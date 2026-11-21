<script setup lang="ts">
import {
  KIND_LABELS, LIGHT_LABELS, LIGHTS, PLANT_KINDS,
  type Light, type Plant, type PlantInput, type PlantKind
} from '~/types/plant'

const props = defineProps<{ plant?: Plant | null }>()
const emit = defineEmits<{ saved: [plant: Plant] }>()

const { plants, ensureLoaded, savePlant, uploadPhoto, removePhoto, logCare, photoUrl } = usePlants()
onMounted(() => ensureLoaded().catch(() => {}))

const isNew = computed(() => !props.plant)
const p = props.plant

const form = reactive({
  name: p?.name ?? '',
  species: p?.species ?? '',
  kind: (p?.kind ?? 'leafy') as PlantKind,
  location: p?.location ?? '',
  light: (p?.light ?? 'medium') as Light | null,
  water_every_days: (p ? p.water_every_days : 7) as number | string | null,
  fertilize_every_days: (p?.fertilize_every_days ?? null) as number | string | null,
  acquired_on: p?.acquired_on ?? '',
  notes: p?.notes ?? ''
})
const lastWatered = ref(todayInput())

const WATER_PRESETS = [3, 7, 10, 14, 21, 30]
const FEED_PRESETS = [14, 30, 60]

const rooms = computed(() =>
  [...new Set(plants.value.map(x => x.location).filter((x): x is string => !!x))].sort()
)

const photoFile = ref<File | null>(null)
const photoPreview = ref<string | null>(photoUrl(p))
const dropPhoto = ref(false)
let objectUrl: string | null = null

function onPhoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(file)
  photoFile.value = file
  photoPreview.value = objectUrl
  dropPhoto.value = false
}

function clearPhoto() {
  photoFile.value = null
  photoPreview.value = null
  dropPhoto.value = !!p?.photo_path
}

onBeforeUnmount(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
})

function blank(v: string) {
  const t = v.trim()
  return t ? t : null
}

function days(v: number | string | null) {
  if (v === null || v === '') return null
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 1 ? n : null
}

const saving = ref(false)
const error = ref('')

async function submit() {
  if (!form.name.trim()) {
    error.value = 'Every plant deserves a name.'
    return
  }
  saving.value = true
  error.value = ''
  let uploaded: string | null = null
  try {
    let photo_path = p?.photo_path ?? null
    if (photoFile.value) {
      uploaded = await uploadPhoto(photoFile.value)
      photo_path = uploaded
    } else if (dropPhoto.value) {
      photo_path = null
    }

    const input: PlantInput = {
      name: form.name.trim(),
      species: blank(form.species),
      kind: form.kind,
      location: blank(form.location),
      light: form.light,
      water_every_days: days(form.water_every_days),
      fertilize_every_days: days(form.fertilize_every_days),
      acquired_on: form.acquired_on || null,
      notes: blank(form.notes),
      photo_path
    }
    const saved = await savePlant(input, p?.id)
    uploaded = null

    if (p?.photo_path && p.photo_path !== saved.photo_path) {
      await removePhoto(p.photo_path).catch(() => {})
    }
    if (!p && lastWatered.value && saved.water_every_days) {
      await logCare([saved.id], 'water', { doneAt: inputToIso(lastWatered.value) })
    }
    emit('saved', saved)
  } catch (e) {
    if (uploaded) removePhoto(uploaded).catch(() => {})
    error.value = errMsg(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-8" @submit.prevent="submit">
    <!-- left: photo + kind -->
    <div class="flex flex-col gap-5">
      <div class="card tape flex flex-col items-center gap-3">
        <PlantPicture
          :src="photoPreview"
          :kind="form.kind"
          :alt="form.name || 'New plant'"
          class="aspect-square w-full max-w-72"
        />
        <div class="flex flex-wrap justify-center gap-2">
          <label class="btn btn-sun btn-sm">
            <input type="file" accept="image/*" class="sr-only" @change="onPhoto">
            {{ photoPreview ? 'Change photo' : 'Add a photo' }}
          </label>
          <button v-if="photoPreview" type="button" class="btn btn-ghost btn-sm" @click="clearPhoto">
            Remove
          </button>
        </div>
      </div>

      <fieldset>
        <legend class="field-label">
          What kind?
        </legend>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="k in PLANT_KINDS"
            :key="k"
            type="button"
            class="sketch flex flex-col items-center px-1 pt-1 pb-0.5 text-sm transition"
            :class="form.kind === k ? 'bg-leaf-light shadow-sketch-sm' : 'bg-white/70 opacity-75 hover:opacity-100'"
            :aria-pressed="form.kind === k"
            @click="form.kind = k"
          >
            <PlantDoodle :kind="k" class="size-12" />
            {{ KIND_LABELS[k] }}
          </button>
        </div>
      </fieldset>
    </div>

    <!-- right: details -->
    <div class="flex flex-col gap-5">
      <div>
        <label for="name" class="field-label">Name</label>
        <input
          id="name"
          v-model="form.name"
          class="input text-xl!"
          placeholder="e.g. Monty the Monstera"
          maxlength="80"
          required
          autocomplete="off"
        >
      </div>

      <div class="grid gap-5 sm:grid-cols-2">
        <div>
          <label for="species" class="field-label">Species</label>
          <input
            id="species"
            v-model="form.species"
            class="input"
            placeholder="Monstera deliciosa"
            maxlength="120"
          >
        </div>
        <div>
          <label for="location" class="field-label">Where is it?</label>
          <input
            id="location"
            v-model="form.location"
            class="input"
            list="rooms"
            placeholder="Living room window"
            maxlength="60"
          >
          <datalist id="rooms">
            <option v-for="r in rooms" :key="r" :value="r" />
          </datalist>
        </div>
      </div>

      <fieldset>
        <legend class="field-label">
          Light
        </legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="l in LIGHTS"
            :key="l"
            type="button"
            class="btn btn-sm"
            :class="form.light === l ? 'btn-sun' : 'opacity-75'"
            :aria-pressed="form.light === l"
            @click="form.light = form.light === l ? null : l"
          >
            {{ LIGHT_LABELS[l] }}
          </button>
        </div>
      </fieldset>

      <div class="note -rotate-[0.6deg]">
        <label for="water" class="field-label flex items-center gap-2">
          <CareIcon kind="water" class="size-6!" /> Water every
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <input
            id="water"
            v-model.number="form.water_every_days"
            type="number"
            min="1"
            max="365"
            class="input w-24!"
            placeholder="–"
          >
          <span>days</span>
          <span class="mx-1 text-ink-soft">or</span>
          <button
            v-for="d in WATER_PRESETS"
            :key="d"
            type="button"
            class="chip"
            :class="form.water_every_days === d ? 'bg-water-light!' : 'bg-white!'"
            @click="form.water_every_days = d"
          >
            {{ d }}
          </button>
        </div>
        <p class="mt-1 text-sm text-ink-soft">
          Leave empty if it doesn't need a schedule.
        </p>

        <div v-if="isNew && form.water_every_days" class="mt-3">
          <label for="last-watered" class="text-lg">Last watered on</label>
          <input
            id="last-watered"
            v-model="lastWatered"
            type="date"
            :max="todayInput()"
            class="input mt-1 w-auto!"
          >
        </div>
      </div>

      <div>
        <label for="feed" class="field-label flex items-center gap-2">
          <CareIcon kind="fertilize" class="size-6!" /> Feed every
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <input
            id="feed"
            v-model.number="form.fertilize_every_days"
            type="number"
            min="1"
            max="730"
            class="input w-24!"
            placeholder="–"
          >
          <span>days</span>
          <span class="mx-1 text-ink-soft">or</span>
          <button
            v-for="d in FEED_PRESETS"
            :key="d"
            type="button"
            class="chip"
            :class="form.fertilize_every_days === d ? 'bg-leaf-light!' : 'bg-white!'"
            @click="form.fertilize_every_days = d"
          >
            {{ d }}
          </button>
        </div>
      </div>

      <div class="grid gap-5 sm:grid-cols-2">
        <div>
          <label for="acquired" class="field-label">Got it on</label>
          <input
            id="acquired"
            v-model="form.acquired_on"
            type="date"
            :max="todayInput()"
            class="input"
          >
        </div>
      </div>

      <div>
        <label for="notes" class="field-label">Notes</label>
        <textarea
          id="notes"
          v-model="form.notes"
          rows="4"
          class="input"
          maxlength="4000"
          placeholder="Likes a shower now and then. Hates drafts."
        />
      </div>

      <p v-if="error" class="sketch bg-rose-light px-3 py-2" role="alert">
        {{ error }}
      </p>

      <div class="flex flex-wrap items-center gap-3">
        <button type="submit" class="btn btn-leaf text-xl!" :disabled="saving">
          {{ saving ? 'Saving…' : isNew ? 'Plant it!' : 'Save changes' }}
        </button>
        <NuxtLink :to="p ? `/plants/${p.id}` : '/'" class="btn btn-ghost">
          Cancel
        </NuxtLink>
      </div>
    </div>
  </form>
</template>
