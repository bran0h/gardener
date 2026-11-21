<script setup lang="ts">
import type { PlantKind } from '~/types/plant'

withDefaults(defineProps<{ kind?: PlantKind }>(), { kind: 'leafy' })
</script>

<template>
  <svg
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g filter="url(#wobble)">
      <template v-if="kind === 'cactus'">
        <path class="fill-leaf-light" d="M41 57 L41 24 C41 13 59 13 59 24 L59 57 Z" />
        <path class="fill-leaf-light" d="M41 44 L34 44 C30 44 28 41 28 37 L28 30 C28 25 34 25 34 30 L34 38 L41 38 Z" />
        <path class="fill-leaf-light" d="M59 35 L66 35 L66 27 C66 22 72 22 72 27 L72 33 C72 38 70 41 66 41 L59 41 Z" />
        <path stroke-width="1.4" d="M46 22 l-3 -2 M54 27 l3 -2 M46 34 l-3 -1 M54 41 l3 -1 M47 49 l-3 1 M53 52 l3 1" />
        <circle class="fill-rose-light" cx="50" cy="13" r="4" />
      </template>

      <template v-else-if="kind === 'succulent'">
        <path class="fill-leaf-light" d="M50 57 C36 55 25 47 22 40 C33 39 44 46 50 57 Z" />
        <path class="fill-leaf-light" d="M50 57 C64 55 75 47 78 40 C67 39 56 46 50 57 Z" />
        <path class="fill-leaf-light" d="M50 57 C40 49 33 38 35 29 C44 33 50 44 50 57 Z" />
        <path class="fill-leaf-light" d="M50 57 C60 49 67 38 65 29 C56 33 50 44 50 57 Z" />
        <path class="fill-leaf-light" d="M50 57 C44 46 44 31 50 22 C56 31 56 46 50 57 Z" />
      </template>

      <template v-else-if="kind === 'flower'">
        <path d="M50 57 C50 46 50 36 50 27" />
        <path class="fill-leaf-light" d="M50 49 C40 47 33 41 33 34 C42 34 48 40 50 49 Z" />
        <path class="fill-leaf-light" d="M50 42 C58 40 65 34 67 27 C58 27 52 33 50 42 Z" />
        <circle class="fill-rose-light" cx="50" cy="10" r="6" />
        <circle class="fill-rose-light" cx="59" cy="16.5" r="6" />
        <circle class="fill-rose-light" cx="55.5" cy="26.5" r="6" />
        <circle class="fill-rose-light" cx="44.5" cy="26.5" r="6" />
        <circle class="fill-rose-light" cx="41" cy="16.5" r="6" />
        <circle class="fill-sun" cx="50" cy="19" r="4.5" />
      </template>

      <template v-else-if="kind === 'herb'">
        <path d="M40 57 C40 46 36 38 31 30 M50 57 C50 45 50 34 50 20 M60 57 C60 46 64 38 69 30" />
        <ellipse class="fill-leaf-light" cx="30" cy="27" rx="6" ry="4" transform="rotate(-35 30 27)" />
        <ellipse class="fill-leaf-light" cx="37" cy="41" rx="5.5" ry="3.5" transform="rotate(-20 37 41)" />
        <ellipse class="fill-leaf-light" cx="50" cy="17" rx="4" ry="6" />
        <ellipse class="fill-leaf-light" cx="44" cy="32" rx="5" ry="3.5" transform="rotate(25 44 32)" />
        <ellipse class="fill-leaf-light" cx="56" cy="38" rx="5" ry="3.5" transform="rotate(-25 56 38)" />
        <ellipse class="fill-leaf-light" cx="70" cy="27" rx="6" ry="4" transform="rotate(35 70 27)" />
        <ellipse class="fill-leaf-light" cx="63" cy="42" rx="5.5" ry="3.5" transform="rotate(20 63 42)" />
      </template>

      <template v-else-if="kind === 'hanging'">
        <path class="fill-leaf-light" d="M29 56 C29 44 39 39 50 42 C61 39 71 44 71 56 Z" />
        <path d="M30 58 C19 66 24 78 15 92 M70 58 C81 66 76 78 85 92" />
        <circle class="fill-leaf-light" cx="22" cy="66" r="3.5" />
        <circle class="fill-leaf-light" cx="21" cy="78" r="3.5" />
        <circle class="fill-leaf-light" cx="16" cy="89" r="3.5" />
        <circle class="fill-leaf-light" cx="78" cy="66" r="3.5" />
        <circle class="fill-leaf-light" cx="79" cy="78" r="3.5" />
        <circle class="fill-leaf-light" cx="84" cy="89" r="3.5" />
      </template>

      <template v-else-if="kind === 'tree'">
        <path d="M50 57 L50 36 M50 46 L58 38 M50 50 L42 42" />
        <path class="fill-leaf-light" d="M30 34 C22 26 30 12 42 14 C46 4 62 6 64 14 C76 12 82 26 74 32 C80 42 66 48 58 42 C52 47 38 47 35 42 C26 44 23 36 30 34 Z" />
        <path stroke-width="1.4" d="M44 24 q3 -2 6 0 M58 28 q3 -2 6 0 M38 34 q3 -2 6 0" />
      </template>

      <template v-else>
        <path d="M50 57 C50 44 49 34 47 24 M50 50 C56 44 60 40 64 36 M49 46 C43 42 38 38 34 34" />
        <path class="fill-leaf-light" d="M47 24 C38 18 36 7 46 5 C57 5 59 18 47 24 Z" />
        <path class="fill-leaf-light" d="M64 36 C63 26 73 19 83 23 C87 32 76 41 64 36 Z" />
        <path class="fill-leaf-light" d="M34 34 C24 39 13 32 15 23 C24 17 35 24 34 34 Z" />
        <path stroke-width="1.4" d="M47 22 L46 11 M66 34 L78 26 M32 32 L21 25" />
      </template>

      <!-- pot -->
      <path class="fill-clay-light" d="M31 63 L69 63 L64 92 Q50 95 36 92 Z" />
      <path class="fill-clay" d="M26 56 Q50 53 74 56 L74 64 Q50 66 26 64 Z" />
      <path stroke-width="1.4" d="M38 76 q4 -3 8 0 M54 82 q4 -3 8 0" />
    </g>
  </svg>
</template>
