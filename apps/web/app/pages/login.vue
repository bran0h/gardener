<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()
const loading = ref(false)
const error = ref(
  route.query.denied
    ? 'This account has no access to Gardener. Ask for the "gardener" role at auth.hozza.dev.'
    : route.query.error ? `Could not verify access: ${String(route.query.error)}` : ''
)

const redirect = useSupabaseCookieRedirect()
watch(user, (u) => {
  if (u && !route.query.denied && !route.query.error) navigateTo(redirect.pluck() || '/')
}, { immediate: true })

async function loginWithGoogle() {
  loading.value = true
  error.value = ''
  const { error: err } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/confirm` }
  })
  if (err) {
    error.value = err.message
    loading.value = false
  }
}
</script>

<template>
  <div class="card tape w-full max-w-sm px-6! py-8! text-center">
    <div class="flex items-end justify-center -space-x-3">
      <PlantDoodle kind="cactus" class="size-16 -rotate-6" />
      <PlantDoodle kind="leafy" class="size-24" />
      <PlantDoodle kind="flower" class="size-16 rotate-6" />
    </div>
    <h1 class="squiggle mx-auto mt-2 inline-block text-6xl">
      Gardener
    </h1>
    <p class="mt-3 text-lg text-ink-soft">
      Keep the green friends in the flat happy and watered.
    </p>

    <button
      type="button"
      class="btn mt-6 w-full text-lg!"
      :disabled="loading"
      @click="loginWithGoogle"
    >
      <svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z" />
      </svg>
      {{ loading ? 'Off to Google…' : 'Sign in with Google' }}
    </button>

    <p v-if="error" class="sketch mt-4 bg-rose-light px-3 py-2 text-left" role="alert">
      {{ error }}
    </p>
  </div>
</template>
