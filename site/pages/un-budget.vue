<template>
  <div class="min-h-screen bg-[#f6f9fc]">
    <VizTip />
    <header class="border-b border-sky-100 bg-gradient-to-b from-[#e8f4fb] to-[#f6f9fc]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#0077b6] font-semibold">
          <span class="inline-block w-2 h-2 rounded-full bg-[#009edb]" />UN Monitor
        </div>
        <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">Budget, dues and reform</h1>
        <p class="text-primary-600 mt-3 max-w-3xl leading-relaxed">
          How the UN is funded and who pays, what the Fifth Committee (administrative and budgetary questions) is negotiating this session, and the UN80 reform drive.
          Built from the Committee's and the Committee on Contributions' official pages, with news coverage.
        </p>
        <nav class="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Sections">
          <a v-for="s in SECTIONS" :key="s.id" :href="`#${s.id}`" class="px-3 py-1.5 rounded-full bg-white ring-1 ring-sky-200 text-primary-700 hover:ring-[#009edb] hover:text-[#0077b6]">{{ s.label }}</a>
        </nav>
      </div>
    </header>

    <div v-if="!d" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-4"><div class="skeleton h-24 rounded-2xl" /><div class="skeleton h-96 rounded-2xl" /></div>
    <div v-else-if="!d.available" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-primary-500">Not collected yet.</div>
    <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <!-- key numbers -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-sky-100 rounded-2xl overflow-hidden ring-1 ring-sky-100">
        <div v-for="t in tiles" :key="t.label" class="bg-white px-5 py-4">
          <div class="font-serif text-3xl text-primary-900 tabular-nums leading-none">{{ t.value }}</div>
          <div class="text-xs text-primary-500 mt-1.5">{{ t.label }}</div>
          <div v-if="t.sub" class="text-[11px] mt-0.5 text-primary-400">{{ t.sub }}</div>
        </div>
      </div>

      <SaidPanel section="budget" />

      <!-- ===================== Fifth Committee ===================== -->
      <section id="committee" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-3xl text-primary-900">Fifth Committee, {{ ordinal(S.n) }} session</h2>
          <span class="text-[11px] text-primary-400">Main session {{ S.mainSession || '' }} · updated {{ stamp(S.updatedAt) }}</span></div>
        <div class="grid lg:grid-cols-3 gap-6">
          <div class="card lg:col-span-2 min-w-0">
            <h3 class="h3">Statements by agenda item</h3>
            <p class="sub">{{ S.statementsCount }} statements so far. Groups that have spoken: {{ S.groupsSpeaking.join(', ') || '–' }}. Each name links to the statement as delivered.</p>
            <div class="flex flex-wrap gap-1.5 mb-3">
              <button v-for="g in groupChips" :key="g" class="pill" :class="group === g ? 'pill-on' : ''" @click="group = group === g ? '' : g">{{ g }}</button>
            </div>
            <div class="space-y-4">
              <div v-for="it in shownItems" :key="it.key" class="rounded-xl ring-1 ring-sky-100 p-4">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <div class="text-sm font-medium text-primary-900">
                    <span v-if="it.items.length" class="text-[#0077b6] tabular-nums mr-1">Item {{ it.items.join(', ') }}</span>{{ it.topic || it.titles.map((t: any) => t.title).filter(Boolean).join('; ') }}
                  </div>
                  <span class="text-[11px] text-primary-400">{{ it.dates.map(day).join(', ') }}</span>
                </div>
                <div class="flex flex-wrap gap-1.5 mt-2">
                  <a v-for="s in it.statements.filter((s: any) => !group || s.group === group)" :key="s.url" :href="s.url" target="_blank" rel="noopener"
                    class="chip" :class="s.official ? 'bg-white text-primary-500' : s.group ? 'ring-[#2a78d6]/40' : ''" :title="s.onBehalfOf ? `${s.speaker} on behalf of ${s.onBehalfOf}` : s.speaker">
                    <span v-if="s.country">{{ flag(s.country.iso2) }}</span>
                    <span>{{ s.group && s.group !== 'Officials' ? `${s.group} (${s.speaker})` : s.speaker }}</span>
                    <span v-if="s.lang && s.lang !== 'en'" class="text-[10px] uppercase text-primary-400">{{ s.lang }}</span>
                  </a>
                </div>
              </div>
            </div>
            <button v-if="filteredItems.length > showItems" class="mt-3 text-xs text-[#0077b6] hover:underline" @click="showItems += 10">Show more items</button>
            <div class="flex flex-wrap gap-2 mt-4">
              <NuxtLink v-for="q in ASK" :key="q" :to="`/ask?q=${encodeURIComponent(q)}`" class="text-xs px-3 py-1.5 rounded-full ring-1 ring-sky-200 text-[#0077b6] hover:bg-[#f1f8fd]">Ask: {{ q }}</NuxtLink>
            </div>
          </div>
          <div class="space-y-6 min-w-0">
            <div class="card">
              <h3 class="h3">Agenda</h3>
              <p class="sub">{{ S.agenda.length }} items allocated to the Committee; <span class="font-medium text-primary-700">bold</span> = discussed so far</p>
              <ul class="space-y-1 max-h-80 overflow-y-auto pr-1 text-[13px]">
                <li v-for="a in S.agenda" :key="a.item" :class="a.discussed ? 'text-primary-900 font-medium' : 'text-primary-500'"><span class="tabular-nums text-primary-400 mr-1.5">{{ a.item }}</span>{{ a.title }}</li>
              </ul>
            </div>
            <div class="card">
              <h3 class="h3">Decisions</h3>
              <p class="sub">Draft resolutions and decisions acted on this session</p>
              <ul v-if="S.decisions.length" class="space-y-2.5 text-sm">
                <li v-for="r in S.decisions" :key="(r.draft || '') + r.description">
                  <div class="text-primary-900">{{ r.description }}</div>
                  <div class="text-[11px] text-primary-500">{{ r.draft }}<span v-if="r.action"> · {{ r.action }}</span><span v-if="r.resolution"> · {{ r.resolution }}</span></div>
                </li>
              </ul>
              <p v-else class="text-sm text-primary-400">None yet.</p>
              <a :href="S.sources?.resdec" target="_blank" rel="noopener" class="text-xs text-[#0077b6] hover:underline mt-2 inline-block">All decisions on the Committee's page →</a>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================== Who pays ===================== -->
      <section v-if="P" id="dues" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-3xl text-primary-900">Who pays</h2><span class="text-[11px] text-primary-400">Regular budget · Committee on Contributions · as of {{ P.asOf }}</span></div>
        <div class="grid lg:grid-cols-2 gap-6">
          <div class="card min-w-0">
            <h3 class="h3">Paying in full, month by month</h3>
            <p class="sub">Member States that had paid their regular-budget assessment in full by the end of each month</p>
            <div class="flex flex-wrap gap-3 text-xs text-primary-500 mb-2">
              <span class="flex items-center gap-1"><i class="sw" style="background:#2a78d6" />{{ P.years[0] }}</span>
              <span class="flex items-center gap-1"><i class="sw" style="background:#eb6834" />{{ P.years[1] }}</span>
              <span class="flex items-center gap-1"><i class="sw" style="background:#9aa5b1" />average of the five years before</span>
            </div>
            <svg :viewBox="`0 0 ${W} ${H}`" class="w-full h-auto" role="img" aria-label="Countries paid in full by month">
              <g v-for="y in [0, 50, 100, 150, 193]" :key="y">
                <line :x1="PADL" :x2="W - 8" :y1="yv(y)" :y2="yv(y)" stroke="#e8eef4" />
                <text :x="PADL - 6" :y="yv(y) + 3" text-anchor="end" class="fill-primary-400 text-[10px]">{{ y }}</text>
              </g>
              <text v-for="(m, i) in P.series" :key="m.month" :x="xv(i)" :y="H - 4" text-anchor="middle" class="fill-primary-400 text-[10px]">{{ m.month }}</text>
              <polyline :points="pts('avg5')" fill="none" stroke="#9aa5b1" stroke-width="2" stroke-dasharray="4 3" />
              <polyline :points="pts('lastYear')" fill="none" stroke="#eb6834" stroke-width="2" />
              <polyline :points="pts('thisYear')" fill="none" stroke="#2a78d6" stroke-width="2.5" />
              <g v-for="(m, i) in P.series" :key="'h' + i">
                <circle v-if="m.thisYear != null" :cx="xv(i)" :cy="yv(m.thisYear)" r="4" fill="#2a78d6" stroke="#fff" stroke-width="2" />
                <rect :x="xv(i) - (W - PADL) / 24" y="0" :width="(W - PADL) / 12" :height="H - 16" fill="transparent"
                  @mousemove="show($event, m.month, [{ text: `${P.years[0]}: ${m.thisYear ?? '–'}`, color: '#2a78d6' }, { text: `${P.years[1]}: ${m.lastYear ?? '–'}`, color: '#eb6834' }, { text: `5-year average: ${m.avg5 ?? '–'}`, color: '#9aa5b1' }])" @mouseleave="hide" />
              </g>
            </svg>
            <p class="text-xs text-primary-600 mt-2">{{ P.onTimeCount }} paid within the 30-day due period (by {{ P.dueDate }}). {{ P.paidCount }} of {{ P.members }} have paid in full so far.</p>
          </div>
          <div class="card min-w-0">
            <h3 class="h3">Largest contributors</h3>
            <p class="sub">Share of the regular budget, {{ P.scale.period }} scale (marker: {{ P.scale.prevPeriod }}). Filled bar = paid in full this year.</p>
            <ul class="space-y-2">
              <li v-for="r in P.rows.slice(0, 15)" :key="r.iso3" @mousemove="show($event, r.name, [{ text: `${r.pct}% (${r.prevPct}% in ${P.scale.prevPeriod})`, color: '#2a78d6' }, { text: r.paid ? `Paid in full ${day(r.paidDate)}` : 'Not paid in full', color: r.paid ? '#1baf7a' : '#e34948' }])" @mouseleave="hide">
                <div class="flex justify-between text-sm text-primary-800 gap-2">
                  <NuxtLink :to="`/countries/${r.iso3.toLowerCase()}`" class="truncate hover:text-[#0077b6]">{{ flag(r.iso2) }} {{ r.name }}</NuxtLink>
                  <span class="tabular-nums whitespace-nowrap">{{ r.pct.toFixed(2) }}% <span class="text-[11px]" :class="r.paid ? 'text-emerald-700' : 'text-red-700'">{{ r.paid ? '✓ paid' : '✗ not in full' }}</span></span>
                </div>
                <div class="relative h-2 rounded-full bg-sky-50 mt-0.5">
                  <div class="absolute inset-y-0 left-0 rounded-full" :style="{ width: `${(r.pct / maxPct) * 100}%`, background: r.paid ? '#2a78d6' : 'transparent', boxShadow: r.paid ? 'none' : 'inset 0 0 0 1.5px #2a78d6' }" />
                  <div v-if="r.prevPct" class="absolute -top-0.5 h-3 w-0.5 bg-primary-700" :style="{ left: `${(r.prevPct / maxPct) * 100}%` }" />
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="grid lg:grid-cols-3 gap-6 mt-6">
          <div class="card lg:col-span-2 min-w-0">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="h3">All Member States</h3>
              <input v-model.trim="search" type="search" placeholder="Find a country…" class="w-full sm:w-48 text-sm px-3 py-1 rounded-lg ring-1 ring-sky-200 focus:ring-[#009edb] outline-none">
            </div>
            <div class="flex flex-wrap gap-1.5 mt-3 mb-2">
              <button v-for="f in FILTERS" :key="f.id" class="pill" :class="payFilter === f.id ? 'pill-on' : ''" @click="payFilter = f.id">{{ f.label }}</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead><tr class="text-left text-[11px] uppercase tracking-wider text-primary-400 border-b border-sky-100">
                  <th class="py-2 font-medium">Country</th><th class="py-2 px-2 font-medium text-right">Share</th><th class="py-2 px-2 font-medium text-right">Change</th><th class="py-2 px-2 font-medium">Paid in full</th><th class="py-2 px-2 font-medium text-right">Amount</th>
                </tr></thead>
                <tbody>
                  <tr v-for="r in tableRows.slice(0, showRows)" :key="r.iso3" class="border-b border-sky-50">
                    <td class="py-1.5 pr-2 whitespace-nowrap"><NuxtLink :to="`/countries/${r.iso3.toLowerCase()}`" class="hover:text-[#0077b6]">{{ flag(r.iso2) }} {{ r.name }}</NuxtLink><span v-if="r.article19" class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700">Art. 19</span></td>
                    <td class="py-1.5 px-2 text-right tabular-nums">{{ r.pct.toFixed(3) }}%</td>
                    <td class="py-1.5 px-2 text-right tabular-nums text-xs" :class="(r.change || 0) > 0 ? 'text-primary-800' : 'text-primary-500'">{{ r.change == null ? '–' : (r.change > 0 ? '+' : r.change < 0 ? '−' : '') + Math.abs(r.change).toFixed(3) }}</td>
                    <td class="py-1.5 px-2 text-xs whitespace-nowrap" :class="r.paid ? 'text-emerald-700' : 'text-primary-400'">{{ r.paid ? `✓ ${day(r.paidDate)}${r.onTime ? ' · on time' : ''}` : '–' }}</td>
                    <td class="py-1.5 px-2 text-right tabular-nums text-xs">{{ r.paidUsd ? usd(r.paidUsd) : '' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button v-if="tableRows.length > showRows" class="mt-2 text-xs text-[#0077b6] hover:underline" @click="showRows = tableRows.length">Show all {{ tableRows.length }}</button>
          </div>
          <div class="space-y-6 min-w-0">
            <div class="card">
              <h3 class="h3">Not yet paid in full</h3>
              <p class="sub">{{ P.unpaidCount }} Member States, together assessed {{ P.unpaidShare.toFixed(1) }}% of the budget</p>
              <ul class="space-y-1 text-sm">
                <li v-for="r in P.unpaidLargest" :key="r.iso3" class="flex justify-between gap-2"><span class="truncate">{{ flag(r.iso2) }} {{ r.name }}</span><span class="tabular-nums text-primary-600">{{ r.pct.toFixed(2) }}%</span></li>
              </ul>
            </div>
            <div class="card">
              <h3 class="h3">Article 19</h3>
              <p class="sub">Arrears equal to two full years of dues: the country can lose its vote in the General Assembly</p>
              <div class="flex flex-wrap gap-1.5">
                <NuxtLink v-for="c in P.article19?.countries || []" :key="c.iso3" :to="`/countries/${c.iso3.toLowerCase()}`" class="chip">{{ c.country }}</NuxtLink>
              </div>
              <p v-if="P.article19?.note" class="text-xs text-primary-500 mt-2">{{ P.article19.note }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================== Reform ===================== -->
      <section id="reform" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-3xl text-primary-900">UN80 reform</h2><span class="text-[11px] text-primary-400">The Secretary-General's reform initiative</span></div>
        <div class="grid lg:grid-cols-3 gap-6">
          <div class="card min-w-0">
            <h3 class="h3">Key documents</h3>
            <ul class="space-y-2 text-sm mt-2">
              <li v-for="r in d.un80?.reports || []" :key="r.url"><a :href="r.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-[#0077b6]">{{ r.title }}</a></li>
            </ul>
            <div class="flex flex-wrap gap-3 mt-3 text-xs">
              <a :href="d.un80?.url" target="_blank" rel="noopener" class="text-[#0077b6] hover:underline">UN80 Initiative →</a>
              <a :href="d.un80?.actions" target="_blank" rel="noopener" class="text-[#0077b6] hover:underline">Actions dashboard →</a>
            </div>
          </div>
          <div class="card lg:col-span-2 min-w-0">
            <h3 class="h3">Latest on reform</h3>
            <ul class="divide-y divide-sky-50 mt-1">
              <li v-for="n in reformNews" :key="n.url" class="py-2">
                <a :href="n.url" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:text-[#0077b6] leading-snug">{{ n.title }}</a>
                <div class="text-[11px] text-primary-400">{{ n.outlet }} · {{ day(n.date) }}</div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ===================== News ===================== -->
      <section id="news" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-3xl text-primary-900">Coverage</h2><span class="text-[11px] text-primary-400">{{ d.news.total }} items</span></div>
        <div class="card">
          <div class="flex flex-wrap items-center gap-1.5 mb-3">
            <button v-for="t in TOPICS" :key="t.id" class="pill" :class="topic === t.id ? 'pill-on' : ''" @click="topic = t.id">{{ t.label }}</button>
            <label class="ml-2 text-xs text-primary-600 flex items-center gap-1"><input v-model="official" type="checkbox"> UN sources only</label>
          </div>
          <ul class="divide-y divide-sky-50">
            <li v-for="n in d.news.items.slice(0, showNews)" :key="n.url" class="py-2.5 flex gap-3">
              <span class="text-[11px] text-primary-400 w-20 shrink-0 tabular-nums pt-0.5">{{ day(n.date) }}</span>
              <div class="min-w-0">
                <a :href="n.url" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:text-[#0077b6] leading-snug">{{ n.title }}</a>
                <div class="text-[11px] text-primary-400">{{ n.outlet }}<span v-if="n.official" class="ml-1 text-[#0077b6]">· UN</span> · {{ n.topics.map((t: string) => TOPIC_LABEL[t]).join(', ') }}</div>
              </div>
            </li>
          </ul>
          <button v-if="d.news.items.length > showNews" class="mt-2 text-xs text-[#0077b6] hover:underline" @click="showNews += 20">Show more</button>
        </div>
      </section>

      <MethodNote>
        <p><strong>Fifth Committee.</strong> Agenda, statements and decisions from the Committee's pages for the {{ ordinal(S.n) }} session, checked every 4 hours. Statements are listed as delivered and posted by the Secretariat; groups are those named in the speaker line ("on behalf of …"). Their texts are read for the research desk's search; not every statement is posted, and some only in the language delivered.</p>
        <p><strong>Who pays.</strong> The Committee on Contributions' honour roll lists Member States that have paid their <em>regular-budget</em> assessment in full, with the date and amount; partial payments, peacekeeping and tribunal assessments are not shown, so "not in full" can include countries that have paid part. Shares are the scale of assessments adopted by the General Assembly ({{ P?.scale.period }}, compared with {{ P?.scale.prevPeriod }}). Monthly counts for past years come from the same page. Article 19 status is from the General Assembly's list and its exemptions.</p>
        <p><strong>Coverage.</strong> UN press releases on Fifth Committee meetings and news about UN80, the budget and the liquidity crisis, as indexed by Google News (the press site blocks automated access). Items must name the UN and a budget or reform term in the headline. Volume reflects media attention, not importance.</p>
        <p><strong>Not covered.</strong> Peacekeeping budgets by mission, voluntary funding of funds and programmes, and the Secretariat's monthly cash position, which is not published in machine-readable form.</p>
      </MethodNote>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

useHead({ title: 'UN budget, dues and reform — World Country Groups' })
const { show, hide } = useVizTip()
const SECTIONS = [{ id: 'committee', label: 'Fifth Committee' }, { id: 'dues', label: 'Who pays' }, { id: 'reform', label: 'UN80 reform' }, { id: 'news', label: 'Coverage' }]
const ASK = ['What are the main positions on the 2027 budget so far?', 'What has the G77 said in the Fifth Committee this session?', 'How serious is the UN liquidity crisis and who owes the most?']
const TOPICS = [{ id: '', label: 'All' }, { id: 'fifth', label: 'Fifth Committee' }, { id: 'budget', label: 'Budget and liquidity' }, { id: 'reform', label: 'Reform' }]
const TOPIC_LABEL: Record<string, string> = { fifth: 'Fifth Committee', budget: 'Budget', reform: 'Reform' }
const FILTERS = [{ id: 'all', label: 'All' }, { id: 'paid', label: 'Paid in full' }, { id: 'unpaid', label: 'Not in full' }, { id: 'ontime', label: 'Paid on time' }, { id: 'up', label: 'Share rising' }, { id: 'down', label: 'Share falling' }]

const topic = ref('')
const official = ref(false)
const query = computed(() => ({ topic: topic.value || undefined, official: official.value ? 1 : undefined }))
const { data: d } = useFetch<any>('/api/un/budget', { query, lazy: true, server: false })
const S = computed(() => d.value?.session)
const P = computed(() => d.value?.payers)

const group = ref('')
const showItems = ref(6)
const groupChips = computed(() => S.value?.groupsSpeaking || [])
const filteredItems = computed(() => (S.value?.discussed || []).filter((it: any) => !group.value || it.statements.some((s: any) => s.group === group.value)))
const shownItems = computed(() => filteredItems.value.slice(0, showItems.value))

const search = ref('')
const payFilter = ref('all')
const showRows = ref(25)
const tableRows = computed(() => (P.value?.rows || []).filter((r: any) => {
  if (search.value && !r.name.toLowerCase().includes(search.value.toLowerCase())) return false
  return payFilter.value === 'all' || (payFilter.value === 'paid' && r.paid) || (payFilter.value === 'unpaid' && !r.paid) || (payFilter.value === 'ontime' && r.onTime) ||
    (payFilter.value === 'up' && (r.change || 0) > 0) || (payFilter.value === 'down' && (r.change || 0) < 0)
}))
const maxPct = computed(() => Math.max(1, ...(P.value?.rows || []).slice(0, 15).map((r: any) => Math.max(r.pct, r.prevPct || 0))))
const showNews = ref(20)
const reformNews = computed(() => (d.value?.news.items || []).filter((n: any) => n.topics.includes('reform')).slice(0, 8))

const tiles = computed(() => {
  const p = P.value
  return [
    { label: 'paid their regular-budget dues in full', value: p ? `${p.paidCount}/${p.members}` : '–', sub: p ? `as of ${p.asOf}` : '' },
    { label: 'share of the budget not yet paid in full', value: p ? `${p.unpaidShare.toFixed(1)}%` : '–', sub: p ? `${p.unpaidCount} Member States` : '' },
    { label: 'under Article 19 (arrears)', value: String(p?.article19?.countries?.length ?? '–'), sub: 'can lose their Assembly vote' },
    { label: 'Fifth Committee statements this session', value: String(S.value?.statementsCount ?? '–'), sub: S.value?.mainSession ? `main session ${S.value.mainSession}` : '' },
  ]
})

// pay-pace chart
const W = 520, H = 210, PADL = 30
const xv = (i: number) => PADL + 8 + i * ((W - PADL - 24) / 11)
const yv = (v: number) => 8 + (1 - v / 193) * (H - 32)
const pts = (k: 'thisYear' | 'lastYear' | 'avg5') => (P.value?.series || []).filter((m: any) => m[k] != null).map((m: any) => `${xv(m.idx)},${yv(m[k])}`).join(' ')

const flag = (iso2: string | null) => (iso2 ? isoToFlag(iso2) : '')
const day = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '–')
const stamp = (iso: string) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const usd = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}m` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${v}`)
const ordinal = (n: number) => (n ? `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as any)[n % 10] || 'th'}` : '')
</script>

<style scoped>
.head { @apply flex flex-wrap items-end justify-between gap-2 mb-4 pb-2 border-b-2 border-[#009edb]/30; }
.card { @apply bg-white rounded-2xl ring-1 ring-sky-100 p-5; }
.h3 { @apply font-serif text-xl text-primary-900; }
.sub { @apply text-xs text-primary-500 mt-1 mb-3; }
.chip { @apply inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#f1f8fd] ring-1 ring-sky-100 text-xs text-primary-700 hover:ring-[#009edb]; }
.pill { @apply text-xs px-2.5 py-1 rounded-full ring-1 ring-sky-200 text-primary-700 hover:ring-[#009edb]; }
.pill-on { @apply bg-[#0077b6] text-white ring-[#0077b6]; }
.sw { @apply inline-block w-2.5 h-2.5 rounded-sm; }
</style>
