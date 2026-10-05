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
          <span class="font-serif font-bold text-lg text-primary-900 whitespace-nowrap">World Country Groups</span>
        </NuxtLink>
        <div class="flex items-center gap-8">
          <div class="hidden lg:flex items-center gap-6 text-sm">
            <template v-for="item in navItems" :key="item.label">
              <!-- Direct link -->
              <NuxtLink
                v-if="item.to && !isDisabled(item.to)"
                :to="item.to"
                active-class="!text-primary-900"
                class="text-primary-400 hover:text-primary-900 transition-colors"
              >
                {{ item.label }}
              </NuxtLink>
              <!-- Dropdown -->
              <div v-else-if="item.children" class="relative" :ref="el => setDropdownRef(item.label, el as HTMLElement)">
                <button
                  @click.stop="toggleDropdown(item.label)"
                  class="flex items-center gap-1 transition-colors"
                  :class="isChildActive(item) ? 'text-primary-900' : 'text-primary-400 hover:text-primary-900'"
                >
                  {{ item.label }}
                  <svg class="w-3 h-3 transition-transform" :class="{ 'rotate-180': openDropdown === item.label }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div v-if="openDropdown === item.label" class="absolute left-0 mt-3 w-56 bg-white rounded-xl border border-primary-100 shadow-lg py-2 z-50">
                  <template v-for="child in item.children" :key="child.to">
                    <NuxtLink
                      v-if="!isDisabled(child.to)"
                      :to="child.to"
                      @click="openDropdown = null"
                      class="block px-4 py-2.5 hover:bg-primary-50 transition-colors"
                    >
                      <div class="text-sm font-medium text-primary-900">{{ child.label }}</div>
                      <div v-if="child.desc" class="text-xs text-primary-400 mt-0.5">{{ child.desc }}</div>
                    </NuxtLink>
                  </template>
                </div>
              </div>
            </template>
          </div>
          <div class="hidden lg:flex items-center gap-3">
            <template v-if="auth.state.value.authenticated">
              <div class="relative" ref="userDropdownRef">
                <button @click="userDropdownOpen = !userDropdownOpen" class="flex items-center gap-2 group">
                  <div class="w-8 h-8 rounded-full bg-primary-900 text-white flex items-center justify-center text-xs font-semibold">
                    {{ initials }}
                  </div>
                  <span class="text-sm text-primary-700 group-hover:text-primary-900 transition-colors">
                    {{ auth.state.value.displayName || auth.state.value.username }}
                  </span>
                  <svg class="w-3.5 h-3.5 text-primary-400 transition-transform" :class="{ 'rotate-180': userDropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div v-if="userDropdownOpen" class="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-primary-100 shadow-lg py-1 z-50">
                  <NuxtLink to="/dashboard" @click="userDropdownOpen = false" class="block px-4 py-2 text-sm text-primary-700 hover:bg-primary-50 transition-colors">
                    Dashboard
                  </NuxtLink>
                  <NuxtLink to="/account" @click="userDropdownOpen = false" class="block px-4 py-2 text-sm text-primary-700 hover:bg-primary-50 transition-colors">
                    Account
                  </NuxtLink>
                  <NuxtLink v-if="auth.state.value.role === 'admin'" to="/admin" @click="userDropdownOpen = false" class="block px-4 py-2 text-sm text-primary-700 hover:bg-primary-50 transition-colors">
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
          <!-- Phone / tablet menu button -->
          <button
            class="lg:hidden -mr-2 p-2 rounded-lg text-primary-700 hover:bg-primary-100"
            :aria-expanded="mobileOpen" aria-controls="mobile-menu" aria-label="Menu"
            @click.stop="mobileOpen = !mobileOpen"
          >
            <svg v-if="!mobileOpen" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>
            <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>
    </nav>

    <!-- Phone / tablet menu -->
    <div v-if="mobileOpen" id="mobile-menu" class="lg:hidden border-t border-primary-100 bg-white max-h-[calc(100vh-72px)] overflow-y-auto">
      <div class="px-4 py-3 space-y-1">
        <template v-for="item in navItems" :key="item.label">
          <NuxtLink v-if="item.to && !isDisabled(item.to)" :to="item.to" class="block px-3 py-2.5 rounded-lg text-primary-800 hover:bg-primary-50" active-class="bg-primary-50 font-medium">{{ item.label }}</NuxtLink>
          <div v-else-if="item.children" class="pt-2">
            <div class="px-3 pb-1 text-[11px] uppercase tracking-wider text-primary-400">{{ item.label }}</div>
            <template v-for="child in item.children" :key="child.to">
              <NuxtLink v-if="!isDisabled(child.to)" :to="child.to" class="block px-3 py-2 rounded-lg text-primary-700 hover:bg-primary-50" active-class="bg-primary-50 font-medium">{{ child.label }}</NuxtLink>
            </template>
          </div>
        </template>
      </div>
      <div class="border-t border-primary-100 px-4 py-3 space-y-1">
        <template v-if="auth.state.value.authenticated">
          <div class="px-3 py-1 text-xs text-primary-400">Signed in as {{ auth.state.value.displayName || auth.state.value.username }}</div>
          <NuxtLink to="/dashboard" class="block px-3 py-2 rounded-lg text-primary-700 hover:bg-primary-50">Dashboard</NuxtLink>
          <NuxtLink to="/account" class="block px-3 py-2 rounded-lg text-primary-700 hover:bg-primary-50">Account</NuxtLink>
          <NuxtLink v-if="auth.state.value.role === 'admin'" to="/admin" class="block px-3 py-2 rounded-lg text-primary-700 hover:bg-primary-50">Admin</NuxtLink>
          <button class="block w-full text-left px-3 py-2 rounded-lg text-primary-500 hover:bg-primary-50" @click="handleLogout">Logout</button>
        </template>
        <template v-else>
          <NuxtLink to="/login" class="block px-3 py-2 rounded-lg text-primary-800 hover:bg-primary-50">Log in</NuxtLink>
          <NuxtLink to="/register" class="block px-3 py-2 rounded-lg text-primary-500 hover:bg-primary-50">Register</NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const auth = useAuth()
const route = useRoute()
const userDropdownOpen = ref(false)
const userDropdownRef = ref<HTMLElement | null>(null)
const openDropdown = ref<string | null>(null)
const mobileOpen = ref(false)
const dropdownRefs: Record<string, HTMLElement | null> = {}

function setDropdownRef(label: string, el: HTMLElement | null) {
  dropdownRefs[label] = el
}

const initials = computed(() => {
  const name = auth.state.value.displayName || auth.state.value.username || ''
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
})

interface NavChild { to: string; label: string; desc?: string }
interface NavItem { label: string; to?: string; children?: NavChild[] }

const navItems: NavItem[] = [
  { label: 'Today', to: '/today' },
  { label: 'UN Monitor', to: '/un' },
  { label: 'Ask', to: '/ask' },
  { label: 'News', to: '/news' },
  { label: 'Statements', to: '/statements' },
  {
    label: 'Explore',
    children: [
      { to: '/groups', label: 'Groups', desc: 'International organizations' },
      { to: '/countries', label: 'Countries', desc: 'Country profiles & data' },
      { to: '/people', label: 'People', desc: 'Leaders, ministers and UN officials' },
      { to: '/compare', label: 'Compare', desc: 'Side-by-side analysis' },
    ],
  },
  {
    label: 'Data',
    children: [
      { to: '/votes', label: 'UN Votes', desc: 'General Assembly records' },
      { to: '/conflicts', label: 'Conflicts', desc: 'Armed conflict dashboard' },
      { to: '/partners/trade', label: 'Trade partners', desc: 'Trade with emerging economies' },
      { to: '/partners/donors', label: 'Donor tracker', desc: 'Aid budgets, cuts and donor news' },
      { to: '/speeches', label: 'Speeches', desc: 'UNGA speech analysis' },
      { to: '/quotes', label: 'Quotes', desc: 'Search leaders’ words since 1946' },
    ],
  },
  { label: 'Intelligence', to: '/intelligence' },
  {
    label: 'About',
    children: [
      { to: '/about', label: 'About', desc: 'Project information' },
      { to: '/sources', label: 'Sources', desc: 'Data sources & methodology' },
    ],
  },
]

function isDisabled(path: string): boolean {
  if (auth.state.value.role === 'admin') return false
  return auth.state.value.disabledPages?.includes(path) ?? false
}

function isChildActive(item: NavItem): boolean {
  if (!item.children) return false
  return item.children.some(c => route.path.startsWith(c.to))
}

function toggleDropdown(label: string) {
  openDropdown.value = openDropdown.value === label ? null : label
}

function handleClickOutside(e: MouseEvent) {
  if (userDropdownRef.value && !userDropdownRef.value.contains(e.target as Node)) {
    userDropdownOpen.value = false
  }
  if (openDropdown.value) {
    const ref = dropdownRefs[openDropdown.value]
    if (ref && !ref.contains(e.target as Node)) {
      openDropdown.value = null
    }
  }
}

watch(() => route.path, () => {
  openDropdown.value = null
  mobileOpen.value = false
})

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
