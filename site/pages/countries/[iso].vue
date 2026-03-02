<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div v-if="error" class="text-center py-20">
      <h1 class="font-serif text-2xl font-bold text-primary-400 mb-2">Country not found</h1>
      <NuxtLink to="/groups" class="text-primary-400 hover:text-primary-900 transition-colors">Browse groups &rarr;</NuxtLink>
    </div>

    <template v-else-if="country">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-primary-400 mb-8">
        <NuxtLink to="/groups" class="hover:text-primary-900 transition-colors">Groups</NuxtLink>
        <span class="text-primary-300">/</span>
        <span class="text-primary-600">{{ (country as any).name }}</span>
      </nav>

      <!-- Header -->
      <div class="mb-10">
        <div class="flex items-center gap-4">
          <span v-if="(country as any).iso2" class="text-5xl">{{ isoToFlag((country as any).iso2) }}</span>
          <div>
            <h1 class="font-serif text-3xl sm:text-4xl font-bold text-primary-900">{{ (country as any).name }}</h1>
            <p class="text-primary-500 mt-1 text-sm">
              <span v-if="(country as any).iso2">ISO alpha-2: <strong>{{ (country as any).iso2 }}</strong></span>
              <span v-if="(country as any).iso2 && (country as any).iso3"> &middot; </span>
              <span v-if="(country as any).iso3">alpha-3: <strong>{{ (country as any).iso3 }}</strong></span>
            </p>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="mb-12">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Statistics</h2>
        <GroupStats :stats="stats as any" :pending="statsPending" />
      </div>

      <!-- Memberships with Rankings -->
      <div>
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">
          Group Memberships
          <span class="text-base font-normal text-primary-400">({{ (country as any).groups.length }})</span>
        </h2>

        <!-- Rankings table -->
        <div v-if="rankings && !rankingsPending" class="bg-white rounded-2xl border border-primary-100 overflow-hidden mb-8">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-primary-100 text-left">
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Group</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">GDP</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">GDP %</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Population</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Pop %</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right hidden sm:table-cell">CO2</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right hidden sm:table-cell">CO2 %</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in (rankings as any[])"
                  :key="r.gid"
                  class="border-b border-primary-50 last:border-0 hover:bg-primary-50/50 transition-colors"
                >
                  <td class="px-5 py-3">
                    <NuxtLink :to="`/groups/${r.gid}`" class="font-medium text-primary-800 hover:text-primary-600 transition-colors">
                      {{ r.acronym }}
                    </NuxtLink>
                    <span class="text-primary-300 text-xs ml-1">({{ r.country_count }})</span>
                  </td>
                  <td class="px-5 py-3 text-right tabular-nums">
                    <template v-if="r.gdp.value !== null">
                      <span class="text-primary-700">{{ formatNumber(r.gdp.value) }}</span>
                      <span class="text-primary-400 text-xs ml-1">#{{ r.gdp.rank }}</span>
                    </template>
                    <span v-else class="text-primary-200">-</span>
                  </td>
                  <td class="px-5 py-3 text-right tabular-nums">
                    <template v-if="r.gdp.pct !== null">
                      <div class="flex items-center justify-end gap-2">
                        <div class="w-12 h-1 bg-primary-100 rounded-full overflow-hidden">
                          <div class="h-full bg-primary-300 rounded-full" :style="{ width: Math.min(r.gdp.pct, 100) + '%' }"></div>
                        </div>
                        <span class="text-primary-500 text-xs w-12 text-right">{{ r.gdp.pct }}%</span>
                      </div>
                    </template>
                    <span v-else class="text-primary-200">-</span>
                  </td>
                  <td class="px-5 py-3 text-right tabular-nums">
                    <template v-if="r.population.value !== null">
                      <span class="text-primary-700">{{ formatPopulation(r.population.value) }}</span>
                      <span class="text-primary-400 text-xs ml-1">#{{ r.population.rank }}</span>
                    </template>
                    <span v-else class="text-primary-200">-</span>
                  </td>
                  <td class="px-5 py-3 text-right tabular-nums">
                    <template v-if="r.population.pct !== null">
                      <div class="flex items-center justify-end gap-2">
                        <div class="w-12 h-1 bg-primary-100 rounded-full overflow-hidden">
                          <div class="h-full bg-primary-300 rounded-full" :style="{ width: Math.min(r.population.pct, 100) + '%' }"></div>
                        </div>
                        <span class="text-primary-500 text-xs w-12 text-right">{{ r.population.pct }}%</span>
                      </div>
                    </template>
                    <span v-else class="text-primary-200">-</span>
                  </td>
                  <td class="px-5 py-3 text-right tabular-nums hidden sm:table-cell">
                    <template v-if="r.co2.value !== null">
                      <span class="text-primary-700">{{ formatCO2(r.co2.value) }}</span>
                      <span class="text-primary-400 text-xs ml-1">#{{ r.co2.rank }}</span>
                    </template>
                    <span v-else class="text-primary-200">-</span>
                  </td>
                  <td class="px-5 py-3 text-right tabular-nums hidden sm:table-cell">
                    <template v-if="r.co2.pct !== null">
                      <div class="flex items-center justify-end gap-2">
                        <div class="w-12 h-1 bg-primary-100 rounded-full overflow-hidden">
                          <div class="h-full bg-primary-300 rounded-full" :style="{ width: Math.min(r.co2.pct, 100) + '%' }"></div>
                        </div>
                        <span class="text-primary-500 text-xs w-12 text-right">{{ r.co2.pct }}%</span>
                      </div>
                    </template>
                    <span v-else class="text-primary-200">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Loading skeleton for rankings -->
        <div v-else-if="rankingsPending" class="space-y-2 mb-8">
          <div v-for="i in 4" :key="i" class="skeleton h-12 rounded-lg" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <GroupCard v-for="g in (country as any).groups" :key="g.gid" :group="g" />
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
const iso = route.params.iso as string

const { country, error } = useCountry(iso)
const { stats, pending: statsPending } = useCountryStats(iso)
const { data: rankings, pending: rankingsPending } = useFetch(`/api/countries/${iso}/rankings`, { lazy: true })

useHead({
  title: computed(() => {
    const c = country.value as any
    return c ? `${c.name} — World Country Groups` : 'Loading...'
  }),
})
</script>
