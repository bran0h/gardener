<template>
  <div class="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pt-[env(safe-area-inset-top)] pb-[calc(4rem+env(safe-area-inset-bottom))] sm:px-6">
    <header class="flex items-center justify-between gap-3 py-4 sm:py-6">
      <div class="flex min-w-0 items-center gap-2 sm:gap-4">
        <NuxtLink to="/" class="flex shrink-0 items-center gap-2" :aria-label="$t('header.homeAria')">
          <PlantDoodle kind="leafy" class="size-12 -rotate-6 text-ink sm:size-14" />
          <span class="hidden font-script text-4xl font-bold sm:inline sm:text-5xl">{{ $t('app.name') }}</span>
        </NuxtLink>
        <HomeSwitcher />
      </div>
      <div class="flex shrink-0 items-center gap-1 sm:gap-2">
        <ReminderBell />
        <NuxtLink to="/plants/new" class="btn btn-leaf hidden sm:inline-flex">
          {{ $t('header.newPlant') }}
        </NuxtLink>
        <UserMenu />
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <!-- Floating add button on phones. -->
    <NuxtLink
      to="/plants/new"
      class="btn btn-leaf fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 size-14 p-0! text-3xl! sm:hidden"
      :aria-label="$t('form.newPlant')"
    >
      +
    </NuxtLink>
  </div>
</template>
