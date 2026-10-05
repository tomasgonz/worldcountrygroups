<template>
  <section v-if="show" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
    <VizTip v-if="tip && !embedded" />
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
      <h2 class="font-serif text-xl font-bold text-primary-900">
        <template v-if="embedded">{{ p!.name }}: development aid</template>
        <template v-else>Development aid</template>
      </h2>
      <span v-if="p!.meta" class="text-xs text-primary-400">OECD DAC, to {{ p!.meta.latest_year }}</span>
    </div>
    <p class="text-sm text-primary-500 mb-5">
      <template v-if="d && rec">{{ p!.name }} both gives and receives official development assistance (ODA).</template>
      <template v-else-if="d">Official development assistance (ODA) that {{ p!.name }} gives, as reported to the OECD.</template>
      <template v-else-if="rec">Official development assistance (ODA) that {{ p!.name }} receives, by donor.</template>
      <template v-else>Recent news about {{ p!.name }} as an aid donor.</template>
    </p>

    <!-- ================= DONOR ================= -->
    <div v-if="d" class="mb-2">
      <h3 v-if="rec" class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-2">As a donor</h3>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div class="rounded-xl bg-primary-50 px-3 py-2.5">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">ODA {{ d.latest.year }}</div>
          <div class="font-serif text-2xl font-bold text-primary-900 tabular-nums">{{ aidUsd(d.latest.oda) }}</div>
          <div class="text-[11px] text-primary-500">
            <span v-if="d.latest.preliminary" class="inline-block px-1 rounded bg-amber-100 text-amber-800 mr-1">preliminary</span>
            <template v-if="d.latest.rank_volume">#{{ d.latest.rank_volume }} by volume</template>
          </div>
        </div>
        <div class="rounded-xl bg-primary-50 px-3 py-2.5">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">Share of GNI</div>
          <div class="font-serif text-2xl font-bold text-primary-900 tabular-nums">{{ d.latest.gni_pct != null ? aidPct(d.latest.gni_pct, 2) : '–' }}</div>
          <div class="text-[11px] text-primary-500">
            <template v-if="d.latest.gni_pct == null">not reported</template>
            <template v-else-if="d.latest.gni_pct >= 0.7">meets the 0.7% UN target</template>
            <template v-else>{{ (0.7 - d.latest.gni_pct).toFixed(2) }} pts below 0.7% target</template>
          </div>
        </div>
        <div class="rounded-xl bg-primary-50 px-3 py-2.5">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">Change vs {{ d.latest.prev_year ?? '–' }}</div>
          <div class="font-serif text-2xl font-bold tabular-nums" :class="ch1.cls">
            <span aria-hidden="true" class="text-base align-middle">{{ ch1.arrow }}</span> {{ ch1.text }}
          </div>
          <div class="text-[11px] text-primary-500">
            <template v-if="d.latest.change_1y_usd != null">{{ ch1.word }} of {{ aidUsd(Math.abs(d.latest.change_1y_usd)) }}, real terms</template>
          </div>
        </div>
        <div class="rounded-xl bg-primary-50 px-3 py-2.5">
          <div class="text-[11px] uppercase tracking-wider text-primary-400">Change vs {{ d.latest.base3_year ?? '–' }}</div>
          <div class="font-serif text-2xl font-bold tabular-nums" :class="ch3.cls">
            <span aria-hidden="true" class="text-base align-middle">{{ ch3.arrow }}</span> {{ ch3.text }}
          </div>
          <div class="text-[11px] text-primary-500">3-year change, real terms</div>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-6 mb-6">
        <!-- ODA trend, constant prices -->
        <div class="min-w-0">
          <div class="text-xs font-medium text-primary-600 mb-0.5">ODA, constant {{ p!.meta?.constant_price_year || '' }} USD</div>
          <div class="text-[11px] text-primary-400 mb-2">Grant equivalent. Hatched bar = preliminary estimate.</div>
          <div class="flex items-end gap-[2px] h-32" role="img" :aria-label="`ODA trend for ${p!.name}`">
            <div
              v-for="s in odaSeries" :key="s.year"
              class="flex-1 h-full flex flex-col justify-end items-stretch group cursor-default" tabindex="0"
              @mousemove="tipOda(s, $event)" @mouseleave="hide" @focus="tipOda(s, $event)" @blur="hide"
            >
              <div
                class="rounded-t-[4px] group-hover:opacity-80"
                :style="{ height: barH(s.v, odaMax, 128), background: s.preliminary ? `repeating-linear-gradient(135deg, ${BLUE} 0 3px, #9cc0ea 3px 6px)` : BLUE }"
              />
            </div>
          </div>
          <div class="flex gap-[2px] mt-1">
            <div v-for="(s, i) in odaSeries" :key="s.year" class="flex-1 text-center text-[10px] text-primary-400 tabular-nums">
              {{ i === 0 || i === odaSeries.length - 1 || s.year % 2 === 0 ? `'${String(s.year).slice(2)}` : '' }}
            </div>
          </div>
        </div>

        <!-- ODA / GNI with 0.7% line -->
        <div v-if="gniSeries.length > 1" class="min-w-0">
          <div class="text-xs font-medium text-primary-600 mb-0.5">ODA as % of gross national income</div>
          <div class="text-[11px] text-primary-400 mb-2">Dashed line: the 0.7% UN target.</div>
          <div class="relative h-32">
            <svg class="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline :points="gniPoints" fill="none" :stroke="ORANGE" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
            </svg>
            <div class="absolute left-0 right-0 border-t-2 border-dashed border-primary-400" :style="{ bottom: `${(0.7 / gniMax) * 100}%` }">
              <span class="absolute right-0 -top-4 text-[10px] text-primary-500 bg-white/80 px-0.5">0.7% target</span>
            </div>
            <div
              v-for="(s, i) in gniSeries" :key="s.year"
              class="absolute w-3 h-3 -ml-1.5 -mb-1.5 rounded-full ring-2 ring-white cursor-default"
              :style="{ left: `${xPos(i, gniSeries.length)}%`, bottom: `${(s.v / gniMax) * 100}%`, background: s.preliminary ? '#fff' : ORANGE, boxShadow: `inset 0 0 0 2px ${ORANGE}` }"
              tabindex="0"
              @mousemove="tipGni(s, $event)" @mouseleave="hide" @focus="tipGni(s, $event)" @blur="hide"
            />
          </div>
          <div class="relative h-4 mt-1">
            <span
              v-for="(s, i) in gniSeries" :key="s.year"
              class="absolute -translate-x-1/2 text-[10px] text-primary-400 tabular-nums"
              :style="{ left: `${xPos(i, gniSeries.length)}%` }"
            >{{ i === 0 || i === gniSeries.length - 1 || s.year % 2 === 0 ? `'${String(s.year).slice(2)}` : '' }}</span>
          </div>
        </div>
      </div>

      <!-- composition -->
      <div v-if="composition.length" class="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-primary-600 mb-6">
        <span v-for="c in composition" :key="c.label"><span class="text-primary-400">{{ c.label }}:</span> <span class="tabular-nums font-medium">{{ c.value }}</span></span>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
        <div v-if="d.top_recipients.items.length" class="min-w-0">
          <div class="text-xs font-medium text-primary-600 mb-2">Top recipients, {{ d.top_recipients.year }} <span class="font-normal text-primary-400">(bilateral net ODA)</span></div>
          <ul class="space-y-1">
            <li v-for="r in d.top_recipients.items.slice(0, limitRows)" :key="r.iso3" class="grid items-center gap-2" style="grid-template-columns: minmax(0, 9rem) 1fr 3.8rem">
              <NuxtLink :to="`/countries/${r.iso3.toLowerCase()}`" class="text-[13px] text-primary-700 hover:text-accent-700 truncate">
                <span v-if="r.iso2" class="mr-1">{{ isoToFlag(r.iso2) }}</span>{{ r.name }}
              </NuxtLink>
              <div class="relative h-5 rounded hover:bg-primary-50" tabindex="0" @mousemove="tipPartner(r, d.top_recipients.year, $event)" @mouseleave="hide" @focus="tipPartner(r, d.top_recipients.year, $event)" @blur="hide">
                <div class="absolute left-0 top-1/2 -translate-y-1/2 h-3 rounded-r-[4px]" :style="{ width: barW(r.usd, d.top_recipients.items[0].usd), background: BLUE }" />
              </div>
              <span class="text-right text-[12px] tabular-nums text-primary-800">{{ aidUsd(r.usd) }}</span>
            </li>
          </ul>
        </div>
        <div v-if="d.sectors?.items?.length" class="min-w-0">
          <div class="text-xs font-medium text-primary-600 mb-2">Main sectors, {{ d.sectors.year }} <span class="font-normal text-primary-400">(share of bilateral commitments)</span></div>
          <ul class="space-y-1">
            <li v-for="s in d.sectors.items" :key="s.code" class="grid items-center gap-2" style="grid-template-columns: minmax(0, 9rem) 1fr 3.2rem">
              <span class="text-[13px] text-primary-700 truncate" :title="s.name">{{ s.name }}</span>
              <div class="relative h-5 rounded hover:bg-primary-50" tabindex="0" @mousemove="tipSector(s, $event)" @mouseleave="hide" @focus="tipSector(s, $event)" @blur="hide">
                <div class="absolute left-0 top-1/2 -translate-y-1/2 h-3 rounded-r-[4px]" :style="{ width: barW(s.share, d.sectors.items[0].share), background: AQUA }" />
              </div>
              <span class="text-right text-[12px] tabular-nums text-primary-800">{{ aidPct(s.share, 0) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- ================= RECIPIENT ================= -->
    <div v-if="rec" :class="d ? 'mt-8 pt-6 border-t border-primary-100' : ''">
      <h3 v-if="d" class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-2">As a recipient</h3>
      <div class="grid md:grid-cols-2 gap-6">
        <div class="min-w-0">
          <div class="flex items-baseline gap-3 mb-3">
            <div>
              <div class="text-[11px] uppercase tracking-wider text-primary-400">Net ODA received, {{ rec.year }}</div>
              <div class="font-serif text-2xl font-bold text-primary-900 tabular-nums">{{ aidUsd(rec.total) }}</div>
            </div>
            <div v-if="recChange" class="text-sm tabular-nums" :class="recChange.cls">
              <span aria-hidden="true">{{ recChange.arrow }}</span> {{ recChange.text }} <span class="text-primary-400">vs {{ rec.year - 1 }}</span>
            </div>
          </div>
          <div v-if="rec.series.length > 1">
            <div class="text-[11px] text-primary-400 mb-1">From all official donors, current USD</div>
            <div class="flex items-end gap-[3px] h-20">
              <div
                v-for="s in rec.series" :key="s.year"
                class="flex-1 h-full flex flex-col justify-end group cursor-default" tabindex="0"
                @mousemove="tipRec(s, $event)" @mouseleave="hide" @focus="tipRec(s, $event)" @blur="hide"
              >
                <div class="rounded-t-[4px] group-hover:opacity-80" :style="{ height: barH(s.usd, recMax, 80), background: BLUE }" />
              </div>
            </div>
            <div class="flex gap-[3px] mt-1">
              <div v-for="s in rec.series" :key="s.year" class="flex-1 text-center text-[10px] text-primary-400 tabular-nums">{{ s.year }}</div>
            </div>
          </div>
        </div>
        <div v-if="rec.top_donors.length" class="min-w-0">
          <div class="text-xs font-medium text-primary-600 mb-2">Top donors, {{ rec.year }} <span class="font-normal text-primary-400">(net disbursements)</span></div>
          <ul class="space-y-1">
            <li v-for="r in rec.top_donors.slice(0, limitRows)" :key="r.code" class="grid items-center gap-2" style="grid-template-columns: minmax(0, 9rem) 1fr 5.2rem">
              <component
                :is="r.kind === 'country' || r.kind === 'eu' ? NuxtLinkC : 'span'"
                v-bind="r.kind === 'country' || r.kind === 'eu' ? { to: `/partners/donors?donor=${r.code}` } : {}"
                class="text-[13px] text-primary-700 truncate" :class="r.kind === 'country' || r.kind === 'eu' ? 'hover:text-accent-700' : ''" :title="r.name"
              >
                <span v-if="r.iso2" class="mr-1">{{ r.kind === 'eu' ? '🇪🇺' : isoToFlag(r.iso2) }}</span>{{ shortOrg(r.name) }}
              </component>
              <div class="relative h-5 rounded hover:bg-primary-50" tabindex="0" @mousemove="tipDonor(r, $event)" @mouseleave="hide" @focus="tipDonor(r, $event)" @blur="hide">
                <div class="absolute left-0 top-1/2 -translate-y-1/2 h-3 rounded-r-[4px]" :style="{ width: barW(r.usd, rec.top_donors[0].usd), background: r.kind === 'country' || r.kind === 'eu' ? BLUE : AMBER }" />
              </div>
              <span class="text-right text-[12px] tabular-nums text-primary-800 whitespace-nowrap">
                {{ aidUsd(r.usd) }}
                <span v-if="pctChange(r.usd, r.prev) != null" :class="aidChange(pctChange(r.usd, r.prev)).cls" :title="`vs ${rec.year - 1}`">{{ aidChange(pctChange(r.usd, r.prev)).arrow }}</span>
              </span>
            </li>
          </ul>
          <div class="flex flex-wrap gap-x-4 mt-2 text-[11px] text-primary-500">
            <span class="inline-flex items-center gap-1"><span class="w-3 h-2 rounded-sm" :style="{ background: BLUE }" />Countries, EU</span>
            <span class="inline-flex items-center gap-1"><span class="w-3 h-2 rounded-sm" :style="{ background: AMBER }" />Multilateral and private</span>
            <span>▲▼ change vs {{ rec.year - 1 }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ================= NEWS ================= -->
    <div v-if="p!.news?.length && showNews" class="mt-8 pt-6 border-t border-primary-100">
      <div class="text-xs font-medium text-primary-600 mb-2">Latest donor news</div>
      <ul class="space-y-2.5">
        <li v-for="n in p!.news.slice(0, newsLimit)" :key="n.id" class="text-sm">
          <a :href="n.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-accent-700 font-medium">{{ n.title }}</a>
          <div class="text-[11px] text-primary-400 mt-0.5">
            {{ n.source }} · {{ aidDate(n.publishedAt) }}
            <span v-for="t in n.topics.slice(0, 3)" :key="t" class="ml-1 inline-block px-1.5 rounded-full bg-primary-50 text-primary-500">{{ AID_TOPIC_LABELS[t] || t }}</span>
          </div>
        </li>
      </ul>
    </div>

    <div class="mt-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-primary-400">
      <span>
        Source: OECD DAC (DAC1, DAC2A, DAC5).
        <template v-if="p!.meta?.preliminary_years?.length">{{ p!.meta.preliminary_years.join(', ') }} figures are preliminary.</template>
      </span>
      <NuxtLink v-if="!embedded" :to="`/partners/donors?donor=${p!.code}`" class="text-accent-600 hover:text-accent-700 font-medium">Donor tracker →</NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { resolveComponent } from 'vue'
import { isoToFlag } from '~/composables/useGroups'
import type { TipLine } from '~/composables/useVizTip'
import { AID_COLORS, AID_TOPIC_LABELS, aidUsd, aidPct, aidChange, aidDate } from '~/composables/useAidFormat'

interface SeriesRow { year: number; oda: number | null; oda_real: number | null; gni_pct: number | null; bilateral?: number; multilateral?: number; refugee?: number; humanitarian?: number; preliminary?: boolean }
interface Latest {
  year: number; preliminary: boolean; oda: number | null; oda_real: number | null; gni_pct: number | null
  prev_year: number | null; change_1y_pct: number | null; change_1y_usd: number | null
  base3_year: number | null; change_3y_pct: number | null; change_3y_usd: number | null
  refugee_share?: number; bilateral_share?: number; multilateral_share?: number; humanitarian_share?: number; humanitarian_year?: number
  rank_volume?: number; rank_gni?: number
}
interface Partner { iso3: string; iso2: string | null; name: string; usd: number; prev?: number | null }
interface DonorPart {
  latest: Latest; series: SeriesRow[]
  top_recipients: { year: number; items: Partner[] }
  sectors: { year: number; items: { code: string; name: string; usd: number; share: number }[] } | null
}
interface RecDonor { code: string; iso3: string | null; iso2: string | null; name: string; kind: string; usd: number; prev?: number | null }
interface RecPart { year: number; total: number | null; series: { year: number; usd: number }[]; top_donors: RecDonor[] }
interface NewsItem { id: string; title: string; url: string; source: string; publishedAt: string; topics: string[] }
interface Profile {
  code: string; name: string; iso2: string | null
  is_donor: boolean; is_recipient: boolean
  donor: DonorPart | null; recipient: RecPart | null; news: NewsItem[]
  meta: { latest_year: number; final_year: number; preliminary_years: number[]; constant_price_year: number | null } | null
}

const props = withDefaults(defineProps<{
  iso3: string
  /** Used inside the donor tracker page: no own tooltip host, no link back to the tracker. */
  embedded?: boolean
  showNews?: boolean
  newsLimit?: number
  /** Mount the tooltip host. Pass false when the page already has a <VizTip /> (e.g. CountryTradePartners). */
  tip?: boolean
}>(), { embedded: false, showNews: true, newsLimit: 5, tip: true })

const BLUE = AID_COLORS.blue
const ORANGE = AID_COLORS.orange
const AQUA = AID_COLORS.aqua
const AMBER = AID_COLORS.amber
const NuxtLinkC = resolveComponent('NuxtLink')
const limitRows = 8

const code = computed(() => String(props.iso3 || '').toUpperCase())
const { data } = useFetch<Profile | null>(() => `/api/donors/${code.value}`, {
  key: computed(() => `aid-profile-${code.value}`),
  default: () => null,
})

const p = computed<Profile | null>(() => (data.value && (data.value.is_donor || data.value.is_recipient || data.value.news?.length) ? data.value : null))
const d = computed(() => p.value?.donor ?? null)
const rec = computed(() => p.value?.recipient ?? null)
// Render nothing at all when there is no aid data (or only news while news is hidden)
const show = computed(() => !!p.value && (!!d.value || !!rec.value || (props.showNews && !!p.value.news?.length)))

const { show: showTip, hide } = useVizTip()

const ch1 = computed(() => aidChange(d.value?.latest.change_1y_pct))
const ch3 = computed(() => aidChange(d.value?.latest.change_3y_pct))

const odaSeries = computed(() => (d.value?.series || []).filter(s => s.oda_real != null).map(s => ({ year: s.year, v: s.oda_real as number, nominal: s.oda, preliminary: !!s.preliminary })))
const odaMax = computed(() => Math.max(1, ...odaSeries.value.map(s => s.v)))
const gniSeries = computed(() => (d.value?.series || []).filter(s => s.gni_pct != null).map(s => ({ year: s.year, v: s.gni_pct as number, preliminary: !!s.preliminary })))
const gniMax = computed(() => Math.max(0.8, ...gniSeries.value.map(s => s.v)) * 1.1)
const xPos = (i: number, n: number) => (n <= 1 ? 50 : 3 + (i / (n - 1)) * 94)
const gniPoints = computed(() => gniSeries.value.map((s, i) => `${xPos(i, gniSeries.value.length)},${100 - (s.v / gniMax.value) * 100}`).join(' '))

const recMax = computed(() => Math.max(1, ...(rec.value?.series || []).map(s => s.usd)))
const recChange = computed(() => {
  const s = rec.value?.series || []
  if (s.length < 2) return null
  const c = pctChange(s[s.length - 1].usd, s[s.length - 2].usd)
  return c == null ? null : aidChange(c)
})

const composition = computed(() => {
  const L = d.value?.latest
  if (!L) return []
  const out: { label: string; value: string }[] = []
  if (L.bilateral_share != null) out.push({ label: 'Bilateral / multilateral', value: `${Math.round(L.bilateral_share)}% / ${Math.round(L.multilateral_share ?? 0)}%` })
  if (L.refugee_share != null) out.push({ label: 'In-donor refugee costs', value: aidPct(L.refugee_share) })
  if (L.humanitarian_share != null) out.push({ label: `Humanitarian (${L.humanitarian_year}, of bilateral)`, value: aidPct(L.humanitarian_share) })
  if (L.rank_gni) out.push({ label: 'Rank by % of GNI', value: `#${L.rank_gni}` })
  return out
})

function pctChange(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b <= 0) return null
  return ((a - b) / b) * 100
}
const barH = (v: number, max: number, px: number) => `${Math.max(2, (Math.max(0, v) / max) * px)}px`
const barW = (v: number, max: number) => `${Math.max(1, (Math.max(0, v) / (max || 1)) * 100)}%`
const shortOrg = (n: string) => n.replace(/\s*\[[^\]]+\]\s*$/, '').replace('International Development Association', 'World Bank IDA')

function tipOda(s: { year: number; v: number; nominal: number | null; preliminary: boolean }, e: MouseEvent | FocusEvent) {
  showTip(e, `${s.year}${s.preliminary ? ' (preliminary)' : ''}`, [
    { text: `${aidUsd(s.v)} in constant ${p.value?.meta?.constant_price_year ?? ''} USD`, color: BLUE },
    { text: `${aidUsd(s.nominal)} current USD` },
  ])
}
function tipGni(s: { year: number; v: number; preliminary: boolean }, e: MouseEvent | FocusEvent) {
  showTip(e, `${s.year}${s.preliminary ? ' (preliminary)' : ''}`, [
    { text: `ODA/GNI: ${s.v.toFixed(2)}%`, color: ORANGE },
    { text: s.v >= 0.7 ? 'At or above the 0.7% target' : `${(0.7 - s.v).toFixed(2)} pts below 0.7%` },
  ])
}
function tipPartner(r: Partner, year: number, e: MouseEvent | FocusEvent) {
  const lines: TipLine[] = [{ text: `${year}: ${aidUsd(r.usd)}`, color: BLUE }]
  const c = pctChange(r.usd, r.prev)
  if (r.prev != null) lines.push({ text: `${year - 1}: ${aidUsd(r.prev)}${c != null ? ` (${aidChange(c).arrow} ${aidChange(c).text})` : ''}` })
  showTip(e, r.name, lines)
}
function tipSector(s: { name: string; usd: number; share: number }, e: MouseEvent | FocusEvent) {
  showTip(e, s.name, [{ text: `${aidPct(s.share)} of bilateral commitments`, color: AQUA }, { text: aidUsd(s.usd) }])
}
function tipRec(s: { year: number; usd: number }, e: MouseEvent | FocusEvent) {
  showTip(e, String(s.year), [{ text: `Net ODA received: ${aidUsd(s.usd)}`, color: BLUE }])
}
function tipDonor(r: RecDonor, e: MouseEvent | FocusEvent) {
  const year = rec.value?.year ?? 0
  const c = pctChange(r.usd, r.prev)
  const lines: TipLine[] = [{ text: `${year}: ${aidUsd(r.usd)}`, color: r.kind === 'country' || r.kind === 'eu' ? BLUE : AMBER }]
  if (r.prev != null) lines.push({ text: `${year - 1}: ${aidUsd(r.prev)}${c != null ? ` (${aidChange(c).arrow} ${aidChange(c).text})` : ''}` })
  showTip(e, r.name, lines)
}
</script>
