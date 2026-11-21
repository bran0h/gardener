<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const user = useSupabaseUser()
const redirect = useSupabaseCookieRedirect()
watch(user, (u) => {
  if (u) navigateTo(redirect.pluck() || '/')
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col items-center gap-2 text-ink-soft">
    <PlantDoodle kind="herb" class="size-20 animate-pulse" />
    <p class="text-xl">
      {{ $t('login.signingIn') }}
    </p>
  </div>
</template>
