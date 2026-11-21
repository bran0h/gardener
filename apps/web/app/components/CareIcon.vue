<script setup lang="ts">
import type { CareKind } from '~/types/plant'

defineProps<{ kind: CareKind }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="size-5 shrink-0"
  >
    <template v-if="kind === 'water'">
      <path class="fill-water-light" d="M12 3 C8.5 8.5 6 11.5 6 15 a6 6 0 0 0 12 0 C18 11.5 15.5 8.5 12 3 Z" />
      <path d="M9.5 15.5 q.5 2 2.5 2.5" />
    </template>
    <template v-else-if="kind === 'fertilize'">
      <path d="M12 21 L12 11" />
      <path class="fill-leaf-light" d="M12 13 C8 13 5 10 5 6 C9 6 12 9 12 13 Z" />
      <path class="fill-leaf-light" d="M12 11 C12 7 15 4 19 4 C19 8 16 11 12 11 Z" />
    </template>
    <template v-else-if="kind === 'repot'">
      <path class="fill-clay-light" d="M6 10 H18 L16.5 20 H7.5 Z" />
      <path class="fill-clay" d="M4.5 7 H19.5 V10 H4.5 Z" />
      <path d="M12 7 V3 M12 4 q3 -1 4 1" />
    </template>
    <template v-else-if="kind === 'prune'">
      <circle cx="7" cy="17" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M9 15 L18 4 M15 15 L6 4" />
    </template>
    <template v-else-if="kind === 'mist'">
      <path class="fill-water-light" d="M7 10 H13 V21 H7 Z" />
      <path d="M8 10 V7 H12 V10 M12 7 H14" />
      <path d="M17 6 h.01 M20 4 h.01 M20 8 h.01 M17.5 10 h.01" stroke-width="2.6" />
    </template>
    <template v-else>
      <path class="fill-sun-light" d="M4 20 L5 15 L16 4 L20 8 L9 19 Z" />
      <path d="M14 6 L18 10" />
    </template>
  </svg>
</template>
