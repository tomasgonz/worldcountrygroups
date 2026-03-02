<template>
  <div>
    <!-- Hero -->
    <section class="bg-gradient-to-br from-primary-500 to-primary-700 text-white py-16 sm:py-24">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-4xl sm:text-5xl font-bold mb-4">World Country Groups</h1>
        <p class="text-primary-200 text-lg sm:text-xl max-w-2xl mx-auto mb-8">
          Explore {{ groupCount }} international country groups — from the EU and G20 to BRICS, OECD, NATO and more.
          Browse memberships, GDP, population, and CO2 data.
        </p>
        <div class="max-w-xl mx-auto mb-8">
          <SearchBar v-model="searchQuery" placeholder="Search groups by name, country, or keyword..." />
        </div>
        <div class="flex justify-center gap-8 text-center">
          <div>
            <div class="text-3xl font-bold">{{ groupCount }}</div>
            <div class="text-primary-200 text-sm">Groups</div>
          </div>
          <div>
            <div class="text-3xl font-bold">{{ countryCount }}</div>
            <div class="text-primary-200 text-sm">Countries</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Search results -->
    <section v-if="searchQuery" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 class="text-2xl font-bold text-primary-500 mb-6">Search Results</h2>
      <div v-if="searchPending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="skeleton h-36 rounded-xl" />
      </div>
      <div v-else-if="searchResults.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GroupCard v-for="g in searchResults" :key="g.gid" :group="g" />
      </div>
      <p v-else class="text-gray-500">No groups found matching "{{ searchQuery }}"</p>
    </section>

    <!-- Featured Groups -->
    <section v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-primary-500">Featured Groups</h2>
        <NuxtLink to="/groups" class="text-accent-500 hover:text-accent-600 font-medium text-sm">
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
useHead({ title: 'World Country Groups — Browse International Organizations' })

const { groups } = useGroups()

const groupCount = computed(() => groups.value?.length ?? 0)
const countryCount = computed(() => {
  if (!groups.value) return 0
  // The 'world' group has all unique countries
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
