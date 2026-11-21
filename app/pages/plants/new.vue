<script setup lang="ts">
import type { Plant } from '~/types/plant'

const { push } = useToast()

function onSaved(p: Plant) {
  push(`Welcome home, ${p.name}! 🌿`)
  navigateTo(`/plants/${p.id}`)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <NuxtLink to="/" class="text-ink-soft hover:underline">
        ← All plants
      </NuxtLink>
      <h1 class="squiggle mt-1 inline-block text-5xl">
        A new green friend
      </h1>
    </div>
    <PlantForm @saved="onSaved" />
  </div>
</template>
