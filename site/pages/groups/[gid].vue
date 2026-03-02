<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div v-if="error" class="text-center py-20">
      <h1 class="font-serif text-2xl font-bold text-primary-300 mb-2">Group not found</h1>
      <NuxtLink to="/groups" class="text-primary-400 hover:text-primary-900 transition-colors">Browse all groups &rarr;</NuxtLink>
    </div>

    <template v-else-if="group">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-primary-400 mb-8">
        <NuxtLink to="/groups" class="hover:text-primary-900 transition-colors">Groups</NuxtLink>
        <span class="text-primary-300">/</span>
        <span class="text-primary-600">{{ (group as any).acronym }}</span>
      </nav>

      <!-- Header -->
      <div class="mb-12">
        <h1 class="font-serif text-3xl sm:text-4xl font-bold text-primary-900 mb-3">{{ (group as any).name }}</h1>
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <DomainTag v-for="d in (group as any).domains" :key="d" :domain="d" size="md" />
          <span class="text-xs text-primary-400 bg-primary-50 px-2.5 py-1 rounded-md">
            {{ (group as any).classifier }}
          </span>
        </div>
        <p class="text-primary-400 leading-relaxed max-w-3xl">{{ (group as any).description }}</p>
      </div>

      <!-- Stats -->
      <div class="mb-16">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Aggregate Statistics</h2>
        <GroupStats :stats="stats as any" :pending="statsPending" />
      </div>

      <!-- Country Breakdown -->
      <div class="mb-16">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-2">Country Breakdown</h2>
        <p class="text-primary-400 text-sm mb-6">Each country's share of the group's total GDP, population, and CO2 emissions.</p>

        <div v-if="breakdownPending" class="space-y-2">
          <div v-for="i in 8" :key="i" class="skeleton h-12 rounded-lg" />
        </div>

        <div v-else-if="breakdown" class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-primary-100 text-left">
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Country</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">GDP</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right w-24">%</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Population</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right w-24">%</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right hidden sm:table-cell">CO2</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right w-24 hidden sm:table-cell">%</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in (breakdown as any).countries"
                  :key="c.iso3 || c.name"
                  class="border-b border-primary-50 last:border-0 hover:bg-primary-50/50 transition-colors"
                >
                  <td class="px-5 py-3">
                    <NuxtLink :to="`/countries/${c.iso2 || c.iso3}`" class="flex items-center gap-2 hover:text-primary-600 transition-colors">
                      <span v-if="c.iso2" class="text-base">{{ isoToFlag(c.iso2) }}</span>
                      <span class="text-primary-800">{{ c.name }}</span>
                    </NuxtLink>
                  </td>
                  <td class="px-5 py-3 text-right text-primary-600 tabular-nums">
                    {{ c.gdp !== null ? formatCompact(c.gdp) : '—' }}
                  </td>
                  <td class="px-5 py-3 text-right w-24">
                    <div v-if="c.gdpPct !== null" class="flex items-center justify-end gap-2">
                      <div class="w-16 h-1 bg-primary-100 rounded-full overflow-hidden">
                        <div class="h-full bg-primary-300 rounded-full" :style="{ width: Math.min(c.gdpPct, 100) + '%' }"></div>
                      </div>
                      <span class="text-primary-400 text-xs tabular-nums w-12 text-right">{{ c.gdpPct }}%</span>
                    </div>
                    <span v-else class="text-primary-200">—</span>
                  </td>
                  <td class="px-5 py-3 text-right text-primary-600 tabular-nums">
                    {{ c.population !== null ? formatCompactPop(c.population) : '—' }}
                  </td>
                  <td class="px-5 py-3 text-right w-24">
                    <div v-if="c.populationPct !== null" class="flex items-center justify-end gap-2">
                      <div class="w-16 h-1 bg-primary-100 rounded-full overflow-hidden">
                        <div class="h-full bg-primary-300 rounded-full" :style="{ width: Math.min(c.populationPct, 100) + '%' }"></div>
                      </div>
                      <span class="text-primary-400 text-xs tabular-nums w-12 text-right">{{ c.populationPct }}%</span>
                    </div>
                    <span v-else class="text-primary-200">—</span>
                  </td>
                  <td class="px-5 py-3 text-right text-primary-600 tabular-nums hidden sm:table-cell">
                    {{ c.co2 !== null ? formatCompactCO2(c.co2) : '—' }}
                  </td>
                  <td class="px-5 py-3 text-right w-24 hidden sm:table-cell">
                    <div v-if="c.co2Pct !== null" class="flex items-center justify-end gap-2">
                      <div class="w-16 h-1 bg-primary-100 rounded-full overflow-hidden">
                        <div class="h-full bg-primary-300 rounded-full" :style="{ width: Math.min(c.co2Pct, 100) + '%' }"></div>
                      </div>
                      <span class="text-primary-400 text-xs tabular-nums w-12 text-right">{{ c.co2Pct }}%</span>
                    </div>
                    <span v-else class="text-primary-200">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Countries -->
      <div>
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">
          Member Countries
          <span class="text-base font-normal text-primary-300">({{ (group as any).countries.length }})</span>
        </h2>
        <div class="flex flex-wrap gap-2">
          <CountryBadge v-for="c in (group as any).countries" :key="c.iso3 || c.name" :country="c" />
        </div>
      </div>
    </template>

    <div v-else class="space-y-6">
      <div class="skeleton h-10 w-64" />
      <div class="skeleton h-6 w-96" />
      <div class="grid grid-cols-3 gap-5">
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

const { data: breakdown, pending: breakdownPending } = useFetch(`/api/groups/${gid}/breakdown`)

function formatCompact(val: number): string {
  if (val >= 1e12) return '$' + (val / 1e12).toFixed(1) + 'T'
  if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B'
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(0) + 'M'
  return '$' + val.toLocaleString()
}

function formatCompactPop(val: number): string {
  if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B'
  if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M'
  if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K'
  return val.toLocaleString()
}

function formatCompactCO2(val: number): string {
  if (val >= 1e3) return (val / 1e3).toFixed(1) + ' Gt'
  if (val >= 1) return val.toFixed(1) + ' Mt'
  return (val * 1e3).toFixed(0) + ' kt'
}

useHead({
  title: computed(() => {
    const g = group.value as any
    return g ? `${g.acronym} — ${g.name} — World Country Groups` : 'Loading...'
  }),
})
</script>
