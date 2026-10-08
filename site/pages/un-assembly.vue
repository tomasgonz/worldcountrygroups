<template>
  <div class="min-h-screen bg-[#f6f9fc]">
    <VizTip />
    <header class="border-b border-sky-100 bg-gradient-to-b from-[#e8f4fb] to-[#f6f9fc]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#0077b6] font-semibold">
          <span class="inline-block w-2 h-2 rounded-full bg-[#009edb]" />UN Monitor
        </div>
        <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">General Assembly and ECOSOC</h1>
        <p class="text-primary-600 mt-3 max-w-3xl leading-relaxed">
          How the 193 vote and who breaks ranks, what the six Main Committees are working on, and the Economic and Social Council.
          Votes are country by country from the UN Digital Library; meetings from the Journal of the United Nations.
        </p>
        <nav class="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Sections">
          <a v-for="s in SECTIONS" :key="s.id" :href="`#${s.id}`" class="px-3 py-1.5 rounded-full bg-white ring-1 ring-sky-200 text-primary-700 hover:ring-[#009edb] hover:text-[#0077b6]">{{ s.label }}</a>
          <AdminRegenerate :sources="[{ id: 'fetch-undl-votes', label: 'General Assembly votes (Digital Library)' }, { id: 'fetch-ga-assembly', label: 'Committee bureaus, press and ECOSOC' }, { id: 'fetch-un-journal', label: 'Meetings (UN Journal)' }, { id: 'fetch-un-elections', label: 'ECOSOC membership and elections' }]" />
        </nav>
      </div>
    </header>

    <div v-if="!d" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-4"><div class="skeleton h-24 rounded-2xl" /><div class="skeleton h-96 rounded-2xl" /></div>
    <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-sky-100 rounded-2xl overflow-hidden ring-1 ring-sky-100">
        <div v-for="t in tiles" :key="t.label" class="bg-white px-5 py-4">
          <div class="font-serif text-3xl text-primary-900 tabular-nums leading-none">{{ t.value }}</div>
          <div class="text-xs text-primary-500 mt-1.5">{{ t.label }}</div>
          <div v-if="t.sub" class="text-[11px] mt-0.5 text-primary-400">{{ t.sub }}</div>
        </div>
      </div>

      <!-- ===================== Votes ===================== -->
      <section v-if="V" id="votes" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-3xl text-primary-900">How the Assembly voted · session {{ V.focus }}</h2>
          <span class="text-[11px] text-primary-400">{{ V.counts.recorded }} recorded votes, {{ V.counts.contested }} contested · to {{ day(V.lastVote) }}</span></div>
        <p v-if="V.latestSession !== V.focus" class="text-sm text-primary-600 -mt-2 mb-4">The {{ ordinal(V.latestSession) }} session has only just begun voting, so the analysis covers the {{ ordinal(V.focus) }} session ({{ 1945 + V.focus }}–{{ 1946 + V.focus }}), compared with the {{ ordinal(V.prev) }}.</p>
        <div class="grid lg:grid-cols-2 gap-6">
          <div class="card min-w-0">
            <h3 class="h3">Most divided votes</h3>
            <p class="sub">Lowest share in favour among those voting. Bars: <i class="sw" style="background:#2a78d6" /> yes <i class="sw" style="background:#e34948" /> no <i class="sw" style="background:#c8ccd2" /> abstain</p>
            <ul class="space-y-3">
              <li v-for="r in V.divided.slice(0, 8)" :key="r.id">
                <a :href="`https://digitallibrary.un.org/record/${r.id}`" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:text-[#0077b6] leading-snug line-clamp-2">{{ cleanTitle(r.title) }}</a>
                <div class="flex items-center gap-2 mt-1"><VoteBar :t="r.tally" /><span class="text-[11px] text-primary-500 tabular-nums whitespace-nowrap">{{ r.tally.yes }}–{{ r.tally.no }}–{{ r.tally.abstain }} · {{ day(r.date) }}</span></div>
              </li>
            </ul>
          </div>
          <div class="card min-w-0">
            <h3 class="h3">The US, China, Russia and the EU</h3>
            <p class="sub">On contested votes: how often each voted with the overall majority (session {{ V.prev }} in brackets), and with each other</p>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead><tr class="text-left text-[11px] uppercase tracking-wider text-primary-400 border-b border-sky-100">
                  <th class="py-2 font-medium" /><th class="py-2 px-2 font-medium text-right">With majority</th>
                  <th v-for="p in V.powers" :key="p.id" class="py-2 px-2 font-medium text-right">{{ short(p) }}</th>
                </tr></thead>
                <tbody>
                  <tr v-for="p in V.powers" :key="p.id" class="border-b border-sky-50">
                    <td class="py-2 pr-2 whitespace-nowrap">{{ p.id === 'EU' ? '🇪🇺' : flag(p.iso2) }} {{ p.label }}</td>
                    <td class="py-2 px-2 text-right tabular-nums">{{ pct(p.withMajority) }} <span class="text-[11px] text-primary-400">({{ pct(p.withMajorityPrev) }})</span></td>
                    <td v-for="q in V.powers" :key="q.id" class="py-2 px-2 text-right tabular-nums" :style="cell(p, q)">{{ p.id === q.id ? '–' : pct(p.pairs.find((x: any) => x.id === q.id)?.pct) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h4 class="text-xs font-medium text-primary-500 uppercase tracking-wide mt-4 mb-1.5">Latest votes where the US and China split</h4>
            <ul class="space-y-1.5 text-[13px]">
              <li v-for="r in V.usChina" :key="r.id" class="flex gap-2">
                <span class="shrink-0 tabular-nums text-[11px] text-primary-400 w-16 pt-0.5">{{ day(r.date) }}</span>
                <span class="min-w-0"><a :href="`https://digitallibrary.un.org/record/${r.id}`" target="_blank" rel="noopener" class="text-primary-800 hover:text-[#0077b6]">{{ cleanTitle(r.title) }}</a>
                  <span class="text-[11px] text-primary-500"> · US {{ VOTE[r.usa] }}, China {{ VOTE[r.chn] }}<span v-if="r.rus">, Russia {{ VOTE[r.rus] }}</span></span></span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ===================== Groups ===================== -->
      <section v-if="V" id="groups" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-3xl text-primary-900">Groups and who breaks ranks</h2><span class="text-[11px] text-primary-400">Contested votes, session {{ V.focus }}</span></div>
        <div class="card overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="text-left text-[11px] uppercase tracking-wider text-primary-400 border-b border-sky-100">
              <th class="py-2 font-medium">Group</th><th class="py-2 px-2 font-medium text-right">Cohesion</th><th class="py-2 px-2 font-medium text-right">Session {{ V.prev }}</th>
              <th class="py-2 px-2 font-medium">Most often apart</th><th class="py-2 px-2 font-medium">Most split vote</th>
            </tr></thead>
            <tbody>
              <tr v-for="g in V.groups" :key="g.gid" class="border-b border-sky-50 align-top">
                <td class="py-2 pr-2 whitespace-nowrap"><NuxtLink :to="`/groups/${g.gid}`" class="text-primary-900 hover:text-[#0077b6]">{{ g.acronym }}</NuxtLink> <span class="text-[11px] text-primary-400">{{ g.members }}</span></td>
                <td class="py-2 px-2 text-right tabular-nums font-medium">{{ pct(g.cohesion) }}</td>
                <td class="py-2 px-2 text-right tabular-nums text-primary-500">{{ pct(g.cohesionPrev) }}</td>
                <td class="py-2 px-2 text-[13px]"><span v-for="(o, i) in g.outliers.slice(0, 3)" :key="o.iso3">{{ i ? ', ' : '' }}{{ o.name }} <span class="text-primary-400">({{ pct(o.pct) }})</span></span></td>
                <td class="py-2 px-2 text-[13px] min-w-[16rem]"><template v-if="g.splits[0]">{{ cleanTitle(g.splits[0].title) }} <span class="text-[11px] text-primary-400">({{ g.splits[0].split.yes }} yes, {{ g.splits[0].split.no }} no, {{ g.splits[0].split.abstain }} abst.)</span></template></td>
              </tr>
            </tbody>
          </table>
          <p class="text-xs text-primary-500 mt-2">Cohesion: how often the typical member votes with its group's majority.</p>
        </div>
        <div class="grid lg:grid-cols-2 gap-6 mt-6">
          <div class="card min-w-0">
            <h3 class="h3">Furthest from the majority</h3>
            <p class="sub">Share of contested votes cast with the overall majority (session {{ V.prev }} in brackets)</p>
            <ul class="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <li v-for="m in V.mavericks" :key="m.iso3" class="flex justify-between gap-2"><NuxtLink :to="`/countries/${m.iso3.toLowerCase()}/votes`" class="truncate hover:text-[#0077b6]">{{ flag(m.iso2) }} {{ m.name }}</NuxtLink><span class="tabular-nums text-primary-700">{{ pct(m.pct) }} <span class="text-[11px] text-primary-400">({{ pct(m.prev) }})</span></span></li>
            </ul>
          </div>
          <div class="card min-w-0">
            <h3 class="h3">Biggest shifts since session {{ V.prev }}</h3>
            <p class="sub">Change in the share of contested votes cast with the majority, in points</p>
            <ul class="space-y-1.5 text-sm">
              <li v-for="m in V.movers" :key="m.iso3" class="flex justify-between gap-2"><NuxtLink :to="`/countries/${m.iso3.toLowerCase()}/votes`" class="truncate hover:text-[#0077b6]">{{ flag(m.iso2) }} {{ m.name }}</NuxtLink>
                <span class="tabular-nums whitespace-nowrap"><span class="text-primary-400 text-[11px]">{{ pct(m.prev) }} → {{ pct(m.pct) }}</span> <span :class="m.change < 0 ? 'text-red-700' : 'text-emerald-700'">{{ m.change > 0 ? '▲ +' : '▼ ' }}{{ m.change }}</span></span></li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ===================== Committees ===================== -->
      <section id="committees" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-3xl text-primary-900">The six Main Committees</h2><span class="text-[11px] text-primary-400">{{ ordinal(A.session) }} session · updated {{ stamp(A.updatedAt) }}</span></div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="c in A.committees" :key="c.id" class="card min-w-0 flex flex-col">
            <div class="text-[11px] uppercase tracking-wider text-[#0077b6] font-semibold">{{ c.name }}</div>
            <div class="font-serif text-lg text-primary-900 leading-tight">{{ c.mandate }}</div>
            <div v-if="c.bureau" class="text-xs text-primary-500 mt-1">Chair: {{ c.bureau.chair }} <span v-if="c.bureau.iso">{{ flag(c.bureau.iso.iso2) }}</span> {{ c.bureau.country }}</div>
            <div v-if="c.next.length" class="mt-3">
              <div class="lbl">Next meetings</div>
              <ul class="space-y-1 text-[13px]">
                <li v-for="m in c.next" :key="m.url"><a :href="m.url" target="_blank" rel="noopener" class="hover:text-[#0077b6]"><span class="tabular-nums text-primary-500">{{ day(m.date) }} {{ m.time }}</span> · {{ m.agenda[0] || m.title }}</a></li>
              </ul>
            </div>
            <div v-if="c.press.length" class="mt-3">
              <div class="lbl">Latest coverage</div>
              <ul class="space-y-1.5 text-[13px]">
                <li v-for="p in c.press.slice(0, 3)" :key="p.url"><a :href="p.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-[#0077b6] leading-snug">{{ p.title }}</a> <span class="text-[11px] text-primary-400">{{ day(p.date) }}</span></li>
              </ul>
            </div>
            <div class="mt-auto pt-3 flex flex-wrap gap-3 text-xs">
              <NuxtLink v-if="c.link" :to="c.link" class="text-[#0077b6] hover:underline">Budget, dues and statements →</NuxtLink>
              <a :href="c.documentation" target="_blank" rel="noopener" class="text-[#0077b6] hover:underline">Documents</a>
              <a :href="c.site" target="_blank" rel="noopener" class="text-[#0077b6] hover:underline">Committee site</a>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================== Plenary ===================== -->
      <section id="plenary" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-3xl text-primary-900">Plenary</h2><span class="text-[11px] text-primary-400">Meetings and coverage</span></div>
        <div class="grid lg:grid-cols-3 gap-6">
          <div class="card min-w-0">
            <h3 class="h3">Coming up</h3>
            <ul v-if="A.plenary.next.length" class="space-y-2 text-sm mt-2">
              <li v-for="m in A.plenary.next" :key="m.url"><a :href="m.url" target="_blank" rel="noopener" class="hover:text-[#0077b6]"><span class="tabular-nums text-primary-500">{{ day(m.date) }} {{ m.time }}</span><div class="text-primary-800 leading-snug">{{ m.agenda.join('; ') || m.title }}</div></a></li>
            </ul>
            <p v-else class="text-sm text-primary-400 mt-2">No plenary meetings in the Journal's window.</p>
            <h3 class="h3 mt-5">Latest votes, session {{ V?.latestSession }}</h3>
            <ul class="space-y-2 text-[13px] mt-2">
              <li v-for="r in V?.newest || []" :key="r.id"><a :href="`https://digitallibrary.un.org/record/${r.id}`" target="_blank" rel="noopener" class="text-primary-800 hover:text-[#0077b6] leading-snug">{{ cleanTitle(r.title) }}</a>
                <div class="text-[11px] text-primary-400 tabular-nums">{{ day(r.date) }} · {{ r.tally.yes }}–{{ r.tally.no }}–{{ r.tally.abstain }}</div></li>
            </ul>
          </div>
          <div class="card lg:col-span-2 min-w-0">
            <h3 class="h3">Meetings coverage</h3>
            <ul class="divide-y divide-sky-50 mt-1">
              <li v-for="p in A.plenary.press" :key="p.url" class="py-2"><a :href="p.url" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:text-[#0077b6]">{{ p.title }}</a> <span class="text-[11px] text-primary-400">{{ day(p.date) }}</span></li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ===================== ECOSOC ===================== -->
      <section id="ecosoc" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-3xl text-primary-900">Economic and Social Council</h2><span class="text-[11px] text-primary-400">{{ E.seats }} members · {{ E.year }}</span></div>
        <div class="grid lg:grid-cols-3 gap-6">
          <div class="card min-w-0">
            <div class="lbl">President</div>
            <div v-if="E.president" class="font-serif text-xl text-primary-900">{{ E.president.name }}</div>
            <div v-if="E.president" class="text-xs text-primary-500">{{ E.president.nationality }}<span v-if="E.president.since"> · elected {{ day(E.president.since) }}</span></div>
            <div class="lbl mt-4">Coming up</div>
            <ul v-if="E.meetings.upcoming.length" class="space-y-1.5 text-[13px]">
              <li v-for="m in E.meetings.upcoming" :key="m.url"><a :href="m.url" target="_blank" rel="noopener" class="hover:text-[#0077b6]"><span class="tabular-nums text-primary-500">{{ day(m.date) }}</span> · {{ m.organ }} <span class="text-primary-400">({{ m.location }})</span></a></li>
            </ul>
            <p v-else class="text-sm text-primary-400">Nothing in the Journal's window.</p>
            <div v-if="E.press.length" class="lbl mt-4">Latest coverage</div>
            <ul class="space-y-1.5 text-[13px]"><li v-for="p in E.press" :key="p.url"><a :href="p.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-[#0077b6]">{{ p.title }}</a> <span class="text-[11px] text-primary-400">{{ day(p.date) }}</span></li></ul>
          </div>
          <div class="card lg:col-span-2 min-w-0">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="h3">Members by regional group</h3>
              <span class="text-xs text-primary-500">Highlighted: term ends {{ E.year }}</span>
            </div>
            <div class="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-3">
              <div v-for="(list, g) in E.members" :key="g">
                <div class="lbl">{{ GROUP_NAMES[g] || g }} <span class="normal-case tracking-normal text-primary-400">({{ list.length }})</span></div>
                <div class="flex flex-wrap gap-1.5">
                  <NuxtLink v-for="m in list" :key="m.iso3" :to="`/countries/${m.iso3.toLowerCase()}`" class="chip" :class="m.termEnd === E.year ? 'ring-amber-300 bg-amber-50' : ''" :title="`Term ends ${m.termEnd}`">{{ flag(m.iso2) }} {{ m.name }}</NuxtLink>
                </div>
              </div>
            </div>
            <NuxtLink to="/elections?tab=ecosoc" class="text-xs text-[#0077b6] hover:underline mt-4 inline-block">ECOSOC elections →</NuxtLink>
          </div>
        </div>
      </section>

      <MethodNote>
        <p><strong>Votes.</strong> Recorded plenary votes with each Member State's vote, from the UN Digital Library's voting records (collected daily) and the Library's voting dataset; votes adopted without a vote are not included. The analysis covers the latest session with at least 30 recorded votes, compared with the session before. <em>Contested</em> votes are those with at least 100 countries voting and at least 10% departing from the majority; agreement figures use only these, because near-unanimous votes make everyone look aligned.</p>
        <p><strong>Measures.</strong> "With the majority": share of a country's contested votes (yes, no or abstain; absences ignored) matching the most common vote. Group cohesion: the median member's share of votes matching its group's own majority. Pairs: share of contested votes on which both cast the same vote. The EU is the majority vote of EU members. Countries with fewer than 30 contested votes in a session are left out of the rankings.</p>
        <p><strong>Committees, plenary and ECOSOC.</strong> Chairs from the committees' bureau pages; meetings from the Journal of the United Nations (a rolling window of about a week); coverage from UN Meetings Coverage press releases as indexed by Google News. ECOSOC members and terms from the General Assembly's election records; ECOSOC rarely votes, so there is no vote analysis for it.</p>
      </MethodNote>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

useHead({ title: 'General Assembly and ECOSOC — World Country Groups' })
const SECTIONS = [{ id: 'votes', label: 'Votes' }, { id: 'groups', label: 'Groups' }, { id: 'committees', label: 'Committees' }, { id: 'plenary', label: 'Plenary' }, { id: 'ecosoc', label: 'ECOSOC' }]
const GROUP_NAMES: Record<string, string> = { AG: 'African States', APG: 'Asia-Pacific States', EEG: 'Eastern European States', GRULAC: 'Latin American and Caribbean States', WEOG: 'Western European and other States' }
const VOTE: Record<string, string> = { Y: 'yes', N: 'no', A: 'abstained', X: 'absent' }
const { data: d } = useFetch<any>('/api/un/assembly', { lazy: true, server: false })
const V = computed(() => d.value?.votes)
const A = computed(() => d.value?.assembly || { committees: [], plenary: { next: [], press: [] } })
const E = computed(() => d.value?.ecosoc || { members: {}, meetings: { upcoming: [] }, press: [] })
const tiles = computed(() => [
  { label: `recorded votes, session ${V.value?.focus ?? ''}`, value: V.value?.counts.recorded ?? '–', sub: V.value ? `${V.value.counts.contested} contested` : '' },
  { label: 'US votes with the majority', value: pct(V.value?.powers.find((p: any) => p.id === 'USA')?.withMajority), sub: 'contested votes' },
  { label: 'Main Committees in session', value: A.value.committees.filter((c: any) => c.next.length).length || A.value.committees.length, sub: A.value.session ? `${ordinal(A.value.session)} session` : '' },
  { label: 'ECOSOC members ending their term', value: E.value.leaving?.length ?? '–', sub: E.value.year ? `in ${E.value.year}` : '' },
])

const pct = (v: number | null | undefined) => (v == null ? '–' : `${Math.round(v)}%`)
const short = (p: any) => (p.id === 'EU' ? 'EU' : p.id)
function cell(p: any, q: any) {
  if (p.id === q.id) return {}
  const v = p.pairs.find((x: any) => x.id === q.id)?.pct
  return v == null ? {} : { background: `rgba(42,120,214,${(v / 100) * 0.35})` }
}
const cleanTitle = (t: string) => (t || '').replace(/\s*:\s*resolution\s*\/.*$/i, '').replace(/\s*\/\s*$/, '')
const flag = (iso2: string | null) => (iso2 ? isoToFlag(iso2) : '')
const day = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }) : '–')
const stamp = (iso: string) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const ordinal = (n: number) => (n ? `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as any)[n % 10] || 'th'}` : '')

const VoteBar = defineComponent({
  props: { t: { type: Object, required: true } },
  setup(p) {
    const { show, hide } = useVizTip()
    return () => {
      const t: any = p.t
      const n = Math.max(1, t.yes + t.no + t.abstain)
      const seg = (v: number, c: string) => (v ? h('span', { class: 'h-full', style: { width: `${(v / n) * 100}%`, background: c } }) : null)
      return h('div', { class: 'flex h-2.5 gap-[2px] flex-1 min-w-[6rem] rounded overflow-hidden bg-sky-50', onMousemove: (e: MouseEvent) => show(e, 'Vote', [{ text: `Yes ${t.yes}`, color: '#2a78d6' }, { text: `No ${t.no}`, color: '#e34948' }, { text: `Abstain ${t.abstain}`, color: '#c8ccd2' }]), onMouseleave: hide },
        [seg(t.yes, '#2a78d6'), seg(t.no, '#e34948'), seg(t.abstain, '#c8ccd2')])
    }
  },
})
</script>

<style scoped>
.head { @apply flex flex-wrap items-end justify-between gap-2 mb-4 pb-2 border-b-2 border-[#009edb]/30; }
.card { @apply bg-white rounded-2xl ring-1 ring-sky-100 p-5; }
.h3 { @apply font-serif text-xl text-primary-900; }
.sub { @apply text-xs text-primary-500 mt-1 mb-3; }
.lbl { @apply text-[11px] font-medium text-primary-500 uppercase tracking-wide mb-1.5; }
.chip { @apply inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#f1f8fd] ring-1 ring-sky-100 text-xs text-primary-700 hover:ring-[#009edb]; }
.sw { @apply inline-block w-2.5 h-2.5 rounded-sm align-middle; }
</style>
