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
        <NuxtLink :to="`/countries/${iso}`" class="hover:text-primary-900 transition-colors">{{ (country as any).name }}</NuxtLink>
        <span class="text-primary-300">/</span>
        <span class="text-primary-600">Voting Record</span>
      </nav>

      <!-- Header -->
      <div class="mb-10">
        <div class="flex items-center gap-4">
          <span v-if="(country as any).iso2" class="text-5xl">{{ isoToFlag((country as any).iso2) }}</span>
          <div>
            <h1 class="font-serif text-3xl sm:text-4xl font-bold text-primary-900">UN Voting Record</h1>
            <p class="text-primary-500 mt-1">{{ (country as any).name }}</p>
          </div>
        </div>
      </div>

      <!-- Session-by-Session Voting Summary -->
      <div class="mb-12">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Voting by Session</h2>

        <template v-if="countryVotesPending">
          <div class="space-y-3">
            <div v-for="i in 5" :key="i" class="skeleton h-8 rounded-lg" />
          </div>
        </template>

        <template v-else-if="countryVotesData?.available && votingSessions.length">
          <div class="bg-white rounded-2xl border border-primary-100 p-6">
            <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-4">Last {{ votingSessions.length }} Sessions</div>
            <div class="space-y-3">
              <div v-for="s in votingSessions" :key="s.session" class="flex items-center gap-3">
                <span class="text-xs text-primary-400 tabular-nums w-12 text-right">S{{ s.session }}</span>
                <div class="flex-1 flex h-5 rounded-full overflow-hidden bg-gray-100">
                  <div
                    v-if="s.yes > 0"
                    class="bg-emerald-400 transition-all"
                    :style="{ width: s.yesPct + '%' }"
                    :title="`Yes: ${s.yes} (${s.yesPct}%)`"
                  />
                  <div
                    v-if="s.no > 0"
                    class="bg-red-400 transition-all"
                    :style="{ width: s.noPct + '%' }"
                    :title="`No: ${s.no} (${s.noPct}%)`"
                  />
                  <div
                    v-if="s.abstain > 0"
                    class="bg-amber-400 transition-all"
                    :style="{ width: s.abstainPct + '%' }"
                    :title="`Abstain: ${s.abstain} (${s.abstainPct}%)`"
                  />
                  <div
                    v-if="s.nv > 0"
                    class="bg-gray-300 transition-all"
                    :style="{ width: s.nvPct + '%' }"
                    :title="`Non-voting: ${s.nv} (${s.nvPct}%)`"
                  />
                </div>
                <span class="text-xs text-primary-400 tabular-nums w-20 text-right">{{ s.total }} votes</span>
              </div>
            </div>
            <!-- Legend -->
            <div class="flex flex-wrap gap-4 mt-4 text-xs text-primary-500">
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-emerald-400"></span> Yes</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-red-400"></span> No</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-amber-400"></span> Abstain</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-gray-300"></span> Non-voting</span>
            </div>
          </div>
        </template>

        <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-8 text-center">
          <p class="text-primary-400">No UN voting data available for this country.</p>
        </div>
      </div>

      <!-- Search Votes by Issue -->
      <div v-if="countryVotesData?.available" class="mb-12">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Search Votes by Issue</h2>
        <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
          <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-primary-100">
            <select
              v-model="countryResTheme"
              class="text-sm border border-primary-200 rounded-lg px-3 py-2 bg-white text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option :value="undefined">All themes</option>
              <option v-for="t in countryResAvailableThemes" :key="t" :value="t">{{ t }}</option>
            </select>
            <input
              v-model="countryResSearchInput"
              type="text"
              placeholder="Search by topic (e.g. climate, human rights, nuclear)..."
              class="text-sm border border-primary-200 rounded-lg px-3 py-2 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div v-if="countryResPending && (countryResSearch || countryResTheme)" class="p-6 space-y-3">
            <div v-for="i in 5" :key="i" class="skeleton h-10 rounded-lg" />
          </div>

          <template v-else-if="(countryResSearch || countryResTheme) && countryResData?.resolutions?.length">
            <div class="divide-y divide-primary-50">
              <div v-for="r in countryResData.resolutions" :key="r.id">
                <button
                  class="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
                  @click="toggleSearchRes(r.id)"
                >
                  <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ r.date }}</span>
                  <span
                    class="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                    :class="countryVoteBadgeClass(r.vote)"
                  >{{ countryVoteLabel(r.vote) }}</span>
                  <span class="text-sm text-primary-700 flex-1 min-w-0">
                    <span class="truncate block">{{ r.title }}</span>
                    <span v-if="r.themes?.length" class="flex flex-wrap gap-1 mt-0.5">
                      <span
                        v-for="theme in r.themes"
                        :key="theme"
                        class="inline-block text-[10px] leading-tight px-1.5 py-0.5 rounded-full font-medium"
                        :class="themeBadgeClass(theme)"
                      >{{ theme }}</span>
                    </span>
                  </span>
                  <span class="flex items-center gap-1.5 text-xs tabular-nums whitespace-nowrap">
                    <span class="text-emerald-600">Y:{{ r.globalTally.yes }}</span>
                    <span class="text-red-600">N:{{ r.globalTally.no }}</span>
                    <span class="text-amber-600">A:{{ r.globalTally.abstain }}</span>
                  </span>
                  <svg class="w-4 h-4 text-primary-300 transition-transform" :class="expandedSearchRes === r.id ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
                </button>
                <div v-if="expandedSearchRes === r.id" class="px-5 pb-4">
                  <p class="text-sm text-primary-600">{{ r.title }}</p>
                  <p class="text-xs text-primary-400 mt-1">Session {{ r.session }} &middot; Resolution {{ r.id }}</p>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div class="flex items-center justify-between px-5 py-3 border-t border-primary-100 text-sm text-primary-500">
              <span>Showing {{ ((countryResData.page - 1) * 20) + 1 }}&ndash;{{ Math.min(countryResData.page * 20, countryResData.total) }} of {{ countryResData.total }}</span>
              <div class="flex gap-2">
                <button
                  :disabled="countryResData.page <= 1"
                  class="px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  @click="countryResPage--"
                >Prev</button>
                <button
                  :disabled="countryResData.page >= countryResData.pages"
                  class="px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  @click="countryResPage++"
                >Next</button>
              </div>
            </div>
          </template>

          <div v-else-if="(countryResSearch || countryResTheme) && !countryResPending" class="p-8 text-center text-primary-400">
            No resolutions found for the current filters.
          </div>

          <div v-else class="p-8 text-center text-primary-400 text-sm">
            Select a theme or enter a topic above to search this country's voting record.
          </div>
        </div>
      </div>

      <!-- Voting by Theme -->
      <div v-if="countryVotesData?.available" class="mb-12">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Voting by Theme</h2>
        <div v-if="countryThemeStatsPending" class="space-y-3">
          <div v-for="i in 5" :key="i" class="skeleton h-10 rounded-lg" />
        </div>
        <div v-else-if="countryThemeStatsData.length" class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
          <div class="divide-y divide-primary-50">
            <div v-for="ts in countryThemeStatsData" :key="ts.theme" class="px-5 py-3">
              <div class="flex items-center gap-4 mb-2">
                <span
                  class="inline-block text-xs leading-tight px-2 py-1 rounded-full font-medium whitespace-nowrap"
                  :class="themeBadgeClass(ts.theme)"
                >{{ ts.theme }}</span>
                <span class="text-xs text-primary-400 tabular-nums">{{ ts.resolutions }} resolutions</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="flex-1 flex h-3 rounded-full overflow-hidden bg-gray-100">
                  <div
                    v-if="ts.yes > 0"
                    class="bg-emerald-400"
                    :style="{ width: (ts.yes / ts.resolutions * 100) + '%' }"
                    :title="`Yes: ${ts.yes}`"
                  />
                  <div
                    v-if="ts.no > 0"
                    class="bg-red-400"
                    :style="{ width: (ts.no / ts.resolutions * 100) + '%' }"
                    :title="`No: ${ts.no}`"
                  />
                  <div
                    v-if="ts.abstain > 0"
                    class="bg-amber-400"
                    :style="{ width: (ts.abstain / ts.resolutions * 100) + '%' }"
                    :title="`Abstain: ${ts.abstain}`"
                  />
                </div>
                <span class="text-[10px] text-primary-400 tabular-nums whitespace-nowrap">
                  Y:{{ Math.round(ts.yes / ts.resolutions * 100) }}%
                  N:{{ Math.round(ts.no / ts.resolutions * 100) }}%
                  A:{{ Math.round(ts.abstain / ts.resolutions * 100) }}%
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-6 text-center">
          <p class="text-primary-400 text-sm">No theme stats available.</p>
        </div>
      </div>

      <!-- Theme Voting Trends -->
      <div v-if="countryVotesData?.available" class="mb-12">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Theme Voting Trends</h2>
        <div v-if="themeTrendsPending" class="space-y-3">
          <div v-for="i in 5" :key="i" class="skeleton h-8 rounded-lg" />
        </div>
        <div v-else-if="themeTrendsThemes.length" class="bg-white rounded-2xl border border-primary-100 p-6">
          <!-- Theme selector -->
          <div class="mb-5">
            <select
              v-model="selectedTrendTheme"
              class="text-sm border border-primary-200 rounded-lg px-3 py-2 bg-white text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option v-for="t in themeTrendsThemes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <!-- Decade bars -->
          <div v-if="selectedTrendData" class="space-y-3">
            <div v-for="d in selectedTrendData.decades" :key="d.decade" class="flex items-center gap-3">
              <span class="text-xs text-primary-400 tabular-nums w-12 text-right font-medium">{{ d.decade }}</span>
              <div
                class="flex h-5 rounded-full overflow-hidden bg-gray-100"
                :style="{ width: decadeBarWidth(d.resolutions) + '%', minWidth: '40px' }"
              >
                <div
                  v-if="d.yes > 0"
                  class="bg-emerald-400 transition-all"
                  :style="{ width: (d.yes / d.resolutions * 100) + '%' }"
                  :title="`Yes: ${d.yes}`"
                />
                <div
                  v-if="d.no > 0"
                  class="bg-red-400 transition-all"
                  :style="{ width: (d.no / d.resolutions * 100) + '%' }"
                  :title="`No: ${d.no}`"
                />
                <div
                  v-if="d.abstain > 0"
                  class="bg-amber-400 transition-all"
                  :style="{ width: (d.abstain / d.resolutions * 100) + '%' }"
                  :title="`Abstain: ${d.abstain}`"
                />
                <div
                  v-if="d.resolutions - d.yes - d.no - d.abstain > 0"
                  class="bg-gray-300 transition-all"
                  :style="{ width: ((d.resolutions - d.yes - d.no - d.abstain) / d.resolutions * 100) + '%' }"
                  :title="`Non-voting: ${d.resolutions - d.yes - d.no - d.abstain}`"
                />
              </div>
              <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">
                {{ d.resolutions }} res &middot; {{ d.resolutions > 0 ? Math.round(d.yes / d.resolutions * 100) : 0 }}% Yes
              </span>
            </div>

            <!-- Low-data warning -->
            <p v-if="selectedTrendData.decades.some((d: any) => d.resolutions > 0 && d.resolutions < 5)" class="text-xs text-amber-600 mt-2">
              * Some decades have fewer than 5 resolutions — trends may not be representative.
            </p>
          </div>

          <!-- Legend -->
          <div class="flex flex-wrap gap-4 mt-4 text-xs text-primary-500">
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-emerald-400"></span> Yes</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-red-400"></span> No</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-amber-400"></span> Abstain</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-gray-300"></span> Non-voting</span>
          </div>
        </div>
        <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-6 text-center">
          <p class="text-primary-400 text-sm">No theme trend data available.</p>
        </div>
      </div>

      <!-- Voting Alignment -->
      <div v-if="alignmentData?.mostAligned?.length" class="mb-12">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">
          Voting Alignment
          <span class="text-sm font-normal text-primary-400">(last {{ alignmentData.sessionsUsed }} sessions)</span>
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Most Aligned -->
          <div>
            <h3 class="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Most Aligned</h3>
            <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
              <div class="divide-y divide-primary-50">
                <NuxtLink
                  v-for="a in alignmentData.mostAligned.slice(0, 15)"
                  :key="a.iso3"
                  :to="`/countries/${a.iso3}`"
                  class="px-4 py-2.5 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
                >
                  <span class="text-sm text-primary-700 flex-1">{{ a.iso3 }}</span>
                  <div class="w-24 h-2 bg-primary-100 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-400 rounded-full" :style="{ width: (a.agreement * 100) + '%' }" />
                  </div>
                  <span class="text-xs text-emerald-600 font-semibold tabular-nums w-12 text-right">{{ (a.agreement * 100).toFixed(1) }}%</span>
                </NuxtLink>
              </div>
            </div>
          </div>
          <!-- Least Aligned -->
          <div>
            <h3 class="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Least Aligned</h3>
            <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
              <div class="divide-y divide-primary-50">
                <NuxtLink
                  v-for="a in alignmentData.leastAligned.slice(0, 15)"
                  :key="a.iso3"
                  :to="`/countries/${a.iso3}`"
                  class="px-4 py-2.5 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
                >
                  <span class="text-sm text-primary-700 flex-1">{{ a.iso3 }}</span>
                  <div class="w-24 h-2 bg-primary-100 rounded-full overflow-hidden">
                    <div class="h-full bg-red-400 rounded-full" :style="{ width: (a.agreement * 100) + '%' }" />
                  </div>
                  <span class="text-xs text-red-600 font-semibold tabular-nums w-12 text-right">{{ (a.agreement * 100).toFixed(1) }}%</span>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="space-y-6">
      <div class="skeleton h-10 w-64" />
      <div class="skeleton h-6 w-96" />
      <div class="skeleton h-32 rounded-xl" />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const iso = route.params.iso as string

const { country, error } = useCountry(iso)
const { votes: countryVotesRaw, pending: countryVotesPending } = useCountryVotes(iso)
const countryVotesData = computed(() => countryVotesRaw.value as any)

// Alignment
const { alignment: alignmentRaw } = useCountryAlignment(iso)
const alignmentData = computed(() => alignmentRaw.value as any)

// Issue search
const countryResPage = ref(1)
const countryResSearchInput = ref('')
const countryResSearch = ref('')
const countryResTheme = ref<string | undefined>(undefined)
const expandedSearchRes = ref<string | null>(null)

let countrySearchTimer: ReturnType<typeof setTimeout> | null = null
watch(countryResSearchInput, (val) => {
  if (countrySearchTimer) clearTimeout(countrySearchTimer)
  countrySearchTimer = setTimeout(() => {
    countryResSearch.value = val
    countryResPage.value = 1
    expandedSearchRes.value = null
  }, 300)
})

watch(countryResTheme, () => {
  countryResPage.value = 1
  expandedSearchRes.value = null
})

const { resolutions: countryResRaw, pending: countryResPending } = useCountryResolutions(iso, {
  page: countryResPage,
  search: countryResSearch,
  theme: countryResTheme,
})
const countryResAvailableThemes = computed(() => (countryResRaw.value as any)?.themes ?? [])
const countryResData = computed(() => countryResRaw.value as any)

function toggleSearchRes(id: string) {
  expandedSearchRes.value = expandedSearchRes.value === id ? null : id
}

// Theme stats
const { themeStats: countryThemeStatsRaw, pending: countryThemeStatsPending } = useCountryThemeStats(iso)
const countryThemeStatsData = computed(() => (countryThemeStatsRaw.value as any)?.stats ?? [])

// Theme trends
const { themeTrends: themeTrendsRaw, pending: themeTrendsPending } = useCountryThemeTrends(iso)
const themeTrendsData = computed(() => (themeTrendsRaw.value as any)?.trends ?? [])
const themeTrendsThemes = computed(() => themeTrendsData.value.map((t: any) => t.theme))
const selectedTrendTheme = ref<string>('')
watch(themeTrendsThemes, (themes) => {
  if (themes.length && !selectedTrendTheme.value) {
    selectedTrendTheme.value = themes[0]
  }
}, { immediate: true })
const selectedTrendData = computed(() => {
  if (!selectedTrendTheme.value) return null
  return themeTrendsData.value.find((t: any) => t.theme === selectedTrendTheme.value) ?? null
})
function decadeBarWidth(resolutions: number): number {
  if (!selectedTrendData.value) return 0
  const maxRes = Math.max(...selectedTrendData.value.decades.map((d: any) => d.resolutions))
  if (maxRes === 0) return 0
  return Math.max(15, Math.round((resolutions / maxRes) * 100))
}

// Session bar chart
const votingSessions = computed(() => {
  const sessions = countryVotesData.value?.sessions
  if (!sessions) return []
  const entries = Object.entries(sessions)
    .map(([key, val]: [string, any]) => {
      const session = parseInt(key)
      if (isNaN(session)) return null
      const total = val.yes + val.no + val.abstain + val.non_voting
      if (total === 0) return null
      return {
        session,
        yes: val.yes,
        no: val.no,
        abstain: val.abstain,
        nv: val.non_voting,
        total,
        yesPct: Math.round((val.yes / total) * 100),
        noPct: Math.round((val.no / total) * 100),
        abstainPct: Math.round((val.abstain / total) * 100),
        nvPct: Math.round((val.non_voting / total) * 100),
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.session - a.session)
    .slice(0, 10)
  return entries
})

function countryVoteBadgeClass(vote: string): string {
  switch (vote) {
    case 'Y': return 'bg-emerald-100 text-emerald-700'
    case 'N': return 'bg-red-100 text-red-700'
    case 'A': return 'bg-amber-100 text-amber-700'
    default: return 'bg-gray-100 text-gray-400'
  }
}

function countryVoteLabel(vote: string): string {
  switch (vote) {
    case 'Y': return 'Yes'
    case 'N': return 'No'
    case 'A': return 'Abstain'
    default: return 'NV'
  }
}

useHead({
  title: computed(() => {
    const c = country.value as any
    return c ? `${c.name} UN Voting Record — World Country Groups` : 'Loading...'
  }),
})
</script>
