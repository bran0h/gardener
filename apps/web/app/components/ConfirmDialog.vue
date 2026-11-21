<script setup lang="ts">
const { state, answer } = useConfirm()

const typed = ref('')
const cancelBtn = ref<HTMLButtonElement>()
const input = ref<HTMLInputElement>()

const canConfirm = computed(() =>
  !state.value?.requireText || typed.value.trim() === state.value.requireText.trim()
)

watch(state, async (s) => {
  typed.value = ''
  if (!s) return
  await nextTick()
  // Safe default: focus "Cancel" (or the text field when typing is required).
  ;(s.requireText ? input.value : cancelBtn.value)?.focus()
})

function confirm() {
  if (canConfirm.value) answer(true)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="state"
        class="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
        @click.self="answer(false)"
        @keydown.esc="answer(false)"
      >
        <div
          class="card-solid tape flex w-full max-w-sm flex-col gap-4 px-5! pt-6! pb-5!"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          :aria-describedby="state.message ? 'confirm-message' : undefined"
        >
          <h2 id="confirm-title" class="text-4xl text-balance">
            {{ state.title }}
          </h2>
          <p v-if="state.message" id="confirm-message" class="text-ink-soft">
            {{ state.message }}
          </p>

          <input
            v-if="state.requireText"
            ref="input"
            v-model="typed"
            class="input"
            :placeholder="state.requireText"
            :aria-label="state.requireText"
            autocomplete="off"
            @keydown.enter.prevent="confirm"
          >

          <div class="flex flex-wrap justify-end gap-2">
            <button ref="cancelBtn" type="button" class="btn btn-ghost" @click="answer(false)">
              {{ $t('common.cancel') }}
            </button>
            <button
              type="button"
              class="btn"
              :class="state.danger ? 'btn-danger' : 'btn-leaf'"
              :disabled="!canConfirm"
              @click="confirm"
            >
              {{ state.confirm }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
