<template>
  <div v-if="data">
    <SectionNav :sections="sections" :active-section="activeSection" @navigate="scrollTo" />

    <!-- Executive Summary -->
    <section id="intel-summary" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Executive Summary</h3>
      <div class="flex items-center gap-3 mb-4">
        <span class="text-3xl">{{ isoToFlag(data.country.iso2) }}</span>
        <div>
          <h4 class="font-serif text-lg font-semibold text-primary-900">{{ data.country.name }}</h4>
          <p class="text-primary-400 text-xs">{{ data.country.region }} &middot; {{ data.country.subregion }} &middot; {{ data.country.income_group || 'N/A' }}</p>
        </div>
      </div>

      <template v-if="data.latestSpeech">
        <div class="bg-primary-50 rounded-xl p-4 mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-primary-500">Latest UN Address (Session {{ data.latestSpeech.session }}, {{ data.latestSpeech.year }})</span>
            <span
              class="px-2 py-0.5 rounded-full text-xs font-medium"
              :class="sentimentClass(data.latestSpeech.sentiment?.overall)"
            >{{ data.latestSpeech.sentiment?.overall || 'N/A' }}</span>
          </div>
          <p class="text-xs text-primary-500 mb-1">{{ data.latestSpeech.speaker }} &mdash; {{ data.latestSpeech.speaker_title }}</p>
          <p class="text-sm text-primary-700 leading-relaxed">{{ data.latestSpeech.summary }}</p>
        </div>

        <div v-if="data.latestSpeech.key_quotes?.length" class="mb-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">Key Quotes</h5>
          <div v-for="(q, i) in data.latestSpeech.key_quotes.slice(0, 3)" :key="i" class="border-l-2 border-primary-200 pl-3 mb-2">
            <p class="text-sm text-primary-600 italic">"{{ q }}"</p>
          </div>
        </div>

        <div v-if="data.latestSpeech.policy_positions?.length" class="mb-2">
          <h5 class="text-xs font-medium text-primary-500 mb-2">Policy Positions</h5>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div v-for="(p, i) in data.latestSpeech.policy_positions.slice(0, 6)" :key="i" class="bg-white border border-primary-50 rounded-lg p-2">
              <span class="text-xs font-medium text-primary-700">{{ p.topic }}</span>
              <p class="text-xs text-primary-500">{{ p.position }}</p>
            </div>
          </div>
        </div>
      </template>
      <p v-else class="text-primary-400 text-sm">No speech data available.</p>
    </section>

    <!-- Theme Evolution -->
    <section id="intel-themes" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Theme Evolution</h3>
      <div v-if="data.themeTrends?.length">
        <div v-for="trend in data.themeTrends.slice(0, 8)" :key="trend.theme" class="mb-4">
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
      <p v-else class="text-primary-400 text-sm">No voting theme data available.</p>
    </section>

    <!-- Voting Pattern -->
    <section id="intel-voting" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Voting Pattern</h3>

      <div v-if="data.votingAlignment.p5.length" class="mb-6">
        <h5 class="text-xs font-medium text-primary-500 mb-2">P5 Alignment</h5>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div v-for="p in sortedP5" :key="p.iso3" class="text-center p-3 bg-primary-50 rounded-lg">
            <span class="block text-lg font-bold" :class="p.agreement >= 0.7 ? 'text-emerald-600' : p.agreement >= 0.4 ? 'text-amber-600' : 'text-red-600'">
              {{ (p.agreement * 100).toFixed(0) }}%
            </span>
            <span class="text-xs text-primary-500">{{ p5Label(p.iso3) }}</span>
          </div>
        </div>
      </div>

      <div v-if="data.themeStats?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Voting by Theme</h5>
        <div class="space-y-2">
          <div v-for="t in data.themeStats.slice(0, 10)" :key="t.theme">
            <div class="flex items-center justify-between text-xs mb-0.5">
              <span class="text-primary-700">{{ t.theme }}</span>
              <span class="text-primary-400">{{ t.resolutions }} res</span>
            </div>
            <div class="h-3 rounded-sm overflow-hidden flex bg-primary-50">
              <div class="bg-emerald-400" :style="{ width: pct(t.yes, t.resolutions) }" />
              <div class="bg-red-400" :style="{ width: pct(t.no, t.resolutions) }" />
              <div class="bg-amber-300" :style="{ width: pct(t.abstain, t.resolutions) }" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="data.votingAlignment.mostAligned?.length" class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h5 class="text-xs font-medium text-primary-500 mb-2">Most Aligned</h5>
          <div v-for="a in data.votingAlignment.mostAligned" :key="a.iso3" class="flex items-center justify-between py-1 text-sm">
            <span class="text-primary-700">{{ a.name || a.iso3 }}</span>
            <span class="text-emerald-600 font-medium">{{ (a.agreement * 100).toFixed(0) }}%</span>
          </div>
        </div>
        <div>
          <h5 class="text-xs font-medium text-primary-500 mb-2">Least Aligned</h5>
          <div v-for="a in data.votingAlignment.leastAligned" :key="a.iso3" class="flex items-center justify-between py-1 text-sm">
            <span class="text-primary-700">{{ a.name || a.iso3 }}</span>
            <span class="text-red-600 font-medium">{{ (a.agreement * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Relationships -->
    <section id="intel-relationships" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Relationships</h3>

      <div v-if="data.speechMentions?.length" class="mb-6">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Most Referenced Countries (in speeches)</h5>
        <div class="space-y-2">
          <div v-for="m in data.speechMentions.slice(0, 10)" :key="m.iso3" class="flex items-center justify-between">
            <span class="text-sm text-primary-700">{{ m.name || m.iso3 }}</span>
            <span class="text-xs text-primary-400">{{ m.count }}x &mdash; {{ truncate(m.context, 60) }}</span>
          </div>
        </div>
      </div>

      <div v-if="data.gdelt?.topPartners?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">GDELT Bilateral Partners</h5>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-primary-400 border-b border-primary-50">
                <th class="text-left py-1 font-medium">Partner</th>
                <th class="text-right py-1 font-medium">Events</th>
                <th class="text-right py-1 font-medium">Coop%</th>
                <th class="text-right py-1 font-medium">Tone</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in data.gdelt.topPartners" :key="p.partner" class="border-b border-primary-50/50">
                <td class="py-1.5 text-primary-700">{{ p.partner }}</td>
                <td class="py-1.5 text-right text-primary-500">{{ p.events }}</td>
                <td class="py-1.5 text-right" :class="p.cooperation_ratio >= 0.5 ? 'text-emerald-600' : 'text-red-500'">
                  {{ (p.cooperation_ratio * 100).toFixed(0) }}%
                </td>
                <td class="py-1.5 text-right" :class="p.avg_tone >= 0 ? 'text-emerald-600' : 'text-red-500'">
                  {{ p.avg_tone.toFixed(1) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Risk Profile -->
    <section id="intel-risk" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Risk Profile</h3>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Conflict -->
        <div class="bg-primary-50 rounded-xl p-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">Conflict Status</h5>
          <template v-if="data.riskProfile.conflict">
            <span
              class="inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2"
              :class="intensityClass(data.riskProfile.conflict.conflict_intensity)"
            >{{ data.riskProfile.conflict.conflict_intensity }}</span>
            <p class="text-sm text-primary-700">{{ data.riskProfile.conflict.total_events.toLocaleString() }} events</p>
            <p class="text-xs text-primary-500">{{ data.riskProfile.conflict.total_fatalities.toLocaleString() }} fatalities</p>
          </template>
          <p v-else class="text-sm text-primary-400">No conflict data</p>
        </div>

        <!-- Sanctions -->
        <div class="bg-primary-50 rounded-xl p-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">Sanctions</h5>
          <template v-if="data.riskProfile.sanctions">
            <span class="text-lg font-bold text-red-600">{{ data.riskProfile.sanctions.length }}</span>
            <span class="text-xs text-primary-500 ml-1">active regime(s)</span>
            <div v-for="s in data.riskProfile.sanctions.slice(0, 3)" :key="s.id" class="mt-1">
              <p class="text-xs text-primary-700">{{ s.name }}</p>
            </div>
          </template>
          <p v-else class="text-sm text-emerald-600">No sanctions</p>
        </div>

        <!-- Military -->
        <div class="bg-primary-50 rounded-xl p-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">Military</h5>
          <template v-if="data.riskProfile.military">
            <p class="text-sm text-primary-700">Rank #{{ data.riskProfile.military.rank }}</p>
            <p class="text-xs text-primary-500">{{ formatMilitary(data.riskProfile.military.active_military) }} active</p>
            <p class="text-xs text-primary-500">{{ formatDefenseBudget(data.riskProfile.military.defense_budget) }} budget</p>
          </template>
          <p v-else class="text-sm text-primary-400">No military data</p>
        </div>
      </div>
    </section>

    <!-- Treaties & Groups -->
    <section id="intel-treaties" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Treaties & Groups</h3>

      <div v-if="data.treaties?.length" class="mb-6">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Treaty Participation</h5>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div v-for="t in data.treaties.slice(0, 12)" :key="t.treaty?.id || t.treaty?.name" class="flex items-center justify-between p-2 bg-primary-50 rounded-lg">
            <span class="text-xs text-primary-700">{{ t.treaty?.short_name || t.treaty?.name }}</span>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-medium"
              :class="treatyStatusClass(t.status)"
            >{{ t.status }}</span>
          </div>
        </div>
      </div>

      <div v-if="data.groups?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Group Memberships ({{ data.groups.length }})</h5>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="g in data.groups"
            :key="g.gid"
            :to="`/groups/${g.gid}`"
            class="px-2.5 py-1 bg-primary-50 border border-primary-100 rounded-lg text-xs text-primary-700 hover:bg-primary-100 transition-colors"
          >{{ g.acronym }}</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ data: any }>()

const sections = [
  { id: 'intel-summary', label: 'Summary' },
  { id: 'intel-themes', label: 'Themes' },
  { id: 'intel-voting', label: 'Voting' },
  { id: 'intel-relationships', label: 'Relations' },
  { id: 'intel-risk', label: 'Risk' },
  { id: 'intel-treaties', label: 'Treaties' },
]

const { activeSection, scrollTo } = useSectionNav(sections)

const p5Map: Record<string, string> = { USA: 'United States', GBR: 'United Kingdom', FRA: 'France', RUS: 'Russia', CHN: 'China' }
const p5Order = ['USA', 'GBR', 'FRA', 'RUS', 'CHN']

function p5Label(iso3: string) { return p5Map[iso3] || iso3 }

const sortedP5 = computed(() => {
  if (!props.data?.votingAlignment?.p5) return []
  return p5Order
    .map(code => props.data.votingAlignment.p5.find((p: any) => p.iso3 === code))
    .filter(Boolean)
})

function pct(val: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((val / total) * 100)}%`
}

function sentimentClass(s: string) {
  if (s === 'positive') return 'bg-emerald-100 text-emerald-700'
  if (s === 'negative') return 'bg-red-100 text-red-700'
  if (s === 'mixed') return 'bg-amber-100 text-amber-700'
  return 'bg-primary-100 text-primary-600'
}

function intensityClass(i: string) {
  if (i === 'high') return 'bg-red-100 text-red-700'
  if (i === 'medium') return 'bg-amber-100 text-amber-700'
  if (i === 'low') return 'bg-emerald-100 text-emerald-700'
  return 'bg-primary-100 text-primary-600'
}

function treatyStatusClass(s: string) {
  if (s === 'party') return 'bg-emerald-100 text-emerald-700'
  if (s === 'signatory') return 'bg-blue-100 text-blue-700'
  if (s === 'withdrawn') return 'bg-red-100 text-red-700'
  return 'bg-primary-100 text-primary-500'
}

function truncate(str: string, max: number) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '...' : str
}
</script>
