const PUBLIC = ['/login', '/confirm']

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC.includes(to.path)) return
  // The Supabase module redirects signed-out visitors; this is the role check.
  if (!useSupabaseUser().value) return
  // Invite links work for anyone signed in: joining is what grants the role.
  if (to.path.startsWith('/invite/')) return

  const { check, reset, lastError } = useAccess()
  const result = await check()
  if (result === 'allowed') return

  // Only a definite "no" signs the user out. A failed lookup is reported instead.
  if (result === 'denied') {
    await useSupabaseClient().auth.signOut()
    reset()
    return navigateTo({ path: '/login', query: { denied: '1' } })
  }
  return navigateTo({ path: '/login', query: { error: lastError.value || 'check failed' } })
})
