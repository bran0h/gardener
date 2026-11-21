<script setup lang="ts">
import type { Plant } from '~/types/plant'

const props = defineProps<{ plant: Plant, photo: string | null, busy?: boolean }>()
defineEmits<{ water: [] }>()

const waterDays = computed(() => daysUntilDue(props.plant.last_watered_at, props.plant.water_every_days))
</script>

<template>
  <!-- Phones: a row (photo left). From sm up: a card (photo on top). -->
  <article
    class="card flex gap-3 p-3! sm:flex-col"
    :style="{ transform: tilt(plant.id, 0.6) }"
  >
    <NuxtLink :to="`/plants/${plant.id}`" class="shrink-0" tabindex="-1" aria-hidden="true">
      <PlantPicture :src="photo" :kind="plant.kind" :alt="plant.name" class="size-24 sm:aspect-square sm:size-auto sm:w-full" />
    </NuxtLink>
    <div class="flex min-w-0 flex-1 flex-col justify-between gap-2">
      <NuxtLink :to="`/plants/${plant.id}`" class="min-w-0 px-1">
        <h3 class="truncate text-3xl">
          {{ plant.name }}
        </h3>
        <p v-if="plant.species" class="truncate text-sm text-ink-soft italic">
          {{ plant.species }}
        </p>
      </NuxtLink>
      <div class="flex items-center justify-between gap-2 px-1">
        <DueBadge :days="waterDays" />
        <button
          v-if="plant.water_every_days"
          type="button"
          class="btn btn-water size-8 shrink-0 p-0!"
          :disabled="busy"
          :aria-label="$t('plant.markWatered', { name: plant.name })"
          :title="$t('plant.wateredJustNow')"
          @click="$emit('water')"
        >
          <CareIcon kind="water" />
        </button>
      </div>
    </div>
  </article>
</template>
