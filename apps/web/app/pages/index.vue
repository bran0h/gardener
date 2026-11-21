<script setup lang="ts">
import type { CareKind, Plant } from '~/types/plant'

const { homePlants: plants, loaded: plantsLoaded, refresh, logCare, photoUrl } = usePlants()
const { ensure: ensureHomes, current: home, homes } = useHomes()
const loaded = computed(() => plantsLoaded.value && !!home.value)
const { push } = useToast()
const user = useSupabaseUser()

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
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})

const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

interface Due { plant: Plant, days: number }

function dueList(field: 'water' | 'fertilize'): Due[] {
  return plants.value
    .map(plant => ({
      plant,
      days: field === 'water'
        ? daysUntilDue(plant.last_watered_at, plant.water_every_days)
        : daysUntilDue(plant.last_fertilized_at, plant.fertilize_every_days)
    }))
    .filter((x): x is Due => x.days !== null && x.days <= 0)
    .sort((a, b) => a.days - b.days)
}

const thirsty = computed(() => dueList('water'))
const hungry = computed(() => dueList('fertilize'))

const search = ref('')
const room = ref<string | null>(null)
const NO_ROOM = 'Somewhere in the flat'

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
    const what = list.length === 1 ? list[0]!.name : `${list.length} plants`
    push(kind === 'water' ? `Watered ${what} 💧` : `Fed ${what} 🌱`, kind === 'water' ? 'water' : 'leaf')
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
        {{ greeting }}<span v-if="firstName">, {{ firstName }}</span>!
      </h1>
    </section>

    <p v-if="error" class="sketch bg-rose-light px-4 py-3" role="alert">
      Could not load your plants: {{ error }}
    </p>

    <div v-if="!loaded && !error" class="flex flex-col items-center gap-2 py-16 text-ink-soft">
      <PlantDoodle kind="succulent" class="size-20 animate-pulse" />
      <p>Counting leaves…</p>
    </div>

    <!-- empty -->
    <section v-else-if="loaded && !plants.length" class="card tape mx-auto flex max-w-md flex-col items-center gap-4 px-8! py-10! text-center">
      <div class="flex items-end -space-x-2">
        <PlantDoodle kind="hanging" class="size-20 -rotate-3" />
        <PlantDoodle kind="tree" class="size-24 rotate-2" />
      </div>
      <h2 class="text-4xl">
        No plants yet
      </h2>
      <p class="text-ink-soft">
        Add the first green friend to <b>{{ home?.name }}</b> and Gardener will remind you when it gets thirsty.
        Living with someone? Invite them from the home menu at the top.
      </p>
      <NuxtLink to="/plants/new" class="btn btn-leaf text-xl!">
        + Add a plant
      </NuxtLink>
    </section>

    <template v-else-if="loaded">
      <!-- today -->
      <section class="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div class="note -rotate-[0.4deg]">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 class="flex items-center gap-2 text-4xl">
              <CareIcon kind="water" class="size-8!" /> Thirsty today
            </h2>
            <button
              v-if="thirsty.length > 1"
              type="button"
              class="btn btn-water btn-sm"
              @click="care(thirsty.map(t => t.plant), 'water')"
            >
              Watered all {{ thirsty.length }}
            </button>
          </div>
          <p v-if="!thirsty.length" class="text-lg">
            Everyone has had a drink. Nothing to do! ☀️
          </p>
          <ul v-else class="flex flex-col divide-y-2 divide-dashed divide-ink/20">
            <li v-for="t in thirsty" :key="t.plant.id" class="flex items-center gap-3 py-2">
              <PlantPicture :src="photoUrl(t.plant)" :kind="t.plant.kind" :alt="t.plant.name" class="size-12 shrink-0" />
              <NuxtLink :to="`/plants/${t.plant.id}`" class="min-w-0 flex-1">
                <span class="block truncate font-script text-2xl font-bold">{{ t.plant.name }}</span>
                <span class="block truncate text-sm text-ink-soft">
                  {{ t.plant.location ?? NO_ROOM }} · {{ dueLabel(t.days) }}
                </span>
              </NuxtLink>
              <button
                type="button"
                class="btn btn-water btn-sm"
                :disabled="busy.has(t.plant.id)"
                @click="care([t.plant], 'water')"
              >
                <CareIcon kind="water" /> Done
              </button>
            </li>
          </ul>
        </div>

        <div class="card rotate-[0.5deg]">
          <h2 class="mb-3 flex items-center gap-2 text-3xl">
            <CareIcon kind="fertilize" class="size-7!" /> Hungry
          </h2>
          <p v-if="!hungry.length" class="text-ink-soft">
            No one needs feeding right now.
          </p>
          <ul v-else class="flex flex-col gap-2">
            <li v-for="h in hungry" :key="h.plant.id" class="flex items-center justify-between gap-2">
              <NuxtLink :to="`/plants/${h.plant.id}`" class="min-w-0 truncate text-lg">
                {{ h.plant.name }}
                <span class="text-sm text-ink-soft">· {{ dueLabel(h.days) }}</span>
              </NuxtLink>
              <button
                type="button"
                class="btn btn-sm bg-leaf-light!"
                :disabled="busy.has(h.plant.id)"
                @click="care([h.plant], 'fertilize')"
              >
                Fed
              </button>
            </li>
          </ul>
        </div>
      </section>

      <!-- all plants -->
      <section class="flex flex-col gap-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 class="squiggle self-start text-4xl">
            All plants <span class="text-2xl text-ink-soft">({{ plants.length }})</span>
          </h2>
          <input
            v-model="search"
            type="search"
            class="input sm:w-64!"
            placeholder="Find a plant…"
            aria-label="Search plants"
          >
        </div>
        <div v-if="rooms.length > 1" class="flex flex-wrap gap-2">
          <button
            type="button"
            class="chip"
            :class="!room ? 'bg-leaf-light!' : 'bg-white!'"
            @click="room = null"
          >
            Everywhere
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
          No plant matches that.
        </p>

        <div v-for="[name, list] in groups" :key="name" class="flex flex-col gap-4">
          <h3 v-if="groups.length > 1 || name !== NO_ROOM" class="text-3xl text-leaf-dark">
            {{ name }}
          </h3>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
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
