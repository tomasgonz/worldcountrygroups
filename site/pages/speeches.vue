<template>
  <div class="bg-primary-50/40 min-h-screen">
    <VizTip />

    <!-- ===================== Hero ===================== -->
    <section class="bg-white border-b border-primary-100">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p class="text-[11px] uppercase tracking-[0.14em] text-primary-500">UN General Assembly &middot; General Debate</p>
        <div class="flex flex-wrap items-end justify-between gap-4 mt-2">
          <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 leading-[1.05]">
            UNGA {{ selectedSession ?? '' }} <span class="text-primary-400">({{ sessionYear }})</span>: what the world said
          </h1>
          <label class="flex items-center gap-2 text-sm text-primary-500">
            Session
            <select v-model.number="selectedSession" class="text-sm border border-primary-200 rounded-lg px-3 py-1.5 bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent-300">
              <option v-for="s in reversedSessions" :key="s" :value="s">{{ s }} ({{ 1945 + s }})</option>
            </select>
          </label>
        </div>
        <p v-if="ins" class="text-primary-500 mt-3 max-w-3xl leading-relaxed">
          {{ ins.overview.speeches }} statements<template v-if="ins.overview.dates">, delivered {{ fmtDate(ins.overview.dates.first) }}&ndash;{{ fmtDate(ins.overview.dates.last) }}</template>,
          analysed one by one with AI and compared with session {{ ins.prevSession ?? '—' }}<template v-if="ins.prevSession"> ({{ 1945 + ins.prevSession }})</template>.
        </p>
        <p v-if="ins && ins.prevSession && !ins.models.comparable" class="mt-2 text-xs text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2 max-w-3xl">
          The two sessions were analysed with different AI models ({{ ins.models.current.join(', ') }} vs {{ ins.models.previous.join(', ') }}), so small year-on-year changes may reflect the model rather than the speeches.
        </p>
      </div>
    </section>

    <div v-if="insPending && !ins" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-4">
      <div class="skeleton h-24 rounded-2xl" /><div class="skeleton h-80 rounded-2xl" />
    </div>

    <div v-else-if="ins" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <!-- ===================== Headline numbers ===================== -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-primary-200/70 rounded-2xl overflow-hidden ring-1 ring-primary-200/70">
        <div v-for="t in tiles" :key="t.label" class="bg-white px-5 py-4">
          <div class="font-serif text-3xl text-primary-900 tabular-nums leading-none">{{ t.value }}</div>
          <div class="text-xs text-primary-500 mt-1.5">{{ t.label }}</div>
          <div v-if="t.delta" class="text-[11px] mt-0.5 text-primary-400">{{ t.delta }}</div>
        </div>
      </div>

      <!-- ===================== In brief ===================== -->
      <section v-if="findings.length" class="card">
        <h2 class="h2">In brief</h2>
        <ul class="mt-3 grid md:grid-cols-2 gap-x-8 gap-y-2.5">
          <li v-for="(f, i) in findings" :key="i" class="flex gap-2.5 text-[15px] leading-6 text-primary-700">
            <span class="mt-2 w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0" />
            <span v-html="f" />
          </li>
        </ul>
      </section>

      <!-- ===================== Themes ===================== -->
      <section class="grid lg:grid-cols-5 gap-8">
        <div class="card lg:col-span-3">
          <h2 class="h2">What the debate was about</h2>
          <p class="sub">Share of speeches where each theme was a high or medium priority</p>
          <VizDumbbell :rows="themeRows" :max="100" :current-label="`${ins.year}`" :prev-label="`${ins.year - 1}`" />
        </div>
        <div class="card lg:col-span-2">
          <h2 class="h2">Rising and falling</h2>
          <p class="sub">Change since {{ ins.year - 1 }}, in percentage points</p>
          <VizDiverging v-if="moverRows.length" :rows="moverRows" label-width="9rem" />
          <p v-else class="text-sm text-primary-400">No previous session to compare with.</p>
        </div>
      </section>

      <!-- ===================== Who talked about whom ===================== -->
      <section class="grid lg:grid-cols-5 gap-8">
        <div class="card lg:col-span-3">
          <h2 class="h2">Who talked about whom</h2>
          <p class="sub">Countries named in the most speeches, by how speakers framed them</p>
          <VizStackedBars :rows="mentionRows" :series="MENTION_SERIES" label-width="9.5rem" value-width="2.5rem" unit-label=" speeches" />
        </div>
        <div class="card lg:col-span-2">
          <h2 class="h2">Crises in focus</h2>
          <p class="sub">Share of speeches that addressed each conflict</p>
          <VizDumbbell :rows="conflictRows" :current-label="`${ins.year}`" :prev-label="`${ins.year - 1}`" label-width="9rem" />
        </div>
      </section>

      <!-- ===================== Tone & speakers ===================== -->
      <section class="grid lg:grid-cols-2 gap-8">
        <div class="card">
          <h2 class="h2">Tone by region</h2>
          <p class="sub">AI-assessed overall tone of each speech</p>
          <VizStackedBars :rows="toneRows" :series="TONE_SERIES" normalize label-width="11rem" value-width="2.5rem" unit-label=" speeches" />
        </div>
        <div class="card">
          <h2 class="h2">Who took the podium</h2>
          <p class="sub">Level of the person delivering each statement</p>
          <VizDumbbell :rows="levelRows" unit="" current-label="Speeches" label-width="11rem" />
        </div>
      </section>

      <!-- ===================== Regional priorities ===================== -->
      <section class="card">
        <h2 class="h2">Regional priorities</h2>
        <p class="sub">Share of each UN regional group's speeches giving the theme high or medium priority</p>
        <VizHeatmap :rows="regionRows" :columns="regionThemeCols" :values="regionValues" tip-note="of the region's speeches" />
      </section>

      <!-- ===================== Quotes ===================== -->
      <section>
        <h2 class="h2 mb-1">In their words</h2>
        <p class="sub">From the countries other speakers mentioned most</p>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink v-for="q in ins.quotes" :key="q.iso3" :to="`/countries/${q.iso3.toLowerCase()}/speeches`"
            class="group flex flex-col justify-between bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 hover:ring-accent-300 transition">
            <blockquote class="font-serif text-lg leading-snug text-primary-800">&ldquo;{{ q.quote }}&rdquo;</blockquote>
            <div class="mt-3 text-xs text-primary-500">
              <span class="mr-1">{{ q.iso2 ? isoToFlag(q.iso2) : '' }}</span>
              <span class="font-medium text-primary-700 group-hover:text-accent-700">{{ q.name }}</span><span v-if="q.speaker"> &middot; {{ q.speaker }}</span>
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- ===================== Explorer (table view) ===================== -->
      <section class="card !p-0 overflow-hidden">
        <div class="px-6 pt-6 pb-4 border-b border-primary-100">
          <h2 class="h2">Every speech</h2>
          <p class="sub !mb-3">Filter and sort all {{ ins.speeches.length }} statements; select a row for its summary</p>
          <div class="flex flex-wrap gap-2">
            <input v-model="q" type="search" placeholder="Country or speaker" class="text-sm border border-primary-200 rounded-lg px-3 py-1.5 w-48" />
            <select v-model="fTheme" class="text-sm border border-primary-200 rounded-lg px-2 py-1.5">
              <option value="">Any theme</option>
              <option v-for="t in ins.themes.slice(0, 20)" :key="t.theme" :value="t.theme">{{ themeLabel(t.theme) }}</option>
            </select>
            <select v-model="fTone" class="text-sm border border-primary-200 rounded-lg px-2 py-1.5">
              <option value="">Any tone</option><option value="positive">Positive</option><option value="mixed">Mixed</option><option value="negative">Negative</option>
            </select>
            <select v-model="fLevel" class="text-sm border border-primary-200 rounded-lg px-2 py-1.5">
              <option value="">Any speaker level</option>
              <option v-for="l in ins.overview.speakerLevels" :key="l.level" :value="l.level">{{ l.level }}</option>
            </select>
            <span class="text-xs text-primary-400 self-center ml-auto">{{ tableRows.length }} shown</span>
          </div>
        </div>
        <div class="overflow-x-auto max-h-[36rem]">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-white z-10 text-[11px] uppercase tracking-wider text-primary-400">
              <tr class="border-b border-primary-100">
                <th v-for="c in COLS" :key="c.key" class="text-left font-medium px-4 py-2.5" :class="c.cls">
                  <button v-if="c.sort" class="uppercase tracking-wider hover:text-primary-700" @click="toggleSort(c.key)">{{ c.label }}<span v-if="sortKey === c.key">{{ sortDir > 0 ? ' ↑' : ' ↓' }}</span></button>
                  <span v-else>{{ c.label }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="s in tableRows" :key="s.iso3">
                <tr class="border-b border-primary-50 hover:bg-primary-50/60 cursor-pointer" @click="open = open === s.iso3 ? null : s.iso3">
                  <td class="px-4 py-2.5 whitespace-nowrap"><span class="mr-1.5">{{ s.iso2 ? isoToFlag(s.iso2) : '' }}</span><span class="text-primary-900">{{ s.name }}</span></td>
                  <td class="px-4 py-2.5 text-primary-600 hidden md:table-cell">{{ s.speaker }}<div class="text-[11px] text-primary-400">{{ s.title }}</div></td>
                  <td class="px-4 py-2.5">
                    <span class="inline-flex items-center gap-1.5 text-xs text-primary-700"><span class="w-2 h-2 rounded-full" :style="{ background: toneColor(s.tone) }" />{{ s.tone }}</span>
                  </td>
                  <td class="px-4 py-2.5 hidden lg:table-cell">
                    <span v-for="t in s.themes.slice(0, 2)" :key="t" class="inline-block mr-1 mb-0.5 text-[11px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-600 whitespace-nowrap">{{ themeLabel(t) }}</span>
                  </td>
                  <td class="px-4 py-2.5 text-right tabular-nums text-primary-600">{{ s.words?.toLocaleString() }}</td>
                  <td class="px-4 py-2.5 text-right tabular-nums text-primary-500 whitespace-nowrap hidden sm:table-cell">{{ s.date ? fmtDate(s.date) : '' }}</td>
                </tr>
                <tr v-if="open === s.iso3" class="bg-primary-50/60">
                  <td colspan="6" class="px-4 py-3 text-[13px] leading-6 text-primary-700">
                    {{ s.summary }}
                    <NuxtLink :to="`/countries/${s.iso3.toLowerCase()}/speeches`" class="ml-1 text-accent-600 hover:text-accent-700">Full speech and analysis &rarr;</NuxtLink>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ===================== Groups ===================== -->
      <section v-if="groupHeat" class="card">
        <h2 class="h2">Priorities by negotiating group</h2>
        <p class="sub">Share of each group's members rating the theme as high relevance</p>
        <VizHeatmap :rows="groupHeat.rows" :columns="groupHeat.columns" :values="groupHeat.values" tip-note="of members, high relevance" />
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
          <div v-for="g in priorities.groups" :key="g.gid + '-topics'" class="rounded-xl ring-1 ring-primary-100 p-4">
            <NuxtLink :to="`/groups/${g.gid}`" class="text-sm font-medium text-primary-900 hover:text-accent-700">{{ g.name }}</NuxtLink>
            <div class="flex flex-wrap gap-1 mt-2">
              <span v-for="topic in g.emergingTopics" :key="topic" class="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 ring-1 ring-primary-100">{{ topic }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================== Long-term ===================== -->
      <section class="card">
        <h2 class="h2">Tone over the decades</h2>
        <p class="sub">Number of positive and negative speeches per session for selected groups and countries</p>
        <div class="flex flex-wrap gap-2 items-center mb-5">
          <span v-for="sel in selectedBlocs" :key="sel" class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary-100 text-primary-700">
            {{ blocLabel(sel) }}
            <button class="ml-0.5 hover:text-red-600" :aria-label="`Remove ${blocLabel(sel)}`" @click="removeBloc(sel)">&times;</button>
          </span>
          <div ref="dropdownRef" class="relative">
            <button class="text-xs px-3 py-1 rounded-full border border-dashed border-primary-300 text-primary-500 hover:border-primary-500" @click="showBlocDropdown = !showBlocDropdown">+ Add</button>
            <div v-if="showBlocDropdown" class="absolute z-20 top-8 left-0 w-64 bg-white border border-primary-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
              <input v-model="blocSearchQuery" type="text" placeholder="Search groups or countries…" class="w-full text-xs px-3 py-2 border-b border-primary-100 focus:outline-none" @keydown.stop>
              <button v-for="opt in filteredBlocOptions" :key="opt.id" class="w-full text-left text-xs px-3 py-1.5 hover:bg-primary-50 flex justify-between" @click="addBloc(opt.id)">
                <span>{{ opt.label }}</span><span class="text-[10px] text-primary-400">{{ opt.type }}</span>
              </button>
            </div>
          </div>
        </div>
        <div v-if="comparisonData?.groups?.length" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div v-for="g in comparisonData.groups" :key="g.gid" class="rounded-xl ring-1 ring-primary-100 p-4">
            <div class="text-sm font-medium text-primary-900 mb-1">{{ g.name }}</div>
            <ChartsChartLine :data="groupComparisonLine(g.sentimentTimeline)" :series-names="['Positive', 'Negative']" :colors="['#2a78d6', '#e34948']" :legend="true" :height="140" :y-min="0" />
          </div>
        </div>
        <div v-else-if="comparisonPending" class="grid sm:grid-cols-3 gap-5"><div v-for="i in 3" :key="i" class="skeleton h-44 rounded-xl" /></div>

        <div v-if="decadeHeat" class="mt-10">
          <h3 class="font-serif text-2xl text-primary-900">Themes by decade</h3>
          <p class="sub">Share of all General Debate speeches in each decade giving the theme high or medium priority</p>
          <VizHeatmap :rows="decadeHeat.rows" :columns="decadeHeat.columns" :values="decadeHeat.values" tip-note="of that decade's speeches" />
        </div>
      </section>

      <p class="text-[11px] text-primary-400 pb-6">
        Themes, tone, mentions and conflicts come from an AI reading of each speech ({{ ins.models.current.join(', ') }}). Treat them as a structured index for finding speeches, and check the text before quoting.
        Speech texts: UN General Debate website (official statements and UN transcripts).
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSpeechSessions, useSpeechGroupPriorities, useSpeechGroupComparison, useGroups, useCountries, isoToFlag } from '~/composables/useGroups'

const sessionsData = useSpeechSessions()
const selectedSession = ref<number | undefined>(undefined)
watch(sessionsData.latestSession, (v) => { if (v != null && selectedSession.value === undefined) selectedSession.value = v }, { immediate: true })
const reversedSessions = computed(() => [...(sessionsData.sessions.value || [])].reverse())
const sessionYear = computed(() => (selectedSession.value == null ? '' : 1945 + selectedSession.value))

const { data: insRaw, pending: insPending } = useFetch(() => `/api/speeches/insights${selectedSession.value ? `?session=${selectedSession.value}` : ''}`, { watch: [selectedSession] })
const ins = computed(() => insRaw.value as any)

// ---------- labels & colours ----------
const THEME_LABELS: Record<string, string> = {
  peace_security: 'Peace & security', reform_un: 'UN reform', climate_change: 'Climate change', human_rights: 'Human rights',
  sustainable_development: 'Sustainable development', economic_growth: 'Economic growth', conflict_resolution: 'Conflict resolution',
  nuclear_disarmament: 'Nuclear disarmament', rule_of_law: 'Rule of law', gender_equality: 'Gender equality', food_security: 'Food security',
  cyber_security: 'Cyber security', self_determination: 'Self-determination', indigenous_rights: 'Indigenous rights',
}
const themeLabel = (t: string) => THEME_LABELS[t] || t.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

const BLUE = '#2a78d6', AMBER = '#eda100', RED = '#e34948', GRAY = '#e2e1dc'
const MENTION_SERIES = [
  { key: 'partner', label: 'Partner / support', color: BLUE },
  { key: 'concern', label: 'Concern', color: AMBER },
  { key: 'criticism', label: 'Criticism', color: RED },
  { key: 'neutral', label: 'Neutral', color: GRAY, ring: true },
]
const TONE_SERIES = [
  { key: 'positive', label: 'Positive', color: BLUE },
  { key: 'mixed', label: 'Mixed', color: GRAY, ring: true },
  { key: 'negative', label: 'Negative or critical', color: RED },
]
const toneColor = (t: string) => (t === 'positive' ? BLUE : t === 'negative' ? RED : '#94a3b8')

const fmtDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const signed = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}`

// ---------- tiles & findings ----------
const tiles = computed(() => {
  const o = ins.value?.overview
  if (!o) return []
  const pos = (t: any, n: number) => (n ? Math.round((t.positive / n) * 100) : 0)
  return [
    { label: 'Statements', value: o.speeches, delta: o.prevSpeeches ? `${o.prevSpeeches} in ${ins.value.year - 1}` : '' },
    { label: 'Delivered by a head of state or government', value: `${Math.round(o.leaderShare)}%`, delta: o.prevLeaderShare != null ? `${signed(o.leaderShare - o.prevLeaderShare)} pts vs ${ins.value.year - 1}` : '' },
    { label: 'Median length (words)', value: o.medianWords.toLocaleString(), delta: o.prevMedianWords ? `${signed(((o.medianWords - o.prevMedianWords) / o.prevMedianWords) * 100)}% vs ${ins.value.year - 1}` : '' },
    { label: 'Positive in tone', value: `${pos(o.tone, o.speeches)}%`, delta: o.prevSpeeches ? `${signed(pos(o.tone, o.speeches) - pos(o.prevTone, o.prevSpeeches))} pts vs ${ins.value.year - 1}` : '' },
  ]
})

const findings = computed(() => {
  const d = ins.value
  if (!d) return []
  const out: string[] = []
  const b = (s: string) => `<strong class="text-primary-900 font-medium">${s}</strong>`
  const top = d.themes[0]
  if (top) out.push(`${b(themeLabel(top.theme))} was the most common priority, raised in ${Math.round(top.share)}% of speeches.`)
  const up = d.movers.find((m: any) => m.delta > 0)
  if (up && d.prevSession) out.push(`${b(themeLabel(up.theme))} rose the most: ${Math.round(up.prevShare)}% of speeches in ${d.year - 1}, ${Math.round(up.share)}% in ${d.year}.`)
  const down = [...d.movers].reverse().find((m: any) => m.delta < 0)
  if (down && d.prevSession) out.push(`${b(themeLabel(down.theme))} fell the most, from ${Math.round(down.prevShare)}% to ${Math.round(down.share)}% of speeches.`)
  const m = d.mentioned[0]
  if (m) out.push(`${b(m.name)} was named in ${m.total} speeches, more than any other country.`)
  const crit = [...d.mentioned].sort((a: any, b2: any) => b2.criticism - a.criticism)[0]
  if (crit?.criticism) out.push(`${b(crit.name)} drew the most criticism, in ${crit.criticism} speeches.`)
  const c = d.conflicts[0]
  if (c) out.push(`${b(c.name)} was the most-discussed crisis (${Math.round(c.share)}% of speeches${c.prevShare != null ? `, down from ${Math.round(c.prevShare)}%`.replace('down from', c.share >= c.prevShare ? 'up from' : 'down from') : ''}).`)
  const riser = [...d.mentioned].filter((x: any) => x.prevTotal).sort((a: any, b2: any) => (b2.total - b2.prevTotal) - (a.total - a.prevTotal))[0]
  if (riser && riser.total - riser.prevTotal >= 5) out.push(`${b(riser.name)} was mentioned in ${riser.total - riser.prevTotal} more speeches than in ${d.year - 1}.`)
  return out
})

// ---------- chart rows ----------
const themeRows = computed(() => (ins.value?.themes || []).slice(0, 14).map((t: any) => ({
  key: t.theme, label: themeLabel(t.theme), value: t.share, prev: t.prevShare,
  detail: [`High priority in ${Math.round(t.highShare)}% of speeches`],
})))
const moverRows = computed(() => (ins.value?.movers || []).map((t: any) => ({
  key: t.theme, label: themeLabel(t.theme), value: t.delta,
  detail: [`${Math.round(t.prevShare)}% → ${Math.round(t.share)}% of speeches`],
})))
const mentionRows = computed(() => (ins.value?.mentioned || []).slice(0, 14).map((m: any) => ({
  key: m.iso3, label: m.name, prefix: m.iso2 ? isoToFlag(m.iso2) : '',
  values: { partner: m.partner, concern: m.concern, criticism: m.criticism, neutral: m.neutral }, valueLabel: String(m.total),
  detail: [`Named in ${m.total} speeches${m.prevTotal ? ` (${m.prevTotal} in ${ins.value.year - 1})` : ''}`],
})))
const conflictRows = computed(() => (ins.value?.conflicts || []).slice(0, 10).map((c: any) => ({
  key: c.name, label: c.name, value: c.share, prev: c.prevShare, detail: [`${c.count} speeches`],
})))
const toneRows = computed(() => (ins.value?.regions || []).map((r: any) => ({
  key: r.gid, label: r.label, values: { positive: r.tone.positive, mixed: r.tone.mixed + r.tone.neutral, negative: r.tone.negative },
  valueLabel: String(r.speeches),
})))
const regionRows = computed(() => (ins.value?.regions || []).map((r: any) => ({ key: r.gid, label: r.label })))
const regionThemeCols = computed(() => (ins.value?.regionThemes || []).map((t: string) => ({ key: t, label: themeLabel(t) })))
const regionValues = computed(() => Object.fromEntries((ins.value?.regions || []).map((r: any) => [r.gid, r.themes])))
const levelRows = computed(() => (ins.value?.overview?.speakerLevels || []).map((l: any) => ({ key: l.level, label: l.level, value: l.count })))

// ---------- explorer ----------
const q = ref(''), fTheme = ref(''), fTone = ref(''), fLevel = ref('')
const sortKey = ref('name'), sortDir = ref(1), open = ref<string | null>(null)
const COLS = [
  { key: 'name', label: 'Country', sort: true, cls: '' },
  { key: 'speaker', label: 'Speaker', sort: true, cls: 'hidden md:table-cell' },
  { key: 'tone', label: 'Tone', sort: true, cls: '' },
  { key: 'themes', label: 'Top themes', sort: false, cls: 'hidden lg:table-cell' },
  { key: 'words', label: 'Words', sort: true, cls: 'text-right' },
  { key: 'date', label: 'Date', sort: true, cls: 'text-right hidden sm:table-cell' },
]
function toggleSort(k: string) { if (sortKey.value === k) sortDir.value *= -1; else { sortKey.value = k; sortDir.value = k === 'words' ? -1 : 1 } }
const tableRows = computed(() => {
  const term = q.value.trim().toLowerCase()
  return (ins.value?.speeches || [])
    .filter((s: any) => !term || s.name.toLowerCase().includes(term) || (s.speaker || '').toLowerCase().includes(term))
    .filter((s: any) => !fTheme.value || s.themes.includes(fTheme.value))
    .filter((s: any) => !fTone.value || s.tone === fTone.value)
    .filter((s: any) => !fLevel.value || s.level === fLevel.value)
    .slice()
    .sort((a: any, b: any) => {
      const x = a[sortKey.value] ?? '', y = b[sortKey.value] ?? ''
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * sortDir.value
    })
})

// ---------- negotiating groups ----------
const { priorities: prioritiesRaw } = useSpeechGroupPriorities(computed(() => selectedSession.value))
const priorities = computed(() => prioritiesRaw.value as any)
const groupHeat = computed(() => {
  const p = priorities.value
  if (!p?.groups?.length) return null
  return {
    rows: p.groups.map((g: any) => ({ key: g.gid, label: g.name, sub: `${g.speechCount}` })),
    columns: p.themes.map((t: string) => ({ key: t, label: p.themeLabels?.[t] || themeLabel(t) })),
    values: Object.fromEntries(p.groups.map((g: any) => [g.gid, g.priorities])),
  }
})

// ---------- long-term ----------
const DEFAULT_BLOCS = ['lldcs', 'g77', 'developing-ex-lldcs', 'eu', 'USA', 'canz']
const selectedBlocs = ref<string[]>([...DEFAULT_BLOCS])
const showBlocDropdown = ref(false)
const blocSearchQuery = ref('')
const dropdownRef = ref<HTMLElement | null>(null)
const { groups: allGroups } = useGroups()
const { countries: allCountries } = useCountries()
const blocOptions = computed(() => [
  ...((allGroups.value as any[]) || []).map(g => ({ id: g.gid, label: `${g.acronym || g.gid} — ${g.name}`, type: 'group' })),
  ...((allCountries.value as any[]) || []).map(c => ({ id: c.iso3, label: c.name, type: 'country' })),
])
const filteredBlocOptions = computed(() => {
  const sel = new Set(selectedBlocs.value.map(s => s.toLowerCase()))
  const term = blocSearchQuery.value.toLowerCase()
  return blocOptions.value.filter(o => !sel.has(o.id.toLowerCase()) && (!term || o.label.toLowerCase().includes(term))).slice(0, 20)
})
function blocLabel(id: string) {
  const o = blocOptions.value.find(x => x.id.toLowerCase() === id.toLowerCase())
  return o ? (o.type === 'group' ? o.label.split(' — ')[0] : o.label) : id
}
function addBloc(id: string) { if (!selectedBlocs.value.includes(id)) selectedBlocs.value = [...selectedBlocs.value, id]; showBlocDropdown.value = false; blocSearchQuery.value = '' }
function removeBloc(id: string) { selectedBlocs.value = selectedBlocs.value.filter(s => s !== id) }
function onDocClick(e: MouseEvent) { if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) showBlocDropdown.value = false }
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

const { comparison: comparisonRaw, pending: comparisonPending } = useSpeechGroupComparison(selectedBlocs)
const comparisonData = computed(() => comparisonRaw.value as any)
const groupComparisonLine = (timeline: any[]) => timeline.map((s: any) => ({ x: s.year, values: [s.positive, s.negative], label: `Session ${s.session} (${s.year})` }))
const decadeHeat = computed(() => {
  const d = ins.value?.decades
  if (!d?.themes?.length) return null
  return {
    rows: d.themes.map((t: string) => ({ key: t, label: themeLabel(t) })),
    columns: d.columns,
    values: d.values,
  }
})

useHead({ title: computed(() => `UNGA ${selectedSession.value ?? ''} — what the world said`) })
</script>

<style scoped>
.card {
  @apply bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 sm:p-7;
}
.h2 {
  @apply font-serif text-2xl sm:text-[1.7rem] text-primary-900 leading-tight;
}
.sub {
  @apply text-xs text-primary-500 mt-1 mb-5;
}
</style>
