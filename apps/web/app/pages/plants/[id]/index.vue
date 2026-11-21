<script setup lang="ts">
import { LOGGABLE_KINDS, type CareKind, type CareLog } from '~/types/plant'

const route = useRoute()
const id = String(route.params.id)
const { plants, fetchPlant, listLogs, logCare, skipToday, deleteLog, deletePlant, photoUrl, watchDiary } = usePlants()
const { push } = useToast()
const { ensure: ensureHomes, select: selectHome, ensurePeople, firstName, isShared } = useHomes()
const user = useSupabaseUser()
const { t } = useI18n()
const { date, relativeDay, formatDay } = useFormat()

const plant = computed(() => plants.value.find(p => p.id === id) ?? null)

// Who logged what, when more than one person shares the home.
function who(userId: string) {
  const homeId = plant.value?.home_id
  if (!homeId || !isShared(homeId)) return ''
  if (userId === user.value?.sub) return t('common.you')
  return firstName(homeId, userId) ?? t('plant.someoneWhoLeft')
}

// The diary updates live when someone else in the home writes to it.
let stopDiary: (() => void) | null = null
onBeforeUnmount(() => stopDiary?.())
const logs = ref<CareLog[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const p = await fetchPlant(id)
    if (!p) {
      error.value = t('plant.notFound')
      return
    }
    selectHome(p.home_id)
    const [entries] = await Promise.all([
      listLogs(id),
      ensureHomes().then(() => ensurePeople(p.home_id)).catch(() => {})
    ])
    logs.value = entries
    stopDiary = watchDiary(id, () => {
      listLogs(id).then((l) => {
        logs.value = l
      }).catch(() => {})
    })
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
})

useHead({ title: () => plant.value ? `${plant.value.name} · Gardener` : 'Gardener' })

const waterDays = computed(() => plant.value && plantDue(plant.value))

const busy = ref(false)

async function record(kind: CareKind, note?: string | null, doneAt?: string) {
  busy.value = true
  try {
    await logCare([id], kind, { note, doneAt })
    logs.value = await listLogs(id)
    push(kind === 'note' ? t('plant.noteSaved') : t('plant.careDone', { action: t(`care.${kind}.past`), name: plant.value?.name ?? '' }), kind === 'water' ? 'water' : 'leaf')
    return true
  } catch (e) {
    push(errMsg(e), 'rose')
    return false
  } finally {
    busy.value = false
  }
}

async function skip() {
  busy.value = true
  try {
    await skipToday([id])
    logs.value = await listLogs(id)
    push(t('plant.skipped', { name: plant.value?.name ?? '' }))
  } catch (e) {
    push(errMsg(e), 'rose')
  } finally {
    busy.value = false
  }
}

const showLog = ref(false)
const logForm = reactive({ kind: 'note' as CareKind, note: '', date: todayInput() })

async function addLog() {
  if (logForm.kind === 'note' && !logForm.note.trim()) return
  const ok = await record(logForm.kind, logForm.note.trim() || null, inputToIso(logForm.date))
  if (ok) {
    showLog.value = false
    logForm.note = ''
    logForm.kind = 'note'
    logForm.date = todayInput()
  }
}

async function removeLog(log: CareLog) {
  try {
    await deleteLog(log)
    logs.value = logs.value.filter(l => l.id !== log.id)
  } catch (e) {
    push(errMsg(e), 'rose')
  }
}

const confirmDelete = ref(false)
async function destroy() {
  if (!plant.value) return
  const name = plant.value.name
  try {
    await deletePlant(plant.value)
    push(t('plant.goodbye', { name }))
    await navigateTo('/')
  } catch (e) {
    push(errMsg(e), 'rose')
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <NuxtLink to="/" class="text-ink-soft hover:underline">
      {{ $t('plant.allPlants') }}
    </NuxtLink>

    <p v-if="error" class="sketch bg-rose-light px-4 py-3" role="alert">
      {{ error }}
    </p>
    <p v-else-if="loading && !plant" class="text-ink-soft">
      {{ $t('common.loading') }}
    </p>

    <template v-else-if="plant">
      <div class="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <!-- picture + facts -->
        <div class="flex flex-col gap-5">
          <div class="card tape -rotate-1">
            <PlantPicture :src="photoUrl(plant)" :kind="plant.kind" :alt="plant.name" class="aspect-square w-full" />
          </div>
          <PlantPhotos :plant="plant" />
          <dl class="card grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rotate-[0.4deg]">
            <dt class="text-ink-soft">
              {{ $t('plant.kind') }}
            </dt>
            <dd>{{ $t(`kinds.${plant.kind}`) }}</dd>
            <template v-if="plant.location">
              <dt class="text-ink-soft">
                {{ $t('plant.livesIn') }}
              </dt>
              <dd>{{ plant.location }}</dd>
            </template>
            <template v-if="plant.light">
              <dt class="text-ink-soft">
                {{ $t('plant.light') }}
              </dt>
              <dd>{{ $t(`lights.${plant.light}`) }}</dd>
            </template>
            <template v-if="plant.acquired_on">
              <dt class="text-ink-soft">
                {{ $t('plant.withUsSince') }}
              </dt>
              <dd>{{ date(plant.acquired_on, { day: 'numeric', month: 'long', year: 'numeric' }) }}</dd>
            </template>
          </dl>
        </div>

        <!-- name, schedule, actions -->
        <div class="flex flex-col gap-6">
          <div>
            <h1 class="text-6xl break-words">
              {{ plant.name }}
            </h1>
            <p v-if="plant.species" class="text-xl text-ink-soft italic">
              {{ plant.species }}
            </p>
          </div>

          <div class="max-w-sm">
            <div class="note">
              <p class="flex items-center gap-2 font-script text-3xl font-bold">
                <CareIcon kind="water" class="size-7!" /> {{ $t('plant.water') }}
              </p>
              <p v-if="plant.water_every_days" class="mt-1">
                {{ $t('plant.everyDays', { n: plant.water_every_days }, plant.water_every_days) }}
              </p>
              <p class="text-sm text-ink-soft">
                {{ $t('plant.last', { when: relativeDay(plant.last_watered_at) }) }}
              </p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <DueBadge :days="waterDays" />
                <button type="button" class="btn btn-water btn-sm" :disabled="busy" @click="record('water')">
                  {{ $t('plant.wateredNow') }}
                </button>
                <button
                  v-if="plant.water_every_days"
                  type="button"
                  class="btn btn-ghost btn-sm"
                  :disabled="busy"
                  :title="$t('plant.skipHint')"
                  @click="skip"
                >
                  <CareIcon kind="skip" /> {{ $t('plant.skip') }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="plant.notes" class="card -rotate-[0.3deg] whitespace-pre-line">
            {{ plant.notes }}
          </div>

          <div class="flex flex-wrap gap-2">
            <NuxtLink :to="`/plants/${plant.id}/edit`" class="btn">
              {{ $t('common.edit') }}
            </NuxtLink>
            <button v-if="!confirmDelete" type="button" class="btn btn-ghost" @click="confirmDelete = true">
              {{ $t('common.delete') }}
            </button>
            <template v-else>
              <button type="button" class="btn btn-danger" @click="destroy">
                {{ $t('plant.confirmDelete', { name: plant.name }) }}
              </button>
              <button type="button" class="btn btn-ghost" @click="confirmDelete = false">
                {{ $t('plant.keepIt') }}
              </button>
            </template>
          </div>

          <!-- diary -->
          <section class="flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <h2 class="squiggle text-4xl">
                {{ $t('plant.diary') }}
              </h2>
              <button type="button" class="btn btn-sun btn-sm" @click="showLog = !showLog">
                {{ showLog ? $t('common.close') : $t('plant.addEntry') }}
              </button>
            </div>

            <form v-if="showLog" class="card flex flex-col gap-3" @submit.prevent="addLog">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="k in LOGGABLE_KINDS"
                  :key="k"
                  type="button"
                  class="chip"
                  :class="logForm.kind === k ? 'bg-sun-light!' : 'bg-white!'"
                  :aria-pressed="logForm.kind === k"
                  @click="logForm.kind = k"
                >
                  <CareIcon :kind="k" class="size-4!" /> {{ $t(`care.${k}.verb`) }}
                </button>
              </div>
              <textarea
                v-model="logForm.note"
                rows="2"
                class="input"
                maxlength="1000"
                :placeholder="logForm.kind === 'note' ? $t('plant.notePlaceholder') : $t('plant.optionalPlaceholder')"
              />
              <div class="flex flex-wrap items-center gap-3">
                <DatePicker
                  v-model="logForm.date"
                  :max="todayInput()"
                  :aria-label="$t('plant.dateAria')"
                  class="min-w-64 flex-1"
                />
                <button
                  type="submit"
                  class="btn btn-leaf"
                  :disabled="busy || (logForm.kind === 'note' && !logForm.note.trim())"
                >
                  {{ $t('common.save') }}
                </button>
              </div>
            </form>

            <p v-if="!logs.length" class="text-ink-soft">
              {{ $t('plant.nothingYet') }}
            </p>
            <ol v-else class="relative ml-3 flex flex-col gap-3 border-l-2 border-dashed border-ink/30 pl-5">
              <li v-for="log in logs" :key="log.id" class="group relative">
                <span class="sketch absolute top-1 -left-[33px] flex size-6 items-center justify-center bg-paper">
                  <CareIcon :kind="log.kind" class="size-4!" />
                </span>
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p>
                      <span class="font-bold">{{ $t(`care.${log.kind}.past`) }}</span>
                      <span class="text-ink-soft"> · {{ formatDay(log.done_at) }}</span>
                      <span v-if="who(log.user_id)" class="text-ink-soft"> · {{ $t('plant.by', { name: who(log.user_id) }) }}</span>
                    </p>
                    <p v-if="log.note" class="whitespace-pre-line">
                      {{ log.note }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm opacity-60 group-hover:opacity-100"
                    :aria-label="$t('plant.removeEntry')"
                    :title="$t('plant.removeEntry')"
                    @click="removeLog(log)"
                  >
                    ✕
                  </button>
                </div>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
