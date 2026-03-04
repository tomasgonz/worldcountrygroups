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
defineProps<{ data: any }>()

const sections = [
  { id: 'bi-voting', label: 'Voting' },
  { id: 'bi-speeches', label: 'Speeches' },
  { id: 'bi-groups', label: 'Groups' },
  { id: 'bi-positions', label: 'Positions' },
  { id: 'bi-gdelt', label: 'GDELT' },
  { id: 'bi-divergence', label: 'Divergence' },
]

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
</script>
