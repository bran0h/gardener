<script setup lang="ts">
// Keep <html lang> in step with the chosen language (screen readers, Safari translate).
const { locale, locales } = useI18n()
useHead({
  htmlAttrs: {
    lang: () => (locales.value as { code: string, language?: string }[]).find(l => l.code === locale.value)?.language ?? 'en'
  }
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <AppToaster />
  <ConfirmDialog />

  <!-- Shared filter that makes every doodle look drawn by hand. -->
  <svg width="0" height="0" class="absolute" aria-hidden="true">
    <filter id="wobble" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>
</template>
