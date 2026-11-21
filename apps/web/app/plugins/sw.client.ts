/** Registers the service worker that receives reminders (see public/sw.js). */
export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => {
    console.warn('[gardener] service worker registration failed', e)
  })
})
