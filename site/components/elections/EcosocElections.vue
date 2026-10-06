<template>
  <section class="space-y-5">
    <VizTip v-if="tip" />

    <div v-if="pending" class="space-y-3">
      <div class="skeleton h-40 rounded-2xl" />
      <div class="skeleton h-64 rounded-2xl" />
    </div>
    <div v-else-if="!d" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 text-sm text-primary-600">
      ECOSOC election data is not available yet.
    </div>

    <template v-else>
      <!-- ============ Membership ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">Economic and Social Council in {{ d.year }}</h2>
          <span class="text-xs text-primary-400">Updated {{ fmtDate(d.meta.updated_at) }}</span>
        </div>
        <p class="text-sm text-primary-500 mb-4">{{ d.rules }}</p>
        <!-- seats by term end, one stacked bar per group -->
        <div class="space-y-1.5 mb-4" role="img" :aria-label="`ECOSOC seats by regional group and the year terms end: ${GROUPS.map(g => `${groupShort(g)} ${d!.seats_by_group[g]}`).join(', ')}`">
          <div v-for="g in GROUPS" :key="g" class="seat-row grid items-center gap-2 text-xs">
            <span class="truncate text-primary-700">{{ groupShort(g) }} · {{ d.seats_by_group[g] }}</span>
            <div class="flex h-4 gap-px">
              <div v-for="y in END_YEARS" :key="y" class="h-full first:rounded-l last:rounded-r"
                :style="{ width: (endCount(g, y) / MAX_SEATS * 100) + '%', background: yearColor(y) }"
                @mousemove="show($event, `${groupLabel(g)}`, [{ text: `${endCount(g, y)} seat(s) ending 31 Dec ${y}`, color: yearColor(y) }])" @mouseleave="hide" />
            </div>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-primary-500 pt-1">
            <span v-for="y in END_YEARS" :key="y" class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" :style="{ background: yearColor(y) }" />Term ends {{ y }}</span>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div v-for="g in GROUPS" :key="g" class="rounded-xl bg-primary-50/70 p-3">
            <div class="flex items-center gap-1.5 mb-2">
              <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: groupColor(g) }" />
              <span class="text-[11px] font-semibold uppercase tracking-wider text-primary-700">{{ groupShort(g) }}</span>
            </div>
            <ul class="space-y-1">
              <li v-for="m in membersByGroup[g]" :key="m.iso3 || m.name" class="flex items-center justify-between gap-2 text-sm">
                <span class="truncate text-primary-900" :title="m.name"><span v-if="m.iso2" class="mr-1">{{ isoToFlag(m.iso2) }}</span>{{ m.name }}</span>
                <span class="shrink-0 text-[11px] tabular-nums" :class="m.term_end === d.year ? 'text-accent-700 font-semibold' : 'text-primary-500'"
                  :title="m.replaced_by ? `Hands the rest of its term (to ${m.term_end_original}) to ${m.replaced_by}` : `Term ends 31 December ${m.term_end}`">
                  to {{ m.term_end }}<template v-if="m.replaced_by">*</template>
                </span>
              </li>
            </ul>
          </div>
        </div>
        <p class="text-[11px] text-primary-400 mt-3">
          “to {{ d.year }}” in bold: term ends this year.
          <template v-if="replaced.length">* {{ replaced.map(m => `${m.name} gives up ${m.term_end_original} to ${m.replaced_by}`).join('; ') }} (rotation within the group).</template>
        </p>
        <p v-if="d.members_notes.length" class="text-[11px] text-accent-700 mt-1">{{ d.members_notes.join(' ') }}</p>
        <SourceLine :urls="sourcesFor('ecosoc.members')" :verified="d.members_verified" />
      </div>

      <!-- ============ Latest election ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">{{ le.year }} election <span class="text-primary-400 font-normal text-base">for {{ le.term }}</span></h2>
          <span class="text-xs text-primary-400">{{ fmtDate(le.date) }}</span>
        </div>
        <p class="text-sm text-primary-500 mb-3">
          {{ le.elected.length }} of {{ totalSeats }} seats filled.
          A candidate needs two-thirds of the members present and voting<template v-if="le.required_majority">: <strong class="text-primary-800">{{ le.required_majority }} of {{ le.present_and_voting }}</strong></template>.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div v-for="g in seatGroups" :key="g" class="rounded-xl ring-1 ring-primary-200/70 p-3">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-900">
                <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: groupColor(g) }" />{{ groupShort(g) }}
              </span>
              <span class="text-[11px] text-primary-400">{{ le.seats[g] }} seat{{ le.seats[g] === 1 ? '' : 's' }}</span>
            </div>
            <ul class="space-y-1">
              <li v-for="e in le.elected_by_group[g] || []" :key="e.iso3 || e.name" class="text-sm text-primary-900 flex items-center justify-between gap-2"
                tabindex="0" @mousemove="electTip(e, $event)" @mouseleave="hide" @focus="electTip(e, $event)" @blur="hide">
                <span class="truncate"><span v-if="e.iso2" class="mr-1">{{ isoToFlag(e.iso2) }}</span>{{ e.name }}</span>
                <span class="text-[11px] tabular-nums shrink-0" :class="e.votes ? 'text-primary-700' : 'text-primary-300'">{{ e.votes ? `${e.votes} votes` : '✓' }}</span>
              </li>
              <li v-for="n in (le.vacancies[g] || 0)" :key="'v' + n" class="text-sm text-accent-800 rounded bg-accent-50 px-1.5 py-0.5">Seat still vacant</li>
            </ul>
          </div>
        </div>
        <div v-if="le.by_election.length" class="mt-3 text-sm text-primary-700">
          <span class="text-[11px] uppercase tracking-wider text-primary-400 mr-1">By-election</span>
          <span v-for="b in le.by_election" :key="b.iso3 || b.name"><span v-if="b.iso2">{{ isoToFlag(b.iso2) }} </span><strong>{{ b.name }}</strong> ({{ b.term }}): {{ b.note }}</span>
        </div>
        <ul v-if="le.notable.length" class="mt-4 space-y-1 text-sm text-primary-700 list-disc pl-5">
          <li v-for="(n, i) in le.notable" :key="i">{{ n }}</li>
        </ul>
        <p v-if="le.unverified.length" class="text-[11px] text-accent-700 mt-3">Not verified: {{ le.unverified.join(' ') }}</p>
        <p class="text-[11px] text-primary-400 mt-1">
          Winners recorded from press reports (the UN press release sits behind a bot check) and cross-checked automatically<template v-if="le.checks.length">: {{ le.checks.filter(c => c.confirmed).length }}/{{ le.checks.length }} source checks passed</template>.
        </p>
        <SourceLine :urls="le.sources.map(s => s.url)" :verified="le.verified" />
      </div>

      <!-- ============ Next election ============ -->
      <div v-if="ne" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">Next election: {{ ne.year }} <span class="text-primary-400 font-normal text-base">for {{ ne.term }}</span></h2>
          <span class="text-xs text-primary-400">{{ ne.date ? fmtDate(ne.date) : ne.date_text }}</span>
        </div>
        <p class="text-sm text-primary-500 mb-4">{{ ne.note }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div v-for="g in GROUPS.filter(x => (ne!.seats[x] || 0) > 0)" :key="g" class="rounded-xl ring-1 ring-primary-200/70 p-3">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-900">
                <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: groupColor(g) }" />{{ groupShort(g) }}
              </span>
              <span class="text-[11px] text-primary-400">{{ ne.seats[g] }} seat{{ ne.seats[g] === 1 ? '' : 's' }}</span>
            </div>
            <div class="text-[11px] uppercase tracking-wider text-primary-400 mb-1">Terms ending</div>
            <ul class="space-y-0.5">
              <li v-for="o in ne.outgoing.filter(x => x.group === g)" :key="o.iso3 || o.name" class="text-sm text-primary-700">
                <span v-if="o.iso2" class="mr-1">{{ isoToFlag(o.iso2) }}</span>{{ o.name }}<span v-if="o.note" class="text-[11px] text-primary-400"> ({{ o.note }})</span>
              </li>
            </ul>
          </div>
        </div>
        <p class="text-[11px] text-primary-400 mt-3">Outgoing members may stand again: re-election to ECOSOC is allowed.</p>
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
interface CRef { iso3: string | null; iso2?: string | null; name: string; group: GroupCode | null }
interface Member extends CRef { term_end: number; term_start?: number; replaced_by?: string; term_end_original?: number; note?: string }
interface Elected extends CRef { votes?: number | null }
interface Ecosoc {
  meta: { updated_at: string; notes: string[]; sources: { title: string; url: string; section: string }[] }
  groups: Record<GroupCode, string>; year: number; seats_by_group: Record<GroupCode, number>; rules: string
  members: Member[]; members_verified: boolean; members_notes: string[]
  latest_election: {
    year: number; date: string; term: string; seats: Partial<Record<GroupCode, number>>
    elected: Elected[]; elected_by_group: Partial<Record<GroupCode, Elected[]>>
    by_election: (CRef & { term: string; replaces: string; note: string })[]
    vacancies: Partial<Record<GroupCode, number>>; present_and_voting: number | null; required_majority: number | null
    notable: string[]; unverified: string[]; sources: { title: string; url: string }[]
    checks: { url: string; confirmed: boolean }[]; verified: boolean
  }
  next_election: { year: number; term: string; date: string | null; date_text: string; seats: Partial<Record<GroupCode, number>>; outgoing: Member[]; note: string } | null
}

withDefaults(defineProps<{ tip?: boolean }>(), { tip: true })

const GROUPS: GroupCode[] = ['AG', 'APG', 'EEG', 'GRULAC', 'WEOG']
const BLUE = '#2a78d6', ORANGE = '#eb6834', AQUA = '#1baf7a', AMBER = '#eda100', RED = '#e34948'
const COLORS = [BLUE, ORANGE, AQUA, AMBER, RED]
const SHORT: Record<GroupCode, string> = { AG: 'Africa', APG: 'Asia-Pacific', EEG: 'E. Europe', GRULAC: 'Latin Am. & Caribbean', WEOG: 'W. Europe & Others' }

const { data, pending } = useFetch<Ecosoc>('/api/un-elections/ecosoc', { key: 'un-elections-ecosoc' })
const d = computed(() => data.value || null)
const le = computed(() => d.value!.latest_election)
const ne = computed(() => d.value?.next_election || null)

const groupColor = (g: GroupCode | null | undefined) => (g ? COLORS[GROUPS.indexOf(g)] || '#94a3b8' : '#94a3b8')
const groupShort = (g: GroupCode | null | undefined) => (g ? SHORT[g] || g : '—')
const groupLabel = (g: GroupCode | null | undefined) => (g ? d.value?.groups[g] || g : 'Unknown group')
const seatGroups = computed(() => GROUPS.filter(g => (le.value?.seats[g] || 0) > 0))
const totalSeats = computed(() => Object.values(le.value?.seats || {}).reduce((a, b) => a + (b || 0), 0))

const membersByGroup = computed(() => {
  const out: Partial<Record<GroupCode, Member[]>> = {}
  for (const m of d.value?.members || []) if (m.group) (out[m.group] ||= []).push(m)
  for (const g of GROUPS) out[g]?.sort((a, b) => a.term_end - b.term_end || a.name.localeCompare(b.name))
  return out
})
const replaced = computed(() => (d.value?.members || []).filter(m => m.replaced_by))
const END_YEARS = computed(() => [...new Set((d.value?.members || []).map(m => m.term_end))].sort())
const MAX_SEATS = computed(() => Math.max(...GROUPS.map(g => d.value?.seats_by_group[g] || 0), 1))
const endCount = (g: GroupCode, y: number) => (membersByGroup.value[g] || []).filter(m => m.term_end === y).length
// term-end years use the palette in order (blue, orange, aqua), independent of group colours
const yearColor = (y: number) => [BLUE, ORANGE, AQUA, AMBER][END_YEARS.value.indexOf(y)] || '#94a3b8'

const { show, hide } = useVizTip()
function electTip(e: Elected, ev: MouseEvent | FocusEvent) {
  const req = le.value.required_majority
  show(ev, e.name, [
    { text: groupLabel(e.group), color: groupColor(e.group) },
    { text: e.votes ? `${e.votes} votes of ${le.value.present_and_voting} present and voting (needed ${req})` : 'Elected · vote count not published in the sources checked' },
    { text: `Term ${le.value.term}` },
  ])
}
const sourcesFor = (section: string) => (d.value?.meta.sources || []).filter(s => s.section === section).map(s => s.url)

function fmtDate(s: string | null | undefined) {
  if (!s) return ''
  const dt = new Date(s.length === 10 ? s + 'T12:00:00Z' : s)
  return isNaN(dt.getTime()) ? s : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
.seat-row { grid-template-columns: minmax(7rem, 11rem) 1fr; }
@media (max-width: 420px) { .seat-row { grid-template-columns: 6.5rem 1fr; } }
</style>
