<script setup lang="ts">
import type { Plant } from '~/types/plant'

const props = defineProps<{ plant: Plant, photo: string | null, busy?: boolean }>()
defineEmits<{ water: [] }>()

const waterDays = computed(() => daysUntilDue(props.plant.last_watered_at, props.plant.water_every_days))
</script>

<template>
  <article
    class="card group relative flex flex-col gap-3 p-3!"
    :style="{ transform: tilt(plant.id) }"
  >
    <NuxtLink :to="`/plants/${plant.id}`" class="flex flex-col gap-3">
      <PlantPicture :src="photo" :kind="plant.kind" :alt="plant.name" class="aspect-square w-full" />
      <div class="px-1">
        <h3 class="truncate text-3xl">
          {{ plant.name }}
        </h3>
        <p v-if="plant.species" class="truncate text-sm text-ink-soft italic">
          {{ plant.species }}
        </p>
      </div>
    </NuxtLink>
    <div class="mt-auto flex items-center justify-between gap-2 px-1">
      <DueBadge :days="waterDays" />
      <button
        v-if="plant.water_every_days"
        type="button"
        class="btn btn-water btn-sm"
        :disabled="busy"
        :aria-label="`Mark ${plant.name} as watered`"
        title="Watered just now"
        @click="$emit('water')"
      >
        <CareIcon kind="water" />
      </button>
    </div>
  </article>
</template>
