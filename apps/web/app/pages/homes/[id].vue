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
const { ask } = useConfirm()
const { t } = useI18n()

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
      error.value = t('homePage.notFound')
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
  await run(() => rename(id, n), t('homePage.renamed'))
  renaming.value = false
}

const displayName = (p: HomePerson) => p.full_name || p.email?.split('@')[0] || t('common.someone')
const expiresIn = (iso: string) => {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
  return days <= 1 ? t('homePage.expiresToday') : t('homePage.expiresIn', { n: days }, days)
}

async function newInvite() {
  const inv = await run(() => createInvite(id))
  if (!inv) return
  invites.value = [inv, ...invites.value]
  await share(inv)
}

async function share(inv: HomeInvite) {
  const url = inviteUrl(inv.token)
  const text = t('homePage.shareText', { home: home.value?.name ?? '' })
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
    push(t('homePage.linkCopied'))
  } catch {
    push(t('homePage.copyFailed'), 'rose')
  }
}

async function revoke(inv: HomeInvite) {
  if (!await ask({ title: t('confirm.revokeTitle'), message: t('confirm.revokeText'), confirm: t('homePage.revoke') })) return
  await run(() => revokeInvite(inv.id), t('homePage.linkRevoked'))
  invites.value = invites.value.filter(i => i.id !== inv.id)
}

async function makeOwner(p: HomePerson) {
  await run(() => setRole(id, p.user_id, 'owner'), t('homePage.nowOwner', { name: displayName(p) }))
  await load()
}

async function stepDown(p: HomePerson) {
  await run(() => setRole(id, p.user_id, 'member'), t('homePage.nowMember'))
  await ensure().then(() => useHomes().refresh())
  await load()
}

async function remove(p: HomePerson) {
  const ok = await ask({
    title: t('confirm.removePersonTitle', { name: displayName(p), home: home.value?.name ?? '' }),
    message: t('confirm.removePersonText'),
    confirm: t('common.remove')
  })
  if (!ok) return
  await run(() => removePerson(id, p.user_id), t('homePage.removed', { name: displayName(p) }))
  await load()
}

const soleOwner = computed(() => isOwner.value && people.value.filter(x => x.role === 'owner').length < 2)

async function leaveHome() {
  const name = home.value?.name ?? ''
  const sure = await ask({
    title: t('confirm.leaveTitle', { name }),
    // A sole owner cannot leave (the database refuses); say why up front.
    message: soleOwner.value ? t('homePage.onlyOwner') : t('confirm.leaveText'),
    confirm: t('confirm.leave')
  })
  if (!sure) return
  const ok = await run(async () => {
    await leave(id)
    return true
  }, t('homePage.left', { name: home.value?.name ?? '' }))
  if (ok) navigateTo('/')
}

async function deleteHome() {
  const n = home.value?.name
  if (!n) return
  const sure = await ask({
    title: t('confirm.deleteHomeTitle', { name: n }),
    message: t('homePage.deleteText', { name: n }),
    confirm: t('homePage.deleteForEveryone'),
    requireText: n
  })
  if (!sure) return
  const ok = await run(async () => {
    await destroy(id)
    return true
  }, t('homePage.deleted', { name: n ?? '' }))
  if (ok) navigateTo('/')
}
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-8">
    <NuxtLink to="/" class="text-ink-soft hover:underline">
      {{ $t('homePage.back') }}
    </NuxtLink>

    <p v-if="error" class="sketch bg-rose-light px-4 py-3" role="alert">
      {{ error }}
    </p>
    <p v-else-if="loading" class="text-ink-soft">
      {{ $t('common.loading') }}
    </p>

    <template v-else-if="home">
      <!-- name -->
      <section>
        <form v-if="renaming" class="flex flex-wrap items-center gap-2" @submit.prevent="saveName">
          <input v-model="name" class="input max-w-sm text-3xl!" maxlength="60" :aria-label="$t('homePage.nameAria')">
          <button type="submit" class="btn btn-leaf" :disabled="busy || !name.trim()">
            {{ $t('common.save') }}
          </button>
          <button type="button" class="btn btn-ghost" @click="renaming = false; name = home.name">
            {{ $t('common.cancel') }}
          </button>
        </form>
        <div v-else class="flex flex-wrap items-end gap-3">
          <h1 class="squiggle text-6xl">
            {{ home.name }}
          </h1>
          <button v-if="isOwner" type="button" class="btn btn-ghost btn-sm mb-2" @click="renaming = true">
            {{ $t('homePage.rename') }}
          </button>
        </div>
        <p class="mt-2 text-ink-soft">
          {{ $t('homePage.shared') }}
        </p>
      </section>

      <!-- people -->
      <section class="card flex flex-col gap-3">
        <h2 class="text-4xl">
          {{ $t('homePage.people') }}
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
                {{ displayName(p) }}<span v-if="p.user_id === me" class="text-ink-soft"> ({{ $t('common.you') }})</span>
              </p>
              <p class="truncate text-sm text-ink-soft">
                {{ p.email }}
              </p>
            </div>
            <span class="chip" :class="p.role === 'owner' ? 'bg-sun-light!' : 'bg-white!'">{{ $t(`homes.${p.role}`) }}</span>

            <div v-if="isOwner && p.user_id !== me" class="flex w-full justify-end gap-2 sm:w-auto">
              <button
                v-if="p.role === 'member'"
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="busy"
                @click="makeOwner(p)"
              >
                {{ $t('homePage.makeOwner') }}
              </button>
              <button type="button" class="btn btn-danger btn-sm" :disabled="busy" @click="remove(p)">
                {{ $t('common.remove') }}
              </button>
            </div>
            <div v-else-if="isOwner && p.user_id === me && people.filter(x => x.role === 'owner').length > 1" class="flex w-full justify-end sm:w-auto">
              <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="stepDown(p)">
                {{ $t('homePage.stepDown') }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- invites -->
      <section v-if="isOwner" class="note flex flex-col gap-3">
        <h2 class="text-4xl">
          {{ $t('homePage.inviteTitle') }}
        </h2>
        <p>
          {{ $t('homePage.inviteText', { home: home.name }) }}
        </p>
        <div>
          <button type="button" class="btn btn-leaf" :disabled="busy" @click="newInvite">
            {{ $t('homePage.createLink') }}
          </button>
        </div>
        <ul v-if="invites.length" class="flex flex-col gap-2">
          <li v-for="inv in invites" :key="inv.id" class="sketch-alt flex flex-wrap items-center gap-2 bg-white px-3 py-2">
            <code class="min-w-0 flex-1 truncate text-sm select-all">{{ inviteUrl(inv.token) }}</code>
            <span class="text-sm text-ink-soft">{{ expiresIn(inv.expires_at) }}</span>
            <button type="button" class="btn btn-sm" @click="share(inv)">
              {{ $t('homePage.share') }}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="revoke(inv)">
              {{ $t('homePage.revoke') }}
            </button>
          </li>
        </ul>
      </section>
      <p v-else class="text-ink-soft">
        {{ $t('homePage.askOwner') }}
      </p>

      <!-- leave / delete -->
      <section class="flex flex-col gap-3">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn" :disabled="busy" @click="leaveHome">
            {{ $t('homePage.leave', { name: home.name }) }}
          </button>
          <button v-if="isOwner" type="button" class="btn btn-danger" :disabled="busy" @click="deleteHome">
            {{ $t('homePage.deleteSummary') }}
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
