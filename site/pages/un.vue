<template>
  <div class="un min-h-screen bg-[#f6f9fc]">
    <VizTip />

    <!-- ===================== Header ===================== -->
    <header class="border-b border-sky-100 bg-gradient-to-b from-[#e8f4fb] to-[#f6f9fc]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#0077b6] font-semibold">
          <span class="inline-block w-2 h-2 rounded-full bg-[#009edb]" />UN Monitor
        </div>
        <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">The UN system, tracked</h1>
        <p class="text-primary-600 mt-3 max-w-3xl leading-relaxed">
          A standing view of what the UN's main bodies are doing: the Security Council, the General Assembly, the Secretariat, and the human rights and humanitarian system.
          Built from official records. For today's news and analysis, see <NuxtLink to="/today" class="text-[#0077b6] underline">Today</NuxtLink>.
        </p>
        <nav class="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Sections">
          <a v-for="s in SECTIONS" :key="s.id" :href="`#${s.id}`" class="px-3 py-1.5 rounded-full bg-white ring-1 ring-sky-200 text-primary-700 hover:ring-[#009edb] hover:text-[#0077b6]">{{ s.label }}</a>
        </nav>
      </div>
    </header>

    <div v-if="pending && !d" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-4">
      <div class="skeleton h-24 rounded-2xl" /><div class="skeleton h-96 rounded-2xl" />
    </div>

    <div v-else-if="d" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <!-- ===================== Key numbers ===================== -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-px bg-sky-100 rounded-2xl overflow-hidden ring-1 ring-sky-100">
        <div v-for="t in tiles" :key="t.label" class="bg-white px-5 py-4">
          <div class="font-serif text-3xl text-primary-900 tabular-nums leading-none">{{ t.value }}</div>
          <div class="text-xs text-primary-500 mt-1.5">{{ t.label }}</div>
          <div v-if="t.sub" class="text-[11px] mt-0.5" :class="t.subClass || 'text-primary-400'">{{ t.sub }}</div>
        </div>
      </div>

      <!-- ===================== Security Council ===================== -->
      <section id="council" class="scroll-mt-24">
        <SectionHead title="Security Council" :updated="d.freshness.council" note="Official record, Dag Hammarskjöld Library" />
        <div class="grid lg:grid-cols-3 gap-6">
          <!-- composition -->
          <div class="card space-y-5">
            <div v-if="d.council.president" class="rounded-xl bg-[#e8f4fb] p-4">
              <div class="text-[11px] uppercase tracking-wider text-[#0077b6] font-semibold">Presidency · {{ monthLabel(d.council.president.month) }}</div>
              <div class="mt-1 text-xl font-serif text-primary-900"><span class="mr-1.5">{{ flag(d.council.president.iso2) }}</span>{{ d.council.president.name }}</div>
              <div v-if="d.council.nextPresident" class="text-xs text-primary-500 mt-1">Next: {{ flag(d.council.nextPresident.iso2) }} {{ d.council.nextPresident.name }} ({{ monthLabel(d.council.nextPresident.month) }})</div>
            </div>
            <div>
              <div class="lbl">Permanent members</div>
              <div class="flex flex-wrap gap-1.5">
                <NuxtLink v-for="c in d.council.permanent" :key="c.iso3" :to="`/countries/${c.iso3.toLowerCase()}`" class="chip">{{ flag(c.iso2) }} {{ c.name }}</NuxtLink>
              </div>
            </div>
            <div>
              <div class="lbl">Elected members <span class="normal-case tracking-normal font-normal text-primary-400">(term ends)</span></div>
              <div class="grid grid-cols-2 gap-1.5">
                <NuxtLink v-for="c in d.council.elected" :key="c.iso3" :to="`/countries/${c.iso3.toLowerCase()}`" class="chip justify-between">
                  <span class="truncate">{{ flag(c.iso2) }} {{ c.name }}</span><span class="text-[10px] text-primary-400 tabular-nums">{{ c.termEnd }}</span>
                </NuxtLink>
              </div>
            </div>
            <div v-if="d.council.incoming.length">
              <div class="lbl">Joining on 1 January {{ d.council.incoming[0].termStart }}</div>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="c in d.council.incoming" :key="c.iso3" class="chip !bg-white ring-1 ring-dashed ring-sky-200">{{ flag(c.iso2) }} {{ c.name }}</span>
              </div>
              <p class="text-[10px] text-primary-400 mt-1">From the published presidency rota; members without a presidency next year are not listed.</p>
            </div>
          </div>

          <!-- decisions -->
          <div class="card lg:col-span-2">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="h3">Latest decisions</h3>
              <div class="flex items-center gap-3 text-[11px] text-primary-500">
                <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-[#2a78d6]" />In favour</span>
                <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-[#e34948]" />Against</span>
                <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-[#d6d4cf]" />Abstained</span>
              </div>
            </div>
            <ul class="mt-3 divide-y divide-primary-100">
              <li v-for="r in d.council.decisions" :key="r.id" class="py-2.5 grid grid-cols-[4.5rem_1fr_9rem] items-center gap-3">
                <span class="text-xs text-primary-400 tabular-nums">{{ shortDate(r.date) }}</span>
                <div class="min-w-0">
                  <div class="text-sm text-primary-800 truncate" :title="r.title">{{ r.title }}</div>
                  <div class="text-[11px] mt-0.5 flex items-center gap-2">
                    <span class="badge" :class="r.adopted ? 'badge-ok' : r.vetoed ? 'badge-bad' : 'badge-warn'">{{ r.adopted ? 'Adopted' : r.vetoed ? 'Vetoed' : 'Not adopted' }}</span>
                    <a :href="r.press_release || `https://docs.un.org/${r.id}`" target="_blank" rel="noopener" class="text-primary-400 hover:text-[#0077b6] font-mono">{{ r.id }}</a>
                  </div>
                </div>
                <VoteBar :tally="r.tally" :total="15" :label="r.id" />
              </li>
            </ul>
          </div>
        </div>

        <div class="grid lg:grid-cols-3 gap-6 mt-6">
          <div class="card">
            <h3 class="h3">Where the Council's attention went</h3>
            <p class="sub">Meetings by agenda item, last 30 days</p>
            <VizDumbbell :rows="focusRows" unit="" current-label="Meetings" label-width="12rem" color="#009edb" />
          </div>
          <div class="card">
            <h3 class="h3">Recent vetoes</h3>
            <p class="sub">Drafts blocked by a permanent member since {{ new Date().getFullYear() - 2 }}</p>
            <ul class="space-y-3">
              <li v-for="v in d.council.vetoes" :key="v.date + v.draft" class="text-sm">
                <div class="flex items-center gap-2"><span class="text-xs text-primary-400 tabular-nums">{{ shortDate(v.date, true) }}</span>
                  <span class="text-primary-800">{{ v.subject }}</span></div>
                <div class="text-xs text-red-700 mt-0.5">Vetoed by {{ v.by.map((c: any) => `${flag(c.iso2)} ${c.name}`).join(' and ') }}</div>
              </li>
            </ul>
          </div>
          <div class="card">
            <h3 class="h3">Meetings</h3>
            <p class="sub">Most recent Council meetings</p>
            <ol class="relative border-l border-sky-200 ml-1.5 space-y-3">
              <li v-for="m in d.council.meetings.slice(0, 8)" :key="m.meeting" class="pl-4">
                <span class="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full" :class="m.outcome ? 'bg-[#009edb]' : 'bg-sky-200'" />
                <div class="text-[11px] text-primary-400">{{ shortDate(m.date) }} · <a :href="m.record" target="_blank" rel="noopener" class="hover:text-[#0077b6]">{{ m.meeting }}</a></div>
                <div class="text-sm text-primary-800 leading-snug">{{ m.topic }}</div>
                <div v-if="m.outcome" class="text-[11px] text-[#0077b6]">{{ m.outcome }}</div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <!-- ===================== AI analysis ===================== -->
      <section id="analysis" class="scroll-mt-24">
        <SectionHead title="Council analysis" note="AI reading of the official record, refreshed every few hours" />
        <div class="card">
          <div v-if="aiPending" class="space-y-2"><div v-for="i in 4" :key="i" class="skeleton h-4 rounded" /></div>
          <template v-else-if="aiHtml">
            <VizHighlightLegend class="mb-4" />
            <div class="brief prose max-w-none" v-html="aiHtml" />
            <p class="text-[11px] text-primary-400 mt-4">Written by {{ ai?.model }} {{ ai?.generatedAt ? `· ${timeAgo(ai.generatedAt)}` : '' }}. Check the decisions above before relying on it.</p>
          </template>
          <p v-else class="text-sm text-primary-500">The analysis is unavailable right now. Everything else on this page comes straight from the official record.</p>
        </div>
      </section>

      <!-- ===================== General Assembly ===================== -->
      <section id="assembly" class="scroll-mt-24">
        <SectionHead :title="`General Assembly · ${ordinal(d.generalAssembly.currentSession)} session`" :updated="d.freshness.generalAssembly" note="Resolutions and votes, Dag Hammarskjöld Library" />
        <div class="grid lg:grid-cols-3 gap-6">
          <div class="card">
            <NuxtLink v-if="d.generalAssembly.president" :to="`/people/${d.generalAssembly.president.slug}`" class="block rounded-xl bg-[#e8f4fb] p-4 mb-5 hover:bg-[#dcefFa]">
              <div class="text-[11px] uppercase tracking-wider text-[#0077b6] font-semibold">President of the {{ ordinal(d.generalAssembly.currentSession) }} session</div>
              <div class="mt-1 text-xl font-serif text-primary-900">{{ d.generalAssembly.president.name }}</div>
              <div v-if="d.generalAssembly.president.home" class="text-xs text-primary-500 mt-0.5">{{ flag(d.generalAssembly.president.home.iso2) }} {{ d.generalAssembly.president.home.name }}</div>
            </NuxtLink>
            <h3 class="h3">Session {{ d.generalAssembly.statsSession }} in numbers</h3>
            <p v-if="d.generalAssembly.statsSession !== d.generalAssembly.currentSession" class="sub">The {{ ordinal(d.generalAssembly.currentSession) }} session has just opened, so figures are for the previous session</p>
            <p v-else class="sub">Resolutions adopted so far</p>
            <div class="grid grid-cols-2 gap-4 mt-2">
              <div><div class="num">{{ d.generalAssembly.stats.resolutions }}</div><div class="cap">resolutions</div></div>
              <div><div class="num">{{ pct(d.generalAssembly.stats.withoutVote, d.generalAssembly.stats.resolutions) }}%</div><div class="cap">adopted without a vote</div></div>
              <div><div class="num">{{ d.generalAssembly.stats.recorded }}</div><div class="cap">recorded votes</div></div>
              <div><div class="num">{{ d.generalAssembly.stats.avgYes }}</div><div class="cap">average votes in favour</div></div>
            </div>
            <NuxtLink to="/votes" class="inline-block mt-5 text-sm text-[#0077b6] hover:underline">Country voting records &rarr;</NuxtLink>
          </div>
          <div class="card lg:col-span-2">
            <h3 class="h3">Latest resolutions</h3>
            <ul class="mt-3 divide-y divide-primary-100">
              <li v-for="r in d.generalAssembly.latest" :key="r.id" class="py-2.5 grid grid-cols-[4.5rem_1fr_9rem] items-center gap-3">
                <span class="text-xs text-primary-400 tabular-nums">{{ shortDate(r.date) }}</span>
                <div class="min-w-0">
                  <div class="text-sm text-primary-800 truncate" :title="r.title">{{ r.title }}</div>
                  <a :href="r.url" target="_blank" rel="noopener" class="text-[11px] text-primary-400 hover:text-[#0077b6] font-mono">{{ r.id }}</a>
                  <span class="text-[11px] text-primary-400"> · {{ r.body }}</span>
                </div>
                <VoteBar v-if="r.tally" :tally="r.tally" :label="r.id" />
                <span v-else class="badge badge-ok justify-self-start">Without a vote</span>
              </li>
            </ul>
          </div>
        </div>
        <div class="card mt-6">
          <h3 class="h3">Most divided votes of session {{ d.generalAssembly.statsSession }}</h3>
          <p class="sub">Recorded votes with the lowest share in favour</p>
          <ul class="divide-y divide-primary-100">
            <li v-for="r in d.generalAssembly.contested" :key="r.id" class="py-2.5 grid sm:grid-cols-[1fr_16rem] items-center gap-3">
              <div class="min-w-0">
                <div class="text-sm text-primary-800">{{ r.title }}</div>
                <a :href="r.url" target="_blank" rel="noopener" class="text-[11px] text-primary-400 hover:text-[#0077b6] font-mono">{{ r.id }}</a>
              </div>
              <VoteBar :tally="r.tally" :label="r.id" show-numbers />
            </li>
          </ul>
        </div>
      </section>

      <!-- ===================== Secretary-General ===================== -->
      <UnSgOffice />

      <!-- ===================== Secretariat / rights / humanitarian ===================== -->
      <section id="system" class="scroll-mt-24">
        <SectionHead title="Across the UN system" :updated="d.freshness.statements" note="Official statements and reporting" />
        <div class="grid lg:grid-cols-3 gap-6">
          <div v-for="col in systemCols" :id="col.id" :key="col.id" class="card scroll-mt-24">
            <h3 class="h3">{{ col.title }}</h3>
            <p class="sub">{{ col.sub }}</p>
            <ul class="space-y-3">
              <li v-for="x in col.items" :key="x.url" class="text-sm">
                <a :href="x.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-[#0077b6] leading-snug">{{ x.title }}</a>
                <div class="text-[11px] text-primary-400 mt-0.5">{{ sourceLabel(x.source) }} · {{ timeAgo(x.publishedAt) }}<span v-if="x.countries.length"> · {{ x.countries.map((c: any) => flag(c.iso2)).join(' ') }}</span></div>
              </li>
              <li v-if="!col.items.length" class="text-sm text-primary-400">Nothing recent.</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ===================== Coming up ===================== -->
      <section id="coming-up" class="scroll-mt-24">
        <SectionHead title="Coming up" note="Formal meetings in the next two days, New York time (UN Web TV)" />
        <div class="card">
          <ul v-if="d.comingUp.length" class="grid md:grid-cols-2 gap-x-8 gap-y-2.5">
            <li v-for="m in d.comingUp" :key="m.start + m.title" class="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
              <span class="text-xs text-primary-500 tabular-nums pt-0.5">{{ m.day === 'today' ? 'Today' : 'Tomorrow' }} {{ nyTime(m.start) }}</span>
              <div><a :href="m.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-[#0077b6]">{{ m.title }}</a><div class="text-[11px] text-primary-400">{{ m.body }}</div></div>
            </li>
          </ul>
          <p v-else class="text-sm text-primary-500">No formal meetings published for the next two days yet. The UN Web TV schedule is checked every few hours.</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import { isoToFlag } from '~/composables/useGroups'

useHead({ title: 'UN Monitor — World Country Groups' })

const SECTIONS = [
  { id: 'council', label: 'Security Council' },
  { id: 'analysis', label: 'Council analysis' },
  { id: 'assembly', label: 'General Assembly' },
  { id: 'sg', label: 'Secretary-General' },
  { id: 'secretariat', label: 'Secretariat' },
  { id: 'rights', label: 'Human rights & justice' },
  { id: 'humanitarian', label: 'Humanitarian' },
  { id: 'coming-up', label: 'Coming up' },
]

const { data, pending } = useFetch<any>('/api/un/monitor')
const d = computed(() => data.value)

// AI narrative (needs a signed-in user and an AI provider; the page works without it)
const { data: ai, pending: aiPending } = useFetch<any>('/api/intelligence/ai/un-briefing', { lazy: true, server: false })
const { highlight } = useBriefHighlight()
const aiHtml = computed(() => {
  const t = ai.value?.overview || ai.value?.content || ''
  return t ? (marked.parse(highlight(t)) as string) : ''
})

const flag = (iso2: string) => (iso2 ? isoToFlag(iso2) : '')
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) ? 0 : (n % 10 <= 3 ? n % 10 : 0)]}`
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const monthLabel = (m: string) => new Date(m + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const shortDate = (s: string, withYear = false) => (s ? new Date(s + 'T12:00:00Z').toLocaleDateString('en-GB', withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }) : '')
const nyTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
function timeAgo(iso: string) {
  if (!iso) return ''
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (h < 1) return 'within the hour'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
const SOURCE_LABELS: Record<string, string> = {
  'un-spokesperson': 'SG Spokesperson', 'un-press-releases': 'UN Press', 'un-pga': 'President of the GA', dppa: 'DPPA',
  'gnews-un-sg': 'Secretary-General (news)', ohchr: 'OHCHR', icj: 'ICJ', icc: 'ICC', 'ungeneva-press': 'UN Geneva', 'ungeneva-meetings': 'UN Geneva',
  'ocha-reliefweb': 'OCHA', reliefweb: 'ReliefWeb', 'un-news-humanitarian': 'UN News', 'gnews-unhcr': 'UNHCR (news)', 'gnews-wfp': 'WFP (news)',
}
const sourceLabel = (s: string) => SOURCE_LABELS[s] || s

const tiles = computed(() => {
  const c = d.value?.council?.stats, g = d.value?.generalAssembly
  if (!c || !g) return []
  return [
    { label: 'Council meetings, last 30 days', value: c.meetingsLast30 },
    { label: `Council resolutions in ${new Date().getFullYear()}`, value: c.resolutionsThisYear, sub: c.unanimousShare != null ? `${c.unanimousShare}% unanimous` : '' },
    { label: 'Vetoed drafts this year', value: c.vetoedThisYear, sub: c.failedThisYear ? `${c.failedThisYear} more failed for lack of votes` : '', subClass: 'text-red-700' },
    { label: `GA resolutions, session ${g.statsSession}`, value: g.stats.resolutions, sub: `${pct(g.stats.withoutVote, g.stats.resolutions)}% without a vote` },
    { label: 'Council presidency', value: d.value.council.president ? `${flag(d.value.council.president.iso2)} ${d.value.council.president.name}` : '—', sub: d.value.council.president ? monthLabel(d.value.council.president.month) : '' },
  ]
})
const focusRows = computed(() => (d.value?.council?.focus || []).map((f: any) => ({ key: f.topic, label: f.topic, value: f.meetings })))
const systemCols = computed(() => [
  { id: 'secretariat', title: 'Secretariat', sub: 'Secretary-General, Spokesperson, PGA and political affairs', items: d.value?.secretariat || [] },
  { id: 'rights', title: 'Human rights & justice', sub: 'OHCHR, Human Rights Council, ICJ and ICC', items: d.value?.rights || [] },
  { id: 'humanitarian', title: 'Humanitarian', sub: 'OCHA, UNHCR, WFP and UN News reporting', items: d.value?.humanitarian || [] },
])

// ---- small local components ----
const SectionHead = defineComponent({
  props: { title: String, note: String, updated: String },
  setup(p) {
    return () => h('div', { class: 'flex flex-wrap items-end justify-between gap-2 mb-4 pb-2 border-b-2 border-[#009edb]/30' }, [
      h('h2', { class: 'font-serif text-3xl text-primary-900' }, p.title),
      h('span', { class: 'text-[11px] text-primary-400' }, [p.note, p.updated ? ` · updated ${new Date(p.updated).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '']),
    ])
  },
})
const VoteBar = defineComponent({
  props: { tally: { type: Object, default: null }, total: { type: Number, default: 0 }, label: String, showNumbers: Boolean },
  setup(p) {
    const { show, hide } = useVizTip()
    return () => {
      const t: any = p.tally || {}
      const sum = (t.yes || 0) + (t.no || 0) + (t.abstain || 0)
      const base = Math.max(p.total || 0, sum, 1)
      const seg = (v: number, color: string) => (v ? h('span', { class: 'h-full first:rounded-l-[3px] last:rounded-r-[3px]', style: { width: `${(v / base) * 100}%`, background: color } }) : null)
      return h('div', {
        class: 'flex items-center gap-2', tabindex: 0,
        onMousemove: (e: MouseEvent) => show(e, p.label || 'Vote', [
          { text: `In favour: ${t.yes}`, color: '#2a78d6' }, { text: `Against: ${t.no}`, color: '#e34948' }, { text: `Abstained: ${t.abstain}`, color: '#d6d4cf' }]),
        onMouseleave: hide,
      }, [
        h('div', { class: 'flex h-2.5 gap-[2px] flex-1 min-w-[5rem] rounded bg-primary-50' }, [seg(t.yes, '#2a78d6'), seg(t.no, '#e34948'), seg(t.abstain, '#d6d4cf')]),
        h('span', { class: 'text-[11px] tabular-nums text-primary-600 whitespace-nowrap' }, `${t.yes}-${t.no}-${t.abstain}`),
      ])
    }
  },
})
</script>

<style scoped>
.card { @apply bg-white rounded-2xl ring-1 ring-sky-100 p-5 sm:p-6; }
.h3 { @apply font-serif text-xl text-primary-900; }
.sub { @apply text-xs text-primary-500 mt-1 mb-4; }
.lbl { @apply text-[11px] font-semibold uppercase tracking-wider text-primary-500 mb-2; }
.chip { @apply inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-[#f2f8fc] text-primary-700 hover:bg-[#e3f1fa]; }
.badge { @apply inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1; }
.badge-ok { @apply bg-emerald-50 text-emerald-800 ring-emerald-200; }
.badge-bad { @apply bg-red-50 text-red-700 ring-red-200; }
.badge-warn { @apply bg-amber-50 text-amber-800 ring-amber-200; }
.num { @apply font-serif text-3xl text-primary-900 tabular-nums leading-none; }
.cap { @apply text-xs text-primary-500 mt-1; }
.brief :deep(p) { @apply text-[15px] leading-7 text-primary-700; }
</style>
