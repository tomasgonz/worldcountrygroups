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
        <!-- Keyword cloud from all speeches -->
        <div class="mb-10">
          <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Key Topics Across Sessions</h2>
          <div class="bg-white rounded-2xl border border-primary-100 p-6">
            <div class="flex flex-wrap gap-2">
              <span
                v-for="kw in allKeywords"
                :key="kw.keyword"
                class="inline-block px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                :class="keywordSizeClass(kw.count)"
              >{{ kw.keyword }}</span>
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
                      >{{ mc.iso3 }} <span class="opacity-60">{{ mc.context }}</span></NuxtLink>
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
const { speeches: speechesRaw, pending: speechesPending } = useCountrySpeeches(iso)
const speechesData = computed(() => speechesRaw.value as any)

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
