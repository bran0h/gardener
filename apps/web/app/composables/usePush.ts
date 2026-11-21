import type { Database } from '~/types/database'

export type PushState =
  | 'loading'
  | 'unsupported' // this browser cannot do web push at all
  | 'needs-install' // iPhone/iPad: only works from the Home Screen app
  | 'denied' // the person blocked notifications for this site
  | 'off'
  | 'on'

const TABLE = 'gardener_push_subscriptions'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * Morning reminders through Web Push. The browser stores its subscription in
 * Supabase (RLS: own rows only); the Adonis API (apps/api) reads them and
 * sends each device its summary at the chosen hour.
 */
export function usePush() {
  const supabase = useSupabaseClient<Database>()
  const apiUrl = useRuntimeConfig().public.apiUrl.replace(/\/$/, '')
  const state = useState<PushState>('push-state', () => 'loading')
  const hour = useState<number>('push-hour', () => 8)
  const i18n = useNuxtApp().$i18n
  const locale = () => (i18n.locale.value === 'sk' ? 'sk' : 'en') as 'en' | 'sk'

  async function registration() {
    return (await navigator.serviceWorker.getRegistration('/'))
      ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
  }

  async function save(sub: PushSubscription) {
    const json = sub.toJSON()
    const { data, error } = await supabase
      .from(TABLE)
      .upsert({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: locale(),
        user_agent: navigator.userAgent.slice(0, 300)
      }, { onConflict: 'endpoint' })
      .select('remind_hour')
      .single()
    if (error) throw error
    hour.value = data.remind_hour
  }

  async function refresh() {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported) {
      state.value = isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
      return
    }
    if (Notification.permission === 'denied') {
      state.value = 'denied'
      return
    }
    const sub = await (await registration()).pushManager.getSubscription()
    if (!sub) {
      state.value = 'off'
      return
    }
    // Keeps the row (and the device's timezone) current; restores it if it was removed.
    await save(sub).catch(() => {})
    state.value = 'on'
  }

  /** Must run straight from a tap: iOS only shows the permission prompt then. */
  async function enable() {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      state.value = permission === 'denied' ? 'denied' : 'off'
      return
    }
    const { publicKey } = await $fetch<{ publicKey: string }>(`${apiUrl}/push/key`)
    const reg = await registration()
    await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      }))
    await save(sub)
    state.value = 'on'
  }

  async function disable() {
    const sub = await (await registration()).pushManager.getSubscription()
    if (sub) {
      await supabase.from(TABLE).delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
    state.value = 'off'
  }

  async function setHour(h: number) {
    const sub = await (await registration()).pushManager.getSubscription()
    if (!sub) return
    const { error } = await supabase.from(TABLE).update({ remind_hour: h }).eq('endpoint', sub.endpoint)
    if (error) throw error
    hour.value = h
  }

  /** The language reminders arrive in on this device. */
  async function syncLocale(code: 'en' | 'sk') {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await supabase.from(TABLE).update({ locale: code }).eq('endpoint', sub.endpoint)
  }

  /** Asks the API to send today's summary (or a hello) to this device now. */
  async function test() {
    const sub = await (await registration()).pushManager.getSubscription()
    const { data: { session } } = await supabase.auth.getSession()
    if (!sub || !session) throw new Error('errors.turnOnFirst')
    return await $fetch<{ devices: number, sent: number }>(`${apiUrl}/push/test`, {
      method: 'POST',
      headers: { authorization: `Bearer ${session.access_token}` },
      body: { endpoint: sub.endpoint }
    })
  }

  return { state, hour, refresh, enable, disable, setHour, test, syncLocale }
}
