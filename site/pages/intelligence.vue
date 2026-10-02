<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center justify-between mb-1">
      <h1 class="font-serif text-3xl font-bold text-primary-900">Diplomatic Intelligence</h1>
      <div class="flex items-center gap-2">
        <IntelligenceDocxDownloadButton
          v-if="activeTab === 'briefing' && briefing.data"
          type="country"
          :params="{ iso: currentBriefingIso }"
          :ai-status="aiStatus"
        />
        <IntelligenceDocxDownloadButton
          v-if="activeTab === 'bilateral' && bilateral.data"
          type="bilateral"
          :params="{ a: currentBilateralA, b: currentBilateralB }"
          :ai-status="aiStatus"
        />
        <IntelligenceDocxDownloadButton
          v-if="activeTab === 'trends' && trends.data"
          type="group"
          :params="{ gid: currentTrendsGid }"
          :ai-status="aiStatus"
        />
        <IntelligenceExportButton />
      </div>
    </div>
    <p class="text-primary-400 text-sm mb-8">Consolidated analysis across speeches, voting records, GDELT, conflict, treaty, democracy, arms trade, aid, visa, connectivity, and alliance data.</p>

    <!-- Tab bar -->
    <div class="bg-primary-50 rounded-xl p-1.5 flex overflow-x-auto mb-8 gap-1">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="flex-1 px-4 py-3 rounded-lg text-sm whitespace-nowrap transition-all"
        :class="activeTab === tab.id
          ? 'bg-primary-900 text-white font-medium shadow-sm'
          : 'text-primary-500 hover:text-primary-700 hover:bg-white'"
        @click="setActiveTab(tab.id)"
      >
        <span class="block font-medium">{{ tab.label }}</span>
        <span class="block text-[10px] mt-0.5" :class="activeTab === tab.id ? 'text-primary-300' : 'text-primary-400'">{{ tab.desc }}</span>
      </button>
    </div>

    <!-- Watchlist -->
    <template v-if="activeTab === 'watchlist'">
      <IntelligenceWatchlist
        :codes="bookmarkState.bookmarkedCountries"
        @view-country="viewCountryFromWatchlist"
      />
    </template>

    <!-- Country Briefing -->
    <template v-if="activeTab === 'briefing'">
      <IntelligenceCountrySelector
        :countries="allCountries"
        :loading="briefing.pending"
        :initial-iso="initialIso"
        @generate="generateBriefing"
      />
      <div v-if="briefing.error" class="bg-white rounded-2xl border border-red-100 p-6 text-center mb-6">
        <p class="text-red-600 text-sm">{{ briefing.error }}</p>
      </div>
      <IntelligenceBriefingSkeleton v-if="briefing.pending" />
      <template v-if="briefing.data">
        <IntelligenceAIAnalysis :type="'country'" :params="{ iso: currentBriefingIso }" :ai-status="aiStatus" />
        <IntelligenceRiskScore :iso="currentBriefingIso" :ai-status="aiStatus" />
        <IntelligenceCountryBriefing :data="briefing.data" :ai-configured="aiStatus?.configured" />
      </template>
    </template>

    <!-- Bilateral Prep -->
    <template v-if="activeTab === 'bilateral'">
      <IntelligenceBilateralSelector
        :countries="allCountries"
        :loading="bilateral.pending"
        :initial-a="initialA"
        :initial-b="initialB"
        @generate="generateBilateral"
      />
      <div v-if="bilateral.error" class="bg-white rounded-2xl border border-red-100 p-6 text-center mb-6">
        <p class="text-red-600 text-sm">{{ bilateral.error }}</p>
      </div>
      <IntelligenceBriefingSkeleton v-if="bilateral.pending" />
      <template v-if="bilateral.data">
        <IntelligenceAIAnalysis :type="'bilateral'" :params="{ a: currentBilateralA, b: currentBilateralB }" :ai-status="aiStatus" />
        <div v-if="aiStatus?.configured" class="mb-6">
          <IntelligenceDocxDownloadButton
            type="bilateral"
            :params="{ a: currentBilateralA, b: currentBilateralB }"
            :ai-status="aiStatus"
            label="Meeting Brief"
            endpoint="/api/intelligence/ai/bilateral-meeting-doc"
          />
        </div>
        <IntelligenceBilateralPrep :data="bilateral.data" :ai-configured="aiStatus?.configured" />
      </template>
    </template>

    <!-- Group Trends -->
    <template v-if="activeTab === 'trends'">
      <IntelligenceGroupSelector
        :groups="allGroups"
        :loading="trends.pending"
        :initial-gid="initialGid"
        @generate="generateTrends"
      />
      <div v-if="trends.error" class="bg-white rounded-2xl border border-red-100 p-6 text-center mb-6">
        <p class="text-red-600 text-sm">{{ trends.error }}</p>
      </div>
      <IntelligenceBriefingSkeleton v-if="trends.pending" />
      <template v-if="trends.data">
        <IntelligenceAIAnalysis :type="'group'" :params="{ gid: currentTrendsGid }" :ai-status="aiStatus" />
        <IntelligenceGroupTrends :data="trends.data" :ai-configured="aiStatus?.configured" />
      </template>
    </template>

    <!-- Voting Bloc Detector -->
    <template v-if="activeTab === 'blocs'">
      <IntelligenceVotingBlocDetector />
    </template>

    <!-- Chat Panel -->
    <IntelligenceChatPanel
      :messages="chat.messages"
      :is-streaming="chat.isStreaming"
      v-model:is-open="chat.isOpen"
      :context-label="chat.contextLabel"
      :ai-status="aiStatus"
      @send-message="chat.sendMessage"
      @clear-chat="chat.clearChat"
    />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const { groups: allGroups } = useGroups()
const { countries: allCountries } = useCountries()
const briefing = reactive(useCountryBriefing())
const bilateral = reactive(useBilateralPrep())
const trends = reactive(useGroupTrends())
const chat = reactive(useIntelligenceChat())
const { state: bookmarkState, fetchBookmarks } = useBookmarks()

const aiStatus = ref<{ configured: boolean; provider: string | null } | null>(null)

const tabs = [
  { id: 'watchlist', label: 'Watchlist', desc: 'Your bookmarked countries' },
  { id: 'briefing', label: 'Country Briefing', desc: 'Single-country analysis' },
  { id: 'bilateral', label: 'Country Comparator', desc: 'Compare two countries' },
  { id: 'trends', label: 'Group Trends', desc: 'Group-level patterns' },
  { id: 'blocs', label: 'Voting Blocs', desc: 'Discover voting clusters' },
]

const activeTab = ref((route.query.tab as string) || 'briefing')
// old links to the former UN Monitor tab
if (activeTab.value === 'un-monitor') navigateTo('/un', { replace: true })
const initialIso = route.query.iso as string || ''
const initialA = route.query.a as string || ''
const initialB = route.query.b as string || ''
const initialGid = route.query.gid as string || ''

// Track current params for AI analysis
const currentBriefingIso = ref(initialIso)
const currentBilateralA = ref(initialA)
const currentBilateralB = ref(initialB)
const currentTrendsGid = ref(initialGid)

useHead({
  title: 'Diplomatic Intelligence — World Country Groups',
})

function setActiveTab(tabId: string) {
  activeTab.value = tabId
  router.replace({ query: { tab: tabId === 'briefing' ? undefined : tabId } })
  updateChatContext()
}

function viewCountryFromWatchlist(iso3: string) {
  currentBriefingIso.value = iso3
  activeTab.value = 'briefing'
  router.replace({ query: { iso: iso3 } })
  generateBriefing(iso3)
}

async function generateBriefing(iso: string) {
  currentBriefingIso.value = iso
  await briefing.fetch(iso)
  router.replace({ query: { tab: activeTab.value === 'briefing' ? undefined : activeTab.value, iso } })
  updateChatContext()
}

async function generateBilateral(a: string, b: string) {
  currentBilateralA.value = a
  currentBilateralB.value = b
  await bilateral.fetch(a, b)
  router.replace({ query: { tab: 'bilateral', a, b } })
  updateChatContext()
}

async function generateTrends(gid: string) {
  currentTrendsGid.value = gid
  await trends.fetch(gid)
  router.replace({ query: { tab: 'trends', gid } })
  updateChatContext()
}

function updateChatContext() {
  if (activeTab.value === 'briefing' && briefing.data) {
    chat.setContext('country', { iso: currentBriefingIso.value }, `Chat about ${briefing.data.country?.name || currentBriefingIso.value}`)
  } else if (activeTab.value === 'bilateral' && bilateral.data) {
    chat.setContext('bilateral', { a: currentBilateralA.value, b: currentBilateralB.value }, `Chat about ${bilateral.data.countryA?.name} & ${bilateral.data.countryB?.name}`)
  } else if (activeTab.value === 'trends' && trends.data) {
    chat.setContext('group', { gid: currentTrendsGid.value }, `Chat about ${trends.data.group?.name || currentTrendsGid.value}`)
  }
}

// Auto-load from deep link
onMounted(async () => {
  // Fetch AI status
  try {
    aiStatus.value = await $fetch<any>('/api/intelligence/ai/status')
  } catch {}

  // Fetch bookmarks for watchlist
  fetchBookmarks()

  if (activeTab.value === 'briefing' && initialIso) {
    const waitForCountries = () => new Promise<void>((resolve) => {
      if (allCountries.value) return resolve()
      const stop = watch(allCountries, (val) => { if (val) { stop(); resolve() } })
    })
    await waitForCountries()
    await briefing.fetch(initialIso)
    updateChatContext()
  } else if (activeTab.value === 'bilateral' && initialA && initialB) {
    await bilateral.fetch(initialA, initialB)
    updateChatContext()
  } else if (activeTab.value === 'trends' && initialGid) {
    await trends.fetch(initialGid)
    updateChatContext()
  }
})
</script>
