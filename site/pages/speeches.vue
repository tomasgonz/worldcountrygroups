<template>
  <div>
    <section class="bg-white border-b border-primary-100">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 class="font-serif text-3xl sm:text-4xl font-bold text-primary-900 mb-2">
          UNGA {{ selectedSession ?? '' }} — What the World is Talking About
        </h1>
        <p class="text-primary-400 text-lg max-w-2xl leading-relaxed">
          <template v-if="hasAnalysis">
            Theme priorities across {{ priorities?.meta?.totalSpeeches ?? '' }} UN General Debate speeches ({{ sessionYear }}) — percentage of each group's members rating a theme as high relevance.
          </template>
          <template v-else>
            Top keywords across UN General Debate speeches from session {{ selectedSession }} ({{ sessionYear }}).
          </template>
        </p>
        <!-- Session selector -->
        <div class="mt-6 flex items-center gap-3" v-if="sessionsData.sessions.value?.length > 1">
          <label class="text-sm font-medium text-primary-500">Session:</label>
          <select
            v-model="selectedSession"
            class="text-sm border border-primary-200 rounded-lg px-3 py-1.5 bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option v-for="s in reversedSessions" :key="s" :value="s">
              Session {{ s }} ({{ 1945 + s }})
            </option>
          </select>
        </div>
      </div>
    </section>

    <!-- AI Analysis view (for sessions with analysis) -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12" v-if="hasAnalysis && priorities">
      <!-- Theme comparison table (desktop) -->
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Theme Priorities by Group</h2>
      <div class="hidden md:block overflow-x-auto mb-12">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th class="text-left pb-3 pr-4 text-primary-400 font-medium w-40">Group</th>
              <th v-for="theme in priorities.themes" :key="theme" class="text-left pb-3 px-2 text-primary-400 font-medium">
                {{ priorities.themeLabels[theme] }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in priorities.groups" :key="g.gid" class="border-t border-primary-100">
              <td class="py-3 pr-4">
                <NuxtLink :to="`/groups/${g.gid}`" class="font-semibold text-primary-900 hover:text-primary-600 transition-colors">
                  {{ g.name }}
                </NuxtLink>
                <div class="text-xs text-primary-400">{{ g.speechCount }} speeches</div>
              </td>
              <td v-for="(theme, idx) in priorities.themes" :key="theme" class="py-3 px-2">
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-5 bg-primary-100 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="themeBarColor(idx)"
                      :style="{ width: g.priorities[theme] + '%' }"
                    />
                  </div>
                  <span class="text-xs font-medium text-primary-500 w-8 text-right">{{ g.priorities[theme] }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Theme comparison (mobile) -->
      <div class="md:hidden space-y-6 mb-12">
        <div v-for="g in priorities.groups" :key="g.gid + '-mobile'" class="bg-white rounded-xl border border-primary-100 p-4">
          <div class="flex items-center justify-between mb-3">
            <NuxtLink :to="`/groups/${g.gid}`" class="font-semibold text-primary-900 hover:text-primary-600 transition-colors">
              {{ g.name }}
            </NuxtLink>
            <span class="text-xs text-primary-400">{{ g.speechCount }} speeches</span>
          </div>
          <div class="space-y-2">
            <div v-for="(theme, idx) in priorities.themes" :key="theme" class="flex items-center gap-2">
              <span class="text-xs text-primary-500 w-24 shrink-0">{{ priorities.themeLabels[theme] }}</span>
              <div class="flex-1 h-4 bg-primary-100 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :class="themeBarColor(idx)"
                  :style="{ width: g.priorities[theme] + '%' }"
                />
              </div>
              <span class="text-xs font-medium text-primary-500 w-8 text-right">{{ g.priorities[theme] }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Emerging themes per group -->
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Emerging Topics by Group</h2>
      <p class="text-primary-400 text-sm mb-6">Policy topics most frequently raised in speeches by each group's members.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        <div
          v-for="g in priorities.groups"
          :key="g.gid + '-topics'"
          class="bg-white rounded-xl border border-primary-100 p-5"
        >
          <div class="flex items-center justify-between mb-3">
            <NuxtLink :to="`/groups/${g.gid}`" class="font-semibold text-primary-900 hover:text-primary-600 transition-colors">
              {{ g.name }}
            </NuxtLink>
            <span class="text-xs text-primary-400">{{ g.speechCount }} speeches</span>
          </div>
          <div v-if="g.emergingTopics?.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="topic in g.emergingTopics"
              :key="topic"
              class="inline-block text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 border border-primary-100"
            >{{ topic }}</span>
          </div>
          <p v-else class="text-xs text-primary-400">Not enough data to extract common topics.</p>
        </div>
      </div>

      <div class="text-xs text-primary-400">
        Based on AI analysis of UN General Debate speeches. Theme relevance and policy topics are determined per-country speech analysis.
      </div>

      <!-- Group Sentiment Comparison -->
      <div class="mt-12">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-2">Sentiment Across Blocs</h2>
        <p class="text-primary-400 text-sm mb-4">Positive speech sentiment count over time for selected groups and countries.</p>

        <!-- Bloc selector -->
        <div class="mb-6">
          <div class="flex flex-wrap gap-2 items-center">
            <span
              v-for="sel in selectedBlocs"
              :key="sel"
              class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
            >
              {{ blocLabel(sel) }}
              <button @click="removeBloc(sel)" class="ml-0.5 hover:text-red-600 transition-colors">&times;</button>
            </span>
            <div class="relative" ref="dropdownRef">
              <button
                @click="showBlocDropdown = !showBlocDropdown"
                class="text-xs px-3 py-1 rounded-full border border-dashed border-primary-300 text-primary-500 hover:border-primary-500 hover:text-primary-700 transition-colors"
              >+ Add</button>
              <div
                v-if="showBlocDropdown"
                class="absolute z-20 top-8 left-0 w-64 bg-white border border-primary-200 rounded-xl shadow-lg max-h-72 overflow-y-auto"
              >
                <input
                  v-model="blocSearchQuery"
                  type="text"
                  placeholder="Search groups or countries..."
                  class="w-full text-xs px-3 py-2 border-b border-primary-100 focus:outline-none"
                  @keydown.stop
                />
                <div v-if="filteredBlocOptions.length" class="py-1">
                  <button
                    v-for="opt in filteredBlocOptions"
                    :key="opt.id"
                    class="w-full text-left text-xs px-3 py-1.5 hover:bg-primary-50 transition-colors flex items-center justify-between"
                    @click="addBloc(opt.id)"
                  >
                    <span>{{ opt.label }}</span>
                    <span class="text-[10px] text-primary-400">{{ opt.type }}</span>
                  </button>
                </div>
                <div v-else class="px-3 py-2 text-xs text-primary-400">No matches</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="comparisonData?.groups?.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="g in comparisonData.groups" :key="g.gid" class="bg-white rounded-xl border border-primary-100 p-4">
            <div class="flex items-center justify-between mb-2">
              <NuxtLink v-if="g.type !== 'country'" :to="`/groups/${g.gid}`" class="font-semibold text-sm text-primary-900 hover:text-primary-600 transition-colors">{{ g.name }}</NuxtLink>
              <NuxtLink v-else :to="`/countries/${g.gid.toLowerCase()}`" class="font-semibold text-sm text-primary-900 hover:text-primary-600 transition-colors">{{ g.name }}</NuxtLink>
            </div>
            <ChartsChartLine
              :data="groupComparisonLine(g.sentimentTimeline)"
              :series-names="['Positive', 'Negative']"
              :colors="['#10b981', '#ef4444']"
              :show-area="true"
              :legend="false"
              :height="140"
              :y-min="0"
            />
          </div>
        </div>
        <div v-else-if="comparisonPending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="i in 3" :key="i" class="skeleton h-48 rounded-xl" />
        </div>
      </div>

      <!-- Theme Heatmap -->
      <div v-if="heatmapData" class="mt-12">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-2">Global Theme Heatmap</h2>
        <p class="text-primary-400 text-sm mb-6">Theme prevalence by decade across all speeches.</p>
        <div class="bg-white rounded-xl border border-primary-100 p-6">
          <ChartsChartHeatmap
            :rows="heatmapData.themes"
            :columns="heatmapData.decades"
            :values="heatmapData.values"
            :label-width="160"
            :cell-size="48"
          />
        </div>
      </div>
    </section>

    <!-- Keywords view (for sessions without analysis) -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12" v-else-if="!hasAnalysis">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Top Keywords</h2>
      <p class="text-primary-400 text-sm mb-6">
        Most frequently used terms across all speeches in session {{ selectedSession }}.
      </p>

      <div v-if="topicsPending" class="space-y-3">
        <div v-for="i in 5" :key="i" class="skeleton h-8 rounded-lg" />
      </div>

      <div v-else-if="topicsData?.topics?.length" class="bg-white rounded-2xl border border-primary-100 p-6">
        <div class="flex flex-wrap gap-2">
          <span
            v-for="t in topicsData.topics"
            :key="t.keyword"
            class="inline-block px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            :class="topicSizeClass(t.count, topicsMax)"
          >{{ t.keyword }} <span class="opacity-50 text-xs">({{ t.count }})</span></span>
        </div>
      </div>

      <div v-else class="text-sm text-primary-400 mt-4">
        No keyword data available for this session.
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useSpeechSessions, useSpeechGroupPriorities, useSpeechTopics, useSpeechGroupComparison, useGroups, useCountries } from '~/composables/useGroups'

const sessionsData = useSpeechSessions()

// Bloc selector state
const DEFAULT_BLOCS = ['lldcs', 'g77', 'developing-ex-lldcs', 'eu', 'USA', 'canz']
const selectedBlocs = ref<string[]>([...DEFAULT_BLOCS])
const showBlocDropdown = ref(false)
const blocSearchQuery = ref('')
const dropdownRef = ref<HTMLElement | null>(null)

const { groups: allGroups } = useGroups()
const { countries: allCountries } = useCountries()

const blocOptions = computed(() => {
  const opts: { id: string; label: string; type: string }[] = []
  if (allGroups.value) {
    for (const g of allGroups.value as any[]) {
      opts.push({ id: g.gid, label: `${g.acronym || g.gid} — ${g.name}`, type: 'group' })
    }
  }
  if (allCountries.value) {
    for (const c of allCountries.value as any[]) {
      opts.push({ id: c.iso3, label: c.name, type: 'country' })
    }
  }
  return opts
})

const filteredBlocOptions = computed(() => {
  const selected = new Set(selectedBlocs.value.map(s => s.toLowerCase()))
  const q = blocSearchQuery.value.toLowerCase()
  return blocOptions.value
    .filter(o => !selected.has(o.id.toLowerCase()) && (!q || o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)))
    .slice(0, 20)
})

const blocLabelMap = computed(() => {
  const map = new Map<string, string>()
  for (const o of blocOptions.value) {
    map.set(o.id.toLowerCase(), o.type === 'group' ? (o.label.split(' — ')[0] || o.id) : o.label)
  }
  return map
})

function blocLabel(id: string): string {
  return blocLabelMap.value.get(id.toLowerCase()) || id
}

function addBloc(id: string) {
  if (!selectedBlocs.value.some(s => s.toLowerCase() === id.toLowerCase())) {
    selectedBlocs.value = [...selectedBlocs.value, id]
  }
  showBlocDropdown.value = false
  blocSearchQuery.value = ''
}

function removeBloc(id: string) {
  selectedBlocs.value = selectedBlocs.value.filter(s => s !== id)
}

// Close dropdown on click outside
onMounted(() => {
  document.addEventListener('click', (e: MouseEvent) => {
    if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
      showBlocDropdown.value = false
    }
  })
})

// Group comparison charts
const { comparison: comparisonRaw, pending: comparisonPending } = useSpeechGroupComparison(selectedBlocs)
const comparisonData = computed(() => comparisonRaw.value as any)

function groupComparisonLine(timeline: any[]) {
  return timeline.map((s: any) => ({
    x: s.year,
    values: [s.positive, s.negative],
    label: `Session ${s.session} (${s.year})`,
  }))
}

// Theme heatmap from global data
const heatmapData = computed(() => {
  const hm = comparisonData.value?.themeHeatmap
  if (!hm?.themes?.length) return null
  return {
    themes: hm.themes.map((t: string) => t.replace(/_/g, ' ')),
    decades: hm.decades,
    values: hm.values,
  }
})

const selectedSession = ref<number | undefined>(undefined)

// Initialize selected session once data loads
watch(sessionsData.latestSession, (v) => {
  if (v != null && selectedSession.value === undefined) {
    selectedSession.value = v
  }
}, { immediate: true })

const reversedSessions = computed(() => {
  const s = sessionsData.sessions.value
  return s ? [...s].reverse() : []
})

const sessionYear = computed(() => {
  if (selectedSession.value == null) return ''
  return 1945 + selectedSession.value
})

const hasAnalysis = computed(() => {
  if (selectedSession.value == null) return false
  return sessionsData.analysisSessions.value?.includes(selectedSession.value) ?? false
})

// Fetch group priorities (only meaningful for sessions with analysis)
const sessionRef = computed(() => selectedSession.value)
const { priorities } = useSpeechGroupPriorities(sessionRef)

// Fetch topics for sessions without analysis
const { topics: topicsRaw, pending: topicsPending } = useSpeechTopics(sessionRef)
const topicsData = computed(() => topicsRaw.value as any)

const topicsMax = computed(() => {
  if (!topicsData.value?.topics?.length) return 1
  return Math.max(...topicsData.value.topics.map((t: any) => t.count))
})

function topicSizeClass(count: number, max: number): string {
  const ratio = count / max
  if (ratio > 0.6) return 'bg-blue-100 text-blue-800 text-base'
  if (ratio > 0.35) return 'bg-blue-50 text-blue-700 text-sm'
  if (ratio > 0.15) return 'bg-primary-100 text-primary-600 text-sm'
  return 'bg-primary-50 text-primary-500 text-xs'
}

const THEME_COLORS = ['bg-red-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-violet-500']
function themeBarColor(idx: number) {
  return THEME_COLORS[idx] || 'bg-primary-400'
}

useHead({
  title: computed(() => `UNGA ${selectedSession.value ?? ''} — What the World is Talking About`),
})
</script>
