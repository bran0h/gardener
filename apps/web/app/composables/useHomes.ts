import type { Database } from '~/types/database'
import type { Home, HomeInvite, HomePerson, HomeRole, InvitePreview } from '~/types/plant'

const STORAGE_KEY = 'gardener-home'

/** One shared ensure() at a time: the header, page and form all call it on mount. */
let ensuring: Promise<void> | null = null

function remembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode or blocked storage: the choice just is not remembered.
  }
}

/**
 * The homes the signed-in person belongs to, and which one is open.
 * Every rule (who sees, invites, removes) is enforced in the database;
 * this only reads and calls it.
 */
export function useHomes() {
  const supabase = useSupabaseClient<Database>()
  const homes = useState<Home[]>('homes', () => [])
  const loaded = useState('homes-loaded', () => false)
  const currentId = useState<string | null>('home-id', () => null)

  const current = computed<Home | null>(() =>
    homes.value.find(h => h.id === currentId.value) ?? homes.value[0] ?? null
  )
  const isOwner = computed(() => current.value?.role === 'owner')

  async function uid(): Promise<string> {
    const { data } = await supabase.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('Not signed in.')
    return id
  }

  async function refresh() {
    const me = await uid()
    const [homesRes, mineRes] = await Promise.all([
      supabase.from('gardener_homes').select('*').order('created_at'),
      supabase.from('gardener_home_members').select('home_id, role').eq('user_id', me)
    ])
    if (homesRes.error) throw homesRes.error
    if (mineRes.error) throw mineRes.error
    const roles = new Map(mineRes.data.map(m => [m.home_id, m.role as HomeRole]))
    homes.value = homesRes.data
      .filter(h => roles.has(h.id))
      .map(h => ({ ...h, role: roles.get(h.id)! }))
    loaded.value = true
    if (!homes.value.some(h => h.id === currentId.value)) {
      const saved = remembered()
      select(homes.value.some(h => h.id === saved) ? saved : homes.value[0]?.id ?? null)
    }
  }

  /**
   * Loads homes once; someone with access but no home yet gets one called
   * "Home". The database function is idempotent too (per-person lock), so even
   * two tabs at once cannot create duplicates.
   */
  function ensure(): Promise<void> {
    ensuring ??= (async () => {
      if (!loaded.value) await refresh()
      if (homes.value.length) return
      const { data, error } = await supabase.rpc('gardener_ensure_home')
      if (error) throw error
      await refresh()
      select(data)
    })().finally(() => {
      ensuring = null
    })
    return ensuring
  }

  function select(id: string | null) {
    currentId.value = id
    remember(id)
  }

  async function create(name: string) {
    const { data, error } = await supabase.rpc('gardener_create_home', { home_name: name })
    if (error) throw error
    await refresh()
    select(data.id)
    return data
  }

  async function rename(id: string, name: string) {
    const { error } = await supabase.from('gardener_homes').update({ name: name.trim() }).eq('id', id)
    if (error) throw error
    homes.value = homes.value.map(h => (h.id === id ? { ...h, name: name.trim() } : h))
  }

  async function destroy(id: string) {
    const { error } = await supabase.from('gardener_homes').delete().eq('id', id)
    if (error) throw error
    await afterLeaving(id)
  }

  async function leave(id: string) {
    const { error } = await supabase.from('gardener_home_members').delete()
      .eq('home_id', id).eq('user_id', await uid())
    if (error) throw error
    await afterLeaving(id)
  }

  async function afterLeaving(id: string) {
    if (currentId.value === id) select(null)
    usePlants().forgetHome(id)
    await refresh()
  }

  async function people(id: string): Promise<HomePerson[]> {
    const { data, error } = await supabase.rpc('gardener_home_people', { home: id })
    if (error) throw error
    return data
  }

  async function setRole(homeId: string, userId: string, role: HomeRole) {
    const { error } = await supabase.from('gardener_home_members').update({ role })
      .eq('home_id', homeId).eq('user_id', userId)
    if (error) throw error
  }

  async function removePerson(homeId: string, userId: string) {
    const { error } = await supabase.from('gardener_home_members').delete()
      .eq('home_id', homeId).eq('user_id', userId)
    if (error) throw error
  }

  async function invites(homeId: string): Promise<HomeInvite[]> {
    const { data, error } = await supabase.from('gardener_home_invites').select('*')
      .eq('home_id', homeId).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
    if (error) throw error
    return data
  }

  async function createInvite(homeId: string): Promise<HomeInvite> {
    const { data, error } = await supabase.from('gardener_home_invites').insert({ home_id: homeId }).select().single()
    if (error) throw error
    return data
  }

  async function revokeInvite(id: string) {
    const { error } = await supabase.from('gardener_home_invites').delete().eq('id', id)
    if (error) throw error
  }

  function inviteUrl(token: string) {
    return `${window.location.origin}/invite/${token}`
  }

  async function preview(token: string): Promise<InvitePreview | null> {
    const { data, error } = await supabase.rpc('gardener_invite_preview', { invite_token: token })
    if (error) throw error
    return data[0] ?? null
  }

  /** Joins the home and gets the gardener role; returns the home id. */
  async function accept(token: string): Promise<string> {
    const { data, error } = await supabase.rpc('gardener_accept_invite', { invite_token: token })
    if (error) throw error
    useAccess().reset()
    loaded.value = false
    await refresh()
    select(data)
    return data
  }

  function clear() {
    homes.value = []
    loaded.value = false
    currentId.value = null
  }

  return {
    homes, loaded, current, currentId, isOwner,
    refresh, ensure, select, create, rename, destroy, leave,
    people, setRole, removePerson,
    invites, createInvite, revokeInvite, inviteUrl,
    preview, accept, clear
  }
}
