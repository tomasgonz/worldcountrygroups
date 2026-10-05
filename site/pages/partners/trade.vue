<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
    <VizTip />
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-3">Emerging trading partners</h1>
    <p class="text-primary-500 mb-2 max-w-3xl">
      How every country’s trade in goods with the big emerging economies is changing — China, India, Brazil, Türkiye, the Gulf states,
      Russia, Indonesia, South Africa and Mexico — set against the traditional partners: the United States, the EU-27, Japan and the United Kingdom.
    </p>
    <p class="text-primary-400 text-xs mb-8">
      Source: <a href="https://data.imf.org/en/datasets/IMF.STA:IMTS" target="_blank" rel="noopener" class="underline hover:text-primary-600">IMF International Merchandise Trade Statistics</a>.
      <template v-if="meta">
        Annual data to {{ meta.latest_year }} (latest complete year), monthly to {{ monthLabel(meta.latest_month) }}.
        Shares are of each country’s total goods trade (exports + imports). Gaps are filled with partner (mirror) data and IMF estimates.
        Updated {{ meta.last_updated?.slice(0, 10) }}.
      </template>
    </p>

    <div v-if="sumPending" class="space-y-4">
      <div v-for="i in 4" :key="i" class="skeleton h-24 rounded-2xl" />
    </div>

    <div v-else-if="!meta" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-8 text-center text-primary-500">
      Trade data has not been loaded yet. It is refreshed from the IMF on a schedule.
    </div>

    <template v-else>
      <!-- partner picker -->
      <div class="mb-4">
        <div class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-2">Partner</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="p in meta.partners" :key="p.code" type="button"
            class="px-2.5 py-1 rounded-full text-[13px] ring-1 transition"
            :class="partner === p.code ? 'bg-primary-900 text-white ring-primary-900' : p.group === 'emerging' ? 'bg-white text-primary-700 ring-primary-200 hover:ring-accent-300' : 'bg-primary-50 text-primary-500 ring-primary-200 hover:ring-accent-300'"
            :aria-pressed="partner === p.code"
            @click="partner = p.code"
          >
            <span v-if="p.iso2" class="mr-1">{{ isoToFlag(p.iso2) }}</span>{{ shortName(p.name) }}
          </button>
        </div>
        <div class="text-[11px] text-primary-400 mt-1.5">Grey: traditional partners, for comparison.</div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6 mb-10">
        <!-- ranked table -->
        <section class="lg:col-span-2 bg-white rounded-2xl ring-1 ring-primary-200/70 p-4 sm:p-6 min-w-0">
          <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
            <h2 class="font-serif text-xl font-bold text-primary-900">
              Who trades most with {{ view ? shortName(view.partner.name) : '…' }}
            </h2>
            <span class="text-xs text-primary-400">{{ meta.latest_year }}, share of each country’s goods trade</span>
          </div>
          <p v-if="view" class="text-sm text-primary-500 mb-4">
            {{ shortName(view.partner.name) }} is the largest of the tracked partners for {{ view.top_partner_for.length }} {{ view.top_partner_for.length === 1 ? 'country' : 'countries' }}<template v-if="view.partner.group === 'emerging'">,
            and the leading emerging partner for {{ view.top_emerging_for.length }}</template>.
          </p>

          <div class="flex flex-wrap items-center gap-2 mb-3">
            <input v-model="filter" type="search" placeholder="Filter countries" class="w-full sm:w-48 px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-sm focus:outline-none focus:ring-accent-300" />
            <div class="flex rounded-lg ring-1 ring-primary-200 overflow-hidden text-[12px]">
              <button v-for="s in SORTS" :key="s.key" type="button" class="px-2.5 py-1.5" :class="sort === s.key ? 'bg-primary-900 text-white' : 'bg-white text-primary-600 hover:bg-primary-50'" @click="sort = s.key">{{ s.label }}</button>
            </div>
            <label class="inline-flex items-center gap-1.5 text-[12px] text-primary-500">
              <input v-model="bigOnly" type="checkbox" class="rounded border-primary-300" /> Only economies with $5bn+ trade
            </label>
          </div>

          <div v-if="viewPending" class="space-y-2">
            <div v-for="i in 8" :key="i" class="skeleton h-7 rounded-lg" />
          </div>
          <div v-else-if="!rows.length" class="text-sm text-primary-400 py-6 text-center">No countries match.</div>
          <div v-else class="overflow-x-auto -mx-1">
            <table class="w-full text-[13px]">
              <thead>
                <tr class="text-[11px] text-primary-400 text-left">
                  <th class="font-normal py-1 px-1 w-8">#</th>
                  <th class="font-normal py-1 px-1">Country</th>
                  <th class="font-normal py-1 px-1 hidden sm:table-cell w-[36%]">Share of trade</th>
                  <th class="font-normal py-1 px-1 text-right sm:hidden">Share</th>
                  <th class="font-normal py-1 px-1 text-right">5-yr</th>
                  <th class="font-normal py-1 px-1 text-right hidden sm:table-cell">10-yr</th>
                  <th class="font-normal py-1 px-1 text-right hidden md:table-cell">Trade</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(r, i) in shownRows" :key="r.iso3"
                  class="border-t border-primary-100 hover:bg-primary-50 cursor-pointer"
                  :class="country === r.iso3 ? 'bg-accent-50' : ''"
                  tabindex="0"
                  @click="pickCountry(r.iso3)" @keydown.enter="pickCountry(r.iso3)"
                  @mousemove="rowTip(r, $event)" @mouseleave="hide" @focus="rowTip(r, $event)" @blur="hide"
                >
                  <td class="py-1.5 px-1 text-primary-400 tabular-nums">{{ i + 1 }}</td>
                  <td class="py-1.5 px-1 text-primary-800 max-w-[9rem] sm:max-w-none truncate">
                    <span v-if="r.iso2" class="mr-1">{{ isoToFlag(r.iso2) }}</span>{{ r.name }}
                  </td>
                  <td class="py-1.5 px-1 hidden sm:table-cell">
                    <div class="flex items-center gap-2">
                      <div class="relative h-3 flex-1 rounded bg-primary-100/70 overflow-hidden">
                        <div class="absolute inset-y-0 left-0 rounded-r" :style="{ width: barW(r.share), background: view?.partner.group === 'emerging' ? BLUE : ORANGE }" />
                        <div v-if="r.share_5y != null" class="absolute top-0 bottom-0 w-0.5 bg-primary-700" :style="{ left: `calc(${barW(r.share_5y)} - 1px)` }" />
                      </div>
                      <span class="w-11 text-right tabular-nums text-primary-800">{{ pctText(r.share) }}</span>
                    </div>
                  </td>
                  <td class="py-1.5 px-1 text-right tabular-nums text-primary-800 sm:hidden">{{ pctText(r.share) }}</td>
                  <td class="py-1.5 px-1 text-right tabular-nums whitespace-nowrap" :class="changeClass(r.change_5y)">{{ arrow(r.change_5y) }} {{ changeText(r.change_5y) }}</td>
                  <td class="py-1.5 px-1 text-right tabular-nums whitespace-nowrap hidden sm:table-cell" :class="changeClass(r.change_10y)">{{ changeText(r.change_10y) }}</td>
                  <td class="py-1.5 px-1 text-right tabular-nums text-primary-500 hidden md:table-cell">{{ money(r.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2 mt-3 text-[11px] text-primary-400">
            <span>Changes in percentage points since {{ meta.base_5y }} and {{ meta.base_10y }}. The dark tick marks the {{ meta.base_5y }} share. Click a row to see that country below.</span>
            <button v-if="rows.length > shownRows.length || showAll" type="button" class="text-accent-600 hover:text-accent-700 underline" @click="showAll = !showAll">
              {{ showAll ? 'Show fewer' : `Show all ${rows.length}` }}
            </button>
          </div>
        </section>

        <!-- side: partner totals + shifts -->
        <div class="space-y-6 min-w-0">
          <section v-if="view?.totals.length" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-4 sm:p-5">
            <h2 class="font-serif text-lg font-bold text-primary-900 mb-0.5">Trade with {{ shortName(view.partner.name) }}</h2>
            <div class="text-[11px] text-primary-400 mb-3">All reporting countries, exports + imports, US$</div>
            <div class="flex items-end gap-[2px] h-28" role="img" :aria-label="`Total trade with ${view.partner.name} by year`">
              <div
                v-for="t in view.totals" :key="t.year"
                class="flex-1 h-full flex items-end cursor-default rounded-t hover:bg-primary-50" tabindex="0"
                @mousemove="totalTip(t, $event)" @mouseleave="hide" @focus="totalTip(t, $event)" @blur="hide"
              >
                <div class="w-full rounded-t-[4px]" :style="{ height: `${Math.max(2, (t.total / maxTotal) * 100)}%`, background: view.partner.group === 'emerging' ? BLUE : ORANGE }" />
              </div>
            </div>
            <div class="flex justify-between text-[10px] text-primary-400 mt-1">
              <span>{{ view.totals[0].year }}</span>
              <span class="text-primary-600 font-medium">{{ money(view.totals[view.totals.length - 1].total) }} in {{ view.totals[view.totals.length - 1].year }}</span>
              <span>{{ view.totals[view.totals.length - 1].year }}</span>
            </div>
          </section>

          <section class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-4 sm:p-5">
            <h2 class="font-serif text-lg font-bold text-primary-900 mb-0.5">Biggest shifts toward emerging partners</h2>
            <div class="text-[11px] text-primary-400 mb-3">
              Change in the emerging partners’ combined share of trade, {{ meta.base_5y }}–{{ meta.latest_year }}, percentage points.
              Economies with $5bn+ goods trade.
            </div>
            <div class="flex rounded-lg ring-1 ring-primary-200 overflow-hidden text-[12px] mb-3 w-fit">
              <button type="button" class="px-2.5 py-1" :class="shiftDir === 'toward' ? 'bg-primary-900 text-white' : 'bg-white text-primary-600 hover:bg-primary-50'" @click="shiftDir = 'toward'">Toward</button>
              <button type="button" class="px-2.5 py-1" :class="shiftDir === 'away' ? 'bg-primary-900 text-white' : 'bg-white text-primary-600 hover:bg-primary-50'" @click="shiftDir = 'away'">Away</button>
            </div>
            <ul class="space-y-0.5">
              <li
                v-for="s in shiftRows" :key="s.iso3"
                class="grid items-center gap-2 rounded-md px-1 py-1 hover:bg-primary-50 cursor-pointer"
                style="grid-template-columns: minmax(0, 1fr) 5rem 3.25rem"
                tabindex="0"
                @click="pickCountry(s.iso3)" @keydown.enter="pickCountry(s.iso3)"
                @mousemove="shiftTip(s, $event)" @mouseleave="hide" @focus="shiftTip(s, $event)" @blur="hide"
              >
                <span class="text-[13px] text-primary-800 truncate"><span v-if="s.iso2" class="mr-1">{{ isoToFlag(s.iso2) }}</span>{{ s.name }}</span>
                <span class="relative h-2.5 rounded bg-primary-100/70 overflow-hidden">
                  <span class="absolute inset-y-0 left-0 rounded-r" :style="{ width: `${Math.min(100, (Math.abs(s.change_5y) / maxShift) * 100)}%`, background: shiftDir === 'toward' ? BLUE : ORANGE }" />
                </span>
                <span class="text-right text-[12px] tabular-nums" :class="changeClass(s.change_5y)">{{ changeText(s.change_5y) }}</span>
              </li>
            </ul>
            <div v-if="!shiftRows.length" class="text-sm text-primary-400">No data.</div>
          </section>
        </div>
      </div>

      <!-- one country's breakdown -->
      <section id="country" class="scroll-mt-24">
        <div class="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h2 class="font-serif text-2xl font-bold text-primary-900">One country’s partners</h2>
          <label class="flex items-center gap-2 text-sm text-primary-500 w-full sm:w-auto">
            <span class="shrink-0">Country</span>
            <select v-model="country" class="min-w-0 w-0 flex-1 sm:w-64 sm:flex-none px-3 py-1.5 rounded-lg ring-1 ring-primary-200 bg-white text-sm text-primary-800 focus:outline-none focus:ring-accent-300">
              <option value="">Choose a country…</option>
              <option v-for="c in countries" :key="c.iso3" :value="c.iso3">{{ c.name }}</option>
            </select>
          </label>
        </div>
        <CountryTradePartners v-if="country" :iso3="country" :tip="false" />
        <div v-else class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-8 text-center text-sm text-primary-400">
          Pick a country, or click one in the tables above, to see its trade with each emerging and traditional partner.
        </div>
      </section>

      <ul v-if="meta.notes?.length" class="mt-8 space-y-1 text-[11px] text-primary-400 list-disc pl-4 max-w-3xl">
        <li v-for="n in meta.notes" :key="n">{{ n }}</li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

interface Partner { code: string; iso3: string | null; iso2: string | null; name: string; group: 'emerging' | 'traditional' }
interface Meta {
  latest_year: number; base_5y: number; base_10y: number; latest_month: string | null; last_updated: string
  notes: string[]; partners: Partner[]
}
interface Shift { iso3: string; name: string; iso2: string | null; share: number | null; share_5y: number | null; change_5y: number; change_10y: number | null; traditional_change_5y: number | null; biggest_gainer: string | null; biggest_gainer_change: number | null; total_trade: number | null }
interface Row { iso3: string; name: string; iso2: string | null; latest_year: number; total: number | null; share: number | null; share_5y: number | null; share_10y: number | null; change_5y: number | null; change_10y: number | null; export_share: number | null; import_share: number | null; rank_among_tracked: number | null; total_trade: number | null }
interface View { partner: Partner; latest_year: number; totals: { year: number; total: number }[]; top_partner_for: string[]; top_emerging_for: string[]; rows: Row[] }

useHead({ title: 'Emerging trading partners — World Country Groups' })

const BLUE = '#2a78d6'
const ORANGE = '#eb6834'
const SORTS = [{ key: 'share', label: 'Share' }, { key: 'c5', label: '5-yr change' }, { key: 'c10', label: '10-yr change' }] as const
const route = useRoute()
const router = useRouter()

const partner = ref(String(route.query.partner || 'CHN').toUpperCase())
const country = ref(String(route.query.country || '').toUpperCase())
const sort = ref<'share' | 'c5' | 'c10'>('share')
const filter = ref('')
const bigOnly = ref(true)
const showAll = ref(false)
const shiftDir = ref<'toward' | 'away'>('toward')

const { data: summary, pending: sumPending } = useFetch<{ meta: Meta | null; countries: { iso3: string; name: string; iso2: string | null }[]; shifts: { toward: Shift[]; away: Shift[] } }>('/api/trade/summary', { query: { limit: 15 } })
const meta = computed(() => summary.value?.meta ?? null)
const countries = computed(() => summary.value?.countries ?? [])

const { data: viewData, pending: viewPending } = useFetch<{ view: View | null }>('/api/trade/partners', {
  query: computed(() => ({ partner: partner.value })),
  key: computed(() => `trade-view-${partner.value}`),
})
const view = computed(() => viewData.value?.view ?? null)

const rows = computed(() => {
  const q = filter.value.trim().toLowerCase()
  let r = (view.value?.rows || []).filter(x => (!bigOnly.value || (x.total_trade ?? 0) >= 5000) && (!q || x.name.toLowerCase().includes(q) || x.iso3.toLowerCase() === q))
  if (sort.value === 'c5') r = r.filter(x => x.change_5y != null).sort((a, b) => (b.change_5y ?? 0) - (a.change_5y ?? 0))
  else if (sort.value === 'c10') r = r.filter(x => x.change_10y != null).sort((a, b) => (b.change_10y ?? 0) - (a.change_10y ?? 0))
  return r
})
const shownRows = computed(() => (showAll.value ? rows.value : rows.value.slice(0, 25)))
const maxShare = computed(() => Math.max(5, ...shownRows.value.flatMap(r => [r.share ?? 0, r.share_5y ?? 0])))
const barW = (v: number | null) => `${Math.max(0, ((v ?? 0) / maxShare.value) * 100)}%`
const maxTotal = computed(() => Math.max(1, ...(view.value?.totals || []).map(t => t.total)))
const shiftRows = computed(() => (shiftDir.value === 'toward' ? summary.value?.shifts.toward : summary.value?.shifts.away) || [])
const maxShift = computed(() => Math.max(1, ...shiftRows.value.map(s => Math.abs(s.change_5y))))

const pctText = (v: number | null | undefined) => (v == null ? '—' : `${v < 10 ? v.toFixed(1) : Math.round(v)}%`)
const changeText = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}`)
const changeClass = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.5 ? 'text-primary-400' : v > 0 ? 'text-accent-700' : 'text-red-700')
const arrow = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.5 ? '→' : v > 0 ? '↑' : '↓')
function money(v: number | null | undefined) {
  if (v == null) return '—'
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}tn`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}bn`
  return `$${Math.round(v)}m`
}
const shortName = (n: string) => n.replace('United Arab Emirates', 'UAE').replace('European Union (EU-27)', 'EU-27').replace('United Kingdom', 'UK').replace('United States', 'USA')
const partnerName = (code: string | null) => meta.value?.partners.find(p => p.code === code)?.name ?? code ?? ''
function monthLabel(m: string | null | undefined) {
  if (!m) return '—'
  const [y, mm] = m.split('-M')
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

const { show, hide } = useVizTip()
function rowTip(r: Row, e: MouseEvent | FocusEvent) {
  const m = meta.value
  const lines = [
    { text: `${pctText(r.share)} of goods trade in ${r.latest_year}`, color: view.value?.partner.group === 'emerging' ? BLUE : ORANGE },
    { text: `${m?.base_5y}: ${pctText(r.share_5y)} · ${m?.base_10y}: ${pctText(r.share_10y)}` },
    { text: `${pctText(r.export_share)} of exports · ${pctText(r.import_share)} of imports` },
    { text: `Trade ${money(r.total)} of ${money(r.total_trade)} in total` },
  ]
  if (r.rank_among_tracked) lines.push({ text: `#${r.rank_among_tracked} among the tracked partners` })
  show(e, r.name, lines)
}
function totalTip(t: { year: number; total: number }, e: MouseEvent | FocusEvent) {
  show(e, String(t.year), [{ text: `${money(t.total)} traded with ${view.value?.partner.name}`, color: view.value?.partner.group === 'emerging' ? BLUE : ORANGE }])
}
function shiftTip(s: Shift, e: MouseEvent | FocusEvent) {
  const lines = [
    { text: `Emerging partners: ${pctText(s.share_5y)} → ${pctText(s.share)}`, color: BLUE },
    { text: `Traditional partners: ${changeText(s.traditional_change_5y)} pts` },
  ]
  if (s.biggest_gainer) lines.push({ text: `Biggest gain: ${shortName(partnerName(s.biggest_gainer))} (${changeText(s.biggest_gainer_change)} pts)` })
  if (s.change_10y != null) lines.push({ text: `Over 10 years: ${changeText(s.change_10y)} pts` })
  show(e, s.name, lines)
}

function pickCountry(iso3: string) {
  country.value = iso3
  hide()
  nextTick(() => document.getElementById('country')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

watch([partner, country], ([p, c]) => {
  showAll.value = false
  router.replace({ query: { ...route.query, partner: p === 'CHN' ? undefined : p, country: c || undefined } })
})
</script>
