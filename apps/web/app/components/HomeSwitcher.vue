<script setup lang="ts">
const { homes, current, ensure, select, create } = useHomes()
const { push } = useToast()
const { t } = useI18n()

const open = ref(false)
const adding = ref(false)
const newName = ref('')
const busy = ref(false)
const root = ref<HTMLElement>()
const input = ref<HTMLInputElement>()

onMounted(() => {
  ensure().catch(() => {})
  document.addEventListener('pointerdown', onOutside)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))

function onOutside(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close()
}

function close() {
  open.value = false
  adding.value = false
  newName.value = ''
}

function pick(id: string) {
  select(id)
  close()
  if (useRoute().path !== '/') navigateTo('/')
}

async function startAdding() {
  adding.value = true
  await nextTick()
  input.value?.focus()
}

async function add() {
  const name = newName.value.trim()
  if (!name) return
  busy.value = true
  try {
    await create(name)
    push(t('homes.welcome', { name }))
    close()
    navigateTo('/')
  } catch (e) {
    push(errMsg(e), 'rose')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="current" ref="root" class="relative" @keydown.esc="close">
    <button
      type="button"
      class="chip max-w-40 bg-white! py-0.5 text-base sm:max-w-56"
      :aria-expanded="open"
      :aria-label="$t('homes.switchAria')"
      @click="open ? close() : (open = true)"
    >
      <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path class="fill-clay-light" d="M4 11 L12 4.5 L20 11 L19 20 Q12 20.6 5 20 Z" />
        <path d="M10 20 V14.5 Q12 13.8 14 14.5 V20" />
      </svg>
      <span class="truncate">{{ current.name }}</span>
      <svg viewBox="0 0 24 24" class="size-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 9.5 Q12 15.5 18 9" /></svg>
    </button>

    <Transition name="fade">
      <div
        v-if="open"
        class="card-solid fixed inset-x-3 top-20 z-50 flex flex-col gap-1 p-2! sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:mt-2 sm:w-72"
        role="menu"
      >
        <button
          v-for="h in homes"
          :key="h.id"
          type="button"
          role="menuitemradio"
          :aria-checked="h.id === current.id"
          class="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-lg hover:bg-leaf-light"
          :class="h.id === current.id ? 'font-bold' : ''"
          @click="pick(h.id)"
        >
          <span class="truncate">{{ h.name }}</span>
          <span class="shrink-0 text-sm text-ink-soft">{{ h.id === current.id ? '✓' : h.role === 'owner' ? $t('homes.owner') : '' }}</span>
        </button>

        <div class="my-1 border-t-2 border-dashed border-ink/15" />

        <NuxtLink
          :to="`/homes/${current.id}`"
          role="menuitem"
          class="rounded-lg px-3 py-1.5 text-lg hover:bg-sun-light"
          @click="close"
        >
          {{ $t('homes.settings', { name: current.name }) }}
        </NuxtLink>

        <form v-if="adding" class="flex gap-2 px-1 py-1" @submit.prevent="add">
          <input
            ref="input"
            v-model="newName"
            class="input py-1!"
            :placeholder="$t('homes.newHomePlaceholder')"
            maxlength="60"
            :aria-label="$t('homes.newHomeAria')"
          >
          <button type="submit" class="btn btn-leaf btn-sm" :disabled="busy || !newName.trim()">
            {{ $t('common.add') }}
          </button>
        </form>
        <button v-else type="button" role="menuitem" class="rounded-lg px-3 py-1.5 text-left text-lg hover:bg-leaf-light" @click="startAdding">
          {{ $t('homes.newHome') }}
        </button>
      </div>
    </Transition>
  </div>
</template>
