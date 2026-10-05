<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
    <VizTip />
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-3">Donor tracker</h1>
    <p class="text-primary-500 mb-2 max-w-3xl">
      Who gives official development assistance (ODA), how much, how close each donor is to the 0.7% of national income target,
      where the money goes, and who is cutting. With the latest news from donor agencies.
    </p>
    <p class="text-primary-400 text-xs mb-8 max-w-3xl">
      Source: <a href="https://data-explorer.oecd.org/" target="_blank" rel="noopener" class="underline hover:text-primary-600">OECD Development Assistance Committee</a> (DAC1, DAC2A, DAC5).
      <template v-if="tmeta">
        ODA is the grant-equivalent measure; changes are in constant {{ tmeta.constant_price_year }} prices.
        <strong v-if="tmeta.preliminary_years?.length" class="font-medium text-primary-500">{{ tmeta.preliminary_years.join(', ') }} figures are preliminary OECD estimates</strong><template v-if="tmeta.preliminary_years?.length"> and will be revised;</template>
        recipient and sector detail runs to {{ tmeta.final_year }}. China and other providers that do not report to the OECD are not covered.
        Updated {{ tmeta.updated_at?.slice(0, 10) }}.
      </template>
    </p>

    <div v-if="pending" class="space-y-4">
      <div v-for="i in 4" :key="i" class="skeleton h-24 rounded-2xl" />
    </div>

    <div v-else-if="!donors.length" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-8 text-center text-primary-500">
      Donor data has not been loaded yet. It is refreshed from the OECD on a schedule.
    </div>

    <template v-else>
      <!-- headline tiles -->
      <div v-if="dacLatest" class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-4">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">DAC members’ ODA, {{ dacLatest.year }}</div>
          <div class="font-serif text-2xl sm:text-3xl font-bold text-primary-900 tabular-nums">{{ aidUsd(dacLatest.oda) }}</div>
          <div v-if="dacLatest.preliminary" class="text-[11px] text-amber-800">preliminary</div>
        </div>
        <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-4">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">Change vs {{ dacPrev?.year }}</div>
          <div class="font-serif text-2xl sm:text-3xl font-bold tabular-nums" :class="dacChange.cls"><span aria-hidden="true" class="text-lg align-middle">{{ dacChange.arrow }}</span> {{ dacChange.text }}</div>
          <div class="text-[11px] text-primary-500">real terms, all DAC members</div>
        </div>
        <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-4">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">DAC ODA / GNI</div>
          <div class="font-serif text-2xl sm:text-3xl font-bold text-primary-900 tabular-nums">{{ aidPct(dacLatest.gni_pct, 2) }}</div>
          <div class="text-[11px] text-primary-500">target 0.7%<template v-if="dacPrev?.gni_pct != null">; {{ aidPct(dacPrev.gni_pct, 2) }} in {{ dacPrev.year }}</template></div>
        </div>
        <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-4">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">Donors cutting</div>
          <div class="font-serif text-2xl sm:text-3xl font-bold text-primary-900 tabular-nums">{{ cutsCount }} <span class="text-base font-normal text-primary-400">of {{ withChange }}</span></div>
          <div class="text-[11px] text-primary-500">{{ metAtTarget }} meet the 0.7% target</div>
        </div>
      </div>

      <!-- league table -->
      <section class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-4 sm:p-6 mb-8 min-w-0">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 class="font-serif text-xl font-bold text-primary-900">Donor league table</h2>
          <span class="text-xs text-primary-400">Latest year reported by each donor</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <div class="flex rounded-lg ring-1 ring-primary-200 overflow-hidden text-[12px]">
            <button v-for="s in SORTS" :key="s.key" type="button" class="px-2.5 py-1.5" :class="sort === s.key ? 'bg-primary-900 text-white' : 'bg-white text-primary-600 hover:bg-primary-50'" :aria-pressed="sort === s.key" @click="sort = s.key">{{ s.label }}</button>
          </div>
          <label class="inline-flex items-center gap-1.5 text-[12px] text-primary-500">
            <input v-model="dacOnly" type="checkbox" class="rounded border-primary-300" /> DAC members only
          </label>
          <input v-model="filter" type="search" placeholder="Filter donors" class="w-full sm:w-44 sm:ml-auto px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-sm focus:outline-none focus:ring-accent-300" />
        </div>
        <div class="overflow-x-auto -mx-1">
          <table class="w-full text-[13px]">
            <thead>
              <tr class="text-[11px] text-primary-400 text-left">
                <th class="font-normal py-1 px-1 w-7">#</th>
                <th class="font-normal py-1 px-1">Donor</th>
                <th class="font-normal py-1 px-1 hidden md:table-cell w-[24%]">ODA</th>
                <th class="font-normal py-1 px-1 text-right md:hidden">ODA</th>
                <th class="font-normal py-1 px-1 hidden sm:table-cell w-[22%]">% of GNI <span class="text-primary-300">(| = 0.7%)</span></th>
                <th class="font-normal py-1 px-1 text-right sm:hidden">%GNI</th>
                <th class="font-normal py-1 px-1 text-right">1-yr</th>
                <th class="font-normal py-1 px-1 text-right hidden sm:table-cell">3-yr</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in tableRows" :key="r.code"
                class="border-t border-primary-100 cursor-pointer hover:bg-primary-50/60"
                :class="donor === r.code ? 'bg-accent-50/60' : ''"
                tabindex="0" @click="pick(r.code)" @keydown.enter="pick(r.code)"
              >
                <td class="py-1.5 px-1 text-primary-400 tabular-nums">{{ i + 1 }}</td>
                <td class="py-1.5 px-1">
                  <span class="whitespace-nowrap"><span v-if="r.iso2" class="mr-1">{{ flag(r) }}</span><span class="text-primary-800">{{ shortName(r.name) }}</span></span>
                  <span v-if="r.latest.preliminary" class="ml-1 text-[10px] text-amber-800" title="Preliminary OECD estimate">{{ r.latest.year }}p</span>
                  <span v-else-if="r.latest.year !== tmeta?.latest_year" class="ml-1 text-[10px] text-primary-400">{{ r.latest.year }}</span>
                </td>
                <td class="py-1.5 px-1 hidden md:table-cell">
                  <div class="flex items-center gap-2" @mousemove="tipRow(r, $event)" @mouseleave="hide">
                    <div class="flex-1 h-3 relative">
                      <div class="absolute inset-y-0 left-0 rounded-r-[4px]" :style="{ width: barW(r.latest.oda, maxOda), background: BLUE }" />
                    </div>
                    <span class="w-14 text-right tabular-nums text-primary-800">{{ aidUsd(r.latest.oda) }}</span>
                  </div>
                </td>
                <td class="py-1.5 px-1 text-right tabular-nums md:hidden">{{ aidUsd(r.latest.oda) }}</td>
                <td class="py-1.5 px-1 hidden sm:table-cell">
                  <div v-if="r.latest.gni_pct != null" class="flex items-center gap-2" @mousemove="tipRow(r, $event)" @mouseleave="hide">
                    <div class="flex-1 h-3 relative">
                      <div class="absolute inset-y-0 left-0 rounded-r-[4px]" :style="{ width: gniW(r.latest.gni_pct), background: ORANGE }" />
                      <div class="absolute -top-0.5 -bottom-0.5 w-0.5 bg-primary-700" :style="{ left: gniW(0.7) }" aria-hidden="true" />
                    </div>
                    <span class="w-11 text-right tabular-nums text-primary-800">{{ aidPct(r.latest.gni_pct, 2) }}</span>
                  </div>
                  <span v-else class="text-[11px] text-primary-300">not reported</span>
                </td>
                <td class="py-1.5 px-1 text-right tabular-nums sm:hidden">{{ r.latest.gni_pct != null ? aidPct(r.latest.gni_pct, 2) : '–' }}</td>
                <td class="py-1.5 px-1 text-right tabular-nums whitespace-nowrap" :class="aidChange(r.latest.change_1y_pct).cls">
                  <span aria-hidden="true">{{ aidChange(r.latest.change_1y_pct).arrow }}</span> {{ aidChange(r.latest.change_1y_pct).text }}
                </td>
                <td class="py-1.5 px-1 text-right tabular-nums whitespace-nowrap hidden sm:table-cell" :class="aidChange(r.latest.change_3y_pct).cls">
                  <span aria-hidden="true">{{ aidChange(r.latest.change_3y_pct).arrow }}</span> {{ aidChange(r.latest.change_3y_pct).text }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-primary-500">
          <span>▲ increase · ▼ cut, in constant prices vs the previous year (1-yr) and three years earlier (3-yr)</span>
          <span><span class="text-amber-800">p</span> = preliminary</span>
          <span>Click a donor for its profile.</span>
        </div>
      </section>

      <!-- cuts tracker -->
      <section class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-4 sm:p-6 mb-8 min-w-0">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 class="font-serif text-xl font-bold text-primary-900">Cuts tracker</h2>
          <div class="flex rounded-lg ring-1 ring-primary-200 overflow-hidden text-[12px]">
            <button type="button" class="px-2.5 py-1.5" :class="span === '1y' ? 'bg-primary-900 text-white' : 'bg-white text-primary-600 hover:bg-primary-50'" :aria-pressed="span === '1y'" @click="span = '1y'">vs previous year</button>
            <button type="button" class="px-2.5 py-1.5" :class="span === '3y' ? 'bg-primary-900 text-white' : 'bg-white text-primary-600 hover:bg-primary-50'" :aria-pressed="span === '3y'" @click="span = '3y'">vs 3 years earlier</button>
          </div>
        </div>
        <p class="text-sm text-primary-500 mb-4">Change in each donor’s ODA in constant prices, largest amounts first.</p>
        <div class="grid md:grid-cols-2 gap-6">
          <div v-for="col in cutCols" :key="col.key" class="min-w-0">
            <div class="text-xs font-medium mb-2" :class="col.key === 'cuts' ? 'text-red-700' : 'text-emerald-700'">
              <span aria-hidden="true">{{ col.key === 'cuts' ? '▼' : '▲' }}</span> {{ col.title }} ({{ col.rows.length }})
            </div>
            <div v-if="!col.rows.length" class="text-sm text-primary-400">None.</div>
            <ul class="space-y-1">
              <li v-for="r in col.rows.slice(0, showAllCuts ? 60 : 10)" :key="r.code" class="grid items-center gap-2" style="grid-template-columns: minmax(0, 8.5rem) 1fr 7.2rem">
                <button type="button" class="text-left text-[13px] text-primary-700 hover:text-accent-700 truncate" @click="pick(r.code)">
                  <span v-if="r.iso2" class="mr-1">{{ flag(r) }}</span>{{ shortName(r.name) }}
                </button>
                <div class="relative h-5 rounded hover:bg-primary-50" tabindex="0" @mousemove="tipCut(r, $event)" @mouseleave="hide" @focus="tipCut(r, $event)" @blur="hide">
                  <div class="absolute left-0 top-1/2 -translate-y-1/2 h-3 rounded-r-[4px]" :style="{ width: barW(Math.abs(r.change_usd), col.max), background: col.key === 'cuts' ? RED : AQUA }" />
                </div>
                <span class="text-right text-[12px] tabular-nums whitespace-nowrap" :class="aidChange(r.change_pct).cls">
                  <span aria-hidden="true">{{ aidChange(r.change_pct).arrow }}</span> {{ aidUsd(Math.abs(r.change_usd)) }} <span class="text-primary-400">({{ aidChange(r.change_pct).text }})</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
        <button v-if="cutCols.some(c => c.rows.length > 10)" type="button" class="mt-3 text-[12px] text-accent-600 hover:text-accent-700" @click="showAllCuts = !showAllCuts">
          {{ showAllCuts ? 'Show fewer' : 'Show all' }}
        </button>
        <p class="text-[11px] text-primary-400 mt-3">
          Changes under $5m are left out. <template v-if="tmeta?.preliminary_years?.length">Where the latest year is {{ tmeta.preliminary_years.join(', ') }}, it is a preliminary estimate.</template>
        </p>
      </section>

      <!-- donor profile -->
      <section class="mb-8 min-w-0" id="profile">
        <div class="flex flex-wrap items-center gap-3 mb-3">
          <h2 class="font-serif text-xl font-bold text-primary-900">Donor profile</h2>
          <select v-model="donor" class="px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-sm bg-white focus:outline-none focus:ring-accent-300 max-w-full" aria-label="Choose a donor">
            <option v-for="o in donorOptions" :key="o.code" :value="o.code">{{ o.name }}</option>
          </select>
        </div>
        <CountryAidProfile v-if="donor" :key="donor" :iso3="donor" embedded :tip="false" :news-limit="4" />
      </section>

      <!-- news -->
      <section class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-4 sm:p-6 min-w-0">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 class="font-serif text-xl font-bold text-primary-900">Donor news</h2>
          <span v-if="newsData?.meta" class="text-xs text-primary-400">Last {{ newsData.meta.window_days }} days · updated {{ newsData.meta.updated_at?.slice(0, 10) }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <select v-model="newsDonor" class="px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-sm bg-white focus:outline-none focus:ring-accent-300 max-w-full" aria-label="Filter news by donor">
            <option value="">All donors</option>
            <option v-for="o in newsData?.donors || []" :key="o.code" :value="o.code">{{ o.name }}</option>
          </select>
          <input v-model="newsQ" type="search" placeholder="Search headlines" class="w-full sm:w-52 px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-sm focus:outline-none focus:ring-accent-300" />
        </div>
        <div class="flex flex-wrap gap-1.5 mb-4">
          <button
            type="button" class="px-2.5 py-1 rounded-full text-[12px] ring-1 transition"
            :class="!topic ? 'bg-primary-900 text-white ring-primary-900' : 'bg-white text-primary-600 ring-primary-200 hover:ring-accent-300'"
            :aria-pressed="!topic" @click="topic = ''"
          >All topics</button>
          <button
            v-for="(label, key) in AID_TOPIC_LABELS" :key="key" type="button"
            class="px-2.5 py-1 rounded-full text-[12px] ring-1 transition"
            :class="topic === key ? 'bg-primary-900 text-white ring-primary-900' : 'bg-white text-primary-600 ring-primary-200 hover:ring-accent-300'"
            :aria-pressed="topic === key" @click="topic = topic === key ? '' : String(key)"
          >{{ label }}<span v-if="newsData?.meta?.topics?.[key]" class="ml-1 opacity-60">{{ newsData.meta.topics[key] }}</span></button>
        </div>

        <div v-if="newsPending && !newsData" class="space-y-2">
          <div v-for="i in 6" :key="i" class="skeleton h-12 rounded-lg" />
        </div>
        <div v-else-if="!newsData?.items?.length" class="text-sm text-primary-400 py-6 text-center">No donor news matches these filters.</div>
        <ul v-else class="divide-y divide-primary-100">
          <li v-for="n in newsData.items" :key="n.id" class="py-3">
            <div class="flex items-start gap-2">
              <span class="text-lg leading-6 shrink-0 w-6 text-center" :title="n.donor_name">{{ n.donor === 'EU' ? '🇪🇺' : n.iso2 ? isoToFlag(n.iso2) : '🌐' }}</span>
              <div class="min-w-0">
                <a :href="n.url" target="_blank" rel="noopener" class="text-[14px] font-medium text-primary-800 hover:text-accent-700">{{ n.title }}</a>
                <p v-if="n.excerpt" class="text-[13px] text-primary-500 mt-0.5 line-clamp-2">{{ n.excerpt }}</p>
                <div class="text-[11px] text-primary-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <button type="button" class="hover:text-accent-700" @click="newsDonor = n.donor">{{ n.donor_name }}</button>
                  <span>· {{ n.source }}</span>
                  <span>· {{ aidDate(n.publishedAt) }}</span>
                  <span v-if="n.via === 'news search'" class="text-primary-300">· via news search</span>
                  <button
                    v-for="t in n.topics" :key="t" type="button"
                    class="px-1.5 rounded-full bg-primary-50 text-primary-500 hover:bg-primary-100" @click="topic = t"
                  >{{ AID_TOPIC_LABELS[t] || t }}</button>
                </div>
              </div>
            </div>
          </li>
        </ul>
        <div v-if="newsData && newsData.total > newsData.items.length" class="mt-3 text-center">
          <button type="button" class="text-[13px] text-accent-600 hover:text-accent-700" @click="newsLimit += 40">
            Show more ({{ newsData.total - newsData.items.length }} more)
          </button>
        </div>
        <p class="text-[11px] text-primary-400 mt-4">
          From donor agencies’ own feeds (AFD, BMZ, EU International Partnerships, UK FCDO, Global Affairs Canada, TİKA) and, for other donors, targeted news searches.
          Topics are assigned automatically from keywords and can be wrong.
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'
import { AID_COLORS, AID_TOPIC_LABELS, aidUsd, aidPct, aidChange, aidDate } from '~/composables/useAidFormat'

interface Latest {
  year: number; preliminary: boolean; oda: number | null; oda_real: number | null; gni_pct: number | null
  prev_year: number | null; change_1y_pct: number | null; change_1y_usd: number | null
  base3_year: number | null; change_3y_pct: number | null; change_3y_usd: number | null
  rank_volume?: number; rank_gni?: number
}
interface DonorRow { code: string; iso2: string | null; name: string; kind: string; dac_member: boolean; latest: Latest }
interface ChangeRow { code: string; iso2: string | null; name: string; year: number; from_year: number; preliminary: boolean; change_usd: number; change_pct: number; oda: number | null }
interface DacYear { year: number; oda?: number; oda_real?: number; gni_pct?: number; preliminary?: boolean }
interface Overview {
  meta: { tracker: Record<string, any> | null } | null
  donors: DonorRow[]; dac_total: DacYear[]
  cuts: ChangeRow[]; increases: ChangeRow[]; cuts_3y: ChangeRow[]; increases_3y: ChangeRow[]
}
interface NewsItem { id: string; title: string; url: string; source: string; via: string; donor: string; donor_name: string; iso2: string | null; publishedAt: string; excerpt: string; topics: string[] }
interface NewsResp { meta: { updated_at: string; window_days: number; topics: Record<string, number> } | null; donors: { code: string; name: string }[]; items: NewsItem[]; total: number }

useHead({ title: 'Donor tracker — World Country Groups' })

const BLUE = AID_COLORS.blue
const ORANGE = AID_COLORS.orange
const AQUA = AID_COLORS.aqua
const RED = AID_COLORS.red
const SORTS = [{ key: 'oda', label: 'Volume' }, { key: 'gni', label: '% of GNI' }, { key: 'c1', label: '1-yr change' }, { key: 'c3', label: '3-yr change' }] as const

const route = useRoute()
const router = useRouter()
const { show, hide } = useVizTip()

const { data, pending } = useFetch<Overview>('/api/donors')
const donors = computed(() => data.value?.donors ?? [])
const tmeta = computed<Record<string, any> | null>(() => data.value?.meta?.tracker ?? null)

const sort = ref<typeof SORTS[number]['key']>('oda')
const dacOnly = ref(false)
const filter = ref('')
const span = ref<'1y' | '3y'>('1y')
const showAllCuts = ref(false)

const donor = ref(String(route.query.donor || '').toUpperCase())
watch(donors, (list) => {
  if (!donor.value && list.length) donor.value = list[0].code
}, { immediate: true })
watch(donor, (v) => {
  if (v && route.query.donor !== v) router.replace({ query: { ...route.query, donor: v } })
})

function pick(code: string) {
  donor.value = code
  if (typeof document !== 'undefined') document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const flag = (r: { code: string; iso2: string | null }) => (r.code === 'EU' ? '🇪🇺' : r.iso2 ? isoToFlag(r.iso2) : '')
const shortName = (n: string) => n
  .replace('United Kingdom of Great Britain and Northern Ireland', 'United Kingdom')
  .replace('United States of America', 'United States')
  .replace(/^Republic of Korea$/, 'Korea')
  .replace(/\s*\(.*\)$/, '')

const dacSeries = computed(() => (data.value?.dac_total || []).filter(r => r.oda))
const dacLatest = computed(() => dacSeries.value[dacSeries.value.length - 1] ?? null)
const dacPrev = computed(() => dacSeries.value[dacSeries.value.length - 2] ?? null)
const dacChange = computed(() => {
  const a = dacLatest.value?.oda_real, b = dacPrev.value?.oda_real
  return aidChange(a != null && b ? ((a - b) / b) * 100 : null)
})
const withChange = computed(() => donors.value.filter(d => d.latest.change_1y_pct != null).length)
const cutsCount = computed(() => donors.value.filter(d => (d.latest.change_1y_pct ?? 0) <= -0.5).length)
const metAtTarget = computed(() => donors.value.filter(d => d.kind === 'country' && (d.latest.gni_pct ?? 0) >= 0.7).length)

const tableRows = computed(() => {
  const q = filter.value.trim().toLowerCase()
  const rows = donors.value.filter(d => (!dacOnly.value || d.dac_member) && (!q || d.name.toLowerCase().includes(q) || d.code.toLowerCase() === q))
  const key = (d: DonorRow): number | null => sort.value === 'oda' ? d.latest.oda : sort.value === 'gni' ? d.latest.gni_pct : sort.value === 'c1' ? d.latest.change_1y_pct : d.latest.change_3y_pct
  // volume and %GNI: biggest first; changes: biggest cuts first
  const dir = sort.value === 'c1' || sort.value === 'c3' ? 1 : -1
  return [...rows].sort((a, b) => {
    const ka = key(a), kb = key(b)
    if (ka == null && kb == null) return 0
    if (ka == null) return 1
    if (kb == null) return -1
    return dir * (ka - kb)
  })
})
const maxOda = computed(() => Math.max(1, ...donors.value.map(d => d.latest.oda || 0)))
const gniMax = computed(() => Math.max(1.1, ...donors.value.map(d => d.latest.gni_pct || 0)))
const barW = (v: number | null | undefined, max: number) => `${Math.max(0.5, ((v || 0) / (max || 1)) * 100)}%`
const gniW = (v: number) => `${(v / gniMax.value) * 100}%`

const cutCols = computed(() => {
  const cuts = (span.value === '1y' ? data.value?.cuts : data.value?.cuts_3y) || []
  const inc = (span.value === '1y' ? data.value?.increases : data.value?.increases_3y) || []
  const max = Math.max(1, ...cuts.map(r => Math.abs(r.change_usd)), ...inc.map(r => Math.abs(r.change_usd)))
  return [
    { key: 'cuts', title: 'Biggest cuts', rows: cuts, max },
    { key: 'increases', title: 'Biggest increases', rows: inc, max },
  ]
})

const donorOptions = computed(() => [...donors.value].sort((a, b) => shortName(a.name).localeCompare(shortName(b.name))).map(d => ({ code: d.code, name: `${shortName(d.name)}${d.dac_member ? '' : ' (non-DAC)'}` })))

function tipRow(r: DonorRow, e: MouseEvent | FocusEvent) {
  const L = r.latest
  show(e, `${shortName(r.name)}, ${L.year}${L.preliminary ? ' (preliminary)' : ''}`, [
    { text: `ODA: ${aidUsd(L.oda)}${L.rank_volume ? ` (#${L.rank_volume})` : ''}`, color: BLUE },
    { text: `ODA/GNI: ${L.gni_pct != null ? aidPct(L.gni_pct, 2) : 'not reported'}${L.rank_gni ? ` (#${L.rank_gni})` : ''}`, color: ORANGE },
    { text: `vs ${L.prev_year ?? '–'}: ${aidChange(L.change_1y_pct).arrow} ${aidChange(L.change_1y_pct).text}` },
  ])
}
function tipCut(r: ChangeRow, e: MouseEvent | FocusEvent) {
  const c = aidChange(r.change_pct)
  show(e, shortName(r.name), [
    { text: `${r.from_year} → ${r.year}${r.preliminary ? ' (preliminary)' : ''}`, color: r.change_usd < 0 ? RED : AQUA },
    { text: `${c.arrow} ${c.word} of ${aidUsd(Math.abs(r.change_usd))} (${c.text}), constant prices` },
    { text: `ODA ${r.year}: ${aidUsd(r.oda)}` },
  ])
}

// ---- news ----
const newsDonor = ref(String(route.query.news || ''))
const topic = ref('')
const newsQ = ref('')
const newsLimit = ref(40)
const newsQDebounced = ref('')
let tmr: ReturnType<typeof setTimeout> | null = null
watch(newsQ, (v) => { if (tmr) clearTimeout(tmr); tmr = setTimeout(() => { newsQDebounced.value = v }, 300) })
watch([newsDonor, topic, newsQDebounced], () => { newsLimit.value = 40 })
const { data: newsData, pending: newsPending } = useFetch<NewsResp>('/api/donors/news', {
  query: computed(() => ({ donor: newsDonor.value || undefined, topic: topic.value || undefined, q: newsQDebounced.value || undefined, limit: newsLimit.value })),
})
</script>
