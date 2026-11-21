export const PLANT_KINDS = ['leafy', 'succulent', 'cactus', 'flower', 'herb', 'hanging', 'tree'] as const
export type PlantKind = typeof PLANT_KINDS[number]

export const LIGHTS = ['low', 'medium', 'bright'] as const
export type Light = typeof LIGHTS[number]

export const CARE_KINDS = ['water', 'fertilize', 'repot', 'prune', 'mist', 'note'] as const
export type CareKind = typeof CARE_KINDS[number]

export const KIND_LABELS: Record<PlantKind, string> = {
  leafy: 'Leafy',
  succulent: 'Succulent',
  cactus: 'Cactus',
  flower: 'Flowering',
  herb: 'Herb',
  hanging: 'Trailing',
  tree: 'Tree'
}

export const LIGHT_LABELS: Record<Light, string> = {
  low: 'Shade',
  medium: 'Indirect light',
  bright: 'Bright sun'
}

export const CARE_LABELS: Record<CareKind, { verb: string, past: string }> = {
  water: { verb: 'Water', past: 'Watered' },
  fertilize: { verb: 'Feed', past: 'Fed' },
  repot: { verb: 'Repot', past: 'Repotted' },
  prune: { verb: 'Prune', past: 'Pruned' },
  mist: { verb: 'Mist', past: 'Misted' },
  note: { verb: 'Note', past: 'Note' }
}

export type Plant = {
  id: string
  user_id: string
  name: string
  species: string | null
  kind: PlantKind
  location: string | null
  light: Light | null
  water_every_days: number | null
  fertilize_every_days: number | null
  last_watered_at: string | null
  last_fertilized_at: string | null
  photo_path: string | null
  notes: string | null
  acquired_on: string | null
  created_at: string
  updated_at: string
}

/** What the form writes. The last_* dates follow the care log and are never written directly. */
export type PlantInput = Pick<Plant,
  'name' | 'species' | 'kind' | 'location' | 'light' | 'water_every_days'
  | 'fertilize_every_days' | 'photo_path' | 'notes' | 'acquired_on'>

export type CareLog = {
  id: string
  plant_id: string
  user_id: string
  kind: CareKind
  note: string | null
  done_at: string
  created_at: string
}
