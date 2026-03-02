<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div v-if="error" class="text-center py-20">
      <h1 class="text-2xl font-bold text-gray-400 mb-2">Group not found</h1>
      <NuxtLink to="/groups" class="text-accent-500 hover:text-accent-600">Browse all groups &rarr;</NuxtLink>
    </div>

    <template v-else-if="group">
      <!-- Breadcrumb -->
      <nav class="text-sm text-gray-400 mb-6">
        <NuxtLink to="/groups" class="hover:text-accent-500">Groups</NuxtLink>
        <span class="mx-2">/</span>
        <span class="text-gray-700">{{ (group as any).acronym }}</span>
      </nav>

      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-start gap-4 mb-3">
          <h1 class="text-3xl sm:text-4xl font-bold text-primary-500">{{ (group as any).name }}</h1>
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
          <DomainTag v-for="d in (group as any).domains" :key="d" :domain="d" size="md" />
          <span class="inline-block rounded-full px-3 py-1 text-sm font-medium bg-primary-50 text-primary-600">
            {{ (group as any).classifier }}
          </span>
        </div>
        <p class="text-gray-600 leading-relaxed max-w-4xl">{{ (group as any).description }}</p>
      </div>

      <!-- Stats -->
      <div class="mb-10">
        <h2 class="text-xl font-bold text-primary-500 mb-4">Aggregate Statistics</h2>
        <GroupStats :stats="stats as any" :pending="statsPending" />
      </div>

      <!-- Country Comparison -->
      <div class="mb-10">
        <h2 class="text-xl font-bold text-primary-500 mb-4">Compare Countries</h2>

        <!-- Selected country chips -->
        <div v-if="selectedCountries.length" class="flex flex-wrap gap-2 mb-3">
          <span
            v-for="iso in selectedCountries"
            :key="iso"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-full text-sm font-medium"
          >
            <span v-if="countryMap[iso]?.iso2">{{ isoToFlag(countryMap[iso].iso2) }}</span>
            {{ countryMap[iso]?.name || iso }}
            <button
              class="ml-0.5 hover:bg-primary-400 rounded-full w-5 h-5 inline-flex items-center justify-center text-xs"
              @click="removeCountry(iso)"
            >&times;</button>
          </span>
          <button
            class="px-3 py-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
            @click="selectedCountries = []"
          >Clear all</button>
        </div>

        <!-- Add country select -->
        <select
          :value="''"
          :disabled="selectedCountries.length >= 10"
          class="block w-full sm:w-80 px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          @change="addCountry($event)"
        >
          <option value="" disabled>
            {{ selectedCountries.length >= 10 ? 'Maximum 10 countries selected' : 'Add a country to compare...' }}
          </option>
          <option
            v-for="c in availableCountries"
            :key="c.iso2 || c.iso3"
            :value="c.iso2 || c.iso3"
          >
            {{ c.name }} ({{ c.iso2 || c.iso3 }})
          </option>
        </select>

        <!-- Comparison results -->
        <div v-if="selectedCountries.length > 0" class="mt-6">
          <div v-if="comparePending" class="space-y-4">
            <div v-for="i in selectedCountries.length" :key="i" class="skeleton h-28 rounded-xl" />
          </div>
          <div v-else-if="compareData && (compareData as any[]).length" class="space-y-4">
            <div
              v-for="entry in (compareData as any[])"
              :key="entry.iso3"
              class="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
            >
              <div class="flex items-center gap-2 mb-3">
                <span v-if="entry.iso2" class="text-xl">{{ isoToFlag(entry.iso2) }}</span>
                <h3 class="text-lg font-bold text-primary-500">{{ entry.name }}</h3>
                <span class="text-sm text-gray-400">({{ entry.iso3 }})</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div class="text-sm text-gray-500">GDP (nominal)</div>
                  <div v-if="entry.stats.gdp" class="text-lg font-bold text-primary-500">{{ formatNumber(entry.stats.gdp.total) }}</div>
                  <div v-else class="text-gray-400">No data</div>
                </div>
                <div>
                  <div class="text-sm text-gray-500">Population</div>
                  <div v-if="entry.stats.population" class="text-lg font-bold text-primary-500">{{ formatPopulation(entry.stats.population.total) }}</div>
                  <div v-else class="text-gray-400">No data</div>
                </div>
                <div>
                  <div class="text-sm text-gray-500">CO2 Emissions</div>
                  <div v-if="entry.stats.co2" class="text-lg font-bold text-primary-500">{{ formatCO2(entry.stats.co2.total) }}</div>
                  <div v-else class="text-gray-400">No data</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Countries -->
      <div>
        <h2 class="text-xl font-bold text-primary-500 mb-4">
          Member Countries
          <span class="text-base font-normal text-gray-400">({{ (group as any).countries.length }})</span>
        </h2>
        <div class="flex flex-wrap gap-2">
          <CountryBadge v-for="c in (group as any).countries" :key="c.iso3 || c.name" :country="c" />
        </div>
      </div>
    </template>

    <div v-else class="space-y-6">
      <div class="skeleton h-10 w-64" />
      <div class="skeleton h-6 w-96" />
      <div class="grid grid-cols-3 gap-4">
        <div class="skeleton h-24 rounded-xl" />
        <div class="skeleton h-24 rounded-xl" />
        <div class="skeleton h-24 rounded-xl" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const gid = route.params.gid as string

const { group, error } = useGroup(gid)
const { stats, pending: statsPending } = useGroupStats(gid)

const selectedCountries = ref<string[]>([])

// Build a lookup map from ISO code to country object
const countryMap = computed(() => {
  const map: Record<string, { name: string; iso2: string; iso3: string }> = {}
  if (!group.value) return map
  for (const c of (group.value as any).countries) {
    const key = c.iso2 || c.iso3
    if (key) map[key] = c
  }
  return map
})

// Countries not yet selected, sorted by name
const availableCountries = computed(() => {
  if (!group.value) return []
  const selected = new Set(selectedCountries.value)
  return (group.value as any).countries
    .filter((c: any) => {
      const key = c.iso2 || c.iso3
      return key && !selected.has(key)
    })
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
})

function addCountry(event: Event) {
  const select = event.target as HTMLSelectElement
  const val = select.value
  if (val && !selectedCountries.value.includes(val) && selectedCountries.value.length < 10) {
    selectedCountries.value = [...selectedCountries.value, val]
  }
  select.value = ''
}

function removeCountry(iso: string) {
  selectedCountries.value = selectedCountries.value.filter(c => c !== iso)
}

// Fetch comparison data when selected countries change
const countriesParam = computed(() => selectedCountries.value.join(','))

const { data: compareData, pending: comparePending } = useFetch(
  () => selectedCountries.value.length > 0
    ? `/api/countries/compare?countries=${countriesParam.value}`
    : null,
  {
    watch: [countriesParam],
    default: () => [],
  }
)

// Clear invalid selections when group changes
watch(group, () => {
  if (!group.value) return
  const validKeys = new Set(
    (group.value as any).countries.map((c: any) => c.iso2 || c.iso3).filter(Boolean)
  )
  selectedCountries.value = selectedCountries.value.filter(c => validKeys.has(c))
})

useHead({
  title: computed(() => {
    const g = group.value as any
    return g ? `${g.acronym} — ${g.name} — World Country Groups` : 'Loading...'
  }),
})
</script>
