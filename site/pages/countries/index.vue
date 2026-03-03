<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center justify-between mb-1">
      <h1 class="font-serif text-3xl font-bold text-primary-900">Browse Countries</h1>
      <NuxtLink to="/compare" class="text-sm text-accent-600 hover:text-accent-700 transition-colors">Compare groups &rarr;</NuxtLink>
    </div>
    <p class="text-primary-400 text-sm mb-8">{{ filteredCountries.length }} countries</p>

    <!-- Filters -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
      <SearchBar v-model="query" placeholder="Search countries..." />
      <select
        v-model="region"
        class="block w-full px-3 py-2.5 border border-primary-100 rounded-lg bg-white text-primary-900 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all"
      >
        <option value="">All regions</option>
        <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
      </select>
    </div>

    <!-- Grid -->
    <div v-if="pending && !countries" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <div v-for="i in 12" :key="i" class="skeleton h-28 rounded-xl" />
    </div>
    <div v-else-if="filteredCountries.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <NuxtLink
        v-for="c in filteredCountries"
        :key="c.iso2"
        :to="`/countries/${c.iso2}`"
        class="group block bg-white border border-primary-100 rounded-xl p-5 hover:border-primary-200 hover:shadow-sm transition-all"
      >
        <div class="flex items-start gap-3">
          <span class="text-2xl leading-none">{{ isoToFlag(c.iso2) }}</span>
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold text-primary-900 group-hover:text-accent-600 transition-colors truncate">{{ c.name }}</h3>
            <p class="text-xs text-primary-400 mt-0.5">{{ c.region || 'Unknown region' }}</p>
          </div>
          <span class="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-600">
            {{ c.groupCount }} {{ c.groupCount === 1 ? 'group' : 'groups' }}
          </span>
        </div>
      </NuxtLink>
    </div>
    <p v-else class="text-primary-500 text-center py-12">No countries match your filters.</p>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Browse Countries — World Country Groups' })

const { countries, pending } = useCountries()

const query = ref('')
const region = ref('')

const regions = computed(() => {
  if (!countries.value) return []
  const set = new Set<string>()
  for (const c of countries.value as any[]) {
    if (c.region) set.add(c.region)
  }
  return [...set].sort()
})

const filteredCountries = computed(() => {
  if (!countries.value) return []
  let list = countries.value as any[]
  if (query.value) {
    const q = query.value.toLowerCase()
    list = list.filter((c: any) =>
      c.name.toLowerCase().includes(q) ||
      c.iso2.toLowerCase().includes(q) ||
      c.iso3.toLowerCase().includes(q)
    )
  }
  if (region.value) {
    list = list.filter((c: any) => c.region === region.value)
  }
  return list
})
</script>
