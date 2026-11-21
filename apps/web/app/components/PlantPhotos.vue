<script setup lang="ts">
import type { Plant, PlantPhoto } from '~/types/plant'

const props = defineProps<{ plant: Plant }>()

const { listPhotos, addPhoto, makeCover, deletePhoto, pathUrl } = usePlants()
const { push } = useToast()
const { t } = useI18n()
const { date } = useFormat()
const { ask } = useConfirm()

const photos = ref<PlantPhoto[]>([])
const busy = ref(false)
const open = ref<PlantPhoto | null>(null)

async function load() {
  photos.value = await listPhotos(props.plant.id)
}
onMounted(() => load().catch(() => {}))
// Someone else changed the cover (live update): the timeline may have grown too.
watch(() => props.plant.photo_path, () => load().catch(() => {}))

async function run(fn: () => Promise<unknown>, done: string) {
  busy.value = true
  try {
    await fn()
    await load()
    push(done)
  } catch (e) {
    push(errMsg(e), 'rose')
  } finally {
    busy.value = false
  }
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) run(() => addPhoto(props.plant, file), t('photos.added'))
}

function show(p: PlantPhoto) {
  open.value = p
}

async function cover(p: PlantPhoto) {
  await run(() => makeCover(props.plant, p.path), t('photos.coverSet'))
  open.value = null
}

async function remove(p: PlantPhoto) {
  if (!await ask({ title: t('confirm.deletePhotoTitle'), message: t('confirm.deletePhotoText'), confirm: t('common.delete') })) return
  await run(() => deletePhoto(props.plant, p), t('photos.deleted'))
  open.value = null
}

const day = (iso: string) => date(iso, { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <section class="card flex flex-col gap-3 rotate-[0.3deg]">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-3xl">
        {{ $t('photos.title') }}
      </h2>
      <label class="btn btn-sun btn-sm" :class="busy ? 'pointer-events-none opacity-60' : ''">
        <input type="file" accept="image/*" class="sr-only" :disabled="busy" @change="onFile">
        {{ busy ? $t('photos.adding') : $t('photos.add') }}
      </label>
    </div>

    <p v-if="!photos.length" class="text-sm text-ink-soft">
      {{ $t('photos.empty') }}
    </p>
    <ol v-else class="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pt-1 pb-2">
      <li v-for="p in photos" :key="p.id" class="shrink-0 snap-start">
        <button
          type="button"
          class="flex w-24 flex-col items-center gap-1"
          :aria-label="$t('photos.open', { date: day(p.taken_at) })"
          @click="show(p)"
        >
          <span
            class="sketch-alt relative block size-24 overflow-hidden bg-paper-dark/60"
            :class="p.path === plant.photo_path ? 'shadow-sketch-sm' : ''"
          >
            <img v-if="pathUrl(p.path)" :src="pathUrl(p.path)!" alt="" class="size-full object-cover" loading="lazy">
            <span v-if="p.path === plant.photo_path" class="chip absolute bottom-1 left-1 bg-sun-light! px-1.5! text-xs">{{ $t('photos.cover') }}</span>
          </span>
          <span class="text-xs text-ink-soft">{{ day(p.taken_at) }}</span>
        </button>
      </li>
    </ol>

    <!-- one photo, large -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="open"
          class="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          role="dialog"
          :aria-label="day(open.taken_at)"
          @click.self="open = null"
          @keydown.esc="open = null"
        >
          <div class="card-solid flex max-h-full w-full max-w-lg flex-col gap-3 p-3!">
            <img v-if="pathUrl(open.path)" :src="pathUrl(open.path)!" alt="" class="sketch-alt max-h-[65dvh] w-full object-contain">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-script text-2xl font-bold">{{ day(open.taken_at) }}</span>
              <div class="flex flex-wrap gap-2">
                <button v-if="open.path !== plant.photo_path" type="button" class="btn btn-sun btn-sm" :disabled="busy" @click="cover(open)">
                  {{ $t('photos.makeCover') }}
                </button>
                <button type="button" class="btn btn-danger btn-sm" :disabled="busy" @click="remove(open)">
                  {{ $t('photos.delete') }}
                </button>
                <button type="button" class="btn btn-sm" @click="open = null">
                  {{ $t('common.close') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>
