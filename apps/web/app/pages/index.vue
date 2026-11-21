<script setup lang="ts">
import type { CareKind, Plant } from '~/types/plant'

const { homePlants: plants, loaded: plantsLoaded, refresh, logCare, photoUrl } = usePlants()
const { ensure: ensureHomes, current: home, homes } = useHomes()
const loaded = computed(() => plantsLoaded.value && !!home.value)
const { push } = useToast()
const user = useSupabaseUser()
const { t } = useI18n()
const { date, dueLabel } = useFormat()

const error = ref('')
onMounted(async () => {
  try {
    await Promise.all([ensureHomes(), refresh()])
  } catch (e) {
    error.value = errMsg(e)
  }
})

const firstName = computed(() => {
  const meta = (user.value?.user_metadata ?? {}) as Record<string, string | undefined>
  return (meta.full_name ?? meta.name ?? '').split(' ')[0]
})

const greeting = computed(() => {
  const h = new Date().getHours()
  const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  const g = t(`dashboard.greeting.${part}`)
  return firstName.value ? t('dashboard.greetingName', { greeting: g, name: firstName.value }) : t('dashboard.greetingOnly', { greeting: g })
})

const today = computed(() => date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }))

interface Due { plant: Plant, days: number }

const thirsty = computed(() =>
  plants.value
    .map(plant => ({ plant, days: daysUntilDue(plant.last_watered_at, plant.water_every_days) }))
    .filter((x): x is Due => x.days !== null && x.days <= 0)
    .sort((a, b) => a.days - b.days)
)

const search = ref('')
const room = ref<string | null>(null)
/** Group key for plants without a room; shown as "Somewhere in the flat". */
const NO_ROOM = ''

const rooms = computed(() =>
  [...new Set(plants.value.map(p => p.location).filter((x): x is string => !!x))].sort()
)

const groups = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = plants.value.filter(p =>
    (!room.value || p.location === room.value)
    && (!q || p.name.toLowerCase().includes(q) || p.species?.toLowerCase().includes(q))
  )
  const map = new Map<string, Plant[]>()
  for (const p of list) {
    const key = p.location ?? NO_ROOM
    map.set(key, [...(map.get(key) ?? []), p])
  }
  return [...map.entries()].sort(([a], [b]) =>
    a === NO_ROOM ? 1 : b === NO_ROOM ? -1 : a.localeCompare(b)
  )
})

const busy = ref(new Set<string>())

async function care(list: Plant[], kind: CareKind) {
  const ids = list.map(p => p.id)
  ids.forEach(id => busy.value.add(id))
  try {
    await logCare(ids, kind)
    const what = list.length === 1 ? list[0]!.name : t('dashboard.nPlants', { n: list.length }, list.length)
    push(t('dashboard.watered', { what }), 'water')
  } catch (e) {
    push(errMsg(e), 'rose')
  } finally {
    ids.forEach(id => busy.value.delete(id))
  }
}
</script>

<template>
  <div class="flex flex-col gap-10">
    <section>
      <p class="text-lg text-ink-soft">
        {{ today }}<template v-if="homes.length > 1 && home">
          · {{ home.name }}
        </template>
      </p>
      <h1 class="text-5xl sm:text-6xl">
        {{ greeting }}
      </h1>
    </section>

    <p v-if="error" class="sketch bg-rose-light px-4 py-3" role="alert">
      {{ $t('dashboard.loadError', { error }) }}
    </p>

    <div v-if="!loaded && !error" class="flex flex-col items-center gap-2 py-16 text-ink-soft">
      <PlantDoodle kind="succulent" class="size-20 animate-pulse" />
      <p>{{ $t('dashboard.counting') }}</p>
    </div>

    <!-- empty -->
    <section v-else-if="loaded && !plants.length" class="card tape mx-auto flex max-w-md flex-col items-center gap-4 px-8! py-10! text-center">
      <div class="flex items-end -space-x-2">
        <PlantDoodle kind="hanging" class="size-20 -rotate-3" />
        <PlantDoodle kind="tree" class="size-24 rotate-2" />
      </div>
      <h2 class="text-4xl">
        {{ $t('dashboard.emptyTitle') }}
      </h2>
      <p class="text-ink-soft">
        {{ $t('dashboard.emptyText', { home: home?.name }) }}
      </p>
      <NuxtLink to="/plants/new" class="btn btn-leaf text-xl!">
        {{ $t('dashboard.addPlant') }}
      </NuxtLink>
    </section>

    <template v-else-if="loaded">
      <!-- today -->
      <section class="max-w-3xl">
        <div class="note -rotate-[0.4deg]">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 class="flex items-center gap-2 text-4xl">
              <CareIcon kind="water" class="size-8!" /> {{ $t('dashboard.thirstyToday') }}
            </h2>
            <button
              v-if="thirsty.length > 1"
              type="button"
              class="btn btn-water btn-sm"
              @click="care(thirsty.map(x => x.plant), 'water')"
            >
              {{ $t('dashboard.wateredAll', { n: thirsty.length }) }}
            </button>
          </div>
          <p v-if="!thirsty.length" class="text-lg text-balance">
            {{ $t('dashboard.nothingToDo') }}&nbsp;☀️
          </p>
          <ul v-else class="flex flex-col divide-y-2 divide-dashed divide-ink/20">
            <li v-for="x in thirsty" :key="x.plant.id" class="flex items-center gap-3 py-2">
              <PlantPicture :src="photoUrl(x.plant)" :kind="x.plant.kind" :alt="x.plant.name" class="size-12 shrink-0" />
              <NuxtLink :to="`/plants/${x.plant.id}`" class="min-w-0 flex-1">
                <span class="block truncate font-script text-2xl font-bold">{{ x.plant.name }}</span>
                <span class="block truncate text-sm text-ink-soft">
                  {{ x.plant.location ?? $t('dashboard.somewhere') }} · {{ dueLabel(x.days) }}
                </span>
              </NuxtLink>
              <button
                type="button"
                class="btn btn-water btn-sm"
                :disabled="busy.has(x.plant.id)"
                @click="care([x.plant], 'water')"
              >
                <CareIcon kind="water" /> {{ $t('dashboard.done') }}
              </button>
            </li>
          </ul>
        </div>
      </section>

      <!-- all plants -->
      <section class="flex flex-col gap-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 class="squiggle self-start text-4xl">
            {{ $t('dashboard.allPlants') }} <span class="text-2xl text-ink-soft">({{ plants.length }})</span>
          </h2>
          <input
            v-model="search"
            type="search"
            class="input sm:w-64!"
            :placeholder="$t('dashboard.search')"
            :aria-label="$t('dashboard.searchAria')"
          >
        </div>
        <div v-if="rooms.length > 1" class="flex flex-wrap gap-2">
          <button
            type="button"
            class="chip"
            :class="!room ? 'bg-leaf-light!' : 'bg-white!'"
            @click="room = null"
          >
            {{ $t('dashboard.everywhere') }}
          </button>
          <button
            v-for="r in rooms"
            :key="r"
            type="button"
            class="chip"
            :class="room === r ? 'bg-leaf-light!' : 'bg-white!'"
            @click="room = room === r ? null : r"
          >
            {{ r }}
          </button>
        </div>

        <p v-if="!groups.length" class="text-ink-soft">
          {{ $t('dashboard.noMatch') }}
        </p>

        <div v-for="[name, list] in groups" :key="name" class="flex flex-col gap-4">
          <h3 v-if="groups.length > 1 || name !== NO_ROOM" class="text-3xl text-leaf-dark">
            {{ name || $t('dashboard.somewhere') }}
          </h3>
          <!-- Phones: one plant per row. Larger screens: a grid of cards. -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            <PlantCard
              v-for="p in list"
              :key="p.id"
              :plant="p"
              :photo="photoUrl(p)"
              :busy="busy.has(p.id)"
              @water="care([p], 'water')"
            />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
