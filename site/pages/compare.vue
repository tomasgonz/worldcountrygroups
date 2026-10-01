<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-1">
      {{ mode === 'groups' ? 'Compare Groups' : 'Compare Countries' }}
    </h1>
    <p class="text-primary-400 text-sm mb-8">
      {{ mode === 'groups' ? 'Select 2–5 groups to compare side by side.' : 'Select 2–10 countries to compare side by side.' }}
    </p>

    <CompareSelector
      :mode="mode"
      :selected="selected"
      :loading="loading"
      :groups="allGroups"
      :countries="allCountries"
      @update:mode="switchMode"
      @add="addEntity"
      @remove="removeEntity"
      @compare="doCompare"
    />

    <!-- Results -->
    <template v-if="hasResult">
      <!-- AI Narrative -->
      <div v-if="aiConfigured && (aiNarrativeLoading || aiNarrativeContent)" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
        <h3 class="font-serif text-lg font-bold text-primary-900 mb-3">AI Comparative Analysis</h3>
        <div v-if="aiNarrativeLoading" class="space-y-3">
          <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
          <div class="h-3 bg-primary-100 rounded-full w-11/12 animate-pulse"></div>
          <div class="h-3 bg-primary-100 rounded-full w-4/5 animate-pulse"></div>
        </div>
        <div
          v-else-if="aiNarrativeContent"
          class="prose prose-sm prose-primary max-w-none prose-headings:font-serif prose-headings:text-primary-900 prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3 prose-ul:my-2 prose-li:text-primary-700 prose-li:my-0.5"
          v-html="renderedNarrative"
        ></div>
        <div v-if="aiNarrativeGeneratedAt" class="flex items-center justify-between mt-3 pt-2 border-t border-primary-50">
          <span class="text-xs text-primary-300">Updated {{ narrativeTimeAgo }}</span>
          <button @click="fetchAINarrative(true)" class="text-xs text-primary-300 hover:text-primary-500 transition-colors">Refresh</button>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="bg-primary-50 rounded-lg p-1 flex overflow-x-auto mb-8">
        <button
          v-for="tab in visibleTabs"
          :key="tab.id"
          class="px-4 py-2 rounded-md text-sm whitespace-nowrap transition-all"
          :class="activeTab === tab.id
            ? 'bg-white shadow-sm text-primary-900 font-medium'
            : 'text-primary-500 hover:text-primary-700'"
          @click="setActiveTab(tab.id)"
        >{{ tab.label }}</button>
      </div>

      <!-- Overview -->
      <CompareStats
        v-if="activeTab === 'overview'"
        :entities="statsEntities"
        :mode="mode"
      />

      <!-- Security -->
      <template v-if="activeTab === 'security'">
        <CompareMilitary
          :identifiers="entityIdentifiers"
          :mode="mode"
        />
        <div class="mb-10" />
        <CompareConflict
          :identifiers="entityIdentifiers"
          :mode="mode"
        />
      </template>

      <!-- Diplomacy -->
      <template v-if="activeTab === 'diplomacy'">
        <CompareGDELT
          :identifiers="entityIdentifiers"
          :mode="mode"
        />
        <div class="mb-10" />
        <CompareDiplomacy
          :identifiers="entityIdentifiers"
          :mode="mode"
        />
      </template>

      <!-- Voting -->
      <CompareVoting
        v-if="activeTab === 'voting'"
        :identifiers="entityIdentifiers"
        :mode="mode"
      />

      <!-- Members (groups mode only) -->
      <CompareOverlap
        v-if="activeTab === 'members' && mode === 'groups' && groupResult"
        :groups="groupResult.groups"
        :overlap="groupResult.overlap"
        :unique="groupResult.unique"
      />
    </template>

    <!-- Error -->
    <div v-else-if="errorMsg" class="bg-white rounded-2xl border border-red-100 p-6 text-center">
      <p class="text-red-600 text-sm">{{ errorMsg }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

const route = useRoute()
const router = useRouter()

const { groups: allGroups } = useGroups()
const { countries: allCountries } = useCountries()

const mode = ref<'groups' | 'countries'>((route.query.mode as string) === 'countries' ? 'countries' : 'groups')
const selected = ref<{ id: string; label: string; sublabel?: string; meta?: string; iso2?: string }[]>([])
const loading = ref(false)
const errorMsg = ref('')

// Results
const groupResult = ref<any>(null)
const countryResult = ref<any>(null)
const hasResult = computed(() => mode.value === 'groups' ? !!groupResult.value : !!countryResult.value)

// Tabs
const allTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'security', label: 'Security' },
  { id: 'diplomacy', label: 'Diplomacy' },
  { id: 'voting', label: 'Voting' },
  { id: 'members', label: 'Members' },
]

const visibleTabs = computed(() =>
  mode.value === 'countries'
    ? allTabs.filter(t => t.id !== 'members')
    : allTabs
)

const activeTab = ref((route.query.tab as string) || 'overview')

function setActiveTab(tabId: string) {
  activeTab.value = tabId
  const query = { ...route.query, tab: tabId === 'overview' ? undefined : tabId }
  router.replace({ query })
}

useHead({
  title: computed(() =>
    mode.value === 'groups'
      ? 'Compare Groups — World Country Groups'
      : 'Compare Countries — World Country Groups'
  ),
})

// Entity identifiers for child components
const entityIdentifiers = computed(() =>
  selected.value.map(s => ({ id: s.id, label: s.label }))
)

// Normalized stats entities for CompareStats
const statsEntities = computed(() => {
  if (mode.value === 'groups' && groupResult.value) {
    return groupResult.value.groups.map((g: any) => ({
      id: g.gid,
      label: g.acronym,
      countryCount: g.country_count,
      stats: g.stats,
      extended: g.extended,
      domains: g.domains,
    }))
  }
  if (mode.value === 'countries' && countryResult.value) {
    return countryResult.value.map((c: any) => ({
      id: c.iso2,
      label: c.name,
      stats: c.stats,
      extended: c.extended,
    }))
  }
  return []
})

// AI narrative
const aiConfigured = ref(false)
const aiNarrativeContent = ref('')
const aiNarrativeLoading = ref(false)
const aiNarrativeGeneratedAt = ref('')

const renderedNarrative = computed(() => aiNarrativeContent.value ? marked.parse(aiNarrativeContent.value) as string : '')
const narrativeTimeAgo = computed(() => {
  if (!aiNarrativeGeneratedAt.value) return ''
  const ms = Date.now() - new Date(aiNarrativeGeneratedAt.value).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
})

async function fetchAINarrative(force = false) {
  if (!aiConfigured.value || selected.value.length < 2) return
  aiNarrativeLoading.value = true
  try {
    const identifiers = selected.value.map(s => s.id).join(',')
    const params: Record<string, string> = { mode: mode.value, identifiers }
    if (force) params.force = 'true'
    const res = await $fetch<any>('/api/intelligence/ai/compare-analysis', { query: params })
    aiNarrativeContent.value = res.content
    aiNarrativeGeneratedAt.value = res.generatedAt
  } catch {}
  aiNarrativeLoading.value = false
}

function switchMode(newMode: 'groups' | 'countries') {
  if (newMode === mode.value) return
  mode.value = newMode
  selected.value = []
  groupResult.value = null
  countryResult.value = null
  errorMsg.value = ''
  activeTab.value = 'overview'
  router.replace({ query: { mode: newMode } })
}

function addEntity(entity: any) {
  if (selected.value.some(s => s.id === entity.id)) return
  const max = mode.value === 'groups' ? 5 : 10
  if (selected.value.length >= max) return
  selected.value.push(entity)
}

function removeEntity(id: string) {
  selected.value = selected.value.filter(s => s.id !== id)
}

async function doCompare() {
  if (selected.value.length < 2) return
  loading.value = true
  errorMsg.value = ''
  groupResult.value = null
  countryResult.value = null

  try {
    if (mode.value === 'groups') {
      const gids = selected.value.map(s => s.id).join(',')
      const data = await $fetch(`/api/groups/compare?groups=${gids}`)
      groupResult.value = data
      const tabQuery = activeTab.value !== 'overview' ? activeTab.value : undefined
      router.replace({ query: { mode: 'groups', groups: gids, tab: tabQuery } })
    } else {
      const codes = selected.value.map(s => s.id).join(',')
      const data = await $fetch(`/api/countries/compare?countries=${codes}`)
      countryResult.value = data
      const tabQuery = activeTab.value !== 'overview' ? activeTab.value : undefined
      router.replace({ query: { mode: 'countries', countries: codes, tab: tabQuery } })
    }
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || e?.message || 'Failed to compare'
  } finally {
    loading.value = false
  }

  // Fetch AI narrative after comparison
  if (hasResult.value) {
    fetchAINarrative()
  }
}

// Deep-link: auto-load from URL query
onMounted(async () => {
  // Check AI status
  try {
    const status = await $fetch<any>('/api/intelligence/ai/status')
    aiConfigured.value = status?.configured || false
  } catch {}

  const modeParam = route.query.mode as string
  const groupsParam = route.query.groups as string
  const countriesParam = route.query.countries as string
  const tabParam = route.query.tab as string

  if (modeParam === 'countries' && countriesParam) {
    mode.value = 'countries'

    // Wait for allCountries
    const waitFor = () => new Promise<void>((resolve) => {
      if (allCountries.value) return resolve()
      const stop = watch(allCountries, (val) => {
        if (val) { stop(); resolve() }
      })
    })
    await waitFor()

    const codes = countriesParam.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
    for (const code of codes.slice(0, 10)) {
      const match = (allCountries.value as any[]).find(c => c.iso2 === code || c.iso3 === code)
      if (match) {
        selected.value.push({ id: match.iso2, label: match.name, iso2: match.iso2 })
      }
    }

    if (selected.value.length >= 2) {
      await doCompare()
      if (tabParam && visibleTabs.value.some(t => t.id === tabParam)) {
        activeTab.value = tabParam
      }
    }
  } else if (groupsParam) {
    mode.value = 'groups'

    const waitFor = () => new Promise<void>((resolve) => {
      if (allGroups.value) return resolve()
      const stop = watch(allGroups, (val) => {
        if (val) { stop(); resolve() }
      })
    })
    await waitFor()

    const gids = groupsParam.split(',').map(g => g.trim().toLowerCase()).filter(Boolean)
    for (const gid of gids.slice(0, 5)) {
      const match = (allGroups.value as any[]).find(g => g.gid === gid)
      if (match) {
        selected.value.push({ id: match.gid, label: match.acronym, sublabel: match.name, meta: `${match.country_count} countries` })
      }
    }

    if (selected.value.length >= 2) {
      await doCompare()
      if (tabParam && visibleTabs.value.some(t => t.id === tabParam)) {
        activeTab.value = tabParam
      }
    }
  }
})
</script>
