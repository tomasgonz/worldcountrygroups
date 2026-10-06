<template>
  <section class="space-y-5">
    <VizTip v-if="tip" />

    <div v-if="pending" class="space-y-3">
      <div class="skeleton h-40 rounded-2xl" />
      <div class="skeleton h-64 rounded-2xl" />
    </div>
    <div v-else-if="!d" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 text-sm text-primary-600">
      Human Rights Council election data is not available yet.
    </div>

    <template v-else>
      <!-- ============ Membership ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">Human Rights Council in {{ d.year }}</h2>
          <span class="text-xs text-primary-400">Updated {{ fmtDate(d.meta.updated_at) }}</span>
        </div>
        <p class="text-sm text-primary-500 mb-4">{{ d.rules }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div v-for="g in GROUPS" :key="g" class="rounded-xl bg-primary-50/70 p-3">
            <div class="flex items-center justify-between gap-1.5 mb-2">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: groupColor(g) }" />
                <span class="text-[11px] font-semibold uppercase tracking-wider text-primary-700">{{ groupShort(g) }}</span>
              </span>
              <span class="text-[11px] text-primary-400">{{ d.seats_by_group[g] }} seats</span>
            </div>
            <ul class="space-y-1">
              <li v-for="m in membersByGroup[g]" :key="m.iso3 || m.name" class="flex items-center justify-between gap-2 text-sm">
                <span class="truncate text-primary-900" :title="m.name"><span v-if="m.iso2" class="mr-1">{{ isoToFlag(m.iso2) }}</span>{{ m.name }}</span>
                <span class="shrink-0 inline-flex items-center gap-1">
                  <span v-if="m.second_term" class="text-[10px] font-semibold rounded bg-primary-200/70 text-primary-700 px-1 py-0.5" title="Second consecutive term: not eligible for immediate re-election">2nd</span>
                  <span class="text-[11px] tabular-nums" :class="m.term_end === d.year ? 'text-accent-700 font-semibold' : 'text-primary-500'"
                    :title="`Term ends 31 December ${m.term_end}`">to {{ m.term_end }}</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
        <p class="text-[11px] text-primary-400 mt-3">“to {{ d.year }}” in bold: term ends this year. “2nd”: second consecutive term, so not eligible for immediate re-election.</p>
        <SourceLine :urls="sourcesFor('hrc.members')" :verified="true" />
      </div>

      <!-- ============ Latest election ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">{{ le.year }} election <span class="text-primary-400 font-normal text-base">for {{ le.term }}</span></h2>
          <span class="text-xs text-primary-400">{{ le.date ? fmtDate(le.date) : le.date_text }}</span>
        </div>
        <p class="text-sm text-primary-500 mb-3">
          {{ le.elected?.length || 0 }} members elected by secret ballot in the General Assembly. A candidate needs an absolute majority of the {{ GA_MEMBERS }} members: <strong class="text-primary-800">{{ le.required_majority }} votes</strong>, whatever the number present.
        </p>
        <div class="flex flex-wrap gap-2 mb-4">
          <span v-for="g in seatGroups(le)" :key="g" class="text-[11px] rounded-full px-2.5 py-1 ring-1"
            :class="le.contested[g] ? 'ring-accent-300 bg-accent-50 text-accent-800' : 'ring-primary-200 bg-primary-50 text-primary-600'">
            {{ groupShort(g) }}: {{ le.seats[g] }} seat{{ le.seats[g] === 1 ? '' : 's' }} · {{ le.contested[g] ? 'contested' : 'clean slate' }}
          </span>
        </div>

        <div class="space-y-1.5">
          <div v-for="r in sortedResults" :key="r.iso3 || r.name"
            class="vote-row grid items-center gap-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-primary-300" tabindex="0"
            @mousemove="voteTip(r, $event)" @mouseleave="hide" @focus="voteTip(r, $event)" @blur="hide">
            <span class="truncate" :class="r.elected ? 'font-semibold text-primary-900' : 'text-primary-500'" :title="r.name">
              <span v-if="r.iso2" class="mr-1">{{ isoToFlag(r.iso2) }}</span>{{ r.name }}
            </span>
            <div class="relative h-4 rounded bg-primary-50">
              <div v-if="r.votes != null" class="absolute inset-y-0 left-0 rounded" :style="{ width: pct(r.votes, GA_MEMBERS) + '%', background: groupColor(r.group), opacity: r.elected ? 1 : 0.45 }" />
              <div class="absolute -inset-y-0.5 w-0.5 bg-primary-900" :style="{ left: pct(le.required_majority, GA_MEMBERS) + '%' }" />
            </div>
            <span class="tabular-nums text-right text-xs text-primary-700">
              <template v-if="r.votes != null">{{ r.votes }}</template><template v-else>n/a</template>
              <span v-if="r.elected" class="ml-1 text-[10px] font-semibold" title="Elected">✓</span>
            </span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-primary-500 mt-2">
          <span v-for="g in GROUPS" :key="g" class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" :style="{ background: groupColor(g) }" />{{ groupShort(g) }}</span>
          <span>Black line: {{ le.required_majority }} votes needed · scale 0–{{ GA_MEMBERS }} · ✓ elected</span>
        </div>
        <ul v-if="le.notable.length" class="mt-4 space-y-1 text-sm text-primary-700 list-disc pl-5">
          <li v-for="(n, i) in le.notable" :key="i">{{ n }}</li>
        </ul>
        <p v-if="le.votes_note" class="text-[11px] text-primary-400 mt-3">{{ le.votes_note }}</p>
        <p v-if="le.verification_note" class="text-[11px] text-accent-700 mt-1">{{ le.verification_note }}</p>
        <SourceLine :urls="[le.source, le.votes_source]" :verified="le.verified" />
      </div>

      <!-- ============ Next election ============ -->
      <div v-if="ne" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">Next election: {{ ne.year }} <span class="text-primary-400 font-normal text-base">for {{ ne.term }}</span></h2>
          <span class="text-xs text-primary-400">
            {{ ne.date ? fmtDate(ne.date) : ne.date_text }}<template v-if="daysTo(ne.date) != null"> · {{ daysLabel(daysTo(ne.date)!) }}</template>
          </span>
        </div>
        <p class="text-sm text-primary-500 mb-4">Candidates announced in writing to the General Assembly, by regional group, with the members whose terms end on 31 December {{ ne.year }}.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="g in seatGroups(ne)" :key="g" class="rounded-xl ring-1 ring-primary-200/70 p-3">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-900">
                <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: groupColor(g) }" />{{ groupLabel(g) }}
              </span>
              <span class="text-[11px] shrink-0 rounded-full px-2 py-0.5" :class="statusClass(ne, g)">{{ statusText(ne, g) }}</span>
            </div>
            <div class="text-[11px] text-primary-400 mb-1.5">{{ ne.seats[g] }} seat{{ ne.seats[g] === 1 ? '' : 's' }}</div>
            <ul v-if="(ne.candidates[g] || []).length" class="space-y-1">
              <li v-for="c in ne.candidates[g]" :key="c.iso3 || c.name" class="text-sm text-primary-900">
                <span v-if="c.iso2" class="mr-1">{{ isoToFlag(c.iso2) }}</span>{{ c.name }}
                <span v-if="isIncumbent(c)" class="ml-1 text-[10px] rounded bg-primary-100 text-primary-700 px-1 py-0.5">re-election</span>
                <span v-if="c.endorsed_by_group" class="ml-1 text-[10px] rounded bg-primary-100 text-primary-700 px-1 py-0.5" title="Endorsed by its regional group">endorsed</span>
                <a v-if="c.pledge" :href="c.pledge.url" target="_blank" rel="noopener" class="ml-1 text-[11px] text-primary-400 hover:text-primary-700 underline" :title="`Voluntary pledges: ${c.pledge.symbol}`">pledges</a>
              </li>
            </ul>
            <div v-else class="text-sm text-primary-400">No declared candidate yet</div>
            <div v-if="outgoing(g).length" class="mt-2 pt-2 border-t border-primary-100 text-[11px] text-primary-500">
              Leaving: <span v-for="(o, i) in outgoing(g)" :key="o.iso3 || o.name">{{ o.name }}<template v-if="o.second_term"> (2 terms, not eligible)</template><span v-if="i < outgoing(g).length - 1">, </span></span>
            </div>
          </div>
        </div>
        <ul v-if="ne.notable.length" class="mt-4 space-y-1 text-sm text-primary-700 list-disc pl-5">
          <li v-for="(n, i) in ne.notable" :key="i">{{ n }}</li>
        </ul>
        <p v-if="ne.verification_note" class="text-[11px] text-primary-400 mt-3">{{ ne.verification_note }}</p>
        <SourceLine :urls="[ne.source, ne.secondary_source]" :verified="ne.verified" />
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
interface Member extends CRef { term_end: number; second_term?: boolean }
interface Cand extends CRef { endorsed_by_group?: boolean; pledge?: { symbol: string; url: string } | null; votes?: number | null; elected?: boolean | null; incumbent?: boolean }
interface Election {
  year: number; term: string; date: string | null; date_text: string | null
  seats: Partial<Record<GroupCode, number>>; candidates: Partial<Record<GroupCode, Cand[]>>; contested: Partial<Record<GroupCode, boolean>>
  results: Cand[]; elected?: CRef[]; outgoing?: Member[]; required_majority: number; notable: string[]
  source: string | null; votes_source?: string | null; secondary_source?: string | null
  verified: boolean; verification_note?: string | null; votes_note?: string
}
interface Hrc {
  meta: { updated_at: string; notes: string[]; sources: { title: string; url: string; section: string }[] }
  groups: Record<GroupCode, string>; year: number; seats_by_group: Record<GroupCode, number>; rules: string
  members: Member[]; latest_election: Election; next_election: Election | null
}

withDefaults(defineProps<{ tip?: boolean }>(), { tip: true })

const GROUPS: GroupCode[] = ['AG', 'APG', 'EEG', 'GRULAC', 'WEOG']
const BLUE = '#2a78d6', ORANGE = '#eb6834', AQUA = '#1baf7a', AMBER = '#eda100', RED = '#e34948'
const COLORS = [BLUE, ORANGE, AQUA, AMBER, RED]
const SHORT: Record<GroupCode, string> = { AG: 'Africa', APG: 'Asia-Pacific', EEG: 'E. Europe', GRULAC: 'Latin Am. & Caribbean', WEOG: 'W. Europe & Others' }
const GA_MEMBERS = 193

const { data, pending } = useFetch<Hrc>('/api/un-elections/hrc', { key: 'un-elections-hrc' })
const d = computed(() => data.value || null)
const le = computed(() => d.value!.latest_election)
const ne = computed(() => d.value?.next_election || null)

const groupColor = (g: GroupCode | null | undefined) => (g ? COLORS[GROUPS.indexOf(g)] || '#94a3b8' : '#94a3b8')
const groupShort = (g: GroupCode | null | undefined) => (g ? SHORT[g] || g : '—')
const groupLabel = (g: GroupCode | null | undefined) => (g ? d.value?.groups[g] || g : 'Unknown group')
const seatGroups = (e: Election) => GROUPS.filter(g => (e.seats[g] || 0) > 0)
const pct = (v: number | null | undefined, max: number) => Math.max(0, Math.min(100, ((v || 0) / max) * 100))

const membersByGroup = computed(() => {
  const out: Partial<Record<GroupCode, Member[]>> = {}
  for (const m of d.value?.members || []) if (m.group) (out[m.group] ||= []).push(m)
  for (const g of GROUPS) out[g]?.sort((a, b) => a.term_end - b.term_end || a.name.localeCompare(b.name))
  return out
})
const sortedResults = computed(() => [...(le.value?.results || [])].sort((a, b) =>
  GROUPS.indexOf(a.group as GroupCode) - GROUPS.indexOf(b.group as GroupCode) || (b.votes ?? -1) - (a.votes ?? -1)))

const outgoing = (g: GroupCode) => (ne.value?.outgoing || []).filter(o => o.group === g)
const isIncumbent = (c: Cand) => !!c.incumbent || outgoing(c.group as GroupCode).some(o => o.iso3 === c.iso3)
const nCands = (e: Election, g: GroupCode) => (e.candidates[g] || []).length
function statusText(e: Election, g: GroupCode) {
  const n = nCands(e, g), s = e.seats[g] || 0
  if (!n) return 'No candidate yet'
  if (n > s) return `Contested · ${n} for ${s}`
  if (n === s) return 'Clean slate'
  return `${n} for ${s} seats`
}
function statusClass(e: Election, g: GroupCode) {
  const n = nCands(e, g), s = e.seats[g] || 0
  if (!n) return 'bg-primary-50 text-primary-500'
  if (n > s) return 'bg-accent-50 text-accent-800 ring-1 ring-accent-200'
  return 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
}

const { show, hide } = useVizTip()
function voteTip(r: Cand, e: MouseEvent | FocusEvent) {
  const req = le.value.required_majority
  const lines = [
    { text: r.votes != null ? `${r.votes} votes (needed ${req})` : 'Vote count not available', color: groupColor(r.group) },
    { text: groupLabel(r.group) },
    { text: r.elected ? (r.votes != null ? `Elected · ${r.votes - req} above the majority` : 'Elected') : 'Not elected' },
  ]
  show(e, r.name, lines)
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
    return url.hostname.replace(/^www\./, '') + (url.hostname.endsWith('un.org') && url.pathname.includes('/ga/') ? ' (General Assembly)' : '')
  } catch { return u }
}
</script>

<style scoped>
.vote-row { grid-template-columns: minmax(6.5rem, 10rem) 1fr 3.25rem; }
@media (max-width: 420px) { .vote-row { grid-template-columns: 6rem 1fr 2.75rem; } }
</style>
