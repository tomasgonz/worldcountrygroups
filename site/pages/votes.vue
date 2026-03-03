<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <!-- Dashboard Hero -->
    <section class="mb-10">
      <h1 class="font-serif text-3xl sm:text-4xl font-bold text-primary-900 mb-2">UN General Assembly Votes</h1>
      <p class="text-primary-400 text-sm mb-8">
        Explore resolutions, track how countries and groups voted on any issue.
      </p>
      <div v-if="meta" class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-white rounded-2xl border border-primary-100 p-5">
          <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-1">Total Resolutions</div>
          <div class="text-2xl font-serif font-bold text-primary-900 tabular-nums">{{ meta.totalResolutions.toLocaleString() }}</div>
        </div>
        <div class="bg-white rounded-2xl border border-primary-100 p-5">
          <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-1">Sessions Covered</div>
          <div class="text-2xl font-serif font-bold text-primary-900 tabular-nums">{{ meta.totalSessions }}</div>
        </div>
        <div class="bg-white rounded-2xl border border-primary-100 p-5">
          <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-1">Countries Voting</div>
          <div class="text-2xl font-serif font-bold text-primary-900 tabular-nums">{{ meta.totalCountries }}</div>
        </div>
        <div class="bg-white rounded-2xl border border-primary-100 p-5">
          <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-1">Latest Session</div>
          <div class="text-2xl font-serif font-bold text-primary-900 tabular-nums">{{ meta.lastSession ?? 'N/A' }}</div>
        </div>
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="skeleton h-24 rounded-2xl" />
      </div>
    </section>

    <!-- Search & Filters -->
    <section class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <select
          v-model="resSession"
          class="text-sm border border-primary-200 rounded-lg px-3 py-2.5 bg-white text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option :value="undefined">All sessions</option>
          <option v-for="s in availableSessions" :key="s" :value="s">{{ formatSession(s) }}</option>
        </select>
        <select
          v-model="resTheme"
          class="text-sm border border-primary-200 rounded-lg px-3 py-2.5 bg-white text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option :value="undefined">All themes</option>
          <option v-for="t in availableThemes" :key="t" :value="t">{{ t }}</option>
        </select>
        <input
          v-model="resSearchInput"
          type="text"
          placeholder="Search resolutions by title..."
          class="text-sm border border-primary-200 rounded-lg px-3 py-2.5 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      <!-- Entity Selectors -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Country Selector -->
        <div>
          <label class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2 block">Track Countries <span class="normal-case font-normal">(up to 10)</span></label>
          <div class="relative mb-3">
            <input
              v-model="countrySearchQuery"
              type="text"
              placeholder="Search for a country..."
              class="block w-full px-3 py-2 border border-primary-100 rounded-lg bg-white text-primary-900 placeholder-primary-300 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all"
              @focus="showCountryDropdown = true"
              @input="showCountryDropdown = true"
            />
            <div
              v-if="showCountryDropdown && filteredCountryOptions.length > 0"
              class="absolute z-20 left-0 right-0 mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-48 overflow-y-auto"
            >
              <button
                v-for="c in filteredCountryOptions"
                :key="c.iso3"
                class="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors flex items-center gap-2"
                @mousedown.prevent="addCountry(c)"
              >
                <span>{{ isoToFlag(c.iso2) }}</span>
                <span class="text-primary-900">{{ c.name }}</span>
                <span class="text-primary-300 text-xs ml-auto">{{ c.iso3 }}</span>
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="c in selectedCountries"
              :key="c.iso3"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700"
            >
              {{ isoToFlag(c.iso2) }} {{ c.name }}
              <button class="text-primary-300 hover:text-primary-600 transition-colors ml-0.5" @click="removeCountry(c.iso3)">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
            <span v-if="selectedCountries.length === 0" class="text-primary-300 text-sm">No countries selected</span>
          </div>
        </div>

        <!-- Group Selector -->
        <div>
          <label class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2 block">Track Groups <span class="normal-case font-normal">(up to 5)</span></label>
          <div class="relative mb-3">
            <input
              v-model="groupSearchQuery"
              type="text"
              placeholder="Search for a group..."
              class="block w-full px-3 py-2 border border-primary-100 rounded-lg bg-white text-primary-900 placeholder-primary-300 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all"
              @focus="showGroupDropdown = true"
              @input="showGroupDropdown = true"
            />
            <div
              v-if="showGroupDropdown && filteredGroupOptions.length > 0"
              class="absolute z-20 left-0 right-0 mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-48 overflow-y-auto"
            >
              <button
                v-for="g in filteredGroupOptions"
                :key="g.gid"
                class="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors flex items-center justify-between"
                @mousedown.prevent="addGroup(g)"
              >
                <span>
                  <span class="font-medium text-primary-900">{{ g.acronym }}</span>
                  <span class="text-primary-400 ml-2">{{ g.name }}</span>
                </span>
                <span class="text-primary-300 text-xs">{{ g.country_count }} countries</span>
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="g in selectedGroups"
              :key="g.gid"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700"
            >
              {{ g.acronym }}
              <button class="text-primary-300 hover:text-primary-600 transition-colors ml-0.5" @click="removeGroup(g.gid)">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
            <span v-if="selectedGroups.length === 0" class="text-primary-300 text-sm">No groups selected</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Resolution Results -->
    <section class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
      <!-- Loading -->
      <div v-if="resPending" class="p-6 space-y-3">
        <div v-for="i in 5" :key="i" class="skeleton h-12 rounded-lg" />
      </div>

      <!-- Results -->
      <template v-else-if="resData?.resolutions?.length">
        <div class="divide-y divide-primary-50">
          <div v-for="r in resData.resolutions" :key="r.id">
            <!-- Collapsed row -->
            <button
              class="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
              @click="toggleResolution(r.id)"
            >
              <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ r.date }}</span>
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
              <!-- Inline country vote badges -->
              <span v-if="r.countryVotes" class="flex items-center gap-1 flex-shrink-0">
                <span
                  v-for="(vote, code) in r.countryVotes"
                  :key="code"
                  class="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded"
                  :class="voteBadgeClass(vote)"
                  :title="`${code}: ${voteLabel(vote)}`"
                >
                  <span v-if="countryIso2Map[code as string]">{{ isoToFlag(countryIso2Map[code as string]) }}</span>
                  <span class="font-semibold">{{ voteLabel(vote) }}</span>
                </span>
              </span>
              <svg class="w-4 h-4 text-primary-300 transition-transform flex-shrink-0" :class="expandedRes === r.id ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
            </button>

            <!-- Expanded detail -->
            <div v-if="expandedRes === r.id" class="px-5 pb-4 space-y-3">
              <div class="text-xs text-primary-400">{{ r.id }} &middot; Session {{ r.session }}</div>
              <div class="text-sm text-primary-700">{{ r.title }}</div>

              <!-- Country votes -->
              <div v-if="r.countryVotes && selectedCountries.length" class="space-y-1">
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider">Country Votes</div>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(vote, code) in r.countryVotes"
                    :key="code"
                    class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                    :class="voteBadgeClass(vote)"
                  >
                    <span v-if="countryIso2Map[code as string]">{{ isoToFlag(countryIso2Map[code as string]) }}</span>
                    <span>{{ countryNameMap[code as string] || code }}</span>
                    <span class="font-semibold">{{ voteLabel(vote) }}</span>
                  </span>
                </div>
              </div>

              <!-- Group tallies -->
              <div v-if="r.groupTallies && selectedGroups.length" class="space-y-1">
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider">Group Tallies</div>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(tally, gid) in r.groupTallies"
                    :key="gid"
                    class="inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-primary-50 border border-primary-100"
                  >
                    <span class="font-medium text-primary-700">{{ groupAcronymMap[gid as string] || gid }}</span>
                    <span class="text-emerald-600">Y:{{ tally.yes }}</span>
                    <span class="text-red-600">N:{{ tally.no }}</span>
                    <span class="text-amber-600">A:{{ tally.abstain }}</span>
                    <span
                      class="text-xs px-1.5 py-0.5 rounded-full"
                      :class="isGroupConsensus(tally) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'"
                    >
                      {{ isGroupConsensus(tally) ? 'Consensus' : 'Split' }}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between px-5 py-3 border-t border-primary-100 text-sm text-primary-500">
          <span>Showing {{ ((resData.page - 1) * 20) + 1 }}&ndash;{{ Math.min(resData.page * 20, resData.total) }} of {{ resData.total }}</span>
          <div class="flex gap-2">
            <button
              :disabled="resData.page <= 1"
              class="px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              @click="resPage--"
            >Prev</button>
            <button
              :disabled="resData.page >= resData.pages"
              class="px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              @click="resPage++"
            >Next</button>
          </div>
        </div>
      </template>

      <!-- Empty states -->
      <div v-else-if="!resSearch && !resSession" class="p-12 text-center">
        <div class="text-primary-300 text-4xl mb-3">&#x1F50D;</div>
        <p class="text-primary-400 text-sm">Search for resolutions by title or filter by session to explore voting records.</p>
      </div>
      <div v-else class="p-8 text-center text-primary-400">
        No resolutions found for the current filters.
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'UN Voting — World Country Groups' })

const route = useRoute()
const router = useRouter()

// State
const resPage = ref(1)
const resSession = ref<number | undefined>(undefined)
const resTheme = ref<string | undefined>(undefined)
const resSearchInput = ref('')
const resSearch = ref('')
const expandedRes = ref<string | null>(null)

const selectedCountries = ref<{ iso2: string; iso3: string; name: string }[]>([])
const selectedGroups = ref<{ gid: string; acronym: string; name: string; country_count: number }[]>([])

const countrySearchQuery = ref('')
const groupSearchQuery = ref('')
const showCountryDropdown = ref(false)
const showGroupDropdown = ref(false)

// Debounce search
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(resSearchInput, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    resSearch.value = val
    resPage.value = 1
  }, 300)
})

watch(resSession, () => {
  resPage.value = 1
  expandedRes.value = null
})

watch(resTheme, () => {
  resPage.value = 1
  expandedRes.value = null
})

// Reactive arrays for composable
const countryIso3s = computed(() => selectedCountries.value.map(c => c.iso3))
const groupGids = computed(() => selectedGroups.value.map(g => g.gid))

// Fetch resolutions
const { resolutions: resRaw, pending: resPending } = useResolutions({
  page: resPage,
  session: resSession,
  search: resSearch,
  theme: resTheme,
  countries: countryIso3s,
  groups: groupGids,
})
const resData = computed(() => resRaw.value as any)
const availableSessions = computed(() => resData.value?.sessions ?? [])
const availableThemes = computed(() => resData.value?.themes ?? [])
const meta = computed(() => resData.value?.meta ?? null)

// Fetch countries for autocomplete
const { data: allCountries } = useFetch('/api/countries')

// Fetch groups for autocomplete
const { groups: allGroups } = useGroups()

// Lookup maps
const countryIso2Map = computed(() => {
  const m: Record<string, string> = {}
  for (const c of selectedCountries.value) m[c.iso3] = c.iso2
  return m
})

const countryNameMap = computed(() => {
  const m: Record<string, string> = {}
  for (const c of selectedCountries.value) m[c.iso3] = c.name
  return m
})

const groupAcronymMap = computed(() => {
  const m: Record<string, string> = {}
  for (const g of selectedGroups.value) m[g.gid] = g.acronym
  return m
})

// Autocomplete filtering
const filteredCountryOptions = computed(() => {
  if (!allCountries.value) return []
  const selected = new Set(selectedCountries.value.map(c => c.iso3))
  const q = countrySearchQuery.value.toLowerCase()
  return (allCountries.value as any[])
    .filter(c => !selected.has(c.iso3))
    .filter(c =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.iso3.toLowerCase().includes(q) ||
      c.iso2.toLowerCase().includes(q)
    )
    .slice(0, 15)
})

const filteredGroupOptions = computed(() => {
  if (!allGroups.value) return []
  const selected = new Set(selectedGroups.value.map(g => g.gid))
  const q = groupSearchQuery.value.toLowerCase()
  return (allGroups.value as any[])
    .filter(g => !selected.has(g.gid))
    .filter(g =>
      !q ||
      g.acronym.toLowerCase().includes(q) ||
      g.name.toLowerCase().includes(q) ||
      g.gid.toLowerCase().includes(q)
    )
    .slice(0, 15)
})

function addCountry(c: any) {
  if (selectedCountries.value.length >= 10) return
  if (selectedCountries.value.some(s => s.iso3 === c.iso3)) return
  selectedCountries.value.push({ iso2: c.iso2, iso3: c.iso3, name: c.name })
  countrySearchQuery.value = ''
  showCountryDropdown.value = false
  updateUrl()
}

function removeCountry(iso3: string) {
  selectedCountries.value = selectedCountries.value.filter(c => c.iso3 !== iso3)
  updateUrl()
}

function addGroup(g: any) {
  if (selectedGroups.value.length >= 5) return
  if (selectedGroups.value.some(s => s.gid === g.gid)) return
  selectedGroups.value.push({ gid: g.gid, acronym: g.acronym, name: g.name, country_count: g.country_count })
  groupSearchQuery.value = ''
  showGroupDropdown.value = false
  updateUrl()
}

function removeGroup(gid: string) {
  selectedGroups.value = selectedGroups.value.filter(g => g.gid !== gid)
  updateUrl()
}

// Deep-linking
function updateUrl() {
  const query: Record<string, string> = {}
  if (resSearch.value) query.search = resSearch.value
  if (resSession.value != null) query.session = String(resSession.value)
  if (resTheme.value) query.theme = resTheme.value
  if (selectedCountries.value.length) query.countries = selectedCountries.value.map(c => c.iso3).join(',')
  if (selectedGroups.value.length) query.groups = selectedGroups.value.map(g => g.gid).join(',')
  router.replace({ query })
}

watch(resSearch, updateUrl)
watch(resSession, updateUrl)
watch(resTheme, updateUrl)

// Close dropdowns on outside click
if (import.meta.client) {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.relative')) {
      showCountryDropdown.value = false
      showGroupDropdown.value = false
    }
  })
}

function toggleResolution(id: string) {
  expandedRes.value = expandedRes.value === id ? null : id
}

function formatSession(s: number): string {
  const str = String(s)
  if (str.includes('emsp')) return `Emergency Special ${str.replace('emsp', '')}`
  if (str.includes('sp')) return `Special ${str.replace('sp', '')}`
  return `Session ${s}`
}

function voteBadgeClass(vote: string): string {
  switch (vote) {
    case 'Y': return 'bg-emerald-100 text-emerald-700'
    case 'N': return 'bg-red-100 text-red-700'
    case 'A': return 'bg-amber-100 text-amber-700'
    default: return 'bg-gray-100 text-gray-400'
  }
}

function voteLabel(vote: string): string {
  switch (vote) {
    case 'Y': return 'Yes'
    case 'N': return 'No'
    case 'A': return 'Abs'
    default: return 'NV'
  }
}

function isGroupConsensus(tally: any): boolean {
  const total = tally.yes + tally.no + tally.abstain
  if (total === 0) return true
  const maxVote = Math.max(tally.yes, tally.no, tally.abstain)
  return maxVote / total >= 0.85
}

// Restore from URL on mount
onMounted(async () => {
  const q = route.query

  if (q.search) {
    resSearchInput.value = q.search as string
    resSearch.value = q.search as string
  }
  if (q.session) {
    resSession.value = Number(q.session)
  }
  if (q.theme) {
    resTheme.value = q.theme as string
  }

  // Restore countries
  if (q.countries) {
    const codes = (q.countries as string).split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
    if (codes.length) {
      // Wait for country list
      const waitForCountries = () => new Promise<void>((resolve) => {
        if (allCountries.value) return resolve()
        const stop = watch(allCountries, (val) => {
          if (val) { stop(); resolve() }
        })
      })
      await waitForCountries()
      for (const code of codes.slice(0, 10)) {
        const match = (allCountries.value as any[]).find(c => c.iso3 === code)
        if (match) {
          selectedCountries.value.push({ iso2: match.iso2, iso3: match.iso3, name: match.name })
        }
      }
    }
  }

  // Restore groups
  if (q.groups) {
    const gids = (q.groups as string).split(',').map(g => g.trim().toLowerCase()).filter(Boolean)
    if (gids.length) {
      const waitForGroups = () => new Promise<void>((resolve) => {
        if (allGroups.value) return resolve()
        const stop = watch(allGroups, (val) => {
          if (val) { stop(); resolve() }
        })
      })
      await waitForGroups()
      for (const gid of gids.slice(0, 5)) {
        const match = (allGroups.value as any[]).find(g => g.gid === gid)
        if (match) {
          selectedGroups.value.push({ gid: match.gid, acronym: match.acronym, name: match.name, country_count: match.country_count })
        }
      }
    }
  }
})
</script>
