<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-3">Armed Conflict Events</h1>
    <p class="text-primary-500 mb-2">Conflict event data from <a href="https://acleddata.com/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">ACLED</a>, covering 2023&ndash;2025.</p>
    <p class="text-primary-400 text-sm mb-8">Events include battles, explosions &amp; remote violence, violence against civilians, protests, riots, and strategic developments.</p>

    <template v-if="pending">
      <div class="space-y-4">
        <div v-for="i in 6" :key="i" class="skeleton h-20 rounded-xl" />
      </div>
    </template>

    <template v-else-if="countries.length">
      <!-- Global Summary -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div class="bg-white rounded-2xl border border-primary-100 p-5 text-center">
          <div class="text-2xl font-serif font-bold text-primary-900">{{ countries.length }}</div>
          <div class="text-xs text-primary-400 uppercase tracking-wider mt-1">Countries Affected</div>
        </div>
        <div class="bg-white rounded-2xl border border-primary-100 p-5 text-center">
          <div class="text-2xl font-serif font-bold text-primary-900">{{ globalEvents.toLocaleString() }}</div>
          <div class="text-xs text-primary-400 uppercase tracking-wider mt-1">Total Events</div>
        </div>
        <div class="bg-white rounded-2xl border border-primary-100 p-5 text-center">
          <div class="text-2xl font-serif font-bold text-red-700">{{ globalFatalities.toLocaleString() }}</div>
          <div class="text-xs text-primary-400 uppercase tracking-wider mt-1">Total Fatalities</div>
        </div>
        <div class="bg-white rounded-2xl border border-primary-100 p-5 text-center">
          <div class="text-2xl font-serif font-bold text-red-600">{{ highIntensityCount }}</div>
          <div class="text-xs text-primary-400 uppercase tracking-wider mt-1">High Intensity</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          v-model="intensityFilter"
          class="text-sm border border-primary-200 rounded-lg px-3 py-2 bg-white text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="all">All intensities</option>
          <option value="high">High intensity</option>
          <option value="medium">Medium intensity</option>
          <option value="low">Low intensity</option>
        </select>
        <select
          v-model="sortBy"
          class="text-sm border border-primary-200 rounded-lg px-3 py-2 bg-white text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="fatalities">Sort by fatalities</option>
          <option value="events">Sort by events</option>
          <option value="name">Sort by name</option>
        </select>
        <input
          v-model="search"
          type="text"
          placeholder="Search country..."
          class="text-sm border border-primary-200 rounded-lg px-3 py-2 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      <!-- Country List -->
      <div class="space-y-3">
        <div
          v-for="c in filteredCountries"
          :key="c.iso3"
          class="bg-white rounded-2xl border border-primary-100 overflow-hidden"
        >
          <!-- Header row -->
          <button
            class="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
            @click="toggle(c.iso3)"
          >
            <span v-if="c.iso2" class="text-xl">{{ isoToFlag(c.iso2) }}</span>
            <div class="flex-1 min-w-0">
              <span class="text-sm font-medium text-primary-900">{{ c.name }}</span>
              <span class="text-xs text-primary-400 ml-2">{{ c.iso3 }}</span>
            </div>
            <span
              class="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
              :class="intensityClass(c.conflict_intensity)"
            >{{ c.conflict_intensity.toUpperCase() }}</span>
            <div class="hidden sm:flex items-center gap-4 text-xs tabular-nums">
              <span class="text-primary-500">{{ c.total_events.toLocaleString() }} events</span>
              <span class="text-red-600 font-semibold">{{ c.total_fatalities.toLocaleString() }} fatalities</span>
            </div>
            <svg
              class="w-4 h-4 text-primary-300 transition-transform shrink-0"
              :class="expanded === c.iso3 ? 'rotate-180' : ''"
              viewBox="0 0 20 20"
              fill="currentColor"
            ><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
          </button>

          <!-- Mobile stats (shown below header on small screens) -->
          <div class="sm:hidden px-5 pb-2 flex gap-4 text-xs tabular-nums" v-if="expanded !== c.iso3">
            <span class="text-primary-500">{{ c.total_events.toLocaleString() }} events</span>
            <span class="text-red-600 font-semibold">{{ c.total_fatalities.toLocaleString() }} fatalities</span>
          </div>

          <!-- Expanded details -->
          <div v-if="expanded === c.iso3" class="px-5 pb-5 border-t border-primary-100">
            <div class="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">

              <!-- By type breakdown -->
              <div>
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Events by Type</div>
                <div class="space-y-2">
                  <div v-for="(typeData, typeKey) in c.by_type" :key="typeKey" class="flex items-center gap-3">
                    <span class="text-xs text-primary-500 w-36 truncate capitalize">{{ formatType(typeKey as string) }}</span>
                    <div class="flex-1 h-4 bg-primary-50 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full"
                        :class="typeBarClass(typeKey as string)"
                        :style="{ width: Math.max((typeData.events / c.total_events) * 100, 1) + '%' }"
                      />
                    </div>
                    <span class="text-xs text-primary-500 tabular-nums w-16 text-right">{{ typeData.events.toLocaleString() }}</span>
                    <span class="text-xs text-red-500 tabular-nums w-16 text-right">{{ typeData.fatalities.toLocaleString() }} killed</span>
                  </div>
                </div>

                <!-- Fatalities by type -->
                <div class="mt-4">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Fatalities by Type</div>
                  <div class="space-y-2">
                    <div v-for="(typeData, typeKey) in c.by_type" :key="'f-' + typeKey">
                      <div v-if="typeData.fatalities > 0" class="flex items-center gap-3">
                        <span class="text-xs text-primary-500 w-36 truncate capitalize">{{ formatType(typeKey as string) }}</span>
                        <div class="flex-1 h-4 bg-red-50 rounded-full overflow-hidden">
                          <div
                            class="h-full rounded-full bg-red-300"
                            :style="{ width: Math.max((typeData.fatalities / c.total_fatalities) * 100, 1) + '%' }"
                          />
                        </div>
                        <span class="text-xs text-red-600 tabular-nums w-16 text-right font-medium">{{ Math.round(typeData.fatalities / c.total_fatalities * 100) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Year trend -->
              <div>
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Year-over-Year Trend</div>
                <div class="space-y-3">
                  <div v-for="t in c.trend" :key="t.year" class="flex items-center gap-3">
                    <span class="text-xs text-primary-400 tabular-nums w-10">{{ t.year }}</span>
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <div class="flex-1 h-3 bg-primary-50 rounded-full overflow-hidden">
                          <div
                            class="h-full bg-primary-300 rounded-full"
                            :style="{ width: Math.max((t.events / maxEvents(c)) * 100, 2) + '%' }"
                          />
                        </div>
                        <span class="text-xs text-primary-500 tabular-nums w-16 text-right">{{ t.events.toLocaleString() }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="flex-1 h-3 bg-red-50 rounded-full overflow-hidden">
                          <div
                            class="h-full bg-red-300 rounded-full"
                            :style="{ width: Math.max((t.fatalities / maxFatalities(c)) * 100, 2) + '%' }"
                          />
                        </div>
                        <span class="text-xs text-red-500 tabular-nums w-16 text-right">{{ t.fatalities.toLocaleString() }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="flex gap-4 text-[10px] text-primary-400 mt-1">
                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-primary-300"></span> Events</span>
                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-red-300"></span> Fatalities</span>
                  </div>
                </div>

                <!-- Summary stats -->
                <div class="mt-6 grid grid-cols-2 gap-3">
                  <div class="bg-primary-50 rounded-xl p-3 text-center">
                    <div class="text-lg font-serif font-bold text-primary-900">{{ c.total_events.toLocaleString() }}</div>
                    <div class="text-[10px] text-primary-400 uppercase">Total Events</div>
                  </div>
                  <div class="bg-red-50 rounded-xl p-3 text-center">
                    <div class="text-lg font-serif font-bold text-red-700">{{ c.total_fatalities.toLocaleString() }}</div>
                    <div class="text-[10px] text-primary-400 uppercase">Total Fatalities</div>
                  </div>
                </div>

                <NuxtLink
                  :to="`/countries/${c.iso3}`"
                  class="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-900 transition-colors"
                >
                  View full country profile
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!filteredCountries.length" class="bg-primary-50 rounded-2xl border border-primary-100 p-8 text-center">
        <p class="text-primary-400">No countries match the current filters.</p>
      </div>
    </template>

    <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-8 text-center">
      <p class="text-primary-400">No conflict data available.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Armed Conflict Events — World Country Groups' })

const { data: raw, pending } = useFetch('/api/conflicts')
const conflictData = computed(() => raw.value as any)

const expanded = ref<string | null>(null)
const intensityFilter = ref('all')
const sortBy = ref('fatalities')
const search = ref('')

function toggle(iso3: string) {
  expanded.value = expanded.value === iso3 ? null : iso3
}

const countries = computed(() => {
  if (!conflictData.value?.countries) return []
  return conflictData.value.countries as any[]
})

const filteredCountries = computed(() => {
  let list = [...countries.value]

  if (intensityFilter.value !== 'all') {
    list = list.filter((c: any) => c.conflict_intensity === intensityFilter.value)
  }

  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.iso3?.toLowerCase().includes(q)
    )
  }

  if (sortBy.value === 'fatalities') {
    list.sort((a: any, b: any) => b.total_fatalities - a.total_fatalities)
  } else if (sortBy.value === 'events') {
    list.sort((a: any, b: any) => b.total_events - a.total_events)
  } else {
    list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
  }

  return list
})

const globalEvents = computed(() =>
  countries.value.reduce((sum: number, c: any) => sum + c.total_events, 0)
)
const globalFatalities = computed(() =>
  countries.value.reduce((sum: number, c: any) => sum + c.total_fatalities, 0)
)
const highIntensityCount = computed(() =>
  countries.value.filter((c: any) => c.conflict_intensity === 'high').length
)

function maxEvents(c: any): number {
  return Math.max(...c.trend.map((t: any) => t.events), 1)
}

function maxFatalities(c: any): number {
  return Math.max(...c.trend.map((t: any) => t.fatalities), 1)
}

function intensityClass(intensity: string): string {
  switch (intensity) {
    case 'high': return 'bg-red-100 text-red-700'
    case 'medium': return 'bg-amber-100 text-amber-700'
    case 'low': return 'bg-emerald-100 text-emerald-700'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function formatType(key: string): string {
  return key.replace(/_/g, ' ')
}

function typeBarClass(typeKey: string): string {
  switch (typeKey) {
    case 'battles': return 'bg-red-400'
    case 'explosions_remote_violence': return 'bg-orange-400'
    case 'violence_against_civilians': return 'bg-rose-400'
    case 'protests': return 'bg-blue-400'
    case 'riots': return 'bg-amber-400'
    default: return 'bg-gray-400'
  }
}
</script>
