<template>
  <section class="space-y-5">
    <VizTip v-if="tip" />

    <div v-if="pending" class="space-y-3">
      <div class="skeleton h-40 rounded-2xl" />
      <div class="skeleton h-64 rounded-2xl" />
    </div>
    <div v-else-if="!d" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 text-sm text-primary-600">
      Security Council election data is not available yet.
    </div>

    <template v-else>
      <!-- ============ Current composition ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">Security Council in {{ d.year }}</h2>
          <span class="text-xs text-primary-400">Updated {{ fmtDate(d.meta.updated_at) }}</span>
        </div>
        <p class="text-sm text-primary-500 mb-4">
          Five permanent members and ten elected members serving two-year terms, grouped by UN regional group.
          <span v-if="d.incoming.length">Members elected in {{ d.latest_election.year }} join on 1 January {{ d.latest_election.year + 1 }}.</span>
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div v-for="(g, gi) in GROUPS" :key="g" class="rounded-xl bg-primary-50/70 p-3">
            <div class="flex items-center gap-1.5 mb-2">
              <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: COLORS[gi] }" />
              <span class="text-[11px] font-semibold uppercase tracking-wider text-primary-700">{{ groupShort(g) }}</span>
            </div>
            <ul class="space-y-1">
              <li v-for="m in compByGroup[g]" :key="m.iso3 || m.name" class="flex items-center justify-between gap-2 text-sm">
                <span class="truncate text-primary-900" :title="m.name">
                  <span v-if="m.iso2" class="mr-1">{{ isoToFlag(m.iso2) }}</span>{{ m.name }}
                </span>
                <span v-if="m.permanent" class="shrink-0 text-[10px] font-semibold rounded bg-primary-200/70 text-primary-700 px-1.5 py-0.5">P5</span>
                <span v-else class="shrink-0 text-[11px] tabular-nums" :class="m.term_end === d.year ? 'text-accent-700 font-semibold' : 'text-primary-500'"
                  :title="m.term_end === d.year ? `Term ends 31 December ${m.term_end}` : `Term ${m.term_start}–${m.term_end}`">
                  to {{ m.term_end }}
                </span>
              </li>
              <li v-if="!compByGroup[g]?.length" class="text-xs text-primary-400">—</li>
            </ul>
            <div v-if="incomingByGroup[g]?.length" class="mt-2 pt-2 border-t border-primary-200/70">
              <div class="text-[10px] uppercase tracking-wider text-primary-400 mb-1">Joining {{ d.latest_election.year + 1 }}</div>
              <div v-for="m in incomingByGroup[g]" :key="m.iso3 || m.name" class="text-sm text-primary-800 truncate">
                <span v-if="m.iso2" class="mr-1">{{ isoToFlag(m.iso2) }}</span>{{ m.name }}
                <span class="text-[11px] text-primary-400">{{ m.term_start }}–{{ String(m.term_end).slice(2) }}</span>
              </div>
            </div>
          </div>
        </div>
        <p class="text-[11px] text-primary-400 mt-3">“to {{ d.year }}” in bold: term ends this year.</p>
      </div>

      <!-- ============ Latest election ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">{{ le.year }} election <span class="text-primary-400 font-normal text-base">for {{ le.term }}</span></h2>
          <span class="text-xs text-primary-400">{{ le.date ? fmtDate(le.date) : le.date_text }}</span>
        </div>
        <p class="text-sm text-primary-500 mb-3">
          Elected:
          <span v-for="(e, i) in le.elected" :key="e.iso3 || e.name"><span v-if="e.iso2">{{ isoToFlag(e.iso2) }} </span><strong class="text-primary-800">{{ e.name }}</strong><span v-if="i < le.elected.length - 1">, </span></span>.
          A candidate needs two-thirds of the members present and voting.
        </p>
        <div class="flex flex-wrap gap-2 mb-4">
          <span v-for="g in seatGroups(le)" :key="g" class="text-[11px] rounded-full px-2.5 py-1 ring-1"
            :class="le.contested[g] ? 'ring-accent-300 bg-accent-50 text-accent-800' : 'ring-primary-200 bg-primary-50 text-primary-600'">
            {{ groupShort(g) }}: {{ le.seats[g] }} seat{{ le.seats[g] === 1 ? '' : 's' }} · {{ le.contested[g] ? 'contested' : 'clean slate' }}
            <template v-if="(le.rounds_by_group[g] || 0) > 1"> · {{ le.rounds_by_group[g] }} rounds</template>
          </span>
        </div>

        <div class="space-y-6">
          <div v-for="(b, bi) in le.ballots || []" :key="bi">
            <h3 class="font-serif text-base font-semibold text-primary-900 mb-2">{{ b.label }}</h3>
            <div v-for="r in b.rounds" :key="r.round" class="mb-3">
              <div v-if="b.rounds.length > 1" class="text-[11px] uppercase tracking-wider text-primary-400 mb-1">{{ r.label }}</div>
              <div class="space-y-1.5">
                <div v-for="v in r.votes.filter(x => (x.votes ?? 0) > 0)" :key="v.iso3 || v.name"
                  class="vote-row grid items-center gap-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-primary-300" tabindex="0"
                  @mousemove="voteTip(v, r, $event)" @mouseleave="hide" @focus="voteTip(v, r, $event)" @blur="hide">
                  <span class="truncate" :class="isWinner(v.iso3) ? 'font-semibold text-primary-900' : 'text-primary-600'" :title="v.name">
                    <span v-if="v.iso2" class="mr-1">{{ isoToFlag(v.iso2) }}</span>{{ v.name }}
                  </span>
                  <div class="relative h-4 rounded bg-primary-50">
                    <div class="absolute inset-y-0 left-0 rounded" :style="{ width: pct(v.votes, scaleMax(r)) + '%', background: groupColor(v.group), opacity: isWinner(v.iso3) ? 1 : 0.45 }" />
                    <div v-if="r.required_majority" class="absolute -inset-y-0.5 w-0.5 bg-primary-900" :style="{ left: pct(r.required_majority, scaleMax(r)) + '%' }" />
                  </div>
                  <span class="tabular-nums text-right text-xs text-primary-700">
                    {{ v.votes }}<span v-if="isWinner(v.iso3) && (v.votes ?? 0) >= (r.required_majority ?? Infinity)" class="ml-1 text-[10px] font-semibold text-primary-700" title="Reached the required majority">✓</span>
                  </span>
                </div>
              </div>
              <div class="text-[11px] text-primary-400 mt-1">
                Black line: required majority {{ r.required_majority ?? '—' }} of {{ r.present_and_voting ?? '—' }} present and voting<span v-if="r.abstentions"> · {{ r.abstentions }} abstentions</span>
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-primary-500 mt-2">
          <span v-for="(g, gi) in GROUPS" :key="g" class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" :style="{ background: COLORS[gi] }" />{{ groupShort(g) }}</span>
          <span>Faded bar = not elected · ✓ = reached the majority</span>
        </div>
        <SourceLine :urls="[le.source, le.scr_check?.checked ? le.scr_check.url : null]" :verified="le.verified" />
      </div>

      <!-- ============ Next election ============ -->
      <div v-if="ne" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">Next election: {{ ne.year }} <span class="text-primary-400 font-normal text-base">for {{ ne.term }}</span></h2>
          <span class="text-xs text-primary-400">{{ ne.date_note }}</span>
        </div>
        <p class="text-sm text-primary-500 mb-4">Declared candidacies by regional group. Countries often announce bids many years ahead; lists change until the vote.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="g in seatGroups(ne)" :key="g" class="rounded-xl ring-1 ring-primary-200/70 p-3">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-900">
                <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: groupColor(g) }" />{{ groupLabel(g) }}
              </span>
              <span class="text-[11px] shrink-0 rounded-full px-2 py-0.5" :class="statusClass(ne, g)">{{ statusText(ne, g) }}</span>
            </div>
            <div class="text-[11px] text-primary-400 mb-1.5">{{ ne.seats[g] }} seat{{ ne.seats[g] === 1 ? '' : 's' }}<template v-if="outgoing(g).length"> · replacing {{ outgoing(g).join(', ') }}</template></div>
            <ul v-if="(ne.candidates[g] || []).length" class="space-y-1">
              <li v-for="c in ne.candidates[g]" :key="c.iso3 || c.name" class="text-sm" :class="c.withdrawn ? 'text-primary-400 line-through' : 'text-primary-900'">
                <span v-if="c.iso2" class="mr-1">{{ isoToFlag(c.iso2) }}</span>{{ c.name }}
                <span v-if="c.withdrawn" class="no-underline text-[11px]"> (withdrawn)</span>
                <a v-for="(r, ri) in c.refs.filter(x => x.url)" :key="ri" :href="r.url!" target="_blank" rel="noopener" class="ml-1 text-[11px] text-primary-400 hover:text-primary-700 underline" :title="r.text">source</a>
              </li>
            </ul>
            <div v-else class="text-sm text-primary-400">No declared candidate yet</div>
          </div>
        </div>
        <p v-if="ne.verification_note" class="text-[11px] text-primary-400 mt-3">Unverified: {{ ne.verification_note }}</p>
        <SourceLine :urls="[ne.source]" :verified="false" />
      </div>

      <!-- ============ History ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-1">Past elections</h2>
        <p class="text-sm text-primary-500 mb-3">Winners by year; contested races and the number of ballot rounds they needed.</p>
        <div class="overflow-x-auto -mx-1">
          <table class="w-full text-sm min-w-[560px]">
            <thead>
              <tr class="text-left text-[11px] uppercase tracking-wider text-primary-400 border-b border-primary-200/70">
                <th class="py-2 px-1 font-medium">Year</th>
                <th class="py-2 px-1 font-medium">Elected</th>
                <th class="py-2 px-1 font-medium">Defeated</th>
                <th class="py-2 px-1 font-medium">Rounds</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in d.history" :key="h.year" class="border-b border-primary-100 align-top">
                <td class="py-2 px-1 whitespace-nowrap">
                  <a :href="h.source" target="_blank" rel="noopener" class="font-semibold text-primary-900 hover:underline">{{ h.year }}</a>
                  <div class="text-[11px] text-primary-400">{{ h.term }}</div>
                </td>
                <td class="py-2 px-1">
                  <span v-for="e in h.elected" :key="e.iso3 || e.name" class="inline-flex items-center gap-1 mr-2 mb-0.5 whitespace-nowrap">
                    <span class="w-1.5 h-1.5 rounded-full" :style="{ background: groupColor(e.group) }" :title="groupLabel(e.group)" />
                    <span v-if="e.iso2">{{ isoToFlag(e.iso2) }}</span>{{ e.name }}
                  </span>
                </td>
                <td class="py-2 px-1 text-primary-500">
                  <span v-for="e in h.unsuccessful" :key="e.iso3 || e.name" class="whitespace-nowrap mr-2"><span v-if="e.iso2">{{ isoToFlag(e.iso2) }} </span>{{ e.name }}</span>
                  <span v-if="!h.unsuccessful.length" class="text-primary-300">—</span>
                </td>
                <td class="py-2 px-1">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="g in h.contested_groups" :key="g" class="text-[11px] rounded px-1.5 py-0.5 bg-accent-50 text-accent-800 whitespace-nowrap"
                      @mousemove="show($event, `${h.year}: ${groupLabel(g)}`, [{ text: `Contested · ${h.rounds_by_group[g] ?? 1} round(s)`, color: groupColor(g) }])" @mouseleave="hide">
                      {{ groupShort(g) }} · {{ h.rounds_by_group[g] ?? 1 }}
                    </span>
                    <span v-if="!h.contested_groups.length" class="text-[11px] text-primary-400">all clean slates</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============ Country lookup ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-1">A country’s record</h2>
        <p class="text-sm text-primary-500 mb-3">Elected terms on the Council since 1946.</p>
        <input v-model="q" list="sc-countries" type="search" placeholder="Search a country…" aria-label="Search a country"
          class="w-full sm:w-80 rounded-xl ring-1 ring-primary-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
        <datalist id="sc-countries">
          <option v-for="c in d.countries" :key="c.iso3" :value="c.name" />
        </datalist>
        <div v-if="picked" class="mt-4">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
            <span class="font-serif text-lg font-semibold text-primary-900"><span v-if="picked.iso2" class="mr-1">{{ isoToFlag(picked.iso2) }}</span>{{ picked.name }}</span>
            <span v-if="picked.group" class="text-xs text-primary-500">{{ groupLabel(picked.group) }}</span>
            <span v-if="picked.permanent" class="text-[11px] font-semibold rounded bg-primary-200/70 text-primary-700 px-1.5 py-0.5">Permanent member</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <div class="rounded-xl bg-primary-50 px-3 py-2">
              <div class="text-[11px] uppercase tracking-wider text-primary-400">Elected terms</div>
              <div class="font-serif text-2xl font-bold text-primary-900 tabular-nums">{{ picked.count }}</div>
            </div>
            <div class="rounded-xl bg-primary-50 px-3 py-2">
              <div class="text-[11px] uppercase tracking-wider text-primary-400">Last term</div>
              <div class="font-serif text-xl font-bold text-primary-900 tabular-nums">{{ picked.last_term || 'never' }}</div>
            </div>
            <div v-if="picked.candidacies.length" class="rounded-xl bg-primary-50 px-3 py-2 col-span-2 sm:col-span-1">
              <div class="text-[11px] uppercase tracking-wider text-primary-400">Recent races</div>
              <div class="text-sm text-primary-800">
                <span v-for="(c, i) in picked.candidacies" :key="c.year">{{ c.year }} {{ c.outcome === 'lost' ? 'lost' : c.outcome === 'upcoming' ? 'candidate' : 'won' }}<span v-if="i < picked.candidacies.length - 1">, </span></span>
              </div>
            </div>
          </div>
          <!-- timeline 1946..last -->
          <svg v-if="picked.terms.length" :viewBox="`0 0 ${TW} 34`" class="w-full h-auto" role="img" :aria-label="`${picked.name}'s Security Council terms: ${picked.terms.map(t => t.start + '–' + t.end).join(', ')}`">
            <line :x1="8" :x2="TW - 8" y1="14" y2="14" stroke="#e2e8f0" stroke-width="2" />
            <rect v-for="t in picked.terms" :key="t.start" :x="tx(t.start)" y="7" :width="Math.max(4, tx(t.end + 1) - tx(t.start) - 1)" height="14" rx="3"
              :fill="t.status === 'served' ? BLUE : t.status === 'serving' ? ORANGE : AQUA"
              @mousemove="show($event, `${t.start}–${t.end}`, [{ text: t.status === 'served' ? 'Served' : t.status === 'serving' ? 'Serving now' : 'Elected, not yet seated', color: t.status === 'served' ? BLUE : t.status === 'serving' ? ORANGE : AQUA }])" @mouseleave="hide" />
            <text v-for="y in [1950, 1970, 1990, 2010]" :key="y" :x="tx(y)" y="32" font-size="9" fill="#94a3b8" text-anchor="middle">{{ y }}</text>
            <text :x="TW - 8" y="32" font-size="9" fill="#94a3b8" text-anchor="end">{{ TEND }}</text>
          </svg>
          <div v-if="picked.terms.length" class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-primary-500 mt-1">
            <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" :style="{ background: BLUE }" />Served</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" :style="{ background: ORANGE }" />Serving</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" :style="{ background: AQUA }" />Elected, not yet seated</span>
            <span>Terms: {{ picked.terms.map(t => t.start === t.end ? t.start : `${t.start}–${String(t.end).slice(2)}`).join(', ') }}</span>
          </div>
        </div>
        <div v-else-if="q.trim().length > 1" class="mt-3 text-sm text-primary-500">
          No elected term found for “{{ q }}”. It may never have served on the Council.
        </div>
        <div v-else class="mt-3 flex flex-wrap gap-1.5">
          <span class="text-[11px] text-primary-400 mr-1 self-center">Most terms:</span>
          <button v-for="c in d.countries.slice(0, 6)" :key="c.iso3" type="button" class="text-xs rounded-full px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700" @click="q = c.name">
            <span v-if="c.iso2" class="mr-0.5">{{ isoToFlag(c.iso2) }}</span>{{ c.name }} · {{ c.count }}
          </button>
        </div>
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
interface Member extends CRef { permanent: boolean; term_start: number | null; term_end: number | null }
interface Vote extends CRef { votes: number | null; declared?: boolean }
interface Round { round: number; label: string; present_and_voting: number | null; required_majority: number | null; abstentions: number | null; valid_ballots: number | null; votes: Vote[] }
interface Cand extends CRef { note: string | null; withdrawn: boolean; refs: { text: string; url: string | null }[] }
interface Election {
  year: number; term: string; date: string | null; date_text: string | null; date_note?: string
  seats: Partial<Record<GroupCode, number>>; candidates: Partial<Record<GroupCode, Cand[]>>; contested: Partial<Record<GroupCode, boolean | null>>
  outgoing: CRef[]; elected: CRef[]; unsuccessful: CRef[]; ballots?: { label: string; groups: GroupCode[]; rounds: Round[] }[]
  rounds_by_group: Partial<Record<GroupCode, number>>; source: string; verified?: boolean; verification_note?: string
  scr_check?: { url: string; checked: boolean }
}
interface CountryTerms {
  iso3: string; iso2: string | null; name: string; group: GroupCode | null; permanent: boolean
  terms: { start: number; end: number; status: 'served' | 'serving' | 'elected' }[]; count: number; last_term: string | null
  candidacies: { year: number; term: string; outcome: 'elected' | 'lost' | 'upcoming' }[]
}
interface Council {
  meta: { updated_at: string; notes: string[]; sources: { title: string; url: string; section: string }[] }
  groups: Record<GroupCode, string>; year: number; composition: Member[]; incoming: Member[]
  latest_election: Election; next_election: Election | null
  history: { year: number; term: string; elected: CRef[]; unsuccessful: CRef[]; contested_groups: GroupCode[]; rounds_by_group: Partial<Record<GroupCode, number>>; source: string }[]
  countries: CountryTerms[]
}

withDefaults(defineProps<{ tip?: boolean }>(), { tip: true })

const GROUPS: GroupCode[] = ['AG', 'APG', 'EEG', 'GRULAC', 'WEOG']
const BLUE = '#2a78d6', ORANGE = '#eb6834', AQUA = '#1baf7a', AMBER = '#eda100', RED = '#e34948'
const COLORS = [BLUE, ORANGE, AQUA, AMBER, RED]
const SHORT: Record<GroupCode, string> = { AG: 'Africa', APG: 'Asia-Pacific', EEG: 'E. Europe', GRULAC: 'Latin Am. & Caribbean', WEOG: 'W. Europe & Others' }

const { data, pending } = useFetch<Council>('/api/un-elections/council', { key: 'un-elections-council' })
const d = computed(() => data.value || null)
const le = computed(() => d.value!.latest_election)
const ne = computed(() => d.value?.next_election || null)

const groupColor = (g: GroupCode | null | undefined) => (g ? COLORS[GROUPS.indexOf(g)] || '#94a3b8' : '#94a3b8')
const groupShort = (g: GroupCode | null | undefined) => (g ? SHORT[g] || g : '—')
const groupLabel = (g: GroupCode | null | undefined) => (g ? d.value?.groups[g] || g : 'Unknown group')
const seatGroups = (e: Election) => GROUPS.filter(g => (e.seats[g] || 0) > 0)

const byGroup = (list: Member[]) => {
  const out: Partial<Record<GroupCode, Member[]>> = {}
  for (const m of list) if (m.group) (out[m.group] ||= []).push(m)
  for (const g of GROUPS) out[g]?.sort((a, b) => Number(b.permanent) - Number(a.permanent) || (a.term_end ?? 0) - (b.term_end ?? 0) || a.name.localeCompare(b.name))
  return out
}
const compByGroup = computed(() => byGroup(d.value?.composition || []))
const incomingByGroup = computed(() => byGroup(d.value?.incoming || []))

const winners = computed(() => new Set((d.value?.latest_election.elected || []).map(e => e.iso3)))
const isWinner = (iso3: string | null) => !!iso3 && winners.value.has(iso3)
const scaleMax = (r: Round) => Math.max(r.present_and_voting || 0, r.valid_ballots || 0, ...r.votes.map(v => v.votes || 0), 1)
const pct = (v: number | null | undefined, max: number) => Math.max(0, Math.min(100, ((v || 0) / max) * 100))

const outgoing = (g: GroupCode) => (ne.value?.outgoing || []).filter(o => o.group === g).map(o => o.name)
const liveCands = (e: Election, g: GroupCode) => (e.candidates[g] || []).filter(c => !c.withdrawn).length
function statusText(e: Election, g: GroupCode) {
  const n = liveCands(e, g), s = e.seats[g] || 0
  if (!n) return 'No candidate yet'
  if (n > s) return `Contested · ${n} for ${s}`
  if (n === s) return 'Clean slate'
  return `${n} for ${s} seats`
}
function statusClass(e: Election, g: GroupCode) {
  const n = liveCands(e, g), s = e.seats[g] || 0
  if (!n) return 'bg-primary-50 text-primary-500'
  if (n > s) return 'bg-accent-50 text-accent-800 ring-1 ring-accent-200'
  return 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
}

const { show, hide } = useVizTip()
function voteTip(v: Vote, r: Round, e: MouseEvent | FocusEvent) {
  const lines = [
    { text: `${v.votes} votes${r.present_and_voting ? ` of ${r.present_and_voting} present and voting` : ''}`, color: groupColor(v.group) },
    { text: `Required majority: ${r.required_majority ?? '—'}` },
    { text: isWinner(v.iso3) ? 'Elected' : v.declared === false ? 'Not a declared candidate' : 'Not elected' },
  ]
  if (v.group) lines.splice(1, 0, { text: groupLabel(v.group) })
  show(e, `${v.name} · ${r.label}`, lines)
}

// country lookup
const q = ref('')
const fold = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const picked = computed<CountryTerms | null>(() => {
  const s = fold(q.value)
  if (s.length < 2 || !d.value) return null
  const list = d.value.countries
  return list.find(c => fold(c.name) === s || c.iso3.toLowerCase() === s)
    || list.find(c => fold(c.name).startsWith(s))
    || list.find(c => fold(c.name).includes(s)) || null
})
const TW = 640, TSTART = 1946
const TEND = computed(() => Math.max((d.value?.year || 2026) + 2, ...(d.value?.incoming || []).map(m => m.term_end || 0)))
const tx = (y: number) => 8 + ((y - TSTART) / (TEND.value + 1 - TSTART)) * (TW - 16)

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
      p.verified ? 'Cross-checked. Sources: ' : 'Source: ',
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
.vote-row { grid-template-columns: minmax(6.5rem, 10rem) 1fr 3.25rem; }
@media (max-width: 420px) { .vote-row { grid-template-columns: 6rem 1fr 2.75rem; } }
</style>
