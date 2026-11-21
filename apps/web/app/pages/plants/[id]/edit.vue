<script setup lang="ts">
import type { Plant } from '~/types/plant'

const route = useRoute()
const id = String(route.params.id)
const { plants, fetchPlant } = usePlants()
const { push } = useToast()
const { t } = useI18n()

const plant = computed(() => plants.value.find(p => p.id === id) ?? null)
const loading = ref(!plant.value)
const error = ref('')

onMounted(async () => {
  if (plant.value) return
  try {
    if (!await fetchPlant(id)) error.value = t('plant.notFound')
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
})

function onSaved(p: Plant) {
  push(t('plant.saved', { name: p.name }))
  navigateTo(`/plants/${p.id}`)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <NuxtLink :to="`/plants/${id}`" class="text-ink-soft hover:underline">
        {{ $t('plant.back') }}
      </NuxtLink>
      <h1 class="squiggle mt-1 inline-block text-5xl">
        {{ $t('plant.editTitle', { name: plant?.name ?? $t('plant.plantFallback') }) }}
      </h1>
    </div>
    <p v-if="error" class="sketch bg-rose-light px-4 py-3" role="alert">
      {{ error }}
    </p>
    <p v-else-if="loading" class="text-ink-soft">
      {{ $t('common.loading') }}
    </p>
    <PlantForm v-else-if="plant" :key="plant.id" :plant="plant" @saved="onSaved" />
  </div>
</template>
