<script setup lang="ts">
import type { PlantKind } from '~/types/plant'

defineProps<{ src: string | null, kind: PlantKind, alt: string }>()
</script>

<template>
  <div class="sketch-alt relative overflow-hidden bg-paper-dark/60">
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      class="size-full object-cover"
      loading="lazy"
    >
    <PlantDoodle
      v-else
      :kind="kind"
      class="size-full p-[12%] text-ink"
    />
  </div>
</template>
