<template>
  <header class="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-primary-100">
    <nav class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-[72px]">
        <NuxtLink to="/" class="flex items-center gap-3 group">
          <div class="w-9 h-9 rounded-xl bg-primary-900 flex items-center justify-center group-hover:bg-primary-800 transition-colors">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <span class="font-serif font-bold text-lg text-primary-900">World Country Groups</span>
        </NuxtLink>
        <div class="flex items-center gap-8">
          <div class="flex items-center gap-6 text-sm">
            <NuxtLink to="/groups" active-class="!text-primary-900" class="text-primary-400 hover:text-primary-900 transition-colors">
              Groups
            </NuxtLink>
            <NuxtLink to="/compare" active-class="!text-primary-900" class="text-primary-400 hover:text-primary-900 transition-colors">
              Compare
            </NuxtLink>
            <NuxtLink to="/about" active-class="!text-primary-900" class="text-primary-400 hover:text-primary-900 transition-colors">
              About
            </NuxtLink>
          </div>
          <NuxtLink to="/groups" class="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-primary-900 text-white text-sm rounded-lg hover:bg-primary-800 transition-colors">
            Explore
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </nav>
  </header>
</template>
