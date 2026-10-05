<template>
  <section class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
    <VizTip v-if="tip" />
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
      <h2 class="font-serif text-xl font-bold text-primary-900">Emerging trading partners</h2>
      <span v-if="c" class="text-xs text-primary-400">Goods trade, {{ c.latest_year }}</span>
    </div>

    <div v-if="pending" class="space-y-3 mt-4">
      <div class="skeleton h-16 rounded-xl" />
      <div class="skeleton h-32 rounded-xl" />
    </div>

    <div v-else-if="!c" class="mt-3 rounded-xl bg-primary-50 px-4 py-6 text-center">
      <div class="text-sm text-primary-600">No partner-level goods trade data for this country.</div>
      <div class="text-xs text-primary-400 mt-1">The IMF trade statistics do not cover it separately{{ meta ? `, or its figures stop before ${meta.latest_year - 3}` : '' }}.</div>
    </div>

    <template v-else>
      <p class="text-sm text-primary-500 mb-4">
        How much of {{ c.name }}’s trade in goods (exports + imports) is with the big emerging economies, compared with the traditional partners.
      </p>

      <!-- headline numbers -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div class="rounded-xl bg-primary-50 px-3 py-2.5">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">Emerging partners</div>
          <div class="font-serif text-2xl font-bold text-primary-900 tabular-nums">{{ pctText(c.emerging.share) }}</div>
          <div class="text-[11px]" :class="changeClass(c.emerging.change_5y)">{{ changeText(c.emerging.change_5y) }} pts since {{ c.latest_year - 5 }}</div>
        </div>
        <div class="rounded-xl bg-primary-50 px-3 py-2.5">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">Traditional</div>
          <div class="font-serif text-2xl font-bold text-primary-900 tabular-nums">{{ pctText(c.traditional.share) }}</div>
          <div class="text-[11px]" :class="changeClass(c.traditional.change_5y)">{{ changeText(c.traditional.change_5y) }} pts since {{ c.latest_year - 5 }}</div>
        </div>
        <div class="rounded-xl bg-primary-50 px-3 py-2.5">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">Top emerging</div>
          <div class="text-[15px] font-semibold text-primary-900 truncate mt-1" :title="topEmerging?.name">
            <span v-if="topEmerging?.iso2" class="mr-1">{{ isoToFlag(topEmerging.iso2) }}</span>{{ topEmerging ? shortName(topEmerging.name) : '—' }}
          </div>
          <div class="text-[11px] text-primary-500">{{ topEmerging ? pctText(topEmerging.share) + ' of trade' : '' }}</div>
        </div>
        <div class="rounded-xl bg-primary-50 px-3 py-2.5">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">Total trade</div>
          <div class="font-serif text-2xl font-bold text-primary-900 tabular-nums">{{ money(c.world.total) }}</div>
          <div class="text-[11px] text-primary-500">{{ c.china_export_share != null ? `${pctText(c.china_export_share)} of exports go to China` : 'exports + imports' }}</div>
        </div>
      </div>

      <!-- trend chart -->
      <div v-if="chart.points.length > 1" class="mb-6">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-primary-500 mb-2">
          <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 rounded" :style="{ background: BLUE }" />Emerging partners combined</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 rounded" :style="{ background: ORANGE }" />Traditional (USA, EU-27, Japan, UK)</span>
          <span class="text-primary-400">share of total goods trade</span>
        </div>
        <svg :viewBox="`0 0 ${W} ${H}`" class="w-full h-auto select-none" role="img" :aria-label="`Emerging partners' share of ${c.name}'s trade, ${chart.points[0].year} to ${c.latest_year}`" @mouseleave="hover = null; hideTip()">
          <g v-for="t in chart.ticks" :key="t">
            <line :x1="PADL" :x2="W - PADR" :y1="chart.y(t)" :y2="chart.y(t)" stroke="#e2e8f0" stroke-width="1" />
            <text :x="PADL - 6" :y="chart.y(t) + 3.5" text-anchor="end" font-size="10" fill="#94a3b8">{{ t }}%</text>
          </g>
          <text v-for="p in chart.labels" :key="p.year" :x="chart.x(p.year)" :y="H - 4" text-anchor="middle" font-size="10" fill="#94a3b8">{{ p.year }}</text>
          <line v-if="hover" :x1="chart.x(hover.year)" :x2="chart.x(hover.year)" :y1="PADT" :y2="H - PADB" stroke="#cbd5e1" stroke-width="1" />
          <path :d="chart.path('em')" fill="none" :stroke="BLUE" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          <path :d="chart.path('tr')" fill="none" :stroke="ORANGE" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          <template v-if="hover">
            <circle v-if="hover.em != null" :cx="chart.x(hover.year)" :cy="chart.y(hover.em)" r="4" :fill="BLUE" stroke="#fff" stroke-width="2" />
            <circle v-if="hover.tr != null" :cx="chart.x(hover.year)" :cy="chart.y(hover.tr)" r="4" :fill="ORANGE" stroke="#fff" stroke-width="2" />
          </template>
          <template v-if="chart.last">
            <text v-if="chart.last.em != null" :x="chart.x(chart.last.year) + 6" :y="chart.labelY.em" font-size="11" fill="#334155" font-weight="600">{{ Math.round(chart.last.em) }}%</text>
            <text v-if="chart.last.tr != null" :x="chart.x(chart.last.year) + 6" :y="chart.labelY.tr" font-size="11" fill="#334155" font-weight="600">{{ Math.round(chart.last.tr) }}%</text>
          </template>
          <rect
            v-for="p in chart.points" :key="'h' + p.year"
            :x="chart.x(p.year) - chart.step / 2" :y="PADT" :width="chart.step" :height="H - PADT - PADB"
            fill="transparent" @mousemove="onHover(p, $event)"
          />
        </svg>
        <p v-if="c.eu_member" class="text-[11px] text-primary-400 mt-1">For EU members the EU-27 figure includes trade with the other member states.</p>
      </div>

      <!-- emerging partners ranked -->
      <h3 class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-2">Emerging partners, {{ c.latest_year }}</h3>
      <div class="tp-grid grid text-[11px] text-primary-400 mb-1 gap-2 px-1">
        <span>Partner</span><span class="hidden sm:block">Share of trade</span><span class="text-right">Trade</span><span class="text-right"><span class="sm:hidden">Share · </span>5-yr</span>
      </div>
      <ul class="mb-5">
        <li v-for="p in emerging" :key="p.code">
          <button
            type="button"
            class="tp-grid grid items-center gap-2 w-full text-left rounded-lg px-1 py-1 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
            :class="open === p.code ? 'bg-accent-50' : ''"
            :aria-expanded="open === p.code"
            @click="toggle(p)" @mousemove="rowTip(p, $event)" @mouseleave="hideTip" @focus="rowTip(p, $event)" @blur="hideTip"
          >
            <span class="text-[13px] text-primary-800 truncate"><span v-if="p.iso2" class="mr-1">{{ isoToFlag(p.iso2) }}</span>{{ shortName(p.name) }}</span>
            <span class="hidden sm:flex items-center gap-2">
              <span class="relative h-3 flex-1 rounded bg-primary-100/70 overflow-hidden">
                <span class="absolute inset-y-0 left-0 rounded-r" :style="{ width: barW(p.share), background: BLUE }" />
                <span v-if="p.share_5y != null" class="absolute top-0 bottom-0 w-0.5 bg-primary-700" :style="{ left: `calc(${barW(p.share_5y)} - 1px)` }" />
              </span>
              <span class="w-12 text-right text-[12px] tabular-nums text-primary-800">{{ pctText(p.share) }}</span>
            </span>
            <span class="text-right text-[12px] tabular-nums text-primary-600">{{ money(p.total) }}</span>
            <span class="text-right text-[12px] tabular-nums whitespace-nowrap" :class="changeClass(p.change_5y)">
              <span class="sm:hidden text-primary-800 mr-1">{{ pctText(p.share) }}</span>{{ arrow(p.change_5y) }} {{ changeText(p.change_5y) }}
            </span>
          </button>
          <div v-if="open === p.code" class="mx-1 mb-2 mt-1 rounded-lg bg-primary-50 px-3 py-2.5 text-[12px] text-primary-600">
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <span>Exports {{ money(p.exports) }} <span class="text-primary-400">({{ pctText(p.export_share) }} of all exports)</span></span>
              <span>Imports {{ money(p.imports) }} <span class="text-primary-400">({{ pctText(p.import_share) }} of all imports)</span></span>
              <span v-if="p.change_10y != null">10-yr: <span :class="changeClass(p.change_10y)">{{ changeText(p.change_10y) }} pts</span></span>
              <span v-if="p.growth_5y != null">Trade growth {{ p.growth_5y > 0 ? '+' : '' }}{{ p.growth_5y }}%/yr</span>
            </div>
            <div v-if="p.iso3" class="mt-2">
              <div v-if="products.loading" class="text-primary-400">Loading main products…</div>
              <div v-else-if="products.error" class="text-primary-400">{{ products.error }}</div>
              <div v-else-if="products.data" class="grid sm:grid-cols-2 gap-3">
                <div v-for="side in (['exports', 'imports'] as const)" :key="side">
                  <div class="text-[11px] uppercase tracking-wider text-primary-400 mb-1">Top {{ side }}{{ products.data.year ? `, ${products.data.year}` : '' }}</div>
                  <ol v-if="products.data[side].length" class="space-y-0.5">
                    <li v-for="r in products.data[side]" :key="r.code" class="flex justify-between gap-2" :title="r.name">
                      <span class="truncate">{{ r.short }}</span><span class="tabular-nums text-primary-500 shrink-0">{{ r.share }}%</span>
                    </li>
                  </ol>
                  <div v-else class="text-primary-400">Not reported.</div>
                </div>
                <div class="sm:col-span-2 text-[10px] text-primary-400">HS chapters, share of the flow with {{ shortName(p.name) }}. Source: UN Comtrade.</div>
              </div>
              <button v-else type="button" class="text-accent-600 hover:text-accent-700 underline" @click="loadProducts(p)">Show main products</button>
            </div>
          </div>
        </li>
      </ul>

      <!-- traditional partners -->
      <h3 class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-2">For comparison: traditional partners</h3>
      <ul class="mb-4">
        <li
          v-for="p in traditional" :key="p.code"
          class="tp-grid grid items-center gap-2 px-1 py-1 rounded-lg hover:bg-primary-50" tabindex="0"
          @mousemove="rowTip(p, $event)" @mouseleave="hideTip" @focus="rowTip(p, $event)" @blur="hideTip"
        >
          <span class="text-[13px] text-primary-800 truncate"><span v-if="p.iso2" class="mr-1">{{ isoToFlag(p.iso2) }}</span>{{ shortName(p.name) }}</span>
          <span class="hidden sm:flex items-center gap-2">
            <span class="relative h-3 flex-1 rounded bg-primary-100/70 overflow-hidden">
              <span class="absolute inset-y-0 left-0 rounded-r" :style="{ width: barW(p.share), background: ORANGE }" />
              <span v-if="p.share_5y != null" class="absolute top-0 bottom-0 w-0.5 bg-primary-700" :style="{ left: `calc(${barW(p.share_5y)} - 1px)` }" />
            </span>
            <span class="w-12 text-right text-[12px] tabular-nums text-primary-800">{{ pctText(p.share) }}</span>
          </span>
          <span class="text-right text-[12px] tabular-nums text-primary-600">{{ money(p.total) }}</span>
          <span class="text-right text-[12px] tabular-nums whitespace-nowrap" :class="changeClass(p.change_5y)">
            <span class="sm:hidden text-primary-800 mr-1">{{ pctText(p.share) }}</span>{{ arrow(p.change_5y) }} {{ changeText(p.change_5y) }}
          </span>
        </li>
      </ul>
      <p class="text-[11px] text-primary-400 mb-3 hidden sm:block">Bars: share of total goods trade; the dark tick marks the share in {{ c.latest_year - 5 }}. 5-yr: change in percentage points.</p>

      <div v-if="ttm && ttm.emerging_share != null" class="rounded-xl bg-accent-50/60 px-3 py-2 text-[12px] text-primary-600 mb-3">
        Latest 12 months (to {{ monthLabel(ttm.last_month) }}): emerging partners {{ pctText(ttm.emerging_share) }} of trade
        <template v-if="ttm.prev_emerging_share != null">, vs {{ pctText(ttm.prev_emerging_share) }} a year earlier</template><template v-if="ttm.china_share != null">; China {{ pctText(ttm.china_share) }}</template>.
      </div>

      <p class="text-[11px] text-primary-400">
        Source: <a href="https://data.imf.org/en/datasets/IMF.STA:IMTS" target="_blank" rel="noopener" class="underline hover:text-primary-600">IMF International Merchandise Trade Statistics</a>.
        Latest complete year {{ c.latest_year }}; partner gaps are filled with mirror data and IMF estimates.
        <NuxtLink :to="`/partners/trade?country=${c.iso3}`" class="text-accent-600 hover:text-accent-700 underline ml-1">Compare countries</NuxtLink>
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

interface PartnerRow {
  code: string; iso3: string | null; iso2: string | null; name: string; group: 'emerging' | 'traditional'
  exports: number | null; imports: number | null; total: number | null
  share: number | null; share_5y: number | null; share_10y: number | null; change_5y: number | null; change_10y: number | null
  export_share: number | null; import_share: number | null; growth_5y: number | null; yoy: number | null
  series: { year: number; share: number | null }[]
}
interface GroupShare { share: number | null; share_5y: number | null; change_5y: number | null; change_10y: number | null; series: { year: number; share: number }[] }
interface CountryTrade {
  iso3: string; name: string; iso2: string | null; latest_year: number
  world: { exports: number | null; imports: number | null; total: number | null }
  emerging: GroupShare; traditional: GroupShare; partners: PartnerRow[]
  top_emerging: string | null; china_export_share: number | null; eu_member: boolean
  monthly: { ttm: { emerging_share: number | null; prev_emerging_share: number | null; china_share: number | null; last_month: string | null } } | null
}
interface ProductRow { code: string; name: string; short: string; value: number; share: number }
interface Products { year: number | null; exports: ProductRow[]; imports: ProductRow[] }

const props = withDefaults(defineProps<{ iso3: string; tip?: boolean }>(), { tip: true })

const BLUE = '#2a78d6'
const ORANGE = '#eb6834'
const W = 640, H = 190, PADL = 34, PADR = 40, PADT = 10, PADB = 22

const { data, pending } = useFetch<{ meta: { latest_year: number } | null; country: CountryTrade | null }>('/api/trade/partners', {
  query: computed(() => ({ iso3: (props.iso3 || '').toUpperCase() })),
  key: computed(() => `trade-partners-${(props.iso3 || '').toUpperCase()}`),
  watch: [() => props.iso3],
})
const c = computed(() => data.value?.country ?? null)
const meta = computed(() => data.value?.meta ?? null)
const emerging = computed(() => (c.value?.partners || []).filter(p => p.group === 'emerging'))
const traditional = computed(() => (c.value?.partners || []).filter(p => p.group === 'traditional'))
const topEmerging = computed(() => emerging.value.find(p => p.code === c.value?.top_emerging) ?? null)
const ttm = computed(() => c.value?.monthly?.ttm ?? null)

const maxShare = computed(() => Math.max(5, ...(c.value?.partners || []).flatMap(p => [p.share ?? 0, p.share_5y ?? 0])))
const barW = (v: number | null) => `${Math.max(0, ((v ?? 0) / maxShare.value) * 100)}%`

const pctText = (v: number | null | undefined) => (v == null ? '—' : `${v < 1 && v > 0 ? v.toFixed(1) : v < 10 ? v.toFixed(1) : Math.round(v)}%`)
const changeText = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}`)
const changeClass = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.5 ? 'text-primary-400' : v > 0 ? 'text-accent-700' : 'text-red-700')
const arrow = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.5 ? '→' : v > 0 ? '↑' : '↓')
function money(v: number | null | undefined) {
  if (v == null) return '—'
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}tn`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}bn`
  if (v >= 1) return `$${Math.round(v)}m`
  return `$${v.toFixed(1)}m`
}
const shortName = (n: string) => n.replace('United Arab Emirates', 'UAE').replace('European Union (EU-27)', 'EU-27').replace('United Kingdom', 'UK').replace('United States', 'USA')
function monthLabel(m: string | null) {
  if (!m) return ''
  const [y, mm] = m.split('-M')
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

// ---- trend chart --------------------------------------------------------------
interface Pt { year: number; em: number | null; tr: number | null }
const hover = ref<Pt | null>(null)
const chart = computed(() => {
  const em = new Map((c.value?.emerging.series || []).map(s => [s.year, s.share]))
  const tr = new Map((c.value?.traditional.series || []).map(s => [s.year, s.share]))
  const years = [...new Set([...em.keys(), ...tr.keys()])].sort((a, b) => a - b)
  const points: Pt[] = years.map(y => ({ year: y, em: em.get(y) ?? null, tr: tr.get(y) ?? null }))
  const vals = points.flatMap(p => [p.em, p.tr]).filter((v): v is number => v != null)
  const top = Math.max(10, Math.ceil((Math.max(0, ...vals) * 1.1) / 10) * 10)
  const stepT = top > 60 ? 20 : 10
  const ticks: number[] = []
  for (let t = 0; t <= top; t += stepT) ticks.push(t)
  const y0 = years[0] ?? 0, y1 = years[years.length - 1] ?? 1
  const x = (y: number) => PADL + (y1 === y0 ? 0 : ((y - y0) / (y1 - y0)) * (W - PADL - PADR))
  const y = (v: number) => PADT + (1 - v / top) * (H - PADT - PADB)
  const path = (k: 'em' | 'tr') => {
    let d = '', pen = false
    for (const p of points) {
      const v = p[k]
      if (v == null) { pen = false; continue }
      d += `${pen ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(v).toFixed(1)}`
      pen = true
    }
    return d
  }
  const last = points[points.length - 1] ?? null
  // keep the end labels apart
  let ye = last?.em != null ? y(last.em) + 4 : 0
  let yt = last?.tr != null ? y(last.tr) + 4 : 0
  if (last?.em != null && last?.tr != null && Math.abs(ye - yt) < 12) {
    const mid = (ye + yt) / 2
    if (ye <= yt) { ye = mid - 6; yt = mid + 6 } else { ye = mid + 6; yt = mid - 6 }
  }
  const every = years.length > 8 ? 2 : 1
  const labels = points.filter((_, i) => (points.length - 1 - i) % every === 0)
  return { points, ticks, x, y, path, last, labelY: { em: ye, tr: yt }, step: years.length > 1 ? (W - PADL - PADR) / (years.length - 1) : W, labels }
})

const { show, hide: hideTip } = useVizTip()
function onHover(p: Pt, e: MouseEvent) {
  hover.value = p
  const lines = []
  if (p.em != null) lines.push({ text: `Emerging partners: ${p.em.toFixed(1)}%`, color: BLUE })
  if (p.tr != null) lines.push({ text: `Traditional partners: ${p.tr.toFixed(1)}%`, color: ORANGE })
  show(e, String(p.year), lines)
}
function rowTip(p: PartnerRow, e: MouseEvent | FocusEvent) {
  const lines = [
    { text: `${pctText(p.share)} of goods trade (${c.value?.latest_year})`, color: p.group === 'emerging' ? BLUE : ORANGE },
    { text: `${c.value ? c.value.latest_year - 5 : ''}: ${pctText(p.share_5y)}${p.share_10y != null ? ` · ${c.value ? c.value.latest_year - 10 : ''}: ${pctText(p.share_10y)}` : ''}` },
    { text: `Exports ${money(p.exports)} · Imports ${money(p.imports)}` },
  ]
  if (p.yoy != null) lines.push({ text: `Trade ${p.yoy >= 0 ? '+' : ''}${p.yoy}% on the year before` })
  show(e, p.name, lines)
}

// ---- products (UN Comtrade, on demand) ------------------------------------------
const open = ref<string | null>(null)
const products = reactive<{ loading: boolean; error: string | null; data: Products | null }>({ loading: false, error: null, data: null })
function toggle(p: PartnerRow) {
  open.value = open.value === p.code ? null : p.code
  products.data = null
  products.error = null
  products.loading = false
}
async function loadProducts(p: PartnerRow) {
  if (!c.value || !p.iso3) return
  const code = p.code
  products.loading = true
  products.error = null
  try {
    const r = await $fetch<Products>('/api/trade/products', { query: { iso3: c.value.iso3, partner: p.iso3 } })
    if (open.value === code) products.data = r
  } catch (e: any) {
    if (open.value === code) products.error = e?.data?.statusMessage || e?.statusMessage || 'Product detail is not available right now.'
  } finally {
    if (open.value === code) products.loading = false
  }
}
watch(() => props.iso3, () => { open.value = null; products.data = null; hover.value = null })
</script>

<style scoped>
.tp-grid { grid-template-columns: minmax(0, 1fr) 4.5rem 6.5rem; }
@media (min-width: 640px) {
  .tp-grid { grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 4.5rem 4.75rem; }
}
</style>
