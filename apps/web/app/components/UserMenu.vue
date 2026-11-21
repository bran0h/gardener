<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const { locale, locales, setLocale } = useI18n()
const { reset } = useAccess()
const { clear } = usePlants()
const { clear: clearHomes } = useHomes()
const { syncLocale } = usePush()

const open = ref(false)
const root = ref<HTMLElement>()

const meta = computed(() => (user.value?.user_metadata ?? {}) as Record<string, string | undefined>)
const displayName = computed(() => meta.value.full_name ?? meta.value.name ?? user.value?.email ?? '')
const avatar = computed(() => meta.value.avatar_url ?? meta.value.picture ?? null)
const languages = computed(() => locales.value as { code: 'en' | 'sk', name?: string }[])

onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))

function onOutside(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}

async function choose(code: 'en' | 'sk') {
  await setLocale(code)
  // Reminders on this device follow the language too.
  syncLocale(code).catch(() => {})
}

async function signOut() {
  open.value = false
  await supabase.auth.signOut()
  reset()
  clear()
  clearHomes()
  await navigateTo('/login')
}
</script>

<template>
  <div ref="root" class="relative" @keydown.esc="open = false">
    <button
      type="button"
      class="btn btn-ghost btn-sm p-1!"
      :aria-expanded="open"
      :aria-label="$t('menu.account')"
      :title="displayName"
      @click="open = !open"
    >
      <img
        v-if="avatar"
        :src="avatar"
        alt=""
        class="sketch size-9 border-[1.5px]! object-cover"
        referrerpolicy="no-referrer"
      >
      <span v-else class="sketch flex size-9 items-center justify-center bg-leaf-light font-script text-xl font-bold">
        {{ displayName.charAt(0).toUpperCase() || '?' }}
      </span>
    </button>

    <Transition name="fade">
      <div
        v-if="open"
        class="card fixed inset-x-3 top-20 z-50 flex flex-col gap-3 p-4! sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-72"
        role="menu"
      >
        <div class="min-w-0">
          <p class="text-sm text-ink-soft">
            {{ $t('menu.signedInAs') }}
          </p>
          <p class="truncate text-lg">
            {{ displayName }}
          </p>
        </div>

        <div class="border-t-2 border-dashed border-ink/15 pt-3">
          <p class="field-label text-2xl!">
            {{ $t('menu.language') }}
          </p>
          <div class="flex gap-2" role="radiogroup" :aria-label="$t('menu.language')">
            <button
              v-for="l in languages"
              :key="l.code"
              type="button"
              role="radio"
              class="btn btn-sm flex-1"
              :class="locale === l.code ? 'btn-sun' : 'opacity-75'"
              :aria-checked="locale === l.code"
              @click="choose(l.code)"
            >
              {{ l.name }}
            </button>
          </div>
        </div>

        <button type="button" role="menuitem" class="btn btn-ghost justify-start! border-t-2! border-dashed! border-ink/15! pt-3" @click="signOut">
          {{ $t('menu.signOut') }}
        </button>
      </div>
    </Transition>
  </div>
</template>
