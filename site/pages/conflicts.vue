<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-3">Armed Conflict Events</h1>
    <p class="text-primary-500 mb-2">
      Organised violence recorded by the
      <a href="https://ucdp.uu.se/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">Uppsala Conflict Data Program</a><template v-if="meta?.period_start && meta?.period_end">, {{ formatDate(meta.period_start) }} to {{ formatDate(meta.period_end) }}</template>.
    </p>
    <p class="text-primary-400 text-sm mb-2">
      Each event is an incident of lethal violence: state-based armed conflict, non-state conflict between armed groups, or one-sided violence against civilians.
      Fatalities are UCDP best estimates. UCDP does not record protests or riots.
    </p>
    <p class="text-primary-400 text-xs mb-8">
      Source: {{ meta?.source || 'UCDP GED 26.1 and monthly candidate events, Uppsala University' }}.
      <template v-if="meta?.candidate_from">Events from {{ formatDate(meta.candidate_from) }} onward are provisional candidate events and may be revised.</template>
      <template v-if="meta?.last_updated">Updated {{ meta.last_updated }}.</template>
    </p>

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
          <div class="text-xs text-primary-400 uppercase tracking-wider mt-1">Fatalities (best est.)</div>
        </div>
        <div class="bg-white rounded-2xl border border-primary-100 p-5 text-center">
          <div class="text-2xl font-serif font-bold text-red-600">{{ highIntensityCount }}</div>
          <div class="text-xs text-primary-400 uppercase tracking-wider mt-1">High Intensity</div>
        </div>
      </div>

      <!-- Worldwide monthly series -->
      <div v-if="globalData?.monthly?.length" class="bg-white rounded-2xl border border-primary-100 p-5 mb-8">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <div class="text-xs text-primary-400 font-medium uppercase tracking-wider">Worldwide fatalities by month</div>
          <div v-if="globalData.last_12_months" class="text-xs text-primary-500">
            Last 12 months: {{ globalData.last_12_months.events.toLocaleString() }} events,
            {{ globalData.last_12_months.fatalities.toLocaleString() }} fatalities
          </div>
        </div>
        <div class="flex items-end gap-1 h-24">
          <div
            v-for="m in globalData.monthly"
            :key="m.month"
            class="flex-1 rounded-t"
            :class="isProvisional(m.month) ? 'bg-red-200' : 'bg-red-300'"
            :style="{ height: Math.max((m.fatalities / maxMonthly(globalData.monthly)) * 96, 2) + 'px' }"
            :title="`${m.month}: ${m.events.toLocaleString()} events, ${m.fatalities.toLocaleString()} fatalities`"
          />
        </div>
        <div class="flex justify-between text-[10px] text-primary-400 mt-1">
          <span>{{ globalData.monthly[0].month }}</span>
          <span>{{ globalData.monthly[globalData.monthly.length - 1].month }}</span>
        </div>
        <div class="flex flex-wrap gap-4 mt-3">
          <span v-for="(t, k) in globalData.by_type" :key="k" class="flex items-center gap-1.5 text-xs text-primary-500">
            <span class="w-2.5 h-2.5 rounded-sm" :class="typeBarClass(k as string)"></span>
            {{ formatType(k as string) }}: {{ t.fatalities.toLocaleString() }} killed
          </span>
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
          <option value="none">No events in last 12 months</option>
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
              <span v-if="c.latest_event_date" class="hidden md:inline text-[11px] text-primary-400 ml-2">latest event {{ c.latest_event_date }}</span>
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
                    <span class="text-xs text-primary-500 w-36 truncate">{{ formatType(typeKey as string) }}</span>
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
                        <span class="text-xs text-primary-500 w-36 truncate">{{ formatType(typeKey as string) }}</span>
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

                <!-- Monthly series -->
                <div v-if="c.monthly?.length" class="mt-4">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Fatalities by Month</div>
                  <div class="flex items-end gap-0.5 h-16">
                    <div
                      v-for="m in c.monthly"
                      :key="m.month"
                      class="flex-1 rounded-t"
                      :class="isProvisional(m.month) ? 'bg-red-200' : 'bg-red-300'"
                      :style="{ height: (m.fatalities > 0 ? Math.max((m.fatalities / maxMonthly(c.monthly)) * 64, 2) : 0) + 'px' }"
                      :title="`${m.month}: ${m.events.toLocaleString()} events, ${m.fatalities.toLocaleString()} fatalities`"
                    />
                  </div>
                  <div class="flex justify-between text-[10px] text-primary-400 mt-1">
                    <span>{{ c.monthly[0].month }}</span>
                    <span>{{ c.monthly[c.monthly.length - 1].month }}</span>
                  </div>
                </div>

                <!-- Top conflicts -->
                <div v-if="c.top_conflicts?.length" class="mt-4">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Deadliest Conflicts</div>
                  <div v-for="tc in c.top_conflicts" :key="tc.id" class="flex items-baseline gap-2 text-xs py-1 border-b border-primary-50 last:border-0">
                    <span class="w-2 h-2 rounded-sm shrink-0" :class="typeBarClass(tc.type)" :title="formatType(tc.type)"></span>
                    <span class="text-primary-700 flex-1 min-w-0 truncate" :title="tc.name">{{ tc.name }}</span>
                    <span class="text-primary-400 tabular-nums shrink-0">{{ tc.events.toLocaleString() }} ev.</span>
                    <span class="text-red-500 tabular-nums shrink-0 w-20 text-right">{{ tc.fatalities.toLocaleString() }}</span>
                  </div>
                </div>
              </div>

              <!-- Year trend -->
              <div>
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Year-over-Year Trend</div>
                <div class="space-y-3">
                  <div v-for="t in c.trend" :key="t.year" class="flex items-center gap-3">
                    <span class="text-xs text-primary-400 tabular-nums w-10" :title="t.partial ? `Through ${t.through}${t.provisional ? ' (provisional)' : ''}` : ''">{{ t.year }}<span v-if="t.partial">*</span></span>
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
                <div v-if="c.trend.some((t: any) => t.partial)" class="text-[10px] text-primary-400 mt-2">* year to date{{ c.trend.some((t: any) => t.provisional) ? ', provisional candidate events' : '' }}</div>
                <div class="mt-6 grid grid-cols-2 gap-3">
                  <div class="bg-primary-50 rounded-xl p-3 text-center">
                    <div class="text-lg font-serif font-bold text-primary-900">{{ c.total_events.toLocaleString() }}</div>
                    <div class="text-[10px] text-primary-400 uppercase">Total Events</div>
                  </div>
                  <div class="bg-red-50 rounded-xl p-3 text-center">
                    <div class="text-lg font-serif font-bold text-red-700">{{ c.total_fatalities.toLocaleString() }}</div>
                    <div class="text-[10px] text-primary-400 uppercase">Total Fatalities</div>
                    <div v-if="c.fatalities_low != null && c.fatalities_high != null" class="text-[10px] text-primary-400">range {{ c.fatalities_low.toLocaleString() }}&ndash;{{ c.fatalities_high.toLocaleString() }}</div>
                  </div>
                  <div v-if="c.last_12_months" class="bg-primary-50 rounded-xl p-3 text-center">
                    <div class="text-lg font-serif font-bold text-primary-900">{{ c.last_12_months.fatalities.toLocaleString() }}</div>
                    <div class="text-[10px] text-primary-400 uppercase">Fatalities, last 12 months</div>
                  </div>
                  <div v-if="c.civilian_deaths != null" class="bg-rose-50 rounded-xl p-3 text-center">
                    <div class="text-lg font-serif font-bold text-rose-700">{{ c.civilian_deaths.toLocaleString() }}</div>
                    <div class="text-[10px] text-primary-400 uppercase">Civilian Deaths</div>
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
const meta = computed(() => conflictData.value?.meta || null)
const globalData = computed(() => conflictData.value?.global || null)

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

const TYPE_LABELS: Record<string, string> = {
  state_based: 'State-based conflict',
  non_state: 'Non-state conflict',
  one_sided: 'One-sided violence',
}

function formatType(key: string): string {
  return TYPE_LABELS[key] || key.replace(/_/g, ' ')
}

function typeBarClass(typeKey: string): string {
  switch (typeKey) {
    case 'state_based': return 'bg-red-400'
    case 'non_state': return 'bg-orange-400'
    case 'one_sided': return 'bg-rose-400'
    default: return 'bg-gray-400'
  }
}

function maxMonthly(months: { fatalities: number }[]): number {
  return Math.max(...months.map(m => m.fatalities), 1)
}

// Months covered only by UCDP candidate (provisional) events
function isProvisional(month: string): boolean {
  const from = meta.value?.candidate_from
  return !!from && month >= String(from).slice(0, 7)
}

function formatDate(d: string): string {
  const dt = new Date(d + 'T00:00:00Z')
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
</script>
