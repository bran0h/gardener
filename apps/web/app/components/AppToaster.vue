<script setup lang="ts">
const { toasts, dismiss } = useToast()
const tones = { leaf: 'bg-leaf-light', water: 'bg-water-light', rose: 'bg-rose-light' }
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    aria-live="polite"
  >
    <TransitionGroup name="fade">
      <button
        v-for="t in toasts"
        :key="t.id"
        type="button"
        class="sketch shadow-sketch pointer-events-auto px-4 py-1.5 text-lg"
        :class="tones[t.tone]"
        @click="dismiss(t.id)"
      >
        {{ t.text }}
      </button>
    </TransitionGroup>
  </div>
</template>
