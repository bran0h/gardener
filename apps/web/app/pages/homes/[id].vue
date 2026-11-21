<script setup lang="ts">
import type { HomeInvite, HomePerson } from '~/types/plant'

const route = useRoute()
const id = String(route.params.id)
const {
  homes, ensure, select, rename, destroy, leave,
  people: loadPeople, setRole, removePerson,
  invites: loadInvites, createInvite, revokeInvite, inviteUrl
} = useHomes()
const { push } = useToast()
const user = useSupabaseUser()

const home = computed(() => homes.value.find(h => h.id === id) ?? null)
const isOwner = computed(() => home.value?.role === 'owner')
const me = computed(() => (user.value?.sub ?? '') as string)

const people = ref<HomePerson[]>([])
const invites = ref<HomeInvite[]>([])
const loading = ref(true)
const error = ref('')
const busy = ref(false)

const name = ref('')
const renaming = ref(false)

async function load() {
  people.value = await loadPeople(id)
  invites.value = isOwner.value ? await loadInvites(id) : []
}

onMounted(async () => {
  try {
    await ensure()
    if (!home.value) {
      error.value = "This home doesn't exist, or you're not in it."
      return
    }
    select(id)
    name.value = home.value.name
    await load()
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
})

useHead({ title: () => (home.value ? `${home.value.name} · Gardener` : 'Gardener') })

async function run<T>(fn: () => Promise<T>, done?: string): Promise<T | undefined> {
  busy.value = true
  try {
    const result = await fn()
    if (done) push(done)
    return result
  } catch (e) {
    push(errMsg(e), 'rose')
  } finally {
    busy.value = false
  }
}

async function saveName() {
  const n = name.value.trim()
  if (!n || n === home.value?.name) {
    renaming.value = false
    return
  }
  await run(() => rename(id, n), 'Renamed')
  renaming.value = false
}

const displayName = (p: HomePerson) => p.full_name || p.email?.split('@')[0] || 'Someone'
const expiresIn = (iso: string) => {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
  return days <= 1 ? 'expires today' : `expires in ${days} days`
}

async function newInvite() {
  const inv = await run(() => createInvite(id))
  if (!inv) return
  invites.value = [inv, ...invites.value]
  await share(inv)
}

async function share(inv: HomeInvite) {
  const url = inviteUrl(inv.token)
  const text = `Join "${home.value?.name}" on Gardener so we can look after the plants together 🌱`
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Gardener', text, url })
      return
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
  }
  try {
    await navigator.clipboard.writeText(url)
    push('Invite link copied')
  } catch {
    push('Could not copy. Long-press the link to copy it.', 'rose')
  }
}

async function revoke(inv: HomeInvite) {
  await run(() => revokeInvite(inv.id), 'Link revoked')
  invites.value = invites.value.filter(i => i.id !== inv.id)
}

async function makeOwner(p: HomePerson) {
  await run(() => setRole(id, p.user_id, 'owner'), `${displayName(p)} is now an owner`)
  await load()
}

async function stepDown(p: HomePerson) {
  await run(() => setRole(id, p.user_id, 'member'), 'You are a member now')
  await ensure().then(() => useHomes().refresh())
  await load()
}

const confirmRemove = ref<string | null>(null)
async function remove(p: HomePerson) {
  await run(() => removePerson(id, p.user_id), `${displayName(p)} was removed`)
  confirmRemove.value = null
  await load()
}

const confirmLeave = ref(false)
async function leaveHome() {
  const ok = await run(async () => {
    await leave(id)
    return true
  }, `You left ${home.value?.name}`)
  if (ok) navigateTo('/')
}

const confirmDelete = ref('')
async function deleteHome() {
  const n = home.value?.name
  const ok = await run(async () => {
    await destroy(id)
    return true
  }, `Deleted ${n}`)
  if (ok) navigateTo('/')
}
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-8">
    <NuxtLink to="/" class="text-ink-soft hover:underline">
      ← Plants
    </NuxtLink>

    <p v-if="error" class="sketch bg-rose-light px-4 py-3" role="alert">
      {{ error }}
    </p>
    <p v-else-if="loading" class="text-ink-soft">
      Loading…
    </p>

    <template v-else-if="home">
      <!-- name -->
      <section>
        <form v-if="renaming" class="flex flex-wrap items-center gap-2" @submit.prevent="saveName">
          <input v-model="name" class="input max-w-sm text-3xl!" maxlength="60" aria-label="Home name">
          <button type="submit" class="btn btn-leaf" :disabled="busy || !name.trim()">
            Save
          </button>
          <button type="button" class="btn btn-ghost" @click="renaming = false; name = home.name">
            Cancel
          </button>
        </form>
        <div v-else class="flex flex-wrap items-end gap-3">
          <h1 class="squiggle text-6xl">
            {{ home.name }}
          </h1>
          <button v-if="isOwner" type="button" class="btn btn-ghost btn-sm mb-2" @click="renaming = true">
            Rename
          </button>
        </div>
        <p class="mt-2 text-ink-soft">
          Everyone here sees the same plants, waters them and gets the morning reminders.
        </p>
      </section>

      <!-- people -->
      <section class="card flex flex-col gap-3">
        <h2 class="text-4xl">
          People
        </h2>
        <ul class="flex flex-col divide-y-2 divide-dashed divide-ink/15">
          <li v-for="p in people" :key="p.user_id" class="flex flex-wrap items-center gap-3 py-2">
            <img
              v-if="p.avatar_url"
              :src="p.avatar_url"
              alt=""
              class="sketch size-10 border-[1.5px]! object-cover"
              referrerpolicy="no-referrer"
            >
            <span v-else class="sketch flex size-10 items-center justify-center bg-leaf-light font-script text-xl font-bold">
              {{ displayName(p).charAt(0).toUpperCase() }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-lg">
                {{ displayName(p) }}<span v-if="p.user_id === me" class="text-ink-soft"> (you)</span>
              </p>
              <p class="truncate text-sm text-ink-soft">
                {{ p.email }}
              </p>
            </div>
            <span class="chip" :class="p.role === 'owner' ? 'bg-sun-light!' : 'bg-white!'">{{ p.role }}</span>

            <div v-if="isOwner && p.user_id !== me" class="flex w-full justify-end gap-2 sm:w-auto">
              <button
                v-if="p.role === 'member'"
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="busy"
                @click="makeOwner(p)"
              >
                Make owner
              </button>
              <button
                v-if="confirmRemove !== p.user_id"
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="busy"
                @click="confirmRemove = p.user_id"
              >
                Remove
              </button>
              <template v-else>
                <button type="button" class="btn btn-danger btn-sm" :disabled="busy" @click="remove(p)">
                  Yes, remove
                </button>
                <button type="button" class="btn btn-ghost btn-sm" @click="confirmRemove = null">
                  Keep
                </button>
              </template>
            </div>
            <div v-else-if="isOwner && p.user_id === me && people.filter(x => x.role === 'owner').length > 1" class="flex w-full justify-end sm:w-auto">
              <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="stepDown(p)">
                Step down
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- invites -->
      <section v-if="isOwner" class="note flex flex-col gap-3">
        <h2 class="text-4xl">
          Invite someone
        </h2>
        <p>
          Send a link by message. Whoever opens it and signs in with Google joins
          <b>{{ home.name }}</b>. Links work for 7 days, for anyone you send them to.
        </p>
        <div>
          <button type="button" class="btn btn-leaf" :disabled="busy" @click="newInvite">
            Create invite link
          </button>
        </div>
        <ul v-if="invites.length" class="flex flex-col gap-2">
          <li v-for="inv in invites" :key="inv.id" class="sketch-alt flex flex-wrap items-center gap-2 bg-white px-3 py-2">
            <code class="min-w-0 flex-1 truncate text-sm select-all">{{ inviteUrl(inv.token) }}</code>
            <span class="text-sm text-ink-soft">{{ expiresIn(inv.expires_at) }}</span>
            <button type="button" class="btn btn-sm" @click="share(inv)">
              Share
            </button>
            <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="revoke(inv)">
              Revoke
            </button>
          </li>
        </ul>
      </section>
      <p v-else class="text-ink-soft">
        Want someone else here? Ask an owner to send them an invite link.
      </p>

      <!-- leave / delete -->
      <section class="flex flex-col gap-3">
        <div class="flex flex-wrap gap-2">
          <button v-if="!confirmLeave" type="button" class="btn btn-ghost" @click="confirmLeave = true">
            Leave {{ home.name }}
          </button>
          <template v-else>
            <button type="button" class="btn btn-danger" :disabled="busy" @click="leaveHome">
              Yes, leave
            </button>
            <button type="button" class="btn btn-ghost" @click="confirmLeave = false">
              Stay
            </button>
          </template>
        </div>
        <p v-if="confirmLeave && isOwner && people.filter(x => x.role === 'owner').length < 2" class="text-sm text-ink-soft">
          You're the only owner: make someone else an owner first, or delete the home.
        </p>

        <details v-if="isOwner" class="mt-2">
          <summary class="cursor-pointer text-ink-soft">
            Delete this home…
          </summary>
          <div class="sketch mt-3 flex flex-col gap-2 bg-rose-light/60 p-3">
            <p>
              This deletes <b>{{ home.name }}</b> with all its plants and diaries, for everyone in it.
              Type the name to confirm.
            </p>
            <div class="flex flex-wrap gap-2">
              <input v-model="confirmDelete" class="input max-w-60" :placeholder="home.name" aria-label="Type the home name to confirm">
              <button type="button" class="btn btn-danger" :disabled="busy || confirmDelete.trim() !== home.name" @click="deleteHome">
                Delete for everyone
              </button>
            </div>
          </div>
        </details>
      </section>
    </template>
  </div>
</template>
