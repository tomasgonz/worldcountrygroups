<template>
  <header class="bg-primary-500 text-white shadow-lg">
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <NuxtLink to="/" class="flex items-center gap-2 font-bold text-xl hover:text-accent-300 transition-colors">
          <span class="text-2xl">🌍</span>
          <span class="hidden sm:inline">World Country Groups</span>
          <span class="sm:hidden">WCG</span>
        </NuxtLink>
        <div class="flex items-center gap-6">
          <NuxtLink to="/groups" class="hover:text-accent-300 transition-colors font-medium">
            Groups
          </NuxtLink>
          <NuxtLink to="/about" class="hover:text-accent-300 transition-colors font-medium">
            About
          </NuxtLink>
        </div>
      </div>
    </nav>
  </header>
</template>
