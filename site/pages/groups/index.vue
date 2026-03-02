<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center justify-between mb-1">
      <h1 class="font-serif text-3xl font-bold text-primary-900">Browse Groups</h1>
      <NuxtLink to="/compare" class="text-sm text-accent-600 hover:text-accent-700 transition-colors">Compare groups &rarr;</NuxtLink>
    </div>
    <p class="text-primary-400 text-sm mb-8">{{ filteredGroups.length }} groups</p>

    <!-- Filters -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
      <SearchBar v-model="query" placeholder="Search groups..." />
      <select
        v-model="domain"
        class="block w-full px-3 py-2.5 border border-primary-100 rounded-lg bg-white text-primary-900 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all"
      >
        <option value="">All domains</option>
        <option v-for="d in domains" :key="d" :value="d">{{ d }}</option>
      </select>
      <input
        v-model="country"
        type="text"
        placeholder="Filter by country..."
        class="block w-full px-3 py-2.5 border border-primary-100 rounded-lg bg-white text-primary-900 placeholder-primary-300 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all"
      />
    </div>

    <!-- Grid -->
    <div v-if="pending && !groups" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <div v-for="i in 12" :key="i" class="skeleton h-36 rounded-xl" />
    </div>
    <div v-else-if="filteredGroups.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <GroupCard v-for="g in filteredGroups" :key="g.gid" :group="g" />
    </div>
    <p v-else class="text-primary-500 text-center py-12">No groups match your filters.</p>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Browse Groups — World Country Groups' })

const { groups, pending } = useGroups()

const query = ref('')
const domain = ref('')
const country = ref('')

const domains = computed(() => {
  if (!groups.value) return []
  const set = new Set<string>()
  for (const g of groups.value as any[]) {
    for (const d of g.domains) set.add(d)
  }
  return [...set].sort()
})

const searchResults = ref<any[] | null>(null)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch([query, domain, country], () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (query.value || domain.value || country.value) {
    searchTimeout = setTimeout(async () => {
      const params = new URLSearchParams()
      if (query.value) params.set('q', query.value)
      if (domain.value) params.set('domain', domain.value)
      if (country.value) params.set('country', country.value)
      try {
        searchResults.value = await $fetch(`/api/search?${params.toString()}`)
      } catch {
        searchResults.value = []
      }
    }, 300)
  } else {
    searchResults.value = null
  }
})

const filteredGroups = computed(() => {
  if (searchResults.value !== null) return searchResults.value
  return (groups.value as any[]) || []
})
</script>
