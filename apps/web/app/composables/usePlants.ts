import type { Database } from '~/types/database'
import type { CareKind, CareLog, Plant, PlantInput, PlantPhoto } from '~/types/plant'

const PLANTS = 'gardener_plants'
const LOGS = 'gardener_care_logs'
const PHOTOS = 'gardener_plant_photos'
const BUCKET = 'gardener-photos'
const SIGNED_URL_TTL = 60 * 60 * 12

/** One live subscription for the whole app (see startLive). */
let liveChannel: ReturnType<ReturnType<typeof useSupabaseClient>['channel']> | null = null

/** Plants of the signed-in user's homes, cached in shared state across pages. */
export function usePlants() {
  const supabase = useSupabaseClient<Database>()
  const plants = useState<Plant[]>('plants', () => [])
  const loaded = useState('plants-loaded', () => false)
  const photoUrls = useState<Record<string, string>>('plant-photo-urls', () => ({}))

  function upsertLocal(p: Plant) {
    const rest = plants.value.filter(x => x.id !== p.id)
    plants.value = [...rest, p].sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Signed URLs for private photos, cached by path. */
  async function signPaths(paths: (string | null | undefined)[]) {
    const todo = [...new Set(paths.filter((p): p is string => !!p && !photoUrls.value[p]))]
    if (!todo.length) return
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(todo, SIGNED_URL_TTL)
    const next = { ...photoUrls.value }
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) next[item.path] = item.signedUrl
    }
    photoUrls.value = next
  }

  const signPhotos = (list: Plant[]) => signPaths(list.map(p => p.photo_path))

  function photoUrl(p: Plant | null | undefined): string | null {
    return p?.photo_path ? photoUrls.value[p.photo_path] ?? null : null
  }

  function pathUrl(path: string): string | null {
    return photoUrls.value[path] ?? null
  }

  async function refresh() {
    const { data, error } = await supabase.from(PLANTS).select('*').order('name')
    if (error) throw error
    plants.value = (data ?? []) as Plant[]
    loaded.value = true
    await signPhotos(plants.value)
  }

  async function ensureLoaded() {
    if (!loaded.value) await refresh()
  }

  async function fetchPlants(ids: string[]) {
    const { data, error } = await supabase.from(PLANTS).select('*').in('id', ids)
    if (error) throw error
    for (const p of (data ?? []) as Plant[]) upsertLocal(p)
    await signPhotos((data ?? []) as Plant[])
  }

  async function fetchPlant(id: string): Promise<Plant | null> {
    const { data, error } = await supabase.from(PLANTS).select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return null
    upsertLocal(data as Plant)
    await signPhotos([data as Plant])
    return data as Plant
  }

  async function savePlant(input: PlantInput, id?: string): Promise<Plant> {
    const query = id
      ? supabase.from(PLANTS).update(input).eq('id', id)
      : supabase.from(PLANTS).insert(input)
    const { data, error } = await query.select().single()
    if (error) throw error
    upsertLocal(data as Plant)
    await signPhotos([data as Plant])
    return data as Plant
  }

  async function deletePlant(p: Plant) {
    // Collect the files first: the timeline rows go with the plant.
    const { data: photos } = await supabase.from(PHOTOS).select('path').eq('plant_id', p.id)
    const paths = [...new Set([p.photo_path, ...(photos ?? []).map(x => x.path)].filter((x): x is string => !!x))]
    const { error } = await supabase.from(PLANTS).delete().eq('id', p.id)
    if (error) throw error
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {})
    plants.value = plants.value.filter(x => x.id !== p.id)
  }

  async function uploadPhoto(file: File): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user.id
    if (!uid) throw new Error('errors.signInFirst')
    const blob = await shrinkImage(file)
    const path = `${uid}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false
    })
    if (error) throw error
    return path
  }

  async function removePhoto(path: string) {
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) throw error
  }

  // Photo timeline -----------------------------------------------------------

  async function listPhotos(plantId: string): Promise<PlantPhoto[]> {
    const { data, error } = await supabase.from(PHOTOS).select('*')
      .eq('plant_id', plantId).order('taken_at', { ascending: false })
    if (error) throw error
    await signPaths(data.map(x => x.path))
    return data
  }

  /** Records an uploaded photo in the plant's timeline. */
  async function addToTimeline(plantId: string, path: string) {
    const { error } = await supabase.from(PHOTOS).insert({ plant_id: plantId, path })
    if (error) throw error
  }

  /** Uploads a new photo, adds it to the timeline and makes it the cover. */
  async function addPhoto(plant: Plant, file: File) {
    const path = await uploadPhoto(file)
    try {
      await addToTimeline(plant.id, path)
      await savePlantFields(plant.id, { photo_path: path })
    } catch (e) {
      await removePhoto(path).catch(() => {})
      throw e
    }
  }

  async function makeCover(plant: Plant, path: string | null) {
    await savePlantFields(plant.id, { photo_path: path })
  }

  /** Removes a photo from the timeline and storage; the next newest becomes the cover. */
  async function deletePhoto(plant: Plant, photo: PlantPhoto) {
    const { error } = await supabase.from(PHOTOS).delete().eq('id', photo.id)
    if (error) throw error
    if (plant.photo_path === photo.path) {
      const { data } = await supabase.from(PHOTOS).select('path')
        .eq('plant_id', plant.id).order('taken_at', { ascending: false }).limit(1)
      await savePlantFields(plant.id, { photo_path: data?.[0]?.path ?? null })
    }
    await removePhoto(photo.path).catch(() => {})
  }

  async function savePlantFields(id: string, fields: Partial<Pick<Plant, 'photo_path'>>) {
    const { data, error } = await supabase.from(PLANTS).update(fields).eq('id', id).select().single()
    if (error) throw error
    upsertLocal(data as Plant)
    await signPhotos([data as Plant])
  }

  // Care ---------------------------------------------------------------------

  /** Records care for one or more plants. The database moves last_watered_at. */
  async function logCare(plantIds: string[], kind: CareKind, opts: { note?: string | null, doneAt?: string } = {}) {
    if (!plantIds.length) return
    const doneAt = opts.doneAt ?? new Date().toISOString()
    const rows = plantIds.map(plant_id => ({ plant_id, kind, note: opts.note || null, done_at: doneAt }))
    const { error } = await supabase.from(LOGS).insert(rows)
    if (error) throw error
    await fetchPlants(plantIds)
  }

  /** "Soil is still wet": not due again before tomorrow; noted in the diary. */
  async function skipToday(plantIds: string[]) {
    if (!plantIds.length) return
    const { error } = await supabase.rpc('gardener_skip_watering', { plant_ids: plantIds, until: tomorrowInput() })
    if (error) throw error
    await fetchPlants(plantIds)
  }

  async function listLogs(plantId: string): Promise<CareLog[]> {
    const { data, error } = await supabase
      .from(LOGS)
      .select('*')
      .eq('plant_id', plantId)
      .order('done_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []) as CareLog[]
  }

  async function deleteLog(log: CareLog) {
    const { error } = await supabase.from(LOGS).delete().eq('id', log.id)
    if (error) throw error
    await fetchPlants([log.plant_id])
  }

  // Live updates ---------------------------------------------------------------

  /**
   * Streams plant changes from everyone in the same homes (Realtime applies each
   * subscriber's RLS), so when someone waters, every open app updates. Idempotent.
   */
  function startLive() {
    if (liveChannel) return
    liveChannel = supabase
      .channel('gardener-plants')
      .on('postgres_changes', { event: '*', schema: 'public', table: PLANTS }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<Plant>).id
          if (id) plants.value = plants.value.filter(p => p.id !== id)
          return
        }
        const p = payload.new as Plant
        upsertLocal(p)
        signPhotos([p]).catch(() => {})
      })
      .subscribe()
  }

  async function stopLive() {
    if (!liveChannel) return
    await supabase.removeChannel(liveChannel)
    liveChannel = null
  }

  /** Calls back on every diary change of one plant; returns the unsubscribe. */
  function watchDiary(plantId: string, onChange: () => void): () => void {
    const channel = supabase
      .channel(`gardener-diary-${plantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: LOGS, filter: `plant_id=eq.${plantId}` }, onChange)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }

  // Homes --------------------------------------------------------------------

  /** Plants of the home that is open (the list holds every home's plants). */
  const homePlants = computed(() => {
    const id = useHomes().current.value?.id
    return id ? plants.value.filter(p => p.home_id === id) : []
  })

  /** After leaving or deleting a home its plants are no longer readable. */
  function forgetHome(homeId: string) {
    plants.value = plants.value.filter(p => p.home_id !== homeId)
  }

  function clear() {
    plants.value = []
    loaded.value = false
    photoUrls.value = {}
    stopLive()
  }

  return {
    plants,
    homePlants,
    forgetHome,
    loaded,
    refresh,
    ensureLoaded,
    fetchPlant,
    savePlant,
    deletePlant,
    uploadPhoto,
    removePhoto,
    photoUrl,
    pathUrl,
    listPhotos,
    addToTimeline,
    addPhoto,
    makeCover,
    deletePhoto,
    logCare,
    skipToday,
    listLogs,
    deleteLog,
    startLive,
    stopLive,
    watchDiary,
    clear
  }
}
