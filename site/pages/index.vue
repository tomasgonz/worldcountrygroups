<template>
  <div>
    <!-- Hero -->
    <section class="bg-white border-b border-primary-100">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-900 mb-6 max-w-3xl leading-[1.1]">
          A reference for international country groupings
        </h1>
        <p class="text-primary-400 text-lg max-w-2xl mb-10 leading-relaxed">
          Explore {{ groupCount }} groups — from the EU and G20 to BRICS, OECD, NATO and beyond.
          Membership data, GDP, population, CO2 emissions, and UN General Assembly voting analysis.
        </p>
        <div class="max-w-lg mb-12">
          <SearchBar v-model="searchQuery" placeholder="Search by group name, country, or keyword..." />
        </div>
        <div class="flex items-center gap-10 text-sm">
          <div>
            <div class="text-3xl font-serif font-bold text-primary-900">{{ groupCount }}</div>
            <div class="text-primary-400 mt-0.5">Groups</div>
          </div>
          <div class="w-px h-10 bg-primary-100"></div>
          <div>
            <div class="text-3xl font-serif font-bold text-primary-900">{{ countryCount }}</div>
            <div class="text-primary-400 mt-0.5">Countries</div>
          </div>
          <div class="w-px h-10 bg-primary-100"></div>
          <div>
            <div class="text-3xl font-serif font-bold text-primary-900">5,600+</div>
            <div class="text-primary-400 mt-0.5">Resolutions</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Search results -->
    <section v-if="searchQuery" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h2 class="font-serif text-2xl font-bold text-primary-900 mb-6">Search Results</h2>
      <div v-if="searchPending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="i in 6" :key="i" class="skeleton h-36 rounded-xl" />
      </div>
      <div v-else-if="searchResults.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <GroupCard v-for="g in searchResults" :key="g.gid" :group="g" />
      </div>
      <p v-else class="text-primary-400">No groups found matching "{{ searchQuery }}"</p>
    </section>

    <!-- Featured Groups -->
    <section v-else class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="flex items-baseline justify-between mb-1">
        <h2 class="font-serif text-2xl font-bold text-primary-900">Featured Groups</h2>
        <NuxtLink to="/groups" class="text-primary-400 hover:text-primary-900 text-sm transition-colors">
          View all &rarr;
        </NuxtLink>
      </div>
      <p class="text-primary-400 text-sm mb-8">Major international organizations and alliances</p>
      <div v-if="!groups" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="i in 6" :key="i" class="skeleton h-36 rounded-xl" />
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <GroupCard v-for="g in featured" :key="g.gid" :group="g" />
      </div>
    </section>

    <!-- UN Voting Section — Browse by Theme -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-primary-100">
      <div class="flex items-baseline justify-between mb-1">
        <h2 class="font-serif text-2xl font-bold text-primary-900">UN General Assembly Voting</h2>
        <NuxtLink to="/votes" class="text-primary-400 hover:text-primary-900 text-sm transition-colors">
          Explore all votes &rarr;
        </NuxtLink>
      </div>
      <p class="text-primary-400 text-sm mb-8">
        5,600+ resolutions classified by theme. Click a topic to explore how countries and groups voted.
      </p>
      <div v-if="themeCards.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <NuxtLink
          v-for="card in themeCards"
          :key="card.theme"
          :to="`/votes?theme=${encodeURIComponent(card.theme)}`"
          class="rounded-2xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
          :class="[card.colors.bg, card.colors.border]"
        >
          <div class="text-sm font-semibold mb-1" :class="card.colors.text">{{ card.theme }}</div>
          <div class="text-xs tabular-nums" :class="card.colors.accent">{{ card.count.toLocaleString() }} resolutions</div>
        </NuxtLink>
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div v-for="i in 8" :key="i" class="skeleton h-20 rounded-2xl" />
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

// Theme cards for UN Voting section
const { data: resolutionsMeta } = useFetch('/api/resolutions?limit=0', { lazy: true })
const themeCards = computed(() => {
  const data = resolutionsMeta.value as any
  if (!data?.theme_counts) return []
  const counts = data.theme_counts as Record<string, number>
  return Object.entries(counts)
    .filter(([theme]) => theme !== 'Other')
    .map(([theme, count]) => ({
      theme,
      count,
      colors: THEME_CARD_COLORS[theme] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', accent: 'text-gray-400' },
    }))
    .sort((a, b) => b.count - a.count)
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
