<script setup lang="ts">
const props = defineProps<{ days: number | null }>()

const state = computed(() => dueState(props.days))
const tone = computed(() => ({
  late: 'bg-rose-light',
  today: 'bg-water-light',
  soon: 'bg-sun-light',
  ok: 'bg-white',
  none: 'bg-paper text-ink-soft'
})[state.value])
</script>

<template>
  <span class="chip" :class="tone">
    <CareIcon kind="water" class="size-4!" />
    <span>{{ dueLabel(days) }}</span>
  </span>
</template>
