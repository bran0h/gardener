<script setup lang="ts">
import type { InvitePreview } from '~/types/plant'

definePageMeta({ layout: 'blank' })

const route = useRoute()
const token = String(route.params.token)
const { preview, accept, select } = useHomes()
const { push } = useToast()

const invite = ref<InvitePreview | null>(null)
const loading = ref(true)
const joining = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    invite.value = await preview(token)
    if (!invite.value) error.value = 'This invite link has expired or was revoked. Ask for a new one.'
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
})

async function join() {
  joining.value = true
  try {
    await accept(token)
    push(`Welcome to ${invite.value?.home_name} 🌿`)
    await navigateTo('/')
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    joining.value = false
  }
}

function open() {
  if (invite.value) select(invite.value.home_id)
  navigateTo('/')
}
</script>

<template>
  <div class="card tape w-full max-w-sm px-6! py-8! text-center">
    <div class="flex items-end justify-center -space-x-3">
      <PlantDoodle kind="hanging" class="size-16 -rotate-6" />
      <PlantDoodle kind="tree" class="size-24" />
      <PlantDoodle kind="herb" class="size-16 rotate-6" />
    </div>

    <p v-if="loading" class="mt-4 text-ink-soft">
      Opening the invite…
    </p>

    <template v-else-if="invite && !error">
      <p class="mt-3 text-lg text-ink-soft">
        {{ invite.invited_by || 'Someone' }} invited you to
      </p>
      <h1 class="squiggle mx-auto mt-1 inline-block text-5xl">
        {{ invite.home_name }}
      </h1>
      <p class="mt-3 text-ink-soft">
        You'll see the same plants, can water them, and get the morning reminders.
      </p>
      <button v-if="!invite.already_member" type="button" class="btn btn-leaf mt-6 w-full text-xl!" :disabled="joining" @click="join">
        {{ joining ? 'Joining…' : 'Join this home' }}
      </button>
      <template v-else>
        <p class="mt-6">
          You're already in this home.
        </p>
        <button type="button" class="btn btn-leaf mt-3 w-full" @click="open">
          Open it
        </button>
      </template>
    </template>

    <template v-else>
      <h1 class="mt-3 text-4xl">
        Hmm…
      </h1>
      <p class="sketch mt-4 bg-rose-light px-3 py-2 text-left" role="alert">
        {{ error }}
      </p>
      <NuxtLink to="/" class="btn mt-4">
        Go to Gardener
      </NuxtLink>
    </template>
  </div>
</template>
