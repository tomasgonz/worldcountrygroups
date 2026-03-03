<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-1">Compare Groups</h1>
    <p class="text-primary-400 text-sm mb-8">Select 2-5 groups to compare side by side.</p>

    <!-- Group Selector -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 mb-10">
      <div class="relative mb-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search for a group to add..."
          class="block w-full px-4 py-2.5 border border-primary-100 rounded-lg bg-white text-primary-900 placeholder-primary-300 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all"
          @focus="showDropdown = true"
          @input="showDropdown = true"
        />
        <!-- Autocomplete dropdown -->
        <div
          v-if="showDropdown && filteredOptions.length > 0"
          class="absolute z-20 left-0 right-0 mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-60 overflow-y-auto"
        >
          <button
            v-for="g in filteredOptions"
            :key="g.gid"
            class="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 transition-colors flex items-center justify-between"
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

      <!-- Selected chips -->
      <div class="flex flex-wrap gap-2 mb-4">
        <span
          v-for="g in selectedGroups"
          :key="g.gid"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700"
        >
          {{ g.acronym }}
          <button
            class="text-primary-300 hover:text-primary-600 transition-colors ml-0.5"
            @click="removeGroup(g.gid)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
        <span v-if="selectedGroups.length === 0" class="text-primary-300 text-sm">No groups selected</span>
      </div>

      <button
        :disabled="selectedGroups.length < 2 || loading"
        class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary-900 text-white text-sm rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        @click="doCompare"
      >
        <template v-if="loading">
          <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Comparing...
        </template>
        <template v-else>
          Compare
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </template>
      </button>
    </div>

    <!-- Results -->
    <template v-if="result">
      <!-- Stats Table -->
      <div class="mb-10">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Statistics</h2>
        <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-primary-100 text-left">
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Metric</th>
                  <th
                    v-for="g in result.groups"
                    :key="g.gid"
                    class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right"
                  >
                    {{ g.acronym }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-primary-50">
                  <td class="px-5 py-3 text-primary-600 font-medium">Countries</td>
                  <td
                    v-for="g in result.groups"
                    :key="g.gid"
                    class="px-5 py-3 text-right text-primary-800 tabular-nums"
                  >
                    {{ g.country_count }}
                  </td>
                </tr>
                <tr class="border-b border-primary-50">
                  <td class="px-5 py-3 text-primary-600 font-medium">GDP (nominal)</td>
                  <td
                    v-for="g in result.groups"
                    :key="g.gid"
                    class="px-5 py-3 text-right text-primary-800 tabular-nums"
                  >
                    {{ formatNumber(g.stats?.gdp?.total) }}
                  </td>
                </tr>
                <tr class="border-b border-primary-50">
                  <td class="px-5 py-3 text-primary-600 font-medium">Population</td>
                  <td
                    v-for="g in result.groups"
                    :key="g.gid"
                    class="px-5 py-3 text-right text-primary-800 tabular-nums"
                  >
                    {{ formatPopulation(g.stats?.population?.total) }}
                  </td>
                </tr>
                <tr class="border-b border-primary-50">
                  <td class="px-5 py-3 text-primary-600 font-medium">CO2 Emissions</td>
                  <td
                    v-for="g in result.groups"
                    :key="g.gid"
                    class="px-5 py-3 text-right text-primary-800 tabular-nums"
                  >
                    {{ formatCO2(g.stats?.co2?.total) }}
                  </td>
                </tr>
                <tr>
                  <td class="px-5 py-3 text-primary-600 font-medium">Domains</td>
                  <td
                    v-for="g in result.groups"
                    :key="g.gid"
                    class="px-5 py-3 text-right"
                  >
                    <div class="flex flex-wrap justify-end gap-1">
                      <DomainTag v-for="d in g.domains" :key="d" :domain="d" size="sm" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Overlap Matrix -->
      <div class="mb-10">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Country Overlap</h2>
        <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-primary-100 text-left">
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider"></th>
                  <th
                    v-for="g in result.groups"
                    :key="g.gid"
                    class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-center"
                  >
                    {{ g.acronym }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, ri) in result.groups"
                  :key="row.gid"
                  class="border-b border-primary-50 last:border-0"
                >
                  <td class="px-5 py-3 font-medium text-primary-600">{{ row.acronym }}</td>
                  <td
                    v-for="(col, ci) in result.groups"
                    :key="col.gid"
                    class="px-5 py-3 text-center"
                  >
                    <template v-if="ri === ci">
                      <span class="text-primary-300">{{ row.country_count }}</span>
                    </template>
                    <template v-else>
                      <button
                        class="text-accent-600 hover:text-accent-700 font-medium tabular-nums hover:underline"
                        @click="togglePairExpand(row.gid, col.gid)"
                      >
                        {{ getPairCount(row.gid, col.gid) }}
                      </button>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Expanded pair detail -->
          <div v-if="expandedPair" class="border-t border-primary-100 px-5 py-4 bg-primary-50/50">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium text-primary-700">
                Shared between {{ expandedPairLabel }}
              </span>
              <button class="text-primary-400 hover:text-primary-600 text-xs" @click="expandedPair = null">Close</button>
            </div>
            <div class="flex flex-wrap gap-2">
              <CountryBadge
                v-for="c in expandedPairCountries"
                :key="c.iso2 || c.iso3"
                :country="c"
              />
              <span v-if="expandedPairCountries.length === 0" class="text-primary-300 text-sm">No shared countries</span>
            </div>
          </div>
        </div>

        <!-- Common to all -->
        <div v-if="result.overlap.common.length > 0" class="mt-5">
          <h3 class="text-sm font-medium text-primary-700 mb-3">
            Common to all {{ result.groups.length }} groups
            <span class="text-primary-400 font-normal">({{ result.overlap.common.length }})</span>
          </h3>
          <div class="flex flex-wrap gap-2">
            <CountryBadge
              v-for="c in result.overlap.common"
              :key="c.iso2 || c.iso3"
              :country="c"
            />
          </div>
        </div>
      </div>

      <!-- Unique Members -->
      <div class="mb-10">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Unique Members</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            v-for="g in result.groups"
            :key="g.gid"
            class="bg-white rounded-2xl border border-primary-100 p-6"
          >
            <h3 class="font-medium text-primary-900 mb-1">{{ g.acronym }}</h3>
            <p class="text-primary-400 text-xs mb-3">
              {{ (result.unique[g.gid] || []).length }} exclusive {{ (result.unique[g.gid] || []).length === 1 ? 'member' : 'members' }}
            </p>
            <div class="flex flex-wrap gap-2">
              <CountryBadge
                v-for="c in (result.unique[g.gid] || [])"
                :key="c.iso2 || c.iso3"
                :country="c"
              />
              <span v-if="(result.unique[g.gid] || []).length === 0" class="text-primary-300 text-sm">None — all members shared</span>
            </div>
          </div>
        </div>
      </div>

      <!-- All Members by Group -->
      <div class="mb-10">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">All Members by Group</h2>
        <div class="space-y-5">
          <div
            v-for="g in result.groups"
            :key="g.gid"
            class="bg-white rounded-2xl border border-primary-100 p-6"
          >
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-medium text-primary-900">
                <NuxtLink :to="`/groups/${g.gid}`" class="hover:text-primary-600 transition-colors">
                  {{ g.acronym }}
                </NuxtLink>
                <span class="text-primary-400 font-normal ml-1.5 text-sm">{{ g.name }}</span>
              </h3>
              <span class="text-primary-400 text-xs">{{ g.country_count }} countries</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <CountryBadge
                v-for="c in g.countries"
                :key="c.iso2 || c.iso3"
                :country="c"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Voting Comparison -->
      <div>
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-1">Voting Comparison</h2>
        <p class="text-primary-400 text-sm mb-5">Search UN General Assembly resolutions to compare how each group voted.</p>

        <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
          <!-- Controls -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-primary-100">
            <select
              v-model="voteResSession"
              class="text-sm border border-primary-200 rounded-lg px-3 py-2 bg-white text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option :value="undefined">All sessions</option>
              <option v-for="s in voteAvailableSessions" :key="s" :value="s">{{ formatSession(s) }}</option>
            </select>
            <input
              v-model="voteResSearchInput"
              type="text"
              placeholder="Search resolutions by title..."
              class="text-sm border border-primary-200 rounded-lg px-3 py-2 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <!-- Loading -->
          <div v-if="voteResPending" class="p-6 space-y-3">
            <div v-for="i in 5" :key="i" class="skeleton h-12 rounded-lg" />
          </div>

          <!-- Resolution list -->
          <template v-else-if="voteResData?.resolutions?.length">
            <div class="divide-y divide-primary-50">
              <div v-for="r in voteResData.resolutions" :key="r.id">
                <!-- Collapsed row -->
                <button
                  class="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
                  @click="toggleVoteRes(r.id)"
                >
                  <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ r.date }}</span>
                  <span class="text-sm text-primary-700 flex-1 truncate">{{ r.title }}</span>
                  <span class="flex items-center gap-1.5 text-xs tabular-nums whitespace-nowrap">
                    <span class="text-emerald-600">Y:{{ r.globalTally.yes }}</span>
                    <span class="text-red-600">N:{{ r.globalTally.no }}</span>
                    <span class="text-amber-600">A:{{ r.globalTally.abstain }}</span>
                  </span>
                  <!-- Inline per-group badges -->
                  <span v-if="r.groupTallies" class="flex items-center gap-1 flex-shrink-0">
                    <span
                      v-for="(tally, gid) in r.groupTallies"
                      :key="gid"
                      class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                      :class="isGroupConsensus(tally) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                    >
                      <span class="font-medium">{{ voteGroupAcronymMap[gid as string] || gid }}</span>
                      <span>{{ isGroupConsensus(tally) ? 'C' : 'S' }}</span>
                    </span>
                  </span>
                  <svg class="w-4 h-4 text-primary-300 transition-transform flex-shrink-0" :class="voteExpandedRes === r.id ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
                </button>

                <!-- Expanded detail -->
                <div v-if="voteExpandedRes === r.id" class="px-5 pb-4 space-y-3">
                  <div class="text-xs text-primary-400">{{ r.id }} &middot; Session {{ r.session }}</div>
                  <div class="text-sm text-primary-700">{{ r.title }}</div>

                  <!-- Per-group tally cards -->
                  <div v-if="r.groupTallies" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div
                      v-for="(tally, gid) in r.groupTallies"
                      :key="gid"
                      class="rounded-xl border border-primary-100 p-3"
                    >
                      <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-primary-800 text-sm">{{ voteGroupAcronymMap[gid as string] || gid }}</span>
                        <span
                          class="text-xs px-1.5 py-0.5 rounded-full"
                          :class="isGroupConsensus(tally) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'"
                        >
                          {{ isGroupConsensus(tally) ? 'Consensus' : 'Split' }}
                        </span>
                      </div>
                      <div class="flex items-center gap-3 text-xs tabular-nums">
                        <span class="text-emerald-600">Yes: {{ tally.yes }}</span>
                        <span class="text-red-600">No: {{ tally.no }}</span>
                        <span class="text-amber-600">Abs: {{ tally.abstain }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div class="flex items-center justify-between px-5 py-3 border-t border-primary-100 text-sm text-primary-500">
              <span>Showing {{ ((voteResData.page - 1) * 20) + 1 }}&ndash;{{ Math.min(voteResData.page * 20, voteResData.total) }} of {{ voteResData.total }}</span>
              <div class="flex gap-2">
                <button
                  :disabled="voteResData.page <= 1"
                  class="px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  @click="voteResPage--"
                >Prev</button>
                <button
                  :disabled="voteResData.page >= voteResData.pages"
                  class="px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  @click="voteResPage++"
                >Next</button>
              </div>
            </div>
          </template>

          <!-- Empty state -->
          <div v-else class="p-8 text-center text-primary-400">
            No resolutions found for the current filters.
          </div>
        </div>
      </div>
    </template>

    <!-- Error -->
    <div v-else-if="errorMsg" class="bg-white rounded-2xl border border-red-100 p-6 text-center">
      <p class="text-red-600 text-sm">{{ errorMsg }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Compare Groups — World Country Groups' })

const route = useRoute()
const router = useRouter()

const { groups: allGroups } = useGroups()

const searchQuery = ref('')
const showDropdown = ref(false)
const selectedGroups = ref<{ gid: string; acronym: string; name: string; country_count: number }[]>([])
const loading = ref(false)
const result = ref<any>(null)
const errorMsg = ref('')
const expandedPair = ref<string | null>(null)

// Voting comparison state
const voteResPage = ref(1)
const voteResSession = ref<number | undefined>(undefined)
const voteResSearchInput = ref('')
const voteResSearch = ref('')
const voteExpandedRes = ref<string | null>(null)

const compareGroupGids = computed(() => selectedGroups.value.map(g => g.gid))
const emptyCountries = ref<string[]>([])

const { resolutions: voteResRaw, pending: voteResPending } = useResolutions({
  page: voteResPage,
  session: voteResSession,
  search: voteResSearch,
  countries: emptyCountries,
  groups: compareGroupGids,
})
const voteResData = computed(() => voteResRaw.value as any)
const voteAvailableSessions = computed(() => voteResData.value?.sessions ?? [])

const voteGroupAcronymMap = computed(() => {
  const m: Record<string, string> = {}
  for (const g of selectedGroups.value) m[g.gid] = g.acronym
  return m
})

// Debounce voting search
let voteSearchTimer: ReturnType<typeof setTimeout> | null = null
watch(voteResSearchInput, (val) => {
  if (voteSearchTimer) clearTimeout(voteSearchTimer)
  voteSearchTimer = setTimeout(() => {
    voteResSearch.value = val
    voteResPage.value = 1
  }, 300)
})

watch(voteResSession, () => {
  voteResPage.value = 1
  voteExpandedRes.value = null
})

// Auto-select the latest session once data arrives
watch(voteAvailableSessions, (sessions) => {
  if (sessions?.length && voteResSession.value == null && !voteResSearch.value) {
    voteResSession.value = sessions[0]
  }
})

function toggleVoteRes(id: string) {
  voteExpandedRes.value = voteExpandedRes.value === id ? null : id
}

function formatSession(s: number): string {
  const str = String(s)
  if (str.includes('emsp')) return `Emergency Special ${str.replace('emsp', '')}`
  if (str.includes('sp')) return `Special ${str.replace('sp', '')}`
  return `Session ${s}`
}

function isGroupConsensus(tally: any): boolean {
  const total = tally.yes + tally.no + tally.abstain
  if (total === 0) return true
  const maxVote = Math.max(tally.yes, tally.no, tally.abstain)
  return maxVote / total >= 0.85
}

// Close dropdown on outside click
if (import.meta.client) {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.relative')) {
      showDropdown.value = false
    }
  })
}

const filteredOptions = computed(() => {
  if (!allGroups.value) return []
  const selectedGids = new Set(selectedGroups.value.map(g => g.gid))
  const q = searchQuery.value.toLowerCase()
  return (allGroups.value as any[])
    .filter(g => !selectedGids.has(g.gid))
    .filter(g =>
      !q ||
      g.acronym.toLowerCase().includes(q) ||
      g.name.toLowerCase().includes(q) ||
      g.gid.toLowerCase().includes(q)
    )
    .slice(0, 20)
})

function addGroup(g: any) {
  if (selectedGroups.value.length >= 5) return
  if (selectedGroups.value.some(s => s.gid === g.gid)) return
  selectedGroups.value.push({ gid: g.gid, acronym: g.acronym, name: g.name, country_count: g.country_count })
  searchQuery.value = ''
  showDropdown.value = false
}

function removeGroup(gid: string) {
  selectedGroups.value = selectedGroups.value.filter(g => g.gid !== gid)
}

async function doCompare() {
  if (selectedGroups.value.length < 2) return
  loading.value = true
  errorMsg.value = ''
  result.value = null
  expandedPair.value = null

  const gids = selectedGroups.value.map(g => g.gid).join(',')

  try {
    const data = await $fetch(`/api/groups/compare?groups=${gids}`)
    result.value = data
    // Update URL after successful fetch
    router.replace({ query: { groups: gids } })
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || e?.message || 'Failed to compare groups'
  } finally {
    loading.value = false
  }
}

// Overlap helpers
function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function getPairCount(a: string, b: string): number {
  if (!result.value) return 0
  const key = pairKey(a, b)
  return result.value.overlap.pairs[key]?.length ?? 0
}

function togglePairExpand(a: string, b: string) {
  const key = pairKey(a, b)
  expandedPair.value = expandedPair.value === key ? null : key
}

const expandedPairLabel = computed(() => {
  if (!expandedPair.value || !result.value) return ''
  const [a, b] = expandedPair.value.split(':')
  const ga = result.value.groups.find((g: any) => g.gid === a)
  const gb = result.value.groups.find((g: any) => g.gid === b)
  return `${ga?.acronym ?? a} and ${gb?.acronym ?? b}`
})

const expandedPairCountries = computed(() => {
  if (!expandedPair.value || !result.value) return []
  return result.value.overlap.pairs[expandedPair.value] ?? []
})

// Deep-link: auto-load from URL query
onMounted(async () => {
  const groupsParam = route.query.groups as string
  if (!groupsParam) return

  // Wait for allGroups to be available
  const waitForGroups = () => new Promise<void>((resolve) => {
    if (allGroups.value) return resolve()
    const stop = watch(allGroups, (val) => {
      if (val) { stop(); resolve() }
    })
  })
  await waitForGroups()

  const gids = groupsParam.split(',').map(g => g.trim().toLowerCase()).filter(Boolean)
  for (const gid of gids.slice(0, 5)) {
    const match = (allGroups.value as any[]).find(g => g.gid === gid)
    if (match) {
      selectedGroups.value.push({ gid: match.gid, acronym: match.acronym, name: match.name, country_count: match.country_count })
    }
  }

  if (selectedGroups.value.length >= 2) {
    await doCompare()
  }
})
</script>
