<script setup lang="ts">
import type { Plant } from '~/types/plant'

const { push } = useToast()
const { t } = useI18n()

function onSaved(p: Plant) {
  push(t('plant.welcome', { name: p.name }))
  navigateTo(`/plants/${p.id}`)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <NuxtLink to="/" class="text-ink-soft hover:underline">
        {{ $t('plant.allPlants') }}
      </NuxtLink>
      <h1 class="squiggle mt-1 inline-block text-5xl">
        {{ $t('plant.newTitle') }}
      </h1>
    </div>
    <PlantForm @saved="onSaved" />
  </div>
</template>
