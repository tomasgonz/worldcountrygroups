<template>
  <section class="space-y-5">
    <VizTip v-if="tip" />

    <div v-if="pending" class="space-y-3">
      <div class="skeleton h-40 rounded-2xl" />
      <div class="skeleton h-64 rounded-2xl" />
    </div>
    <div v-else-if="!d" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 text-sm text-primary-600">
      International Court of Justice election data is not available yet.
    </div>

    <template v-else>
      <!-- ============ The Court ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">The Court’s 15 judges</h2>
          <span class="text-xs text-primary-400">Updated {{ fmtDate(d.meta.updated_at) }}</span>
        </div>
        <p class="text-sm text-primary-500 mb-4">{{ d.rules }}</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div v-for="(y, yi) in termClasses" :key="String(y)" class="rounded-xl bg-primary-50/70 p-3">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: CLASS_COLORS[yi] }" />
                <span class="text-[11px] font-semibold uppercase tracking-wider text-primary-700">{{ y ? `Terms end Feb ${y}` : 'Term end unknown' }}</span>
              </span>
              <span v-if="y && ne && y === ne.year + 1" class="text-[10px] font-semibold rounded bg-accent-50 text-accent-800 ring-1 ring-accent-200 px-1.5 py-0.5">up in {{ ne.year }}</span>
            </div>
            <ul class="space-y-1.5">
              <li v-for="j in judgesByEnd(y)" :key="j.name" class="text-sm" tabindex="0"
                @mousemove="judgeTip(j, $event)" @mouseleave="hide" @focus="judgeTip(j, $event)" @blur="hide">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-primary-900" :title="j.name"><span v-if="j.iso2" class="mr-1">{{ isoToFlag(j.iso2) }}</span>{{ j.name }}</span>
                  <span v-if="j.role !== 'judge'" class="shrink-0 text-[10px] font-semibold rounded bg-primary-200/70 text-primary-700 px-1.5 py-0.5">{{ j.role === 'president' ? 'President' : 'Vice-President' }}</span>
                </div>
                <div class="text-[11px] text-primary-400">{{ j.nationality }}<template v-if="j.current_term_from"> · term from {{ fmtDate(j.current_term_from) }}</template><template v-if="j.term_end_derived && j.term_end_derived.startsWith('completes')"> (vacancy)</template></div>
              </li>
            </ul>
          </div>
        </div>
        <SourceLine :urls="sourcesFor('icj.judges')" :verified="true" />
      </div>

      <!-- ============ Next election ============ -->
      <div v-if="ne" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">{{ ne.status === 'held' ? '' : 'Next election: ' }}{{ ne.year }} <span class="text-primary-400 font-normal text-base">for {{ ne.term }}</span></h2>
          <span class="text-xs text-primary-400">{{ ne.date ? fmtDate(ne.date) : ne.date_text }}<template v-if="daysTo(ne.date) != null"> · {{ daysLabel(daysTo(ne.date)!) }}</template></span>
        </div>
        <p class="text-sm text-primary-500 mb-4">
          {{ ne.seats }} seats. The General Assembly and the Security Council vote at the same time but separately; a candidate is elected only with
          <strong class="text-primary-800">{{ ne.ga_required }} votes in the Assembly</strong> and <strong class="text-primary-800">{{ ne.sc_required }} in the Council</strong>.
        </p>
        <div class="mb-4">
          <div class="text-[11px] uppercase tracking-wider text-primary-400 mb-1">Terms ending 5 February {{ ne.year + 1 }}</div>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="t in ne.ending_terms" :key="t.name" class="text-xs rounded-full px-2.5 py-1 ring-1"
              :class="t.running ? 'ring-primary-300 bg-primary-50 text-primary-800' : 'ring-primary-200 text-primary-500'">
              <span v-if="t.iso2" class="mr-0.5">{{ isoToFlag(t.iso2) }}</span>{{ t.name }} · {{ t.running ? 'standing again' : 'not standing' }}
            </span>
          </div>
        </div>
        <div class="text-[11px] uppercase tracking-wider text-primary-400 mb-1">Candidates</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div v-for="c in sortedCands" :key="(c.name || '') + c.country" class="rounded-xl ring-1 ring-primary-200/70 px-3 py-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-primary-900 truncate"><span v-if="c.iso2" class="mr-1">{{ isoToFlag(c.iso2) }}</span>{{ c.name || 'Name not confirmed' }}</span>
              <span class="inline-flex items-center gap-1 text-[11px] text-primary-500 shrink-0">
                <span class="w-2 h-2 rounded-full" :style="{ background: groupColor(c.group) }" />{{ groupShort(c.group) }}
              </span>
            </div>
            <div class="text-[11px] text-primary-500 mt-0.5">
              {{ c.country }}<span v-if="c.incumbent" class="ml-1 rounded bg-primary-100 text-primary-700 px-1 py-0.5">sitting judge</span>
              <template v-if="c.nominating_groups?.length"> · nominated by {{ c.nominating_groups.length }} national groups</template>
              · <a :href="c.source" target="_blank" rel="noopener" class="underline hover:text-primary-700">source</a>
            </div>
            <div v-if="c.note" class="text-[11px] text-accent-700 mt-0.5">{{ c.note }}</div>
          </div>
        </div>
        <ul v-if="ne.notable.length" class="mt-4 space-y-1 text-sm text-primary-700 list-disc pl-5">
          <li v-for="(n, i) in ne.notable" :key="i">{{ n }}</li>
        </ul>
        <template v-if="ne.ballots">
          <h3 class="font-serif text-base font-semibold text-primary-900 mt-5 mb-2">Results</h3>
          <IcjBallot :results="ne.ballots.results.map(r => ({ ...r, elected: false }))" :ga-required="ne.ballots.ga_required" :sc-required="ne.ballots.sc_required" :sc-rounds="ne.ballots.sc_rounds" />
        </template>
        <p v-if="ne.verification_note" class="text-[11px] text-accent-700 mt-3">Unverified: {{ ne.verification_note }}</p>
        <SourceLine :urls="sourcesFor('icj.next_election')" :verified="ne.verified" />
      </div>

      <!-- ============ Latest regular election ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">{{ le.year }} election <span class="text-primary-400 font-normal text-base">for {{ le.term }}</span></h2>
          <span class="text-xs text-primary-400">{{ fmtDate(le.date) }}</span>
        </div>
        <p class="text-sm text-primary-500 mb-3">
          Elected:
          <span v-for="(n, i) in le.elected" :key="n"><strong class="text-primary-800">{{ n }}</strong><span v-if="i < le.elected.length - 1">, </span></span>.
          Each needed an absolute majority in both bodies: {{ le.ga_required }} in the General Assembly and {{ le.sc_required }} in the Security Council.
          The Assembly voted {{ le.ga_rounds.length }} time{{ le.ga_rounds.length === 1 ? '' : 's' }}, the Council {{ le.sc_rounds.length }}.
        </p>
        <IcjBallot :results="le.results" :ga-required="le.ga_required" :sc-required="le.sc_required" :sc-rounds="le.sc_rounds" />
        <ul v-if="le.notable.length" class="mt-4 space-y-1 text-sm text-primary-700 list-disc pl-5">
          <li v-for="(n, i) in le.notable" :key="i">{{ n }}</li>
        </ul>
        <p class="text-[11px] text-primary-400 mt-3">{{ le.verification_note }}</p>
        <SourceLine :urls="[le.source]" :verified="le.verified" />

        <template v-if="d.by_elections.length">
          <h3 class="font-serif text-base font-semibold text-primary-900 mt-6 mb-2">Since then: elections to fill vacancies</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div v-for="b in d.by_elections" :key="b.date" class="rounded-xl ring-1 ring-primary-200/70 p-3">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-sm font-semibold text-primary-900"><span v-if="b.iso2" class="mr-1">{{ isoToFlag(b.iso2) }}</span>{{ b.elected }}</span>
                <span class="text-[11px] text-primary-400">{{ fmtDate(b.date) }}</span>
              </div>
              <div class="text-[11px] text-primary-500 mb-2">{{ b.country }} · replaces {{ b.replaces }} · term to Feb {{ b.term_end }}</div>
              <div class="space-y-1.5">
                <div class="mini-row grid items-center gap-2 text-xs">
                  <span class="text-primary-600">Assembly</span>
                  <div class="relative h-3 rounded bg-primary-50">
                    <div class="absolute inset-y-0 left-0 rounded" :style="{ width: pct(b.ga_votes, GA_MEMBERS) + '%', background: BLUE }" />
                    <div class="absolute -inset-y-0.5 w-0.5 bg-primary-900" :style="{ left: pct(b.ga_required, GA_MEMBERS) + '%' }" />
                  </div>
                  <span class="tabular-nums text-right text-primary-700">{{ b.ga_votes }}/{{ b.ga_required }}</span>
                </div>
                <div class="mini-row grid items-center gap-2 text-xs">
                  <span class="text-primary-600">Council</span>
                  <div class="relative h-3 rounded bg-primary-50">
                    <div class="absolute inset-y-0 left-0 rounded" :style="{ width: pct(b.sc_votes, 15) + '%', background: ORANGE }" />
                    <div class="absolute -inset-y-0.5 w-0.5 bg-primary-900" :style="{ left: pct(b.sc_required, 15) + '%' }" />
                  </div>
                  <span class="tabular-nums text-right text-primary-700">{{ b.sc_votes }}/{{ b.sc_required }}</span>
                </div>
              </div>
              <div class="text-[11px] text-primary-400 mt-1.5">
                {{ b.candidates === 1 ? 'Sole candidate' : `${b.candidates} candidates` }} · final round: {{ b.ga_votes }} of {{ b.ga_present }} in the Assembly<template v-if="b.rounds_ga > 1 || b.rounds_sc > 1"> · {{ b.rounds_ga }} Assembly and {{ b.rounds_sc }} Council rounds</template>
                · <a :href="b.source" target="_blank" rel="noopener" class="underline hover:text-primary-700">source</a><template v-if="!b.verified"> (unverified)</template>
              </div>
            </div>
          </div>
          <p class="text-[11px] text-primary-400 mt-2">Bars: votes in the final round; black line = absolute majority (scale 0–{{ GA_MEMBERS }} in the Assembly, 0–15 in the Council).</p>
        </template>
      </div>

      <p class="text-[11px] text-primary-400">
        Sources:
        <template v-for="(s, i) in d.meta.sources" :key="s.url + s.section"><a :href="s.url" target="_blank" rel="noopener" class="underline hover:text-primary-600">{{ s.title }}</a><span v-if="i < d.meta.sources.length - 1"> · </span></template>
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { h as hFn, type PropType } from 'vue'
import { isoToFlag } from '~/composables/useGroups'

type GroupCode = 'AG' | 'APG' | 'EEG' | 'GRULAC' | 'WEOG'
interface Judge {
  name: string; iso3: string | null; iso2?: string | null; nationality: string; group: GroupCode | null
  role: 'president' | 'vice-president' | 'judge'; member_since: string | null; current_term_from: string | null; career: string
  term_end: number | null; term_end_derived: string | null
}
interface Round { label: string; date: string | null }
interface Result {
  name: string; ga: (number | null)[]; sc: (number | null)[]; ga_majority?: boolean; sc_majority?: boolean; elected: boolean
  nationality?: string | null; iso2?: string | null; regional_group?: string | null; nominating_groups?: number | null
}
interface Cand { name: string | null; iso3: string | null; iso2?: string | null; country: string | null; group: GroupCode | null; nominating_groups: string[] | null; incumbent: boolean; source: string; note: string | null }
interface Icj {
  meta: { updated_at: string; notes: string[]; sources: { title: string; url: string; section: string }[] }
  groups: Record<GroupCode, string>; year: number; rules: string; judges: Judge[]
  latest_election: {
    year: number; term: string; date: string | null; ga_required: number; sc_required: number; ga_rounds: Round[]; sc_rounds: Round[]
    results: Result[]; elected: string[]; notable: string[]; source: string; verified: boolean; verification_note: string
  }
  by_elections: { date: string; elected: string; country: string; iso2?: string | null; replaces: string; term_end: number; candidates: number; ga_votes: number; ga_present: number; sc_votes: number; rounds_ga: number; rounds_sc: number; ga_required: number; sc_required: number; source: string; verified: boolean }[]
  next_election: {
    year: number; term: string; seats: number; status: 'upcoming' | 'held'; date: string | null; date_text: string | null; ga_required: number; sc_required: number
    ending_terms: { name: string; iso2?: string | null; nationality: string; running: boolean }[]
    candidates: Cand[]; ballots: { ga_required: number; sc_required: number; sc_rounds: Round[]; results: { name: string; ga: (number | null)[]; sc: (number | null)[] }[] } | null
    verified: boolean; verification_note: string | null; notable: string[]
  } | null
}

withDefaults(defineProps<{ tip?: boolean }>(), { tip: true })

const GROUPS: GroupCode[] = ['AG', 'APG', 'EEG', 'GRULAC', 'WEOG']
const BLUE = '#2a78d6', ORANGE = '#eb6834', AQUA = '#1baf7a', AMBER = '#eda100', RED = '#e34948'
const COLORS = [BLUE, ORANGE, AQUA, AMBER, RED]
const CLASS_COLORS = [ORANGE, BLUE, AQUA, AMBER]
const SHORT: Record<GroupCode, string> = { AG: 'Africa', APG: 'Asia-Pacific', EEG: 'E. Europe', GRULAC: 'Latin Am. & Caribbean', WEOG: 'W. Europe & Others' }
const GA_MEMBERS = 193

const { data, pending } = useFetch<Icj>('/api/un-elections/icj', { key: 'un-elections-icj' })
const d = computed(() => data.value || null)
const le = computed(() => d.value!.latest_election)
const ne = computed(() => d.value?.next_election || null)

const groupColor = (g: string | null | undefined) => (g ? COLORS[GROUPS.indexOf(g as GroupCode)] || '#94a3b8' : '#94a3b8')
const groupShort = (g: string | null | undefined) => (g ? SHORT[g as GroupCode] || g : '—')
const pct = (v: number | null | undefined, max: number) => Math.max(0, Math.min(100, ((v || 0) / max) * 100))

const termClasses = computed(() => [...new Set((d.value?.judges || []).map(j => j.term_end))].sort((a, b) => (a ?? 9999) - (b ?? 9999)))
const ROLE_ORDER = { president: 0, 'vice-president': 1, judge: 2 }
const judgesByEnd = (y: number | null) => (d.value?.judges || []).filter(j => j.term_end === y)
  .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name))
const sortedCands = computed(() => [...(ne.value?.candidates || [])].sort((a, b) =>
  GROUPS.indexOf(a.group as GroupCode) - GROUPS.indexOf(b.group as GroupCode) || (a.country || '').localeCompare(b.country || '')))

const { show, hide } = useVizTip()
function judgeTip(j: Judge, e: MouseEvent | FocusEvent) {
  show(e, j.name, [
    { text: `${j.nationality}${j.role !== 'judge' ? ' · ' + (j.role === 'president' ? 'President' : 'Vice-President') : ''}`, color: groupColor(j.group) },
    { text: j.term_end ? `Term ends 5 February ${j.term_end}` : 'Term end unknown' },
    ...(j.term_end_derived?.startsWith('completes') ? [{ text: 'Elected to a vacancy: completes a predecessor’s term' }] : []),
    { text: j.career },
  ])
}

function daysTo(s: string | null | undefined) {
  if (!s) return null
  const t = new Date(s + 'T12:00:00Z').getTime() - Date.now()
  return t < 0 ? null : Math.ceil(t / 86400000)
}
const daysLabel = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`)
const sourcesFor = (section: string) => (d.value?.meta.sources || []).filter(s => s.section === section).map(s => s.url)

function fmtDate(s: string | null | undefined) {
  if (!s) return ''
  const dt = new Date(s.length === 10 ? s + 'T12:00:00Z' : s)
  return isNaN(dt.getTime()) ? s : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Ballot table: per candidate, the General Assembly vote (bar on 0–193, line at the majority) and the Security
 * Council's votes in each round (cells on 0–15, filled when at or above the majority).
 */
const IcjBallot = defineComponent({
  props: {
    results: { type: Array as PropType<Result[]>, required: true },
    gaRequired: { type: Number, required: true },
    scRequired: { type: Number, required: true },
    scRounds: { type: Array as PropType<Round[]>, required: true },
  },
  setup(p) {
    const tipFor = (r: Result) => (e: MouseEvent | FocusEvent) => {
      const gaLast = [...r.ga].reverse().find(v => v != null)
      show(e, r.name, [
        { text: `${r.nationality || ''}${r.regional_group ? ' · ' + groupShort(r.regional_group) : ''}`, color: groupColor(r.regional_group) },
        { text: `General Assembly: ${r.ga.map(v => v ?? '–').join(' → ')} (needed ${p.gaRequired})` },
        { text: `Security Council: ${r.sc.map(v => v ?? '–').join(' → ')} (needed ${p.scRequired})` },
        { text: r.elected ? 'Elected' : (gaLast ?? 0) >= p.gaRequired ? 'Majority in the Assembly only: not elected' : 'Not elected' },
        ...(r.nominating_groups ? [{ text: `Nominated by ${r.nominating_groups} national groups` }] : []),
      ])
    }
    return () => hFn('div', { class: 'space-y-2' }, [
      hFn('div', { class: 'ballot-row grid items-end gap-2 text-[10px] uppercase tracking-wider text-primary-400' }, [
        hFn('span', 'Candidate'),
        hFn('span', `General Assembly (needs ${p.gaRequired})`),
        hFn('span', { class: 'text-right sm:text-left' }, `Council by round (needs ${p.scRequired})`),
      ]),
      ...p.results.map(r => {
        const ga = [...r.ga].reverse().find(v => v != null) ?? null
        return hFn('div', {
          class: 'ballot-row grid items-center gap-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-primary-300', tabindex: 0,
          onMousemove: tipFor(r), onMouseleave: hide, onFocus: tipFor(r), onBlur: hide,
        }, [
          hFn('span', { class: ['truncate', r.elected ? 'font-semibold text-primary-900' : 'text-primary-500'], title: r.name }, [
            r.iso2 ? isoToFlag(r.iso2) + ' ' : '', r.name, r.elected ? hFn('span', { class: 'ml-1 text-[10px] font-semibold text-primary-700', title: 'Elected' }, '✓') : null,
          ]),
          hFn('div', { class: 'flex items-center gap-1.5' }, [
            hFn('div', { class: 'relative h-4 rounded bg-primary-50 flex-1' }, [
              hFn('div', { class: 'absolute inset-y-0 left-0 rounded', style: { width: pct(ga, GA_MEMBERS) + '%', background: groupColor(r.regional_group), opacity: r.elected ? 1 : 0.45 } }),
              hFn('div', { class: 'absolute -inset-y-0.5 w-0.5 bg-primary-900', style: { left: pct(p.gaRequired, GA_MEMBERS) + '%' } }),
            ]),
            hFn('span', { class: 'tabular-nums text-xs text-primary-700 w-8 text-right' }, ga ?? '–'),
          ]),
          hFn('div', { class: 'flex gap-0.5 justify-end sm:justify-start' }, r.sc.map((v, i) => hFn('span', {
            class: ['sc-cell tabular-nums text-[11px] rounded text-center', (v ?? 0) >= p.scRequired ? 'text-white font-semibold' : 'text-primary-600 bg-primary-50'],
            style: (v ?? 0) >= p.scRequired ? { background: ORANGE } : undefined,
            title: `${p.scRounds[i]?.label || 'Round ' + (i + 1)}: ${v ?? '–'} votes`,
          }, v ?? '–'))),
        ])
      }),
      hFn('p', { class: 'text-[11px] text-primary-500 pt-1' },
        `Bars: last Assembly round on a 0–${GA_MEMBERS} scale; black line = ${p.gaRequired}. Council cells: votes per round out of 15; orange = at or above ${p.scRequired}. Faded bar = not elected; ✓ = elected.`),
    ])
  },
})

/** Small "source" footer used under cards. */
const SourceLine = defineComponent({
  props: { urls: { type: Array as PropType<(string | null | undefined)[]>, required: true }, verified: { type: Boolean, default: false } },
  setup(p) {
    return () => hFn('p', { class: 'text-[11px] text-primary-400 mt-3' }, [
      p.verified ? 'Sources: ' : 'Unverified. Sources: ',
      ...p.urls.filter((u): u is string => !!u).flatMap((u, i) => [
        i ? ' · ' : '',
        hFn('a', { href: u, target: '_blank', rel: 'noopener', class: 'underline hover:text-primary-600' }, hostLabel(u)),
      ]),
    ])
  },
})
function hostLabel(u: string) {
  try {
    const url = new URL(u)
    if (url.hostname.includes('wikipedia')) return 'Wikipedia: ' + decodeURIComponent(url.pathname.split('/').pop() || '').replace(/_/g, ' ')
    return url.hostname.replace(/^www\./, '')
  } catch { return u }
}
</script>

<style scoped>
:deep(.ballot-row) { grid-template-columns: minmax(7rem, 13rem) minmax(6rem, 1fr) auto; }
:deep(.sc-cell) { width: 1.6rem; padding: 1px 0; }
.mini-row { grid-template-columns: 4.5rem 1fr 3.5rem; }
@media (max-width: 480px) {
  :deep(.ballot-row) { grid-template-columns: 1fr auto; }
  :deep(.ballot-row) > :first-child { grid-column: 1 / -1; }
  :deep(.sc-cell) { width: 1.35rem; }
}
</style>
