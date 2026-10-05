<template>
  <section class="space-y-5">
    <VizTip v-if="tip" />

    <div v-if="pending" class="space-y-3">
      <div class="skeleton h-40 rounded-2xl" />
      <div class="skeleton h-64 rounded-2xl" />
    </div>
    <div v-else-if="!d" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 text-sm text-primary-600">
      President of the General Assembly data is not available yet.
    </div>

    <template v-else>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- ============ Current PGA ============ -->
        <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
          <div class="text-[11px] uppercase tracking-wider text-primary-400 mb-1">President of the General Assembly · {{ ordinal(cur.session) }} session</div>
          <h2 class="font-serif text-2xl font-bold text-primary-900">
            <NuxtLink v-if="cur.person_slug" :to="`/people/${cur.person_slug}`" class="hover:underline">{{ cur.name }}</NuxtLink>
            <span v-else>{{ cur.name }}</span>
          </h2>
          <div class="text-sm text-primary-600 mt-0.5">
            <span v-if="cur.iso2" class="mr-1">{{ isoToFlag(cur.iso2) }}</span>{{ cur.country }}
            <span class="inline-flex items-center gap-1 ml-2 text-xs text-primary-500"><span class="w-2 h-2 rounded-sm" :style="{ background: groupColor(cur.group) }" />{{ groupLabel(cur.group) }}</span>
          </div>
          <dl class="grid grid-cols-2 gap-3 mt-4">
            <div class="rounded-xl bg-primary-50 px-3 py-2">
              <dt class="text-[11px] uppercase tracking-wider text-primary-400">Term</dt>
              <dd class="text-sm font-semibold text-primary-900">{{ cur.term }}</dd>
            </div>
            <div class="rounded-xl bg-primary-50 px-3 py-2">
              <dt class="text-[11px] uppercase tracking-wider text-primary-400">Elected</dt>
              <dd class="text-sm font-semibold text-primary-900">{{ cur.elected_on ? fmtDate(cur.elected_on) : '—' }}<span class="font-normal text-primary-500">{{ cur.contested ? ' · contested ballot' : ' · by acclamation' }}</span></dd>
            </div>
          </dl>
          <div v-if="cur.vote" class="mt-4">
            <div class="text-[11px] uppercase tracking-wider text-primary-400 mb-1.5">Secret ballot</div>
            <div v-for="(row, i) in voteRows" :key="row.name" class="vote-row grid items-center gap-2 text-sm mb-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-300" tabindex="0"
              @mousemove="show($event, row.name, [{ text: `${row.country}: ${row.votes} votes`, color: i === 0 ? BLUE : ORANGE }, { text: i === 0 ? 'Elected' : 'Runner-up' }])" @mouseleave="hide"
              @focus="show($event, row.name, [{ text: `${row.country}: ${row.votes} votes`, color: i === 0 ? BLUE : ORANGE }])" @blur="hide">
              <span class="truncate" :class="i === 0 ? 'font-semibold text-primary-900' : 'text-primary-600'" :title="`${row.name} (${row.country})`">{{ row.name }} <span class="text-[11px] text-primary-400">{{ row.country }}</span></span>
              <div class="h-4 rounded bg-primary-50 relative"><div class="absolute inset-y-0 left-0 rounded" :style="{ width: (row.votes / voteMax) * 100 + '%', background: i === 0 ? BLUE : ORANGE }" /></div>
              <span class="tabular-nums text-xs text-right text-primary-700">{{ row.votes }}</span>
            </div>
            <div class="text-[11px] text-primary-400">Simple majority of members present and voting.</div>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs">
            <NuxtLink v-if="cur.person_slug" :to="`/people/${cur.person_slug}`" class="text-primary-700 underline hover:text-primary-900">Profile and statements</NuxtLink>
            <a v-if="cur.official_url" :href="cur.official_url" target="_blank" rel="noopener" class="text-primary-700 underline hover:text-primary-900">Official site</a>
            <a v-if="cur.election_url" :href="cur.election_url" target="_blank" rel="noopener" class="text-primary-700 underline hover:text-primary-900">Election page</a>
            <span v-if="cur.verified_official" class="text-primary-400">Confirmed on un.org</span>
          </div>
        </div>

        <!-- ============ Next presidency ============ -->
        <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
          <div class="text-[11px] uppercase tracking-wider text-primary-400 mb-1">Next presidency · {{ ordinal(nx.session) }} session ({{ nx.year }}–{{ String(nx.year + 1).slice(2) }})</div>
          <h2 class="font-serif text-2xl font-bold text-primary-900 flex items-center gap-2">
            <span class="w-3 h-3 rounded-sm shrink-0" :style="{ background: groupColor(nx.group) }" />{{ nx.group_label || 'Group to be confirmed' }}
          </h2>
          <p class="text-sm text-primary-500 mt-1">{{ nx.rule_detail || nx.rule }}</p>
          <div class="rounded-xl bg-primary-50 px-3 py-2 mt-4">
            <div class="text-[11px] uppercase tracking-wider text-primary-400">Election expected</div>
            <div class="text-sm font-semibold text-primary-900">{{ nx.election_expected }}</div>
          </div>
          <div class="mt-4">
            <div class="text-[11px] uppercase tracking-wider text-primary-400 mb-1.5">Declared candidates</div>
            <ul v-if="nx.candidates.length" class="space-y-1">
              <li v-for="c in nx.candidates" :key="c.name" class="text-sm text-primary-900">{{ c.name }} <span class="text-primary-500">· {{ c.country }}</span></li>
            </ul>
            <p v-else class="text-sm text-primary-500">None announced yet.</p>
            <p v-if="nx.candidates_note" class="text-[11px] text-primary-400 mt-1">{{ nx.candidates_note }}</p>
            <a v-if="nx.candidates_source" :href="nx.candidates_source" target="_blank" rel="noopener" class="text-[11px] underline text-primary-500">Official election page</a>
          </div>
        </div>
      </div>

      <!-- ============ Rotation ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-1">Regional rotation</h2>
        <p class="text-sm text-primary-500 mb-4">The presidency passes each year to the next of the five regional groups, in a fixed five-year cycle.</p>
        <ol class="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <li v-for="r in d.rotation" :key="r.session" tabindex="0"
            class="rounded-xl p-2.5 ring-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
            :class="r.status === 'current' ? 'ring-primary-500 bg-primary-50' : r.session === nx.session ? 'ring-accent-400 bg-accent-50/60' : 'ring-primary-200/70'"
            @mousemove="rotTip(r, $event)" @mouseleave="hide" @focus="rotTip(r, $event)" @blur="hide">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[11px] tabular-nums text-primary-500">{{ ordinal(r.session) }} · {{ r.year }}</span>
              <span v-if="r.status === 'current'" class="text-[10px] font-semibold text-primary-700">NOW</span>
              <span v-else-if="r.session === nx.session" class="text-[10px] font-semibold text-accent-800">NEXT</span>
            </div>
            <div class="flex items-center gap-1.5 mt-1">
              <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: groupColor(r.group) }" />
              <span class="text-xs font-semibold text-primary-800 truncate">{{ groupShort(r.group) }}</span>
            </div>
            <div class="text-[11px] mt-0.5 truncate" :class="r.president ? 'text-primary-600' : 'text-primary-300'">
              <template v-if="r.president"><span v-if="r.iso2">{{ isoToFlag(r.iso2) }} </span>{{ r.president }}</template>
              <template v-else>to be elected</template>
            </div>
          </li>
        </ol>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-primary-500 mt-3">
          <span v-for="(g, gi) in GROUPS" :key="g" class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" :style="{ background: COLORS[gi] }" />{{ d.groups[g] }}</span>
        </div>
      </div>

      <!-- ============ List ============ -->
      <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
          <h2 class="font-serif text-xl font-bold text-primary-900">All presidents</h2>
          <span class="text-xs text-primary-400">{{ filtered.length }} of {{ d.list.length }}</span>
        </div>
        <div class="flex flex-wrap gap-2 mb-3">
          <input v-model="q" type="search" placeholder="Name or country…" aria-label="Filter presidents by name or country"
            class="w-full sm:w-64 rounded-xl ring-1 ring-primary-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
          <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter by regional group">
            <button type="button" class="text-xs rounded-full px-2.5 py-1 ring-1" :class="!grp ? 'bg-primary-800 text-white ring-primary-800' : 'ring-primary-200 text-primary-600 hover:bg-primary-50'" :aria-pressed="!grp" @click="grp = null">All</button>
            <button v-for="(g, gi) in GROUPS" :key="g" type="button" class="text-xs rounded-full px-2.5 py-1 ring-1 inline-flex items-center gap-1.5"
              :class="grp === g ? 'bg-primary-800 text-white ring-primary-800' : 'ring-primary-200 text-primary-600 hover:bg-primary-50'" :aria-pressed="grp === g" @click="grp = grp === g ? null : g">
              <span class="w-2 h-2 rounded-sm" :style="{ background: COLORS[gi] }" />{{ groupShort(g) }}
            </button>
          </div>
          <label class="inline-flex items-center gap-1.5 text-xs text-primary-600"><input v-model="contestedOnly" type="checkbox" class="rounded"> Contested only</label>
        </div>
        <div class="overflow-x-auto -mx-1 max-h-[32rem] overflow-y-auto">
          <table class="w-full text-sm min-w-[480px]">
            <thead class="sticky top-0 bg-white">
              <tr class="text-left text-[11px] uppercase tracking-wider text-primary-400 border-b border-primary-200/70">
                <th class="py-2 px-1 font-medium">Year</th>
                <th class="py-2 px-1 font-medium">Session</th>
                <th class="py-2 px-1 font-medium">President</th>
                <th class="py-2 px-1 font-medium">Country</th>
                <th class="py-2 px-1 font-medium">Group</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in filtered" :key="p.year + p.name" class="border-b border-primary-100 align-top" :class="p.session === cur.session ? 'bg-primary-50/70' : ''">
                <td class="py-1.5 px-1 tabular-nums text-primary-600">{{ p.year }}</td>
                <td class="py-1.5 px-1 text-primary-600" :title="p.sessions_text">{{ p.session ? ordinal(p.session) : 'special' }}</td>
                <td class="py-1.5 px-1 text-primary-900">
                  <NuxtLink v-if="p.person_slug" :to="`/people/${p.person_slug}`" class="hover:underline">{{ p.name }}</NuxtLink>
                  <span v-else>{{ p.name }}</span>
                  <span v-if="p.vote" class="ml-1 text-[10px] rounded px-1 py-0.5 bg-accent-50 text-accent-800" :title="`Beat ${p.vote.runner_up} (${p.vote.runner_up_country}) ${p.vote.votes_winner}–${p.vote.votes_runner_up}`">contested {{ p.vote.votes_winner }}–{{ p.vote.votes_runner_up }}</span>
                </td>
                <td class="py-1.5 px-1 text-primary-700 whitespace-nowrap"><span v-if="p.iso2" class="mr-1">{{ isoToFlag(p.iso2) }}</span>{{ p.country }}</td>
                <td class="py-1.5 px-1 whitespace-nowrap">
                  <span class="inline-flex items-center gap-1.5 text-xs text-primary-600" :title="p.group_derived ? `Before 1963 groups were informal (listed as ${p.region_raw}); shown with today's group` : groupLabel(p.group)">
                    <span class="w-2 h-2 rounded-sm" :style="{ background: groupColor(p.group) }" />{{ groupShort(p.group) }}<span v-if="p.group_derived" class="text-primary-300">*</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-[11px] text-primary-400 mt-2">* Before the 1963 regional groups, shown with the country’s current group.</p>
      </div>

      <p class="text-[11px] text-primary-400">
        Sources:
        <template v-for="(s, i) in d.meta.sources" :key="s.url + s.section"><a :href="s.url" target="_blank" rel="noopener" class="underline hover:text-primary-600">{{ s.title }}</a><span v-if="i < d.meta.sources.length - 1"> · </span></template>
        · Updated {{ fmtDate(d.meta.updated_at) }}
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

type GroupCode = 'AG' | 'APG' | 'EEG' | 'GRULAC' | 'WEOG'
interface Vote { year: number; winner: string; winner_country: string; runner_up: string; runner_up_country: string; votes_winner: number; votes_runner_up: number }
interface Pga {
  year: number; session: number | null; sessions_text: string; name: string; country: string; iso3: string | null; iso2: string | null
  region_raw: string; group: GroupCode | null; group_derived: boolean; contested: boolean; person_slug?: string; vote?: Vote
}
interface PgaData {
  meta: { updated_at: string; notes: string[]; sources: { title: string; url: string; section: string }[] }
  groups: Record<GroupCode, string>
  current: Pga & { term: string; official_url: string | null; verified_official: boolean; elected_on: string | null; election_url: string | null }
  next: { session: number; year: number; group: GroupCode | null; group_label: string | null; rule: string; rule_detail?: string; election_expected: string; candidates: { name: string; country: string }[]; candidates_source: string | null; candidates_note: string | null }
  rotation: { session: number; year: number; group: GroupCode | null; president: string | null; country: string | null; iso3: string | null; iso2?: string | null; status: 'past' | 'current' | 'upcoming' }[]
  list: Pga[]
}

withDefaults(defineProps<{ tip?: boolean }>(), { tip: true })

const GROUPS: GroupCode[] = ['AG', 'APG', 'EEG', 'GRULAC', 'WEOG']
const BLUE = '#2a78d6', ORANGE = '#eb6834', AQUA = '#1baf7a', AMBER = '#eda100', RED = '#e34948'
const COLORS = [BLUE, ORANGE, AQUA, AMBER, RED]
const SHORT: Record<GroupCode, string> = { AG: 'Africa', APG: 'Asia-Pacific', EEG: 'E. Europe', GRULAC: 'Latin Am. & Caribbean', WEOG: 'W. Europe & Others' }

const { data, pending } = useFetch<PgaData>('/api/un-elections/pga', { key: 'un-elections-pga' })
const d = computed(() => data.value || null)
const cur = computed(() => d.value!.current)
const nx = computed(() => d.value!.next)

const groupColor = (g: GroupCode | null | undefined) => (g ? COLORS[GROUPS.indexOf(g)] || '#94a3b8' : '#94a3b8')
const groupShort = (g: GroupCode | null | undefined) => (g ? SHORT[g] || g : '—')
const groupLabel = (g: GroupCode | null | undefined) => (g ? d.value?.groups[g] || g : 'Unknown group')

const voteRows = computed(() => {
  const v = cur.value.vote
  if (!v) return []
  return [{ name: v.winner, country: v.winner_country, votes: v.votes_winner }, { name: v.runner_up, country: v.runner_up_country, votes: v.votes_runner_up }]
})
const voteMax = computed(() => Math.max(1, ...voteRows.value.map(r => r.votes)) * 1.1)

const { show, hide } = useVizTip()
function rotTip(r: PgaData['rotation'][number], e: MouseEvent | FocusEvent) {
  const lines: { text: string; color?: string }[] = [
    { text: groupLabel(r.group), color: groupColor(r.group) },
    { text: r.president ? `${r.president} (${r.country})` : r.session === nx.value.session ? 'Next to be elected' : 'Future session' },
  ]
  show(e, `${ordinal(r.session)} session, ${r.year}–${String(r.year + 1).slice(2)}`, lines)
}

const q = ref('')
const grp = ref<GroupCode | null>(null)
const contestedOnly = ref(false)
const fold = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const filtered = computed(() => {
  const s = fold(q.value.trim())
  return (d.value?.list || []).filter(p =>
    (!grp.value || p.group === grp.value)
    && (!contestedOnly.value || p.contested)
    && (!s || fold(p.name).includes(s) || fold(p.country).includes(s)),
  ).slice().reverse()
})

function ordinal(n: number | null | undefined) {
  if (n == null) return ''
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
function fmtDate(s: string | null | undefined) {
  if (!s) return ''
  const dt = new Date(s.length === 10 ? s + 'T12:00:00Z' : s)
  return isNaN(dt.getTime()) ? s : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.vote-row { grid-template-columns: minmax(7rem, 13rem) 1fr 2.5rem; }
@media (max-width: 420px) { .vote-row { grid-template-columns: 7rem 1fr 2.25rem; } }
</style>
