<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900"></div>
      <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <h1 class="font-serif text-4xl sm:text-5xl font-bold text-white mb-4 max-w-3xl leading-tight">
          A reference for international country groupings
        </h1>
        <p class="text-primary-300 text-lg max-w-2xl mb-8 leading-relaxed">
          Explore {{ groupCount }} groups — from the EU and G20 to BRICS, OECD, NATO and beyond.
          Membership data, GDP, population, and CO2 emissions.
        </p>
        <div class="max-w-lg mb-10">
          <SearchBar v-model="searchQuery" placeholder="Search by group name, country, or keyword..." />
        </div>
        <div class="flex gap-12">
          <div>
            <div class="text-3xl font-serif font-bold text-white">{{ groupCount }}</div>
            <div class="text-primary-400 text-sm">Groups</div>
          </div>
          <div>
            <div class="text-3xl font-serif font-bold text-white">{{ countryCount }}</div>
            <div class="text-primary-400 text-sm">Countries</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Search results -->
    <section v-if="searchQuery" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 class="font-serif text-2xl font-bold text-primary-900 mb-6">Search Results</h2>
      <div v-if="searchPending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="skeleton h-36 rounded-xl" />
      </div>
      <div v-else-if="searchResults.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GroupCard v-for="g in searchResults" :key="g.gid" :group="g" />
      </div>
      <p v-else class="text-primary-500">No groups found matching "{{ searchQuery }}"</p>
    </section>

    <!-- Featured Groups -->
    <section v-else class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-baseline justify-between mb-6">
        <h2 class="font-serif text-2xl font-bold text-primary-900">Featured Groups</h2>
        <NuxtLink to="/groups" class="text-accent-600 hover:text-accent-700 text-sm font-medium transition-colors">
          View all &rarr;
        </NuxtLink>
      </div>
      <div v-if="!groups" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="skeleton h-36 rounded-xl" />
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GroupCard v-for="g in featured" :key="g.gid" :group="g" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'World Country Groups — International Organizations Reference' })

const { groups } = useGroups()

const groupCount = computed(() => groups.value?.length ?? 0)
const countryCount = computed(() => {
  if (!groups.value) return 0
  const world = groups.value.find((g: any) => g.gid === 'world')
  return world ? world.country_count : 220
})

const featuredGids = ['eu', 'g20', 'brics', 'oecd', 'nato', 'un', 'asean', 'au', 'mercosur']
const featured = computed(() => {
  if (!groups.value) return []
  return featuredGids
    .map(gid => groups.value!.find((g: any) => g.gid === gid))
    .filter(Boolean)
})

const searchQuery = ref('')
const searchResults = ref<any[]>([])
const searchPending = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (q) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!q) {
    searchResults.value = []
    return
  }
  searchPending.value = true
  searchTimeout = setTimeout(async () => {
    try {
      searchResults.value = await $fetch(`/api/search?q=${encodeURIComponent(q)}`)
    } catch {
      searchResults.value = []
    } finally {
      searchPending.value = false
    }
  }, 300)
})
</script>
