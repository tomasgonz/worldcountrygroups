<template>
  <header class="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-primary-200/60">
    <nav class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-14">
        <NuxtLink to="/" class="font-serif font-bold text-lg text-primary-900 hover:text-accent-600 transition-colors">
          World Country Groups
        </NuxtLink>
        <div class="flex items-center gap-6 text-sm font-medium">
          <NuxtLink to="/groups" class="text-primary-500 hover:text-primary-900 transition-colors">
            Groups
          </NuxtLink>
          <NuxtLink to="/about" class="text-primary-500 hover:text-primary-900 transition-colors">
            About
          </NuxtLink>
        </div>
      </div>
    </nav>
  </header>
</template>
