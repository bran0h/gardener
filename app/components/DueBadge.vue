<script setup lang="ts">
const props = withDefaults(defineProps<{ days: number | null, kind?: 'water' | 'fertilize' }>(), { kind: 'water' })

const state = computed(() => dueState(props.days))
const tone = computed(() => ({
  late: 'bg-rose-light',
  today: props.kind === 'water' ? 'bg-water-light' : 'bg-leaf-light',
  soon: 'bg-sun-light',
  ok: 'bg-white',
  none: 'bg-paper text-ink-soft'
})[state.value])
</script>

<template>
  <span class="chip" :class="tone">
    <CareIcon :kind="kind" class="size-4!" />
    <span>{{ dueLabel(days) }}</span>
  </span>
</template>
