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
        <span class="text-primary-600">General Debate Speeches</span>
      </nav>

      <!-- Header -->
      <div class="mb-10">
        <div class="flex items-center gap-4">
          <span v-if="(country as any).iso2" class="text-5xl">{{ isoToFlag((country as any).iso2) }}</span>
          <div>
            <h1 class="font-serif text-3xl sm:text-4xl font-bold text-primary-900">UN General Debate Speeches</h1>
            <p class="text-primary-500 mt-1">{{ (country as any).name }}</p>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="speechesPending" class="space-y-4">
        <div v-for="i in 3" :key="i" class="skeleton h-24 rounded-xl" />
      </div>

      <template v-else-if="speechesData?.available && speechesData.speeches.length">
        <!-- Year Range Slider -->
        <div v-if="trendsData && sliderStart != null && sliderEnd != null && yearMax - yearMin > 1" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
          <ChartsChartRangeSlider
            :min="yearMin"
            :max="yearMax"
            :start="sliderStart"
            :end="sliderEnd"
            @update:start="onSliderStartChange"
            @update:end="onSliderEndChange"
          />
        </div>

        <!-- Speech Trend Charts -->
        <div v-if="trendsData" class="space-y-8 mb-10">
          <!-- Sentiment Timeline -->
          <div v-if="trendsData.sentimentTimeline?.length > 1" class="bg-white rounded-2xl border border-primary-100 p-6">
            <h2 class="font-serif text-xl font-bold text-primary-900 mb-1">Sentiment Timeline</h2>
            <p class="text-xs text-primary-400 mb-4">How this country's tone at the UN General Debate has evolved over time</p>
            <ChartsChartLine
              :data="sentimentChartData"
              :series-names="['Sentiment']"
              :colors="['#10b981']"
              :y-min="0" :y-max="1"
              :y-format="sentimentLabel"
              :show-area="true"
              :legend="false"
              :height="200"
            />
          </div>

          <!-- Theme Radar -->
          <div v-if="radarAxes.length >= 3" class="bg-white rounded-2xl border border-primary-100 p-6">
            <h2 class="font-serif text-xl font-bold text-primary-900 mb-1">Theme Profile</h2>
            <p class="text-xs text-primary-400 mb-4">Share of speeches where each theme was rated as high relevance</p>
            <ChartsChartRadar :axes="radarAxes" :size="320" />
          </div>

          <!-- Mention Network -->
          <div v-if="mentionBars.length" class="bg-white rounded-2xl border border-primary-100 p-6">
            <h2 class="font-serif text-xl font-bold text-primary-900 mb-1">Most-Mentioned Countries</h2>
            <p class="text-xs text-primary-400 mb-4">Countries most frequently referenced in speeches, with context breakdown</p>
            <ChartsChartBar :bars="mentionBars" :label-width="120" />
          </div>
        </div>

        <!-- Keyword cloud from all speeches -->
        <div class="mb-10">
          <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Key Topics Across Sessions</h2>
          <div class="bg-white rounded-2xl border border-primary-100 p-6">
            <div class="flex flex-wrap gap-2">
              <span
                v-for="kw in allKeywords"
                :key="kw.keyword"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                :class="keywordSizeClass(kw.count)"
              >{{ kw.keyword }}
                <ChartsChartSparkline v-if="keywordSparkData[kw.keyword]?.length > 2" :data="keywordSparkData[kw.keyword]" :width="48" :height="14" :color="'#6366f1'" />
              </span>
            </div>
          </div>
        </div>

        <!-- Speech List -->
        <div class="mb-10">
          <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 class="font-serif text-xl font-bold text-primary-900">
              Speeches
              <span class="text-base font-normal text-primary-400">({{ filteredSpeeches.length }} of {{ speechesData.total }})</span>
            </h2>

            <!-- Decade filter -->
            <div v-if="availableDecades.length > 1" class="flex flex-wrap gap-1.5">
              <button
                class="text-xs px-3 py-1 rounded-full border transition-colors"
                :class="selectedDecade === null ? 'bg-primary-900 text-white border-primary-900' : 'bg-white text-primary-600 border-primary-200 hover:border-primary-400'"
                @click="selectedDecade = null"
              >All</button>
              <button
                v-for="decade in availableDecades"
                :key="decade"
                class="text-xs px-3 py-1 rounded-full border transition-colors"
                :class="selectedDecade === decade ? 'bg-primary-900 text-white border-primary-900' : 'bg-white text-primary-600 border-primary-200 hover:border-primary-400'"
                @click="selectedDecade = decade"
              >{{ decade }}s</button>
            </div>
          </div>

          <div class="space-y-4">
            <div
              v-for="speech in filteredSpeeches"
              :key="`${speech.iso3}_${speech.session}`"
              class="bg-white rounded-2xl border border-primary-100 overflow-hidden"
            >
              <!-- Speech header -->
              <button
                class="w-full text-left p-5 flex items-start gap-4 hover:bg-primary-50/50 transition-colors"
                @click="toggleSpeech(speech.session)"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 mb-1.5">
                    <span class="text-lg font-serif font-bold text-primary-900">{{ speech.year }}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-500">Session {{ speech.session }}</span>
                    <span class="text-xs text-primary-400 tabular-nums">{{ speech.word_count.toLocaleString() }} words</span>
                  </div>
                  <div v-if="speech.speaker" class="text-sm text-primary-600 mb-2">
                    <span class="font-medium">{{ speech.speaker }}</span>
                    <span v-if="speech.speaker_title" class="text-primary-400"> &middot; {{ speech.speaker_title }}</span>
                  </div>
                  <!-- Sentiment badge -->
                  <div v-if="speech.analysis?.sentiment" class="flex items-center gap-2 mb-1.5">
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="sentimentClass(speech.analysis.sentiment.overall)">
                      {{ speech.analysis.sentiment.overall }}
                    </span>
                    <span v-for="desc in speech.analysis.sentiment.tone_descriptors?.slice(0, 3)" :key="desc" class="text-xs text-primary-400">{{ desc }}</span>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="kw in speech.keywords.slice(0, 10)"
                      :key="kw"
                      class="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                    >{{ kw }}</span>
                  </div>
                </div>
                <svg
                  class="w-5 h-5 text-primary-300 transition-transform mt-1 flex-shrink-0"
                  :class="expandedSession === speech.session ? 'rotate-180' : ''"
                  viewBox="0 0 20 20" fill="currentColor"
                >
                  <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                </svg>
              </button>

              <!-- Expanded speech content -->
              <div v-if="expandedSession === speech.session" class="border-t border-primary-100">
                <!-- AI Analysis Panel -->
                <div v-if="speech.analysis" class="px-5 py-5 bg-gradient-to-b from-amber-50/40 to-transparent border-b border-primary-100">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="text-xs font-semibold uppercase tracking-wider text-amber-700">AI Analysis</span>
                    <span v-if="speech.analysis._model" class="text-xs text-primary-300">{{ speech.analysis._model }}</span>
                    <span v-if="speech.analysis._analyzed_at" class="text-xs text-primary-300">&middot; {{ speech.analysis._analyzed_at }}</span>
                  </div>

                  <!-- Summary -->
                  <p class="text-sm text-primary-700 leading-relaxed mb-4">{{ speech.analysis.summary }}</p>

                  <!-- Sentiment -->
                  <div v-if="speech.analysis.sentiment" class="mb-4">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs font-medium text-primary-500">Sentiment:</span>
                      <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="sentimentClass(speech.analysis.sentiment.overall)">
                        {{ speech.analysis.sentiment.overall }}
                      </span>
                      <span v-for="desc in speech.analysis.sentiment.tone_descriptors" :key="desc"
                        class="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-500">{{ desc }}</span>
                    </div>
                    <div v-if="speech.analysis.sentiment.criticism_targets?.length" class="mt-1.5">
                      <span class="text-xs text-primary-400">Criticizes: </span>
                      <span v-for="(target, i) in speech.analysis.sentiment.criticism_targets" :key="target" class="text-xs text-red-600">
                        {{ target }}{{ i < speech.analysis.sentiment.criticism_targets.length - 1 ? ', ' : '' }}
                      </span>
                    </div>
                  </div>

                  <!-- Themes -->
                  <div v-if="speech.analysis.themes?.length" class="mb-4">
                    <span class="text-xs font-medium text-primary-500 block mb-1.5">Themes:</span>
                    <div class="flex flex-wrap gap-1.5">
                      <span v-for="t in speech.analysis.themes" :key="t.name"
                        class="text-xs px-2 py-0.5 rounded-full"
                        :class="t.relevance === 'high' ? 'bg-emerald-100 text-emerald-800 font-medium' : t.relevance === 'medium' ? 'bg-sky-50 text-sky-700' : 'bg-primary-50 text-primary-400'"
                      >{{ t.name.replace(/_/g, ' ') }}</span>
                    </div>
                  </div>

                  <!-- Key Quotes -->
                  <div v-if="speech.analysis.key_quotes?.length" class="mb-4">
                    <span class="text-xs font-medium text-primary-500 block mb-1.5">Key Quotes:</span>
                    <div class="space-y-2">
                      <blockquote v-for="(q, i) in speech.analysis.key_quotes" :key="i"
                        class="border-l-2 border-amber-300 pl-3 text-xs text-primary-600 italic leading-relaxed"
                      >"{{ q }}"</blockquote>
                    </div>
                  </div>

                  <!-- Mentioned Countries -->
                  <div v-if="speech.analysis.mentioned_countries?.length" class="mb-4">
                    <span class="text-xs font-medium text-primary-500 block mb-1.5">Countries Mentioned:</span>
                    <div class="flex flex-wrap gap-1.5">
                      <NuxtLink v-for="mc in speech.analysis.mentioned_countries" :key="mc.iso3"
                        :to="`/countries/${mc.iso3.toLowerCase()}`"
                        class="text-xs px-2 py-0.5 rounded-full border hover:bg-primary-50 transition-colors"
                        :class="mc.context === 'ally' || mc.context === 'partnership' ? 'bg-green-50 border-green-200 text-green-700' : mc.context === 'criticism' ? 'bg-red-50 border-red-200 text-red-700' : mc.context === 'concern' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-primary-50 border-primary-200 text-primary-600'"
                      >{{ countryName(mc.iso3) }} <span class="opacity-60">{{ mc.context }}</span></NuxtLink>
                    </div>
                  </div>

                  <!-- Conflicts -->
                  <div v-if="speech.analysis.mentioned_conflicts?.length" class="mb-4">
                    <span class="text-xs font-medium text-primary-500 block mb-1.5">Conflicts Referenced:</span>
                    <div class="space-y-1">
                      <div v-for="c in speech.analysis.mentioned_conflicts" :key="c.name" class="text-xs text-primary-600">
                        <span class="font-medium">{{ c.name }}:</span> {{ c.stance }}
                      </div>
                    </div>
                  </div>

                  <!-- Policy Positions -->
                  <div v-if="speech.analysis.policy_positions?.length" class="mb-4">
                    <span class="text-xs font-medium text-primary-500 block mb-1.5">Policy Positions:</span>
                    <div class="space-y-1">
                      <div v-for="p in speech.analysis.policy_positions" :key="p.topic" class="text-xs text-primary-600">
                        <span class="font-medium">{{ p.topic }}:</span> {{ p.position }}
                      </div>
                    </div>
                  </div>

                  <!-- Alliances -->
                  <div v-if="speech.analysis.alliances_mentioned?.length" class="mb-2">
                    <span class="text-xs font-medium text-primary-500 block mb-1.5">Organizations &amp; Alliances:</span>
                    <div class="flex flex-wrap gap-1.5">
                      <span v-for="a in speech.analysis.alliances_mentioned" :key="a.entity"
                        class="text-xs px-2 py-0.5 rounded-full"
                        :class="a.sentiment === 'positive' ? 'bg-green-50 text-green-700' : a.sentiment === 'negative' ? 'bg-red-50 text-red-700' : 'bg-primary-50 text-primary-500'"
                      >{{ a.entity }}</span>
                    </div>
                  </div>
                </div>

                <!-- Speech Text -->
                <div class="px-5 py-6">
                  <div v-if="textPending" class="space-y-2">
                    <div v-for="i in 5" :key="i" class="skeleton h-4 rounded" />
                  </div>
                  <div v-else-if="speechTextContent" class="prose prose-sm max-w-none text-primary-700 leading-relaxed whitespace-pre-wrap">{{ speechTextContent }}</div>
                  <div v-else class="text-sm text-primary-400">Speech text not available.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-8 text-center">
        <p class="text-primary-400">No UN General Debate speeches available for this country.</p>
        <p class="text-xs text-primary-300 mt-2">Speech data can be loaded from the admin dashboard.</p>
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
const { countries: allCountries } = useCountries()
const countryNameMap = computed(() => {
  const map = new Map<string, string>()
  if (allCountries.value) {
    for (const c of allCountries.value as any[]) {
      map.set(c.iso3, c.name)
    }
  }
  return map
})
function countryName(iso3: string): string {
  return countryNameMap.value.get(iso3.toUpperCase()) || iso3
}

const { speeches: speechesRaw, pending: speechesPending } = useCountrySpeeches(iso)
const speechesData = computed(() => speechesRaw.value as any)

// Year range slider state
const sliderStart = ref<number | undefined>(undefined)
const sliderEnd = ref<number | undefined>(undefined)
const debouncedStart = ref<number | undefined>(undefined)
const debouncedEnd = ref<number | undefined>(undefined)
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

function onSliderStartChange(v: number) {
  sliderStart.value = v
  scheduleDebounce()
}
function onSliderEndChange(v: number) {
  sliderEnd.value = v
  scheduleDebounce()
}
function scheduleDebounce() {
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    debouncedStart.value = sliderStart.value
    debouncedEnd.value = sliderEnd.value
  }, 400)
}

// Speech trend charts
const { trends: trendsRaw } = useCountrySpeechTrends(iso, {
  startYear: debouncedStart,
  endYear: debouncedEnd,
})
const trendsData = computed(() => trendsRaw.value as any)

// Compute year range bounds from initial (unfiltered) sentiment timeline
const yearMin = ref(1946)
const yearMax = ref(2025)
watch(trendsData, (data) => {
  if (!data?.sentimentTimeline?.length) return
  // Only set once (on first load)
  if (sliderStart.value != null) return
  const years = data.sentimentTimeline.map((d: any) => d.year)
  yearMin.value = Math.min(...years)
  yearMax.value = Math.max(...years)
  sliderStart.value = yearMin.value
  sliderEnd.value = yearMax.value
}, { immediate: true })

const MENTION_COLORS: Record<string, string> = {
  ally: '#10b981', partnership: '#10b981',
  criticism: '#ef4444', concern: '#f59e0b',
  general: '#94a3b8', diplomacy: '#6366f1',
  cooperation: '#3b82f6', trade: '#8b5cf6',
}

const sentimentChartData = computed(() => {
  if (!trendsData.value?.sentimentTimeline) return []
  return trendsData.value.sentimentTimeline.map((d: any) => ({
    x: d.year,
    values: [d.sentiment],
    label: `Session ${d.session} (${d.year})`,
  }))
})

function sentimentLabel(v: number): string {
  if (v >= 0.85) return 'Pos'
  if (v >= 0.4) return 'Mix'
  if (v >= 0.15) return 'Neu'
  return 'Neg'
}

const radarAxes = computed(() => {
  if (!trendsData.value?.themeRadar) return []
  return trendsData.value.themeRadar.map((t: any) => ({
    label: t.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()).slice(0, 18),
    value: t.value,
    rawValue: `${(t.value * 100).toFixed(0)}% (${t.count})`,
  }))
})

const mentionBars = computed(() => {
  if (!trendsData.value?.mentionNetwork?.mentioned) return []
  return trendsData.value.mentionNetwork.mentioned.slice(0, 12).map((m: any) => {
    const topCtx = Object.entries(m.contexts || {}).sort((a: any, b: any) => b[1] - a[1])[0]
    const ctx = topCtx ? topCtx[0] as string : 'general'
    return {
      label: m.name || m.iso3,
      value: m.count,
      color: MENTION_COLORS[ctx] || '#94a3b8',
      tooltipLines: Object.entries(m.contexts || {}).map(([k, v]: any) => ({ label: k, value: v, color: MENTION_COLORS[k] || '#94a3b8' })),
    }
  })
})

const keywordSparkData = computed(() => {
  if (!trendsData.value?.keywordTrends) return {} as Record<string, number[]>
  const map: Record<string, number[]> = {}
  for (const kt of trendsData.value.keywordTrends) {
    map[kt.keyword] = kt.trend.map((t: any) => t.count)
  }
  return map
})

// Decade filter
const selectedDecade = ref<number | null>(null)

const availableDecades = computed(() => {
  if (!speechesData.value?.speeches?.length) return []
  const decades = new Set<number>()
  for (const s of speechesData.value.speeches) {
    decades.add(Math.floor(s.year / 10) * 10)
  }
  return [...decades].sort()
})

const filteredSpeeches = computed(() => {
  if (!speechesData.value?.speeches?.length) return []
  if (selectedDecade.value === null) return speechesData.value.speeches
  return speechesData.value.speeches.filter(
    (s: any) => Math.floor(s.year / 10) * 10 === selectedDecade.value
  )
})

// Expanded speech — auto-expand if ?session= query param present
const initialSession = route.query.session ? Number(route.query.session) : null
const expandedSession = ref<number | null>(initialSession)
const loadedSession = ref<number | null>(initialSession)

// Auto-select the correct decade filter if a session query param is present
if (initialSession) {
  watch(speechesData, (data) => {
    if (!data?.speeches?.length) return
    const speech = data.speeches.find((s: any) => s.session === initialSession)
    if (speech && selectedDecade.value === null) {
      const decade = Math.floor(speech.year / 10) * 10
      // Only set decade filter if speech would be hidden (more than one decade available)
      if (availableDecades.value.length > 1) {
        selectedDecade.value = decade
      }
    }
  }, { immediate: true })
}

function toggleSpeech(session: number) {
  if (expandedSession.value === session) {
    expandedSession.value = null
  } else {
    expandedSession.value = session
    loadedSession.value = session
  }
}

const { speechText: speechTextRaw, pending: textPending } = useCountrySpeechText(iso, loadedSession)
const speechTextContent = computed(() => {
  if (!speechTextRaw.value || expandedSession.value !== loadedSession.value) return null
  return (speechTextRaw.value as any)?.text || null
})

// Aggregate keywords across all speeches
const allKeywords = computed(() => {
  if (!speechesData.value?.speeches?.length) return []
  const counts = new Map<string, number>()
  for (const s of speechesData.value.speeches) {
    for (const kw of s.keywords) {
      counts.set(kw, (counts.get(kw) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
})

const maxKeywordCount = computed(() => {
  if (!allKeywords.value.length) return 1
  return Math.max(...allKeywords.value.map(k => k.count))
})

function keywordSizeClass(count: number): string {
  const ratio = count / maxKeywordCount.value
  if (ratio > 0.75) return 'bg-blue-100 text-blue-800 text-base'
  if (ratio > 0.5) return 'bg-blue-50 text-blue-700 text-sm'
  if (ratio > 0.25) return 'bg-primary-100 text-primary-600 text-sm'
  return 'bg-primary-50 text-primary-500 text-xs'
}

function sentimentClass(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'bg-emerald-100 text-emerald-800'
    case 'negative': return 'bg-red-100 text-red-800'
    case 'mixed': return 'bg-amber-100 text-amber-800'
    default: return 'bg-primary-100 text-primary-600'
  }
}

useHead({
  title: computed(() => {
    const c = country.value as any
    return c ? `${c.name} General Debate Speeches — World Country Groups` : 'Loading...'
  }),
})
</script>
