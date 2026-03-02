<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="text-3xl font-bold text-primary-500 mb-2">Browse Groups</h1>
    <p class="text-gray-500 mb-8">{{ filteredGroups.length }} groups found</p>

    <!-- Filters -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <SearchBar v-model="query" placeholder="Search groups..." />
      <select
        v-model="domain"
        class="block w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none"
      >
        <option value="">All domains</option>
        <option v-for="d in domains" :key="d" :value="d">{{ d }}</option>
      </select>
      <input
        v-model="country"
        type="text"
        placeholder="Filter by country (name or ISO)..."
        class="block w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none"
      />
    </div>

    <!-- Grid -->
    <div v-if="pending && !groups" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 12" :key="i" class="skeleton h-36 rounded-xl" />
    </div>
    <div v-else-if="filteredGroups.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <GroupCard v-for="g in filteredGroups" :key="g.gid" :group="g" />
    </div>
    <p v-else class="text-gray-500 text-center py-12">No groups match your filters.</p>
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
  // If any filter is active, use the search API
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
