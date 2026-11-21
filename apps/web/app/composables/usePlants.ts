import type { Database } from '~/types/database'
import type { CareKind, CareLog, Plant, PlantInput } from '~/types/plant'

const PLANTS = 'gardener_plants'
const LOGS = 'gardener_care_logs'
const BUCKET = 'gardener-photos'
const SIGNED_URL_TTL = 60 * 60 * 12

/** Plants of the signed-in user, cached in shared state across pages. */
export function usePlants() {
  const supabase = useSupabaseClient<Database>()
  const plants = useState<Plant[]>('plants', () => [])
  const loaded = useState('plants-loaded', () => false)
  const photoUrls = useState<Record<string, string>>('plant-photo-urls', () => ({}))

  function upsertLocal(p: Plant) {
    const rest = plants.value.filter(x => x.id !== p.id)
    plants.value = [...rest, p].sort((a, b) => a.name.localeCompare(b.name))
  }

  async function signPhotos(list: Plant[]) {
    const paths = list
      .map(p => p.photo_path)
      .filter((p): p is string => !!p && !photoUrls.value[p])
    if (!paths.length) return
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
    const next = { ...photoUrls.value }
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) next[item.path] = item.signedUrl
    }
    photoUrls.value = next
  }

  function photoUrl(p: Plant | null | undefined): string | null {
    return p?.photo_path ? photoUrls.value[p.photo_path] ?? null : null
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
    const { error } = await supabase.from(PLANTS).delete().eq('id', p.id)
    if (error) throw error
    if (p.photo_path) await removePhoto(p.photo_path).catch(() => {})
    plants.value = plants.value.filter(x => x.id !== p.id)
  }

  async function uploadPhoto(file: File): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user.id
    if (!uid) throw new Error('Not signed in.')
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

  /** Records care for one or more plants. The database moves last_watered_at / last_fertilized_at. */
  async function logCare(plantIds: string[], kind: CareKind, opts: { note?: string | null, doneAt?: string } = {}) {
    if (!plantIds.length) return
    const doneAt = opts.doneAt ?? new Date().toISOString()
    const rows = plantIds.map(plant_id => ({ plant_id, kind, note: opts.note || null, done_at: doneAt }))
    const { error } = await supabase.from(LOGS).insert(rows)
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

  function clear() {
    plants.value = []
    loaded.value = false
    photoUrls.value = {}
  }

  return {
    plants,
    loaded,
    refresh,
    ensureLoaded,
    fetchPlant,
    savePlant,
    deletePlant,
    uploadPhoto,
    removePhoto,
    photoUrl,
    logCare,
    listLogs,
    deleteLog,
    clear
  }
}
