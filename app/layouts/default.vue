<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const { reset } = useAccess()
const { clear } = usePlants()

const meta = computed(() => (user.value?.user_metadata ?? {}) as Record<string, string | undefined>)
const displayName = computed(() => meta.value.full_name ?? meta.value.name ?? user.value?.email ?? '')
const avatar = computed(() => meta.value.avatar_url ?? meta.value.picture ?? null)

async function signOut() {
  await supabase.auth.signOut()
  reset()
  clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-16 sm:px-6">
    <header class="flex items-center justify-between gap-3 py-4 sm:py-6">
      <NuxtLink to="/" class="flex items-center gap-2">
        <PlantDoodle kind="leafy" class="size-12 -rotate-6 text-ink sm:size-14" />
        <span class="font-script text-4xl font-bold sm:text-5xl">Gardener</span>
      </NuxtLink>
      <div class="flex items-center gap-2">
        <NuxtLink to="/plants/new" class="btn btn-leaf hidden sm:inline-flex">
          + New plant
        </NuxtLink>
        <button
          type="button"
          class="btn btn-ghost btn-sm gap-2!"
          :title="`Signed in as ${displayName}. Click to sign out.`"
          @click="signOut"
        >
          <img
            v-if="avatar"
            :src="avatar"
            alt=""
            class="sketch size-8 border-[1.5px]! object-cover"
            referrerpolicy="no-referrer"
          >
          <span>Sign out</span>
        </button>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <!-- Floating add button on phones. -->
    <NuxtLink
      to="/plants/new"
      class="btn btn-leaf fixed right-4 bottom-5 z-40 size-14 p-0! text-3xl! sm:hidden"
      aria-label="New plant"
    >
      +
    </NuxtLink>
  </div>
</template>
