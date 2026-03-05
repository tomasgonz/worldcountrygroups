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
            <template v-for="link in navLinks" :key="link.to">
              <NuxtLink
                v-if="!isDisabled(link.to)"
                :to="link.to"
                active-class="!text-primary-900"
                class="text-primary-400 hover:text-primary-900 transition-colors"
              >
                {{ link.label }}
              </NuxtLink>
            </template>
          </div>
          <div class="hidden sm:flex items-center gap-3">
            <template v-if="auth.state.value.authenticated">
              <div class="relative" ref="dropdownRef">
                <button @click="dropdownOpen = !dropdownOpen" class="flex items-center gap-2 group">
                  <div class="w-8 h-8 rounded-full bg-primary-900 text-white flex items-center justify-center text-xs font-semibold">
                    {{ initials }}
                  </div>
                  <span class="text-sm text-primary-700 group-hover:text-primary-900 transition-colors">
                    {{ auth.state.value.displayName || auth.state.value.username }}
                  </span>
                  <svg class="w-3.5 h-3.5 text-primary-400 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div v-if="dropdownOpen" class="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-primary-100 shadow-lg py-1 z-50">
                  <NuxtLink to="/dashboard" @click="dropdownOpen = false" class="block px-4 py-2 text-sm text-primary-700 hover:bg-primary-50 transition-colors">
                    Dashboard
                  </NuxtLink>
                  <NuxtLink to="/account" @click="dropdownOpen = false" class="block px-4 py-2 text-sm text-primary-700 hover:bg-primary-50 transition-colors">
                    Account
                  </NuxtLink>
                  <NuxtLink v-if="auth.state.value.role === 'admin'" to="/admin" @click="dropdownOpen = false" class="block px-4 py-2 text-sm text-primary-700 hover:bg-primary-50 transition-colors">
                    Admin
                  </NuxtLink>
                  <div class="border-t border-primary-100 my-1"></div>
                  <button @click="handleLogout" class="block w-full text-left px-4 py-2 text-sm text-primary-400 hover:text-primary-900 hover:bg-primary-50 transition-colors">
                    Logout
                  </button>
                </div>
              </div>
            </template>
            <template v-else-if="auth.state.value.siteMode === 'restricted'">
              <NuxtLink to="/login" class="inline-flex items-center px-4 py-2 bg-primary-900 text-white text-sm rounded-lg hover:bg-primary-800 transition-colors">
                Log in
              </NuxtLink>
              <NuxtLink to="/register" class="text-sm text-primary-400 hover:text-primary-900 transition-colors">
                Register
              </NuxtLink>
            </template>
            <NuxtLink v-else to="/groups" class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-900 text-white text-sm rounded-lg hover:bg-primary-800 transition-colors">
              Explore
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
const auth = useAuth()
const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const initials = computed(() => {
  const name = auth.state.value.displayName || auth.state.value.username || ''
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
})

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}

const navLinks = [
  { to: '/groups', label: 'Groups' },
  { to: '/countries', label: 'Countries' },
  { to: '/compare', label: 'Compare' },
  { to: '/votes', label: 'Votes' },
  { to: '/conflicts', label: 'Conflicts' },
  { to: '/speeches', label: 'Speeches' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/sources', label: 'Sources' },
  { to: '/about', label: 'About' },
]

function isDisabled(path: string): boolean {
  // Admins always see all links
  if (auth.state.value.role === 'admin') return false
  return auth.state.value.disabledPages?.includes(path) ?? false
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  if (!auth.state.value.loaded) {
    await auth.fetchStatus()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

async function handleLogout() {
  await auth.logout()
  await navigateTo('/login')
}
</script>
