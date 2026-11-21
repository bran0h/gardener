<script setup lang="ts">
const { state, hour, refresh, enable, disable, setHour, test } = usePush()
const { push } = useToast()

const open = ref(false)
const busy = ref(false)
const root = ref<HTMLElement>()
const ios = ref(false)

onMounted(() => {
  ios.value = isIOS()
  refresh().catch(() => {
    state.value = 'off'
  })
  document.addEventListener('pointerdown', onOutside)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))

function onOutside(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}

async function run(fn: () => Promise<unknown>, done?: string) {
  busy.value = true
  try {
    await fn()
    if (done) push(done)
  } catch (e) {
    push(errMsg(e), 'rose')
  } finally {
    busy.value = false
  }
}

const hours = Array.from({ length: 24 }, (_, h) => h)
const hourLabel = (h: number) =>
  new Date(2024, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
</script>

<template>
  <div ref="root" class="relative" @keydown.esc="open = false">
    <button
      type="button"
      class="btn btn-ghost btn-sm relative px-2!"
      :aria-expanded="open"
      aria-label="Reminders"
      title="Reminders"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :class="state === 'on' ? 'fill-sun' : 'fill-sun-light'" d="M6 16.5 C6.5 14 6 10 7.5 7.8 C9 5.5 15 5.3 16.6 7.9 C18 10.2 17.4 14 18.2 16.6 Q12 17.6 6 16.5 Z" />
        <path d="M10 19.5 Q12 21 14 19.5 M12 4 v1.6" />
      </svg>
      <span v-if="state === 'on'" class="absolute top-0.5 right-0.5 size-2.5 rounded-full border border-ink bg-leaf" />
    </button>

    <Transition name="fade">
      <div
        v-if="open"
        class="card tape fixed inset-x-3 top-20 z-50 flex flex-col gap-3 p-4! sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-3 sm:w-80"
        role="dialog"
        aria-label="Reminders"
      >
        <h2 class="text-3xl">
          Reminders
        </h2>

        <p v-if="state === 'loading'" class="text-ink-soft">
          Checking…
        </p>

        <template v-else-if="state === 'needs-install'">
          <p>On iPhone, reminders only work from the Home Screen app:</p>
          <ol class="ml-5 list-decimal space-y-1">
            <li>Tap <b>Share</b> <span aria-hidden="true">⬆︎</span> in Safari.</li>
            <li>Choose <b>Add to Home Screen</b>.</li>
            <li>Open Gardener from the Home Screen and come back here.</li>
          </ol>
        </template>

        <p v-else-if="state === 'unsupported'" class="text-ink-soft">
          This browser can't show notifications.
          <template v-if="ios">
            It needs iOS 16.4 or newer.
          </template>
        </p>

        <p v-else-if="state === 'denied'">
          Notifications are blocked for Gardener.
          <template v-if="ios">
            Allow them in <b>Settings → Notifications → Gardener</b>, then reopen the app.
          </template>
          <template v-else>
            Allow them in the site settings of your browser, then reload.
          </template>
        </p>

        <template v-else-if="state === 'off'">
          <p>Get a note every morning when someone is thirsty or hungry.</p>
          <button type="button" class="btn btn-leaf" :disabled="busy" @click="run(enable, 'Reminders are on 🌱')">
            Turn on for this device
          </button>
        </template>

        <template v-else>
          <p class="flex items-center gap-2">
            <span class="size-2.5 rounded-full border border-ink bg-leaf" /> On for this device
          </p>
          <label class="flex flex-wrap items-center gap-2">
            Every morning after
            <select
              class="input w-auto! py-1!"
              :value="hour"
              :disabled="busy"
              @change="run(() => setHour(Number(($event.target as HTMLSelectElement).value)), 'Saved')"
            >
              <option v-for="h in hours" :key="h" :value="h">{{ hourLabel(h) }}</option>
            </select>
          </label>
          <p class="text-sm text-ink-soft">
            Only when someone needs water or food. Nothing to do, no note.
          </p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn btn-sun btn-sm" :disabled="busy" @click="run(test, 'Sent! It should pop up in a moment.')">
              Send a test
            </button>
            <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="run(disable, 'Reminders are off')">
              Turn off
            </button>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>
