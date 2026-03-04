<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-1">Diplomatic Intelligence</h1>
    <p class="text-primary-400 text-sm mb-8">Consolidated analysis across speeches, voting records, GDELT, conflict, and treaty data.</p>

    <!-- Tab bar -->
    <div class="bg-primary-50 rounded-lg p-1 flex overflow-x-auto mb-8">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="px-4 py-2 rounded-md text-sm whitespace-nowrap transition-all"
        :class="activeTab === tab.id
          ? 'bg-white shadow-sm text-primary-900 font-medium'
          : 'text-primary-500 hover:text-primary-700'"
        @click="setActiveTab(tab.id)"
      >{{ tab.label }}</button>
    </div>

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
      <IntelligenceCountryBriefing v-if="briefing.data" :data="briefing.data" />
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
      <IntelligenceBilateralPrep v-if="bilateral.data" :data="bilateral.data" />
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
      <IntelligenceGroupTrends v-if="trends.data" :data="trends.data" />
    </template>
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

const tabs = [
  { id: 'briefing', label: 'Country Briefing' },
  { id: 'bilateral', label: 'Bilateral Prep' },
  { id: 'trends', label: 'Group Trends' },
]

const activeTab = ref((route.query.tab as string) || 'briefing')
const initialIso = route.query.iso as string || ''
const initialA = route.query.a as string || ''
const initialB = route.query.b as string || ''
const initialGid = route.query.gid as string || ''

useHead({
  title: 'Diplomatic Intelligence — World Country Groups',
})

function setActiveTab(tabId: string) {
  activeTab.value = tabId
  router.replace({ query: { tab: tabId === 'briefing' ? undefined : tabId } })
}

async function generateBriefing(iso: string) {
  await briefing.fetch(iso)
  router.replace({ query: { tab: activeTab.value === 'briefing' ? undefined : activeTab.value, iso } })
}

async function generateBilateral(a: string, b: string) {
  await bilateral.fetch(a, b)
  router.replace({ query: { tab: 'bilateral', a, b } })
}

async function generateTrends(gid: string) {
  await trends.fetch(gid)
  router.replace({ query: { tab: 'trends', gid } })
}

// Auto-load from deep link
onMounted(async () => {
  if (activeTab.value === 'briefing' && initialIso) {
    // Wait for countries to load
    const waitForCountries = () => new Promise<void>((resolve) => {
      if (allCountries.value) return resolve()
      const stop = watch(allCountries, (val) => { if (val) { stop(); resolve() } })
    })
    await waitForCountries()
    await briefing.fetch(initialIso)
  } else if (activeTab.value === 'bilateral' && initialA && initialB) {
    await bilateral.fetch(initialA, initialB)
  } else if (activeTab.value === 'trends' && initialGid) {
    await trends.fetch(initialGid)
  }
})
</script>
