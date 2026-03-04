<template>
  <div id="section-voting" class="mb-10">
    <h2 class="font-serif text-xl font-bold text-primary-900 mb-1">Voting Comparison</h2>
    <p class="text-primary-400 text-sm mb-5">UN voting theme cohesion and resolution browser.</p>

    <!-- Theme Stats -->
    <div v-if="themeRows.length > 0" class="bg-white rounded-2xl border border-primary-100 overflow-hidden mb-5">
      <div class="px-5 py-4 border-b border-primary-100">
        <h3 class="text-sm font-semibold text-primary-800">Theme Cohesion</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-primary-100 text-left">
              <th class="px-5 py-3 font-medium text-primary-400 text-xs uppercase tracking-wider">Theme</th>
              <th v-for="e in identifiers" :key="e.id" class="px-5 py-3 font-medium text-primary-400 text-xs uppercase tracking-wider text-center">
                {{ e.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in themeRows" :key="row.theme" class="border-b border-primary-50 last:border-0">
              <td class="px-5 py-2.5 text-primary-700">{{ row.theme }}</td>
              <td v-for="e in identifiers" :key="e.id" class="px-5 py-2.5 text-center tabular-nums text-sm">
                <template v-if="mode === 'groups'">
                  <span v-if="row.values[e.id] != null" :class="cohesionClass(row.values[e.id] as number)">
                    {{ ((row.values[e.id] as number) * 100).toFixed(0) }}%
                  </span>
                  <span v-else class="text-primary-300">—</span>
                </template>
                <template v-else>
                  <span v-if="row.values[e.id]" class="text-xs">
                    {{ row.values[e.id] }}
                  </span>
                  <span v-else class="text-primary-300">—</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Resolution Browser -->
    <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
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

      <div v-if="voteResPending" class="p-6 space-y-3">
        <div v-for="i in 5" :key="i" class="skeleton h-12 rounded-lg" />
      </div>

      <template v-else-if="voteResData?.resolutions?.length">
        <div class="divide-y divide-primary-50">
          <div v-for="r in voteResData.resolutions" :key="r.id">
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
              <span v-if="r.groupTallies || r.countryVotes" class="flex items-center gap-1 flex-shrink-0">
                <template v-if="mode === 'groups' && r.groupTallies">
                  <span
                    v-for="(tally, gid) in r.groupTallies"
                    :key="gid"
                    class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                    :class="isGroupConsensus(tally) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                  >
                    <span class="font-medium">{{ labelMap[gid as string] || gid }}</span>
                    <span>{{ isGroupConsensus(tally) ? 'C' : 'S' }}</span>
                  </span>
                </template>
              </span>
              <svg class="w-4 h-4 text-primary-300 transition-transform flex-shrink-0" :class="voteExpandedRes === r.id ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
            </button>

            <div v-if="voteExpandedRes === r.id" class="px-5 pb-4 space-y-3">
              <div class="text-xs text-primary-400">{{ r.id }} &middot; Session {{ r.session }}</div>
              <div class="text-sm text-primary-700">{{ r.title }}</div>

              <!-- Group tallies -->
              <div v-if="mode === 'groups' && r.groupTallies" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div
                  v-for="(tally, gid) in r.groupTallies"
                  :key="gid"
                  class="rounded-xl border border-primary-100 p-3"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-primary-800 text-sm">{{ labelMap[gid as string] || gid }}</span>
                    <span
                      class="text-xs px-1.5 py-0.5 rounded-full"
                      :class="isGroupConsensus(tally) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'"
                    >{{ isGroupConsensus(tally) ? 'Consensus' : 'Split' }}</span>
                  </div>
                  <div class="flex items-center gap-3 text-xs tabular-nums">
                    <span class="text-emerald-600">Yes: {{ tally.yes }}</span>
                    <span class="text-red-600">No: {{ tally.no }}</span>
                    <span class="text-amber-600">Abs: {{ tally.abstain }}</span>
                  </div>
                </div>
              </div>

              <!-- Country votes -->
              <div v-if="mode === 'countries' && r.countryVotes" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <div
                  v-for="e in identifiers"
                  :key="e.id"
                  class="rounded-lg border border-primary-100 px-3 py-2 flex items-center justify-between"
                >
                  <span class="text-sm font-medium text-primary-700">{{ e.label }}</span>
                  <span
                    class="text-xs px-1.5 py-0.5 rounded-full font-medium"
                    :class="voteClass(r.countryVotes?.[e.id])"
                  >{{ r.countryVotes?.[e.id] || '—' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

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

      <div v-else class="p-8 text-center text-primary-400">
        No resolutions found for the current filters.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  identifiers: { id: string; label: string }[]
  mode: 'groups' | 'countries'
}>()

const labelMap = computed(() => {
  const m: Record<string, string> = {}
  for (const e of props.identifiers) m[e.id] = e.label
  return m
})

// Theme stats
const themeData = ref<Record<string, any>>({})
const themeLoading = ref(true)

onMounted(async () => {
  const prefix = props.mode === 'groups' ? '/api/groups' : '/api/countries'
  const results = await Promise.all(
    props.identifiers.map(async (e) => {
      try { return { id: e.id, data: await $fetch(`${prefix}/${e.id}/theme-stats`) } }
      catch { return { id: e.id, data: { available: false, stats: [] } } }
    })
  )
  for (const r of results) themeData.value[r.id] = r.data
  themeLoading.value = false
})

const themeRows = computed(() => {
  const allThemes = new Set<string>()
  for (const d of Object.values(themeData.value)) {
    if (!d?.stats) continue
    for (const s of d.stats) allThemes.add(s.theme)
  }

  return [...allThemes].map(theme => {
    const values: Record<string, number | string | null> = {}
    for (const e of props.identifiers) {
      const d = themeData.value[e.id]
      const stat = d?.stats?.find((s: any) => s.theme === theme)
      if (!stat) { values[e.id] = null; continue }
      if (props.mode === 'groups') {
        values[e.id] = stat.cohesion ?? null
      } else {
        values[e.id] = `${stat.yes}Y / ${stat.no}N / ${stat.abstain}A`
      }
    }
    return { theme, values }
  }).slice(0, 15) // top 15 themes
})

function cohesionClass(val: number): string {
  if (val >= 0.85) return 'text-emerald-600 font-medium'
  if (val >= 0.6) return 'text-amber-600'
  return 'text-red-600'
}

// Resolution browser
const voteResPage = ref(1)
const voteResSession = ref<number | undefined>(undefined)
const voteResSearchInput = ref('')
const voteResSearch = ref('')
const voteExpandedRes = ref<string | null>(null)

const entityIds = computed(() => props.identifiers.map(e => e.id))

const { resolutions: voteResRaw, pending: voteResPending } = props.mode === 'groups'
  ? useResolutions({
      page: voteResPage,
      session: voteResSession,
      search: voteResSearch,
      theme: ref(undefined),
      countries: ref([]),
      groups: entityIds,
    })
  : useResolutions({
      page: voteResPage,
      session: voteResSession,
      search: voteResSearch,
      theme: ref(undefined),
      countries: entityIds,
      groups: ref([]),
    })

const voteResData = computed(() => voteResRaw.value as any)
const voteAvailableSessions = computed(() => voteResData.value?.sessions ?? [])

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

function voteClass(vote: string | undefined): string {
  switch (vote) {
    case 'Y': return 'bg-emerald-100 text-emerald-700'
    case 'N': return 'bg-red-100 text-red-700'
    case 'A': return 'bg-amber-100 text-amber-700'
    default: return 'bg-primary-100 text-primary-500'
  }
}
</script>
