<script setup lang="ts">
import type { Plant } from '~/types/plant'

const route = useRoute()
const id = String(route.params.id)
const { plants, fetchPlant } = usePlants()
const { push } = useToast()

const plant = computed(() => plants.value.find(p => p.id === id) ?? null)
const loading = ref(!plant.value)
const error = ref('')

onMounted(async () => {
  if (plant.value) return
  try {
    if (!await fetchPlant(id)) error.value = 'This plant does not exist (any more).'
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
})

function onSaved(p: Plant) {
  push(`Saved ${p.name}`)
  navigateTo(`/plants/${p.id}`)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <NuxtLink :to="`/plants/${id}`" class="text-ink-soft hover:underline">
        ← Back
      </NuxtLink>
      <h1 class="squiggle mt-1 inline-block text-5xl">
        Edit {{ plant?.name ?? 'plant' }}
      </h1>
    </div>
    <p v-if="error" class="sketch bg-rose-light px-4 py-3" role="alert">
      {{ error }}
    </p>
    <p v-else-if="loading" class="text-ink-soft">
      Loading…
    </p>
    <PlantForm v-else-if="plant" :key="plant.id" :plant="plant" @saved="onSaved" />
  </div>
</template>
