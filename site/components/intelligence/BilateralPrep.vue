<template>
  <div v-if="data">
    <SectionNav :sections="sections" :active-section="activeSection" @navigate="scrollTo" />

    <!-- Voting Alignment -->
    <section id="bi-voting" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Voting Alignment</h3>

      <div class="flex items-center gap-6 mb-6">
        <div class="text-center">
          <span class="block text-4xl font-bold" :class="alignColor(data.votingAlignment.overall)">
            {{ (data.votingAlignment.overall * 100).toFixed(0) }}%
          </span>
          <span class="text-xs text-primary-400">Overall Alignment</span>
        </div>
        <div class="text-xs text-primary-500">
          <p>Based on {{ data.votingAlignment.resolutionsCompared.toLocaleString() }} resolutions compared</p>
        </div>
      </div>

      <div v-if="data.votingAlignment.perTheme?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Per-Theme Breakdown</h5>
        <div class="space-y-2">
          <div v-for="t in data.votingAlignment.perTheme" :key="t.theme">
            <div class="flex items-center justify-between text-xs mb-0.5">
              <span class="text-primary-700">{{ t.theme }}</span>
              <span :class="alignColor(t.alignment)">{{ (t.alignment * 100).toFixed(0) }}%</span>
            </div>
            <div class="h-2 rounded-full bg-primary-100 overflow-hidden">
              <div class="h-full rounded-full" :class="alignBg(t.alignment)" :style="{ width: `${t.alignment * 100}%` }" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Speech Cross-References -->
    <section id="bi-speeches" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Speech Cross-References</h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div>
          <h5 class="text-xs font-medium text-primary-500 mb-2">{{ data.countryA.name }} mentions {{ data.countryB.name }}</h5>
          <div v-if="data.speechCrossRefs.aMentionsB.length" class="space-y-2">
            <div v-for="(m, i) in data.speechCrossRefs.aMentionsB" :key="i" class="p-2 bg-primary-50 rounded-lg">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-primary-400">Session {{ m.session }} ({{ m.year }})</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-medium" :class="sentimentBadge(m.sentiment)">{{ m.sentiment }}</span>
              </div>
              <p class="text-xs text-primary-700">{{ m.context }}</p>
            </div>
          </div>
          <p v-else class="text-xs text-primary-400">No mentions found</p>
        </div>

        <div>
          <h5 class="text-xs font-medium text-primary-500 mb-2">{{ data.countryB.name }} mentions {{ data.countryA.name }}</h5>
          <div v-if="data.speechCrossRefs.bMentionsA.length" class="space-y-2">
            <div v-for="(m, i) in data.speechCrossRefs.bMentionsA" :key="i" class="p-2 bg-primary-50 rounded-lg">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-primary-400">Session {{ m.session }} ({{ m.year }})</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-medium" :class="sentimentBadge(m.sentiment)">{{ m.sentiment }}</span>
              </div>
              <p class="text-xs text-primary-700">{{ m.context }}</p>
            </div>
          </div>
          <p v-else class="text-xs text-primary-400">No mentions found</p>
        </div>
      </div>

      <div v-if="data.speechCrossRefs.sharedThemes?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Shared Speech Themes</h5>
        <div class="flex flex-wrap gap-2">
          <span v-for="t in data.speechCrossRefs.sharedThemes.slice(0, 12)" :key="t.theme"
            class="px-2 py-1 bg-primary-50 border border-primary-100 rounded-lg text-xs text-primary-600">
            {{ t.theme }} <span class="text-primary-400">({{ t.countA }}+{{ t.countB }})</span>
          </span>
        </div>
      </div>
    </section>

    <!-- Shared Groups -->
    <section id="bi-groups" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Shared Groups</h3>
      <div v-if="data.sharedGroups?.length" class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="g in data.sharedGroups"
          :key="g.gid"
          :to="`/groups/${g.gid}`"
          class="px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700 hover:bg-primary-100 transition-colors"
        >
          <span class="font-medium">{{ g.acronym }}</span>
          <span class="text-primary-400 text-xs ml-1">{{ g.name }}</span>
        </NuxtLink>
      </div>
      <p v-else class="text-primary-400 text-sm">No shared group memberships found.</p>
    </section>

    <!-- Position Comparison -->
    <section id="bi-positions" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Position Comparison</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div v-for="(side, key) in { a: data.positionComparison.a, b: data.positionComparison.b }" :key="key">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-lg">{{ isoToFlag(key === 'a' ? data.countryA.iso2 : data.countryB.iso2) }}</span>
            <h5 class="font-serif font-semibold text-primary-900">{{ key === 'a' ? data.countryA.name : data.countryB.name }}</h5>
          </div>
          <template v-if="side">
            <p class="text-xs text-primary-400 mb-2">Session {{ side.session }} ({{ side.year }}) &mdash; {{ side.speaker }}</p>
            <p class="text-sm text-primary-700 mb-3 leading-relaxed">{{ side.summary }}</p>
            <div v-if="side.policy_positions?.length" class="space-y-1.5">
              <div v-for="(p, i) in side.policy_positions.slice(0, 5)" :key="i" class="bg-primary-50 rounded-lg p-2">
                <span class="text-xs font-medium text-primary-700">{{ p.topic }}</span>
                <p class="text-xs text-primary-500">{{ p.position }}</p>
              </div>
            </div>
          </template>
          <p v-else class="text-primary-400 text-sm">No speech data available.</p>
        </div>
      </div>
    </section>

    <!-- GDELT Bilateral -->
    <section id="bi-gdelt" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">GDELT Bilateral</h3>
      <template v-if="data.gdeltBilateral">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="text-center p-3 bg-primary-50 rounded-lg">
            <span class="block text-xl font-bold text-primary-900">{{ data.gdeltBilateral.events }}</span>
            <span class="text-xs text-primary-400">Events</span>
          </div>
          <div class="text-center p-3 bg-primary-50 rounded-lg">
            <span class="block text-xl font-bold" :class="data.gdeltBilateral.cooperation_ratio >= 0.5 ? 'text-emerald-600' : 'text-red-600'">
              {{ (data.gdeltBilateral.cooperation_ratio * 100).toFixed(0) }}%
            </span>
            <span class="text-xs text-primary-400">Cooperation</span>
          </div>
          <div class="text-center p-3 bg-primary-50 rounded-lg">
            <span class="block text-xl font-bold text-emerald-600">{{ data.gdeltBilateral.cooperative }}</span>
            <span class="text-xs text-primary-400">Cooperative</span>
          </div>
          <div class="text-center p-3 bg-primary-50 rounded-lg">
            <span class="block text-xl font-bold text-red-600">{{ data.gdeltBilateral.conflictual }}</span>
            <span class="text-xs text-primary-400">Conflictual</span>
          </div>
        </div>
        <div class="mt-3 text-center">
          <span class="text-xs text-primary-400">Average Tone: </span>
          <span class="text-sm font-medium" :class="data.gdeltBilateral.avg_tone >= 0 ? 'text-emerald-600' : 'text-red-600'">
            {{ data.gdeltBilateral.avg_tone.toFixed(2) }}
          </span>
        </div>
      </template>
      <p v-else class="text-primary-400 text-sm">No bilateral GDELT data available.</p>
    </section>

    <!-- Regime Comparison -->
    <section v-if="data.regimeComparison" id="bi-regime" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Regime Comparison</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div v-for="(side, key) in { a: data.regimeComparison.a, b: data.regimeComparison.b }" :key="key" class="text-center">
          <h5 class="font-serif font-semibold text-primary-900 mb-1">{{ key === 'a' ? data.countryA.name : data.countryB.name }}</h5>
          <span v-if="side?.latest?.regime" class="px-2 py-0.5 rounded-full text-xs font-medium" :class="regimeBadge(side.latest.regime)">{{ side.latest.regime }}</span>
          <div v-if="side?.latest" class="mt-3">
            <ChartsChartRadar :axes="buildVDemAxes(side.latest)" :size="220" :fill-color="key === 'a' ? '#3b82f6' : '#f59e0b'" :stroke-color="key === 'a' ? '#3b82f6' : '#f59e0b'" />
          </div>
          <p v-else class="text-xs text-primary-400 mt-4">No V-Dem data</p>
        </div>
      </div>
    </section>

    <!-- Visa Relationship -->
    <section v-if="data.visaRelationship" id="bi-visa" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Visa Relationship</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="bg-primary-50 rounded-xl p-4">
          <div class="text-xs text-primary-400 mb-1">{{ data.countryA.name }} → {{ data.countryB.name }}</div>
          <span class="text-sm font-medium" :class="visaColor(data.visaRelationship.aToB)">{{ data.visaRelationship.aToB || 'Unknown' }}</span>
        </div>
        <div class="bg-primary-50 rounded-xl p-4">
          <div class="text-xs text-primary-400 mb-1">{{ data.countryB.name }} → {{ data.countryA.name }}</div>
          <span class="text-sm font-medium" :class="visaColor(data.visaRelationship.bToA)">{{ data.visaRelationship.bToA || 'Unknown' }}</span>
        </div>
      </div>
    </section>

    <!-- Arms Relationship -->
    <section v-if="data.armsRelationship" id="bi-arms" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Arms Relationship</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div v-for="(side, key) in { a: data.armsRelationship.a, b: data.armsRelationship.b }" :key="key" class="bg-primary-50 rounded-xl p-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">{{ key === 'a' ? data.countryA.name : data.countryB.name }}</h5>
          <template v-if="side">
            <p class="text-sm text-primary-700">Exports: {{ formatTIV(side.total_exports) }} <span class="text-xs text-primary-400">(#{{ side.export_rank }})</span></p>
            <p class="text-sm text-primary-700">Imports: {{ formatTIV(side.total_imports) }} <span class="text-xs text-primary-400">(#{{ side.import_rank }})</span></p>
          </template>
          <p v-else class="text-xs text-primary-400">No data</p>
        </div>
      </div>
      <div v-if="data.armsRelationship.aSuppliesB || data.armsRelationship.bSuppliesA" class="space-y-2">
        <div v-if="data.armsRelationship.aSuppliesB" class="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <span class="text-sm text-primary-700">{{ data.countryA.name }} → {{ data.countryB.name }}</span>
          <span class="text-sm font-medium text-blue-700">{{ formatTIV(data.armsRelationship.aSuppliesB.value) }} TIV</span>
        </div>
        <div v-if="data.armsRelationship.bSuppliesA" class="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <span class="text-sm text-primary-700">{{ data.countryB.name }} → {{ data.countryA.name }}</span>
          <span class="text-sm font-medium text-blue-700">{{ formatTIV(data.armsRelationship.bSuppliesA.value) }} TIV</span>
        </div>
      </div>
    </section>

    <!-- Aid Relationship -->
    <section v-if="data.aidRelationship" id="bi-aid" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Aid Relationship</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div v-for="(side, key) in { a: data.aidRelationship.a, b: data.aidRelationship.b }" :key="key" class="bg-primary-50 rounded-xl p-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">{{ key === 'a' ? data.countryA.name : data.countryB.name }}</h5>
          <template v-if="side">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium mb-1 inline-block" :class="side.is_donor ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'">{{ side.is_donor ? 'Donor' : 'Recipient' }}</span>
            <p class="text-sm text-primary-700">Given: ${{ formatNumber(side.total_given) }}</p>
            <p class="text-sm text-primary-700">Received: ${{ formatNumber(side.total_received) }}</p>
          </template>
          <p v-else class="text-xs text-primary-400">No data</p>
        </div>
      </div>
      <div v-if="data.aidRelationship.aGivesB || data.aidRelationship.bGivesA" class="space-y-2">
        <div v-if="data.aidRelationship.aGivesB" class="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
          <span class="text-sm text-primary-700">{{ data.countryA.name }} → {{ data.countryB.name }}</span>
          <span class="text-sm font-medium text-emerald-700">${{ formatNumber(data.aidRelationship.aGivesB.value) }}</span>
        </div>
        <div v-if="data.aidRelationship.bGivesA" class="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
          <span class="text-sm text-primary-700">{{ data.countryB.name }} → {{ data.countryA.name }}</span>
          <span class="text-sm font-medium text-emerald-700">${{ formatNumber(data.aidRelationship.bGivesA.value) }}</span>
        </div>
      </div>
    </section>

    <!-- Alliance Ties -->
    <section v-if="data.allianceRelationship" id="bi-alliances" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Alliance Ties</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div v-for="(side, key) in { a: data.allianceRelationship.a, b: data.allianceRelationship.b }" :key="key" class="bg-primary-50 rounded-xl p-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">{{ key === 'a' ? data.countryA.name : data.countryB.name }}</h5>
          <template v-if="side">
            <p class="text-sm text-primary-700">Active: {{ side.active_alliances }} &middot; Defense: {{ side.defense_pacts }}</p>
          </template>
          <p v-else class="text-xs text-primary-400">No data</p>
        </div>
      </div>
      <div v-if="data.allianceRelationship.sharedAlliances?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Shared Alliances</h5>
        <div class="flex flex-wrap gap-2">
          <span v-for="a in data.allianceRelationship.sharedAlliances" :key="a" class="px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">{{ a }}</span>
        </div>
      </div>
      <p v-else class="text-xs text-primary-400 mt-2">No shared alliances found.</p>
    </section>

    <!-- Conflict Context -->
    <section v-if="data.conflictProfile" id="bi-conflict" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Conflict Context</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div v-for="(side, key) in { a: data.conflictProfile.a, b: data.conflictProfile.b }" :key="key" class="bg-primary-50 rounded-xl p-4">
          <h5 class="font-serif font-semibold text-primary-900 mb-2">{{ key === 'a' ? data.countryA.name : data.countryB.name }}</h5>
          <template v-if="side">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium mb-2 inline-block" :class="intensityBadge(side.conflict_intensity)">{{ side.conflict_intensity }}</span>
            <p class="text-sm text-primary-700">{{ side.total_events?.toLocaleString() }} events</p>
            <p class="text-xs text-primary-500">{{ side.total_fatalities?.toLocaleString() }} fatalities &middot; Trend: {{ side.trend }}</p>
          </template>
          <p v-else class="text-xs text-emerald-600">No conflict data</p>
        </div>
      </div>
    </section>

    <!-- Diplomatic Cable -->
    <section v-if="aiConfigured" id="bi-cable" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-serif text-xl font-bold text-primary-900">SITREP Cable</h3>
        <div class="flex items-center gap-2">
          <button
            v-if="!cableContent"
            @click="fetchCable"
            :disabled="cableLoading"
            class="px-3 py-1.5 bg-primary-900 text-white text-xs font-medium rounded-lg hover:bg-primary-800 disabled:opacity-50 transition-colors"
          >{{ cableLoading ? 'Generating...' : 'Generate SITREP' }}</button>
          <a
            v-if="cableContent"
            :href="`/api/intelligence/ai/cable-doc?type=bilateral&a=${data.countryA.iso3}&b=${data.countryB.iso3}`"
            class="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >Download DOCX</a>
        </div>
      </div>
      <div v-if="cableLoading" class="space-y-2">
        <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
        <div class="h-3 bg-primary-100 rounded-full w-11/12 animate-pulse"></div>
        <div class="h-3 bg-primary-100 rounded-full w-4/5 animate-pulse"></div>
      </div>
      <div
        v-if="cableContent"
        class="prose prose-sm prose-primary max-w-none prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3 font-mono text-xs"
        v-html="renderedCable"
      ></div>
    </section>

    <!-- Divergence Points -->
    <section id="bi-divergence" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Divergence Points</h3>
      <div v-if="data.divergencePoints?.length" class="space-y-3">
        <div v-for="d in data.divergencePoints" :key="d.theme" class="flex items-center justify-between p-3 bg-red-50 rounded-lg">
          <span class="text-sm text-primary-700">{{ d.theme }}</span>
          <div class="text-right">
            <span class="text-red-600 font-medium text-sm">{{ (d.alignment * 100).toFixed(0) }}% aligned</span>
            <span class="text-xs text-primary-400 block">{{ d.resolutions }} resolutions</span>
          </div>
        </div>
      </div>
      <p v-else class="text-primary-400 text-sm">No significant divergence points found.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'

const props = defineProps<{ data: any; aiConfigured?: boolean }>()

const cableContent = ref('')
const cableLoading = ref(false)

const { highlight } = useBriefHighlight()
const renderedCable = computed(() =>
  cableContent.value ? marked.parse(highlight(cableContent.value)) as string : ''
)

async function fetchCable() {
  if (!props.data?.countryA?.iso3 || !props.data?.countryB?.iso3) return
  cableLoading.value = true
  try {
    const res = await $fetch<any>('/api/intelligence/ai/cable', {
      query: { type: 'bilateral', a: props.data.countryA.iso3, b: props.data.countryB.iso3 },
    })
    cableContent.value = res.content || ''
  } catch {}
  cableLoading.value = false
}

const sections = computed(() => {
  const base: { id: string; label: string }[] = []
  if (props.aiConfigured) base.push({ id: 'bi-overview', label: 'Overview' })
  base.push(
    { id: 'bi-voting', label: 'Voting' },
    { id: 'bi-speeches', label: 'Speeches' },
    { id: 'bi-groups', label: 'Groups' },
    { id: 'bi-positions', label: 'Positions' },
    { id: 'bi-gdelt', label: 'GDELT' },
  )
  if (props.data?.regimeComparison) base.push({ id: 'bi-regime', label: 'Regime' })
  if (props.data?.visaRelationship) base.push({ id: 'bi-visa', label: 'Visa' })
  if (props.data?.armsRelationship) base.push({ id: 'bi-arms', label: 'Arms' })
  if (props.data?.aidRelationship) base.push({ id: 'bi-aid', label: 'Aid' })
  if (props.data?.allianceRelationship) base.push({ id: 'bi-alliances', label: 'Alliances' })
  if (props.data?.conflictProfile) base.push({ id: 'bi-conflict', label: 'Conflict' })
  if (props.aiConfigured) base.push({ id: 'bi-cable', label: 'SITREP' })
  base.push({ id: 'bi-divergence', label: 'Divergence' })
  return base
})

const { activeSection, scrollTo } = useSectionNav(sections)

function alignColor(v: number) {
  if (v >= 0.7) return 'text-emerald-600'
  if (v >= 0.4) return 'text-amber-600'
  return 'text-red-600'
}

function alignBg(v: number) {
  if (v >= 0.7) return 'bg-emerald-400'
  if (v >= 0.4) return 'bg-amber-400'
  return 'bg-red-400'
}

function sentimentBadge(s: string) {
  if (s === 'positive') return 'bg-emerald-100 text-emerald-700'
  if (s === 'negative') return 'bg-red-100 text-red-700'
  return 'bg-primary-100 text-primary-600'
}

function regimeBadge(regime: string) {
  if (regime === 'Liberal Democracy') return 'bg-emerald-100 text-emerald-700'
  if (regime === 'Electoral Democracy') return 'bg-blue-100 text-blue-700'
  if (regime === 'Electoral Autocracy') return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function buildVDemAxes(d: any) {
  return [
    { label: 'Polyarchy', value: d.v2x_polyarchy || 0 },
    { label: 'Liberal', value: d.v2x_libdem || 0 },
    { label: 'Participatory', value: d.v2x_partipdem || 0 },
    { label: 'Deliberative', value: d.v2x_delibdem || 0 },
    { label: 'Egalitarian', value: d.v2x_egaldem || 0 },
    { label: 'Free Expr.', value: d.v2x_freexp_altinf || 0 },
    { label: 'Rule of Law', value: d.v2x_rule || 0 },
    { label: 'Civil Lib.', value: d.v2x_civlib || 0 },
  ]
}

function visaColor(status: string) {
  if (!status) return 'text-primary-500'
  if (status.toLowerCase().includes('free') || /^\d+ days$/.test(status)) return 'text-emerald-600'
  if (status.toLowerCase().includes('arrival')) return 'text-blue-600'
  if (status.toLowerCase().includes('e-visa')) return 'text-amber-600'
  return 'text-red-600'
}

function intensityBadge(i: string) {
  if (i === 'high') return 'bg-red-100 text-red-700'
  if (i === 'medium') return 'bg-amber-100 text-amber-700'
  if (i === 'low') return 'bg-emerald-100 text-emerald-700'
  return 'bg-primary-100 text-primary-600'
}

</script>
