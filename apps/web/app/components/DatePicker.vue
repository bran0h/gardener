<script setup lang="ts">
/**
 * A hand-drawn date picker. v-model is a yyyy-mm-dd string ('' when empty),
 * the same format as <input type="date">. Weeks start on Monday.
 */
const props = withDefaults(defineProps<{
  modelValue: string
  max?: string
  min?: string
  placeholder?: string
  clearable?: boolean
  quick?: boolean
  id?: string
  ariaLabel?: string
}>(), {
  max: undefined,
  min: undefined,
  placeholder: 'Pick a day',
  clearable: false,
  quick: true,
  id: undefined,
  ariaLabel: undefined
})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function parse(s?: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const todayKey = keyOf(new Date())
const yesterdayKey = keyOf(addDays(new Date(), -1))

const selected = computed(() => parse(props.modelValue))
const maxKey = computed(() => props.max ?? '')
const minKey = computed(() => props.min ?? '')
const disabledKey = (key: string) => (!!maxKey.value && key > maxKey.value) || (!!minKey.value && key < minKey.value)

const label = computed(() => {
  if (!selected.value) return ''
  const text = selected.value.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  if (props.modelValue === todayKey) return `${text} · today`
  if (props.modelValue === yesterdayKey) return `${text} · yesterday`
  return text
})

const open = ref(false)
const view = ref<'days' | 'months'>('days')
const cursor = ref(new Date()) // first day of the month being shown
const focusKey = ref(todayKey)
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()

const weekdays = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)
)
const monthNames = Array.from({ length: 12 }, (_, i) =>
  new Date(2024, i, 1).toLocaleDateString(undefined, { month: 'short' })
)
const monthTitle = computed(() =>
  cursor.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
)

const days = computed(() => {
  const first = cursor.value
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(start, i)
    const key = keyOf(d)
    return {
      key,
      day: d.getDate(),
      inMonth: d.getMonth() === first.getMonth(),
      today: key === todayKey,
      selected: key === props.modelValue,
      disabled: disabledKey(key)
    }
  })
})

function show(d: Date) {
  cursor.value = new Date(d.getFullYear(), d.getMonth(), 1)
}

function initialDay(): Date {
  if (selected.value) return selected.value
  const max = parse(props.max)
  return max && max < new Date() ? max : new Date()
}

async function openPicker() {
  const base = initialDay()
  show(base)
  focusKey.value = keyOf(base)
  view.value = 'days'
  open.value = true
  await nextTick()
  focusDay()
}

function close(returnFocus = true) {
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

function focusDay() {
  panel.value?.querySelector<HTMLButtonElement>(`[data-key="${focusKey.value}"]`)?.focus()
}

function pick(key: string) {
  if (disabledKey(key)) return
  emit('update:modelValue', key)
  close()
}

function moveMonth(n: number) {
  show(new Date(cursor.value.getFullYear(), cursor.value.getMonth() + n, 1))
  const f = parse(focusKey.value)!
  const last = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 0).getDate()
  focusKey.value = keyOf(new Date(cursor.value.getFullYear(), cursor.value.getMonth(), Math.min(f.getDate(), last)))
}

const canNext = computed(() => {
  if (!maxKey.value) return true
  const next = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1)
  return keyOf(next) <= maxKey.value
})

function onGridKey(e: KeyboardEvent) {
  const f = parse(focusKey.value)
  if (!f) return
  const moves: Record<string, () => Date> = {
    ArrowLeft: () => addDays(f, -1),
    ArrowRight: () => addDays(f, 1),
    ArrowUp: () => addDays(f, -7),
    ArrowDown: () => addDays(f, 7),
    Home: () => addDays(f, -((f.getDay() + 6) % 7)),
    End: () => addDays(f, 6 - ((f.getDay() + 6) % 7)),
    PageUp: () => new Date(f.getFullYear(), f.getMonth() - 1, f.getDate()),
    PageDown: () => new Date(f.getFullYear(), f.getMonth() + 1, f.getDate())
  }
  const move = moves[e.key]
  if (!move) return
  e.preventDefault()
  const next = move()
  focusKey.value = keyOf(next)
  if (next.getMonth() !== cursor.value.getMonth() || next.getFullYear() !== cursor.value.getFullYear()) show(next)
  nextTick(focusDay)
}

function pickMonth(m: number) {
  show(new Date(cursor.value.getFullYear(), m, 1))
  view.value = 'days'
  const f = parse(focusKey.value)!
  const last = new Date(cursor.value.getFullYear(), m + 1, 0).getDate()
  focusKey.value = keyOf(new Date(cursor.value.getFullYear(), m, Math.min(f.getDate(), last)))
  nextTick(focusDay)
}

const monthDisabled = (m: number) => {
  const firstKey = keyOf(new Date(cursor.value.getFullYear(), m, 1))
  const lastKey = keyOf(new Date(cursor.value.getFullYear(), m + 1, 0))
  return (!!maxKey.value && firstKey > maxKey.value) || (!!minKey.value && lastKey < minKey.value)
}

function onOutside(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close(false)
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>

<template>
  <div ref="root" class="relative" @keydown.esc.stop="open && close()">
    <button
      :id="id"
      ref="trigger"
      type="button"
      class="input flex w-full items-center justify-between gap-3 text-left"
      :aria-label="ariaLabel"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open ? close(false) : openPicker()"
    >
      <span :class="label ? '' : 'text-ink-soft/70'">{{ label || placeholder }}</span>
      <svg viewBox="0 0 24 24" class="size-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path class="fill-sun-light" d="M4 6.5 Q12 5.5 20 6.5 L19.5 20 Q12 20.8 4.5 20 Z" />
        <path d="M4.2 10.5 Q12 9.8 19.8 10.5 M8 4 v4 M16 4 v4" />
        <path d="M8 14 h.01 M12 14 h.01 M16 14 h.01 M8 17 h.01 M12 17 h.01" stroke-width="2.4" />
      </svg>
    </button>

    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-40 bg-ink/25 sm:hidden" aria-hidden="true" @click="close(false)" />
    </Transition>
    <Transition name="fade">
      <div
        v-if="open"
        ref="panel"
        role="dialog"
        aria-modal="false"
        :aria-label="ariaLabel || 'Choose a date'"
        class="card fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 p-3! sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-80"
      >
        <!-- header -->
        <div class="mb-2 flex items-center justify-between gap-1">
          <button
            type="button"
            class="btn btn-ghost btn-sm px-2!"
            :aria-label="view === 'days' ? 'Previous month' : 'Previous year'"
            @click="view === 'days' ? moveMonth(-1) : show(new Date(cursor.getFullYear() - 1, cursor.getMonth(), 1))"
          >
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12.5 Q12 11.5 5.5 12 M10 7 Q7 10 5 12 Q7.5 14.5 10.5 17" /></svg>
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm font-script text-2xl! font-bold"
            :aria-label="view === 'days' ? 'Choose month and year' : 'Back to days'"
            @click="view = view === 'days' ? 'months' : 'days'"
          >
            {{ view === 'days' ? monthTitle : cursor.getFullYear() }}
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm px-2!"
            :aria-label="view === 'days' ? 'Next month' : 'Next year'"
            :disabled="view === 'days' ? !canNext : !!max && cursor.getFullYear() >= Number(max.slice(0, 4))"
            @click="view === 'days' ? moveMonth(1) : show(new Date(cursor.getFullYear() + 1, cursor.getMonth(), 1))"
          >
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11.5 Q12 12.5 18.5 12 M14 7 Q17 10 19 12 Q16.5 14.5 13.5 17" /></svg>
          </button>
        </div>

        <!-- days -->
        <div v-if="view === 'days'">
          <div class="grid grid-cols-7 text-center text-sm text-ink-soft">
            <span v-for="w in weekdays" :key="w" class="py-1">{{ w }}</span>
          </div>
          <div class="grid grid-cols-7 gap-y-0.5" role="grid" @keydown="onGridKey">
            <button
              v-for="d in days"
              :key="d.key"
              type="button"
              role="gridcell"
              :data-key="d.key"
              :tabindex="d.key === focusKey ? 0 : -1"
              :disabled="d.disabled"
              :aria-selected="d.selected"
              :aria-current="d.today ? 'date' : undefined"
              :aria-label="parse(d.key)!.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })"
              class="relative mx-auto flex size-10 items-center justify-center text-lg transition focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-25"
              :class="[
                d.selected ? 'sketch bg-leaf font-bold text-white shadow-sketch-sm' : 'rounded-full hover:bg-leaf-light',
                !d.inMonth && !d.selected ? 'text-ink-soft/50' : ''
              ]"
              @click="pick(d.key)"
              @focus="focusKey = d.key"
            >
              <svg
                v-if="d.today && !d.selected"
                viewBox="0 0 40 40"
                class="pointer-events-none absolute inset-0 size-full text-clay"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M31 9 C26 4 12 4 7 12 C2 21 8 33 20 34 C31 35 37 26 35 17 C34 12 30 8 24 7" />
              </svg>
              <span class="relative">{{ d.day }}</span>
            </button>
          </div>
        </div>

        <!-- months -->
        <div v-else class="grid grid-cols-3 gap-2 py-1">
          <button
            v-for="(m, i) in monthNames"
            :key="m"
            type="button"
            class="btn btn-sm"
            :class="i === cursor.getMonth() ? 'btn-sun' : ''"
            :disabled="monthDisabled(i)"
            @click="pickMonth(i)"
          >
            {{ m }}
          </button>
        </div>

        <!-- footer -->
        <div v-if="quick || clearable" class="mt-3 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-ink/15 pt-3">
          <template v-if="quick">
            <button type="button" class="chip bg-white!" :disabled="disabledKey(todayKey)" @click="pick(todayKey)">
              Today
            </button>
            <button type="button" class="chip bg-white!" :disabled="disabledKey(yesterdayKey)" @click="pick(yesterdayKey)">
              Yesterday
            </button>
          </template>
          <button
            v-if="clearable && modelValue"
            type="button"
            class="chip ml-auto bg-rose-light!"
            @click="emit('update:modelValue', ''); close()"
          >
            Clear
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
