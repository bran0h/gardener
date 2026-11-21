<script setup lang="ts">
import { CARE_KINDS, CARE_LABELS, KIND_LABELS, LIGHT_LABELS, type CareKind, type CareLog } from '~/types/plant'

const route = useRoute()
const id = String(route.params.id)
const { plants, fetchPlant, listLogs, logCare, deleteLog, deletePlant, photoUrl } = usePlants()
const { push } = useToast()

const plant = computed(() => plants.value.find(p => p.id === id) ?? null)
const logs = ref<CareLog[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const p = await fetchPlant(id)
    if (!p) {
      error.value = 'This plant does not exist (any more).'
      return
    }
    logs.value = await listLogs(id)
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
})

useHead({ title: () => plant.value ? `${plant.value.name} · Gardener` : 'Gardener' })

const waterDays = computed(() => plant.value && daysUntilDue(plant.value.last_watered_at, plant.value.water_every_days))
const feedDays = computed(() => plant.value && daysUntilDue(plant.value.last_fertilized_at, plant.value.fertilize_every_days))

const busy = ref(false)

async function record(kind: CareKind, note?: string | null, doneAt?: string) {
  busy.value = true
  try {
    await logCare([id], kind, { note, doneAt })
    logs.value = await listLogs(id)
    push(kind === 'note' ? 'Note saved' : `${CARE_LABELS[kind].past} ${plant.value?.name ?? ''}`, kind === 'water' ? 'water' : 'leaf')
    return true
  } catch (e) {
    push(errMsg(e), 'rose')
    return false
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
    push(`Said goodbye to ${name}`)
    await navigateTo('/')
  } catch (e) {
    push(errMsg(e), 'rose')
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <NuxtLink to="/" class="text-ink-soft hover:underline">
      ← All plants
    </NuxtLink>

    <p v-if="error" class="sketch bg-rose-light px-4 py-3" role="alert">
      {{ error }}
    </p>
    <p v-else-if="loading && !plant" class="text-ink-soft">
      Loading…
    </p>

    <template v-else-if="plant">
      <div class="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <!-- picture + facts -->
        <div class="flex flex-col gap-5">
          <div class="card tape -rotate-1">
            <PlantPicture :src="photoUrl(plant)" :kind="plant.kind" :alt="plant.name" class="aspect-square w-full" />
          </div>
          <dl class="card grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rotate-[0.4deg]">
            <dt class="text-ink-soft">
              Kind
            </dt>
            <dd>{{ KIND_LABELS[plant.kind] }}</dd>
            <template v-if="plant.location">
              <dt class="text-ink-soft">
                Lives in
              </dt>
              <dd>{{ plant.location }}</dd>
            </template>
            <template v-if="plant.light">
              <dt class="text-ink-soft">
                Light
              </dt>
              <dd>{{ LIGHT_LABELS[plant.light] }}</dd>
            </template>
            <template v-if="plant.acquired_on">
              <dt class="text-ink-soft">
                With us since
              </dt>
              <dd>{{ new Date(plant.acquired_on).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) }}</dd>
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

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="note">
              <p class="flex items-center gap-2 font-script text-3xl font-bold">
                <CareIcon kind="water" class="size-7!" /> Water
              </p>
              <p v-if="plant.water_every_days" class="mt-1">
                every {{ plant.water_every_days }} days
              </p>
              <p class="text-sm text-ink-soft">
                last: {{ relativeDay(plant.last_watered_at) }}
              </p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <DueBadge :days="waterDays" />
                <button type="button" class="btn btn-water btn-sm" :disabled="busy" @click="record('water')">
                  Watered now
                </button>
              </div>
            </div>
            <div class="note bg-leaf-light!">
              <p class="flex items-center gap-2 font-script text-3xl font-bold">
                <CareIcon kind="fertilize" class="size-7!" /> Feed
              </p>
              <p v-if="plant.fertilize_every_days" class="mt-1">
                every {{ plant.fertilize_every_days }} days
              </p>
              <p class="text-sm text-ink-soft">
                last: {{ relativeDay(plant.last_fertilized_at) }}
              </p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <DueBadge :days="feedDays" kind="fertilize" />
                <button type="button" class="btn btn-sm" :disabled="busy" @click="record('fertilize')">
                  Fed now
                </button>
              </div>
            </div>
          </div>

          <div v-if="plant.notes" class="card -rotate-[0.3deg] whitespace-pre-line">
            {{ plant.notes }}
          </div>

          <div class="flex flex-wrap gap-2">
            <NuxtLink :to="`/plants/${plant.id}/edit`" class="btn">
              Edit
            </NuxtLink>
            <button v-if="!confirmDelete" type="button" class="btn btn-ghost" @click="confirmDelete = true">
              Delete
            </button>
            <template v-else>
              <button type="button" class="btn btn-danger" @click="destroy">
                Yes, delete {{ plant.name }}
              </button>
              <button type="button" class="btn btn-ghost" @click="confirmDelete = false">
                Keep it
              </button>
            </template>
          </div>

          <!-- diary -->
          <section class="flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <h2 class="squiggle text-4xl">
                Diary
              </h2>
              <button type="button" class="btn btn-sun btn-sm" @click="showLog = !showLog">
                {{ showLog ? 'Close' : '+ Add entry' }}
              </button>
            </div>

            <form v-if="showLog" class="card flex flex-col gap-3" @submit.prevent="addLog">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="k in CARE_KINDS"
                  :key="k"
                  type="button"
                  class="chip"
                  :class="logForm.kind === k ? 'bg-sun-light!' : 'bg-white!'"
                  :aria-pressed="logForm.kind === k"
                  @click="logForm.kind = k"
                >
                  <CareIcon :kind="k" class="size-4!" /> {{ CARE_LABELS[k].verb }}
                </button>
              </div>
              <textarea
                v-model="logForm.note"
                rows="2"
                class="input"
                maxlength="1000"
                :placeholder="logForm.kind === 'note' ? 'New leaf unfurling!' : 'Anything to add? (optional)'"
              />
              <div class="flex flex-wrap items-center gap-3">
                <input
                  v-model="logForm.date"
                  type="date"
                  :max="todayInput()"
                  class="input w-auto!"
                  aria-label="Date"
                >
                <button
                  type="submit"
                  class="btn btn-leaf"
                  :disabled="busy || (logForm.kind === 'note' && !logForm.note.trim())"
                >
                  Save
                </button>
              </div>
            </form>

            <p v-if="!logs.length" class="text-ink-soft">
              Nothing written down yet.
            </p>
            <ol v-else class="relative ml-3 flex flex-col gap-3 border-l-2 border-dashed border-ink/30 pl-5">
              <li v-for="log in logs" :key="log.id" class="group relative">
                <span class="sketch absolute top-1 -left-[33px] flex size-6 items-center justify-center bg-paper">
                  <CareIcon :kind="log.kind" class="size-4!" />
                </span>
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p>
                      <span class="font-bold">{{ CARE_LABELS[log.kind].past }}</span>
                      <span class="text-ink-soft"> · {{ formatDay(log.done_at) }}</span>
                    </p>
                    <p v-if="log.note" class="whitespace-pre-line">
                      {{ log.note }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm opacity-60 group-hover:opacity-100"
                    :aria-label="`Remove this ${CARE_LABELS[log.kind].past.toLowerCase()} entry`"
                    title="Remove entry"
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
