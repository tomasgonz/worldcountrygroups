<template>
  <div v-if="data">
    <SectionNav :sections="sections" :active-section="activeSection" @navigate="scrollTo" />

    <!-- Theme Evolution -->
    <section id="gt-themes" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Theme Evolution</h3>
      <div v-if="data.themeTrends?.length">
        <div v-for="trend in data.themeTrends.slice(0, 10)" :key="trend.theme" class="mb-4">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium text-primary-700">{{ trend.theme }}</span>
            <span class="text-xs text-primary-400">{{ trend.total_resolutions }} resolutions</span>
          </div>
          <div class="flex gap-1">
            <div
              v-for="dec in trend.decades"
              :key="dec.decade"
              class="flex-1"
              :title="`${dec.decade}: ${dec.resolutions} res — Y:${dec.yes} N:${dec.no} A:${dec.abstain}`"
            >
              <div class="text-[10px] text-primary-400 text-center mb-0.5">{{ dec.decade }}</div>
              <div class="h-4 rounded-sm overflow-hidden flex bg-primary-50">
                <div class="bg-emerald-400" :style="{ width: pct(dec.yes, dec.yes + dec.no + dec.abstain) }" />
                <div class="bg-red-400" :style="{ width: pct(dec.no, dec.yes + dec.no + dec.abstain) }" />
                <div class="bg-amber-300" :style="{ width: pct(dec.abstain, dec.yes + dec.no + dec.abstain) }" />
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-4 text-[10px] text-primary-400 mt-2">
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-emerald-400 rounded-sm" /> Yes</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-red-400 rounded-sm" /> No</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-amber-300 rounded-sm" /> Abstain</span>
        </div>
      </div>
      <p v-else class="text-primary-400 text-sm">No voting theme trend data available.</p>
    </section>

    <!-- Cohesion -->
    <section id="gt-cohesion" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Cohesion</h3>

      <div class="flex items-center gap-6 mb-4">
        <div class="text-center">
          <span class="block text-4xl font-bold" :class="cohesionColor(data.cohesion.overall)">
            {{ data.cohesion.overall != null ? (data.cohesion.overall * 100).toFixed(0) + '%' : 'N/A' }}
          </span>
          <span class="text-xs text-primary-400">Overall Cohesion</span>
        </div>
        <div v-if="cohesionDirection" class="text-sm text-primary-500">
          <span :class="cohesionDirection === 'increasing' ? 'text-emerald-600' : cohesionDirection === 'decreasing' ? 'text-red-600' : 'text-primary-400'">
            {{ cohesionDirection === 'increasing' ? 'Trending up' : cohesionDirection === 'decreasing' ? 'Trending down' : 'Stable' }}
          </span>
        </div>
      </div>

      <div v-if="data.cohesion.trend?.length" class="space-y-1">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Session-by-Session</h5>
        <div class="flex items-end gap-1 h-24">
          <div
            v-for="s in data.cohesion.trend.slice(-20)"
            :key="s.session"
            class="flex-1 rounded-t-sm"
            :class="s.cohesion >= 0.8 ? 'bg-emerald-400' : s.cohesion >= 0.6 ? 'bg-amber-400' : 'bg-red-400'"
            :style="{ height: `${s.cohesion * 100}%` }"
            :title="`Session ${s.session}: ${(s.cohesion * 100).toFixed(0)}%`"
          />
        </div>
        <div class="flex justify-between text-[10px] text-primary-400 mt-1">
          <span v-if="data.cohesion.trend.length > 0">S{{ data.cohesion.trend[Math.max(0, data.cohesion.trend.length - 20)].session }}</span>
          <span v-if="data.cohesion.trend.length > 1">S{{ data.cohesion.trend[data.cohesion.trend.length - 1].session }}</span>
        </div>
      </div>
    </section>

    <!-- Emerging Topics -->
    <section id="gt-emerging" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Emerging Topics</h3>

      <div v-if="data.emergingTopics" class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h5 class="text-xs font-medium text-emerald-600 mb-2">New in Recent Sessions</h5>
          <div v-if="data.emergingTopics.newInRecent?.length" class="space-y-1.5">
            <div v-for="t in data.emergingTopics.newInRecent.slice(0, 8)" :key="t" class="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700">
              {{ t }}
            </div>
          </div>
          <p v-else class="text-xs text-primary-400">No new topics detected</p>
        </div>

        <div>
          <h5 class="text-xs font-medium text-primary-500 mb-2">Recent Top Themes</h5>
          <div v-if="data.emergingTopics.recent?.length" class="space-y-1.5">
            <div v-for="t in data.emergingTopics.recent.slice(0, 8)" :key="t.theme" class="flex items-center justify-between px-3 py-1.5 bg-primary-50 rounded-lg text-xs">
              <span class="text-primary-700">{{ t.theme }}</span>
              <span class="text-primary-400">{{ t.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Sentiment Shifts -->
    <section id="gt-sentiment" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Sentiment Shifts</h3>
      <div v-if="data.sentimentBySession?.length">
        <div class="space-y-2">
          <div v-for="s in data.sentimentBySession.slice(-15)" :key="s.session">
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-primary-400 w-16 shrink-0">S{{ s.session }} ({{ s.year }})</span>
              <div class="flex-1 h-4 rounded-sm overflow-hidden flex bg-primary-50">
                <div class="bg-emerald-400" :style="{ width: pct(s.positive, s.speechCount) }" :title="`Positive: ${s.positive}`" />
                <div class="bg-red-400" :style="{ width: pct(s.negative, s.speechCount) }" :title="`Negative: ${s.negative}`" />
                <div class="bg-amber-300" :style="{ width: pct(s.mixed, s.speechCount) }" :title="`Mixed: ${s.mixed}`" />
                <div class="bg-primary-200" :style="{ width: pct(s.neutral, s.speechCount) }" :title="`Neutral: ${s.neutral}`" />
              </div>
              <span class="text-[10px] text-primary-400 w-8 text-right">{{ s.speechCount }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-4 text-[10px] text-primary-400 mt-3">
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-emerald-400 rounded-sm" /> Positive</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-red-400 rounded-sm" /> Negative</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-amber-300 rounded-sm" /> Mixed</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-primary-200 rounded-sm" /> Neutral</span>
        </div>
      </div>
      <p v-else class="text-primary-400 text-sm">No sentiment data available.</p>
    </section>

    <!-- Key Conflicts -->
    <section id="gt-conflicts" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Key Conflicts</h3>
      <div v-if="data.conflicts?.length" class="space-y-3">
        <div v-for="c in data.conflicts" :key="c.conflict" class="p-3 bg-primary-50 rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-primary-700">{{ c.conflict }}</span>
            <span class="text-xs text-primary-400">{{ c.memberMentions }} member mentions</span>
          </div>
          <div v-if="c.stances?.length" class="flex flex-wrap gap-1">
            <span v-for="(s, i) in c.stances.slice(0, 8)" :key="i" class="px-1.5 py-0.5 rounded text-[10px] bg-white border border-primary-100 text-primary-600">
              {{ s.iso3 }}: {{ s.stance }}
            </span>
          </div>
        </div>
      </div>
      <p v-else class="text-primary-400 text-sm">No conflict references found in member speeches.</p>
    </section>

    <!-- Member Spotlight -->
    <section id="gt-members" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Member Spotlight</h3>
      <p class="text-xs text-primary-400 mb-3">Members with highest divergence from group majority (recent 5 sessions)</p>
      <div v-if="data.memberDivergence?.length" class="space-y-2">
        <div v-for="m in data.memberDivergence.slice(0, 10)" :key="m.iso3">
          <div class="flex items-center justify-between text-sm mb-0.5">
            <span class="text-primary-700">{{ m.iso3 }}</span>
            <span :class="m.divergenceScore >= 0.3 ? 'text-red-600' : m.divergenceScore >= 0.15 ? 'text-amber-600' : 'text-emerald-600'" class="font-medium">
              {{ (m.divergenceScore * 100).toFixed(0) }}% divergent
            </span>
          </div>
          <div class="h-2 rounded-full bg-primary-100 overflow-hidden">
            <div
              class="h-full rounded-full"
              :class="m.divergenceScore >= 0.3 ? 'bg-red-400' : m.divergenceScore >= 0.15 ? 'bg-amber-400' : 'bg-emerald-400'"
              :style="{ width: `${Math.min(m.divergenceScore * 200, 100)}%` }"
            />
          </div>
          <span class="text-[10px] text-primary-400">{{ m.totalVotes }} votes analyzed</span>
        </div>
      </div>
      <p v-else class="text-primary-400 text-sm">No divergence data available.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ data: any }>()

const sections = [
  { id: 'gt-themes', label: 'Themes' },
  { id: 'gt-cohesion', label: 'Cohesion' },
  { id: 'gt-emerging', label: 'Emerging' },
  { id: 'gt-sentiment', label: 'Sentiment' },
  { id: 'gt-conflicts', label: 'Conflicts' },
  { id: 'gt-members', label: 'Members' },
]

const { activeSection, scrollTo } = useSectionNav(sections)

function pct(val: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((val / total) * 100)}%`
}

function cohesionColor(v: number | null) {
  if (v == null) return 'text-primary-400'
  if (v >= 0.8) return 'text-emerald-600'
  if (v >= 0.6) return 'text-amber-600'
  return 'text-red-600'
}

const cohesionDirection = computed(() => {
  const trend = props.data?.cohesion?.trend
  if (!trend || trend.length < 4) return null
  const recent = trend.slice(-3).reduce((s: number, t: any) => s + t.cohesion, 0) / 3
  const earlier = trend.slice(-6, -3).reduce((s: number, t: any) => s + t.cohesion, 0) / Math.min(3, trend.slice(-6, -3).length)
  if (recent - earlier > 0.03) return 'increasing'
  if (earlier - recent > 0.03) return 'decreasing'
  return 'stable'
})
</script>
