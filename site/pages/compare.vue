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
}

// Deep-link: auto-load from URL query
onMounted(async () => {
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
