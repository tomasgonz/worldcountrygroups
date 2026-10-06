<template>
  <div class="space-y-8">
    <!-- group picker -->
    <div class="flex flex-wrap items-center gap-2">
      <label class="text-sm text-primary-600" for="aid-group">Recipients in</label>
      <select id="aid-group" v-model="group" class="text-sm rounded-lg ring-1 ring-primary-200 px-2 py-1.5 bg-white max-w-full">
        <option value="">All countries receiving aid</option>
        <optgroup label="Groups">
          <option v-for="g in groupOptions" :key="g.gid" :value="g.gid">{{ g.name }}{{ g.acronym && g.acronym !== g.name ? ` (${g.acronym})` : '' }} · {{ g.recipients }}</option>
        </optgroup>
      </select>
      <div class="flex flex-wrap gap-1.5">
        <button v-for="q in QUICK" :key="q.gid" v-show="groupIds.has(q.gid)" class="text-xs px-2.5 py-1 rounded-full ring-1" :class="group === q.gid ? 'bg-primary-900 text-white ring-primary-900' : 'ring-primary-200 text-primary-600 hover:ring-primary-400'" @click="group = group === q.gid ? '' : q.gid">{{ q.label }}</button>
      </div>
    </div>

    <div v-if="pending && !v" class="space-y-3"><div v-for="i in 3" :key="i" class="skeleton h-24 rounded-2xl" /></div>
    <template v-else-if="v">
      <!-- tiles -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div class="tile"><div class="tl">ODA received, {{ v.latestYear }}</div><div class="tv">{{ aidUsd(v.total) }}</div><div class="ts">{{ v.group ? v.group.name : 'all recipients' }}</div></div>
        <div class="tile"><div class="tl">Change vs {{ v.latestYear - 1 }}</div><div class="tv" :class="aidChange(v.change1y).cls"><span aria-hidden="true" class="text-lg align-middle">{{ aidChange(v.change1y).arrow }}</span> {{ aidChange(v.change1y).text }}</div><div class="ts">current prices</div></div>
        <div class="tile"><div class="tl">Per person</div><div class="tv">{{ v.perCapita !== null ? `$${v.perCapita}` : '–' }}</div><div class="ts">ODA received ÷ population</div></div>
        <div class="tile"><div class="tl">Countries</div><div class="tv">{{ v.recipients }}</div><div class="ts">{{ v.notReceiving ? `${v.notReceiving} members receive no ODA` : 'receiving ODA' }}</div></div>
      </div>

      <div class="grid lg:grid-cols-2 gap-6">
        <!-- trend -->
        <section class="card">
          <h3 class="h3">ODA received by year</h3>
          <p class="sub">Net disbursements from all donors, current US dollars</p>
          <div class="flex items-end gap-2 h-36">
            <div v-for="s in v.series" :key="s.year" class="flex-1 h-full flex flex-col justify-end items-center" tabindex="0"
              @mousemove="show($event, String(s.year), [{ text: aidUsd(s.usd), color: '#2a78d6' }])" @mouseleave="hide">
              <span class="text-[10px] text-primary-500 tabular-nums mb-0.5">{{ aidUsd(s.usd) }}</span>
              <div class="w-full rounded-t-[4px] bg-[#2a78d6]" :style="{ height: Math.max(3, s.usd / maxSeries * 85) + '%' }" />
            </div>
          </div>
          <div class="flex gap-2 mt-1"><span v-for="s in v.series" :key="s.year" class="flex-1 text-center text-[11px] text-primary-400">{{ s.year }}</span></div>
        </section>
        <!-- donors -->
        <section class="card">
          <h3 class="h3">Who funds {{ v.group ? 'these countries' : 'recipients' }}</h3>
          <p class="sub">Donor countries in {{ v.latestYear }}: amount, share of all aid received, and change on the year before</p>
          <div v-if="v.multilateralTotal > 0" class="mb-3 text-xs text-primary-600 bg-primary-50 rounded-lg px-3 py-2">
            Multilateral institutions (World Bank, EU, UN funds, development banks) provided <strong>{{ aidUsd(v.multilateralTotal) }}</strong>, {{ v.multilateralShare }}% of the total; donor countries and private foundations provided the rest.
          </div>
          <ul class="space-y-1.5">
            <li v-for="d in v.donors.slice(0, 10)" :key="d.code" class="flex items-center gap-2 text-sm">
              <span class="w-40 shrink-0 truncate text-primary-800" :title="d.name">{{ d.iso2 ? isoToFlag(d.iso2) + ' ' : '' }}{{ d.name }}</span>
              <div class="flex-1 h-2 rounded-full bg-primary-100 overflow-hidden"><div class="h-full rounded-full bg-[#2a78d6]" :style="{ width: (d.usd / (v.donors[0]?.usd || 1) * 100) + '%' }" /></div>
              <span class="w-16 text-right text-xs tabular-nums text-primary-700">{{ aidUsd(d.usd) }}</span>
              <span class="w-12 text-right text-[11px] tabular-nums" :class="aidChange(d.change1y).cls">{{ aidChange(d.change1y).arrow }}{{ d.change1y !== null ? Math.abs(d.change1y) + '%' : '' }}</span>
            </li>
          </ul>
          <p v-if="!v.donors.length" class="text-sm text-primary-400">No donor breakdown available.</p>
        </section>
      </div>

      <!-- recipients table -->
      <section class="card !p-0 overflow-hidden">
        <div class="px-5 pt-5 flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="h3">{{ v.group ? `Recipients in ${v.group.name}` : 'Recipients' }}</h3>
          <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist" aria-label="Sort by">
            <button v-for="s in SORTS" :key="s.v" role="tab" :aria-selected="sort === s.v" class="px-2.5 py-1 rounded-full" :class="sort === s.v ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="sort = s.v">{{ s.label }}</button>
          </div>
        </div>
        <div class="overflow-x-auto mt-3">
          <table class="w-full text-sm">
            <thead><tr class="text-left text-[11px] uppercase tracking-wider text-primary-400 border-b border-primary-100">
              <th class="px-5 py-2 font-medium">Country</th><th class="px-3 py-2 font-medium text-right">ODA {{ v.latestYear }}</th><th class="px-3 py-2 font-medium text-right">1-yr</th>
              <th class="px-3 py-2 font-medium text-right">Per person</th><th class="px-3 py-2 font-medium text-right">% of GDP</th><th class="px-3 py-2 font-medium">Main donor</th>
            </tr></thead>
            <tbody>
              <tr v-for="r in sortedRows.slice(0, shown)" :key="r.iso3" class="border-b border-primary-50 hover:bg-primary-50/60 cursor-pointer" :class="pick === r.iso3 ? 'bg-accent-50/60' : ''" @click="choose(r.iso3)">
                <td class="px-5 py-2 whitespace-nowrap">{{ r.iso2 ? isoToFlag(r.iso2) + ' ' : '' }}<span class="text-primary-900">{{ r.name }}</span></td>
                <td class="px-3 py-2 text-right tabular-nums">{{ aidUsd(r.total) }}</td>
                <td class="px-3 py-2 text-right tabular-nums text-xs" :class="aidChange(r.change1y).cls">{{ aidChange(r.change1y).arrow }} {{ r.change1y !== null ? Math.abs(r.change1y) + '%' : '–' }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ r.perCapita !== null ? `$${r.perCapita}` : '–' }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ r.pctGdp !== null ? r.pctGdp + '%' : '–' }}</td>
                <td class="px-3 py-2 text-xs text-primary-600 whitespace-nowrap">{{ r.topDonor ? `${r.topDonor.name}${r.topDonor.share ? ` (${r.topDonor.share}%)` : ''}` : '–' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-primary-500">
          <button v-if="sortedRows.length > shown" class="text-accent-700 hover:underline" @click="shown += 25">Show all {{ sortedRows.length }}</button>
          <span>Click a country for its donors and trend. Per person uses World Bank population; % of GDP uses World Bank GDP.</span>
        </div>
      </section>

      <!-- profile -->
      <section v-if="pick" id="recipient-profile" class="scroll-mt-24">
        <div class="flex items-baseline justify-between gap-2 mb-2">
          <h3 class="h3">Recipient profile</h3>
          <NuxtLink :to="`/countries/${pick.toLowerCase()}`" class="text-xs text-accent-700 hover:underline">Country page &rarr;</NuxtLink>
        </div>
        <CountryAidProfile :key="pick" :iso3="pick" embedded :tip="false" :news-limit="3" />
      </section>

      <!-- groups compared -->
      <section v-if="compare.length" class="card">
        <h3 class="h3">Groups compared</h3>
        <p class="sub">ODA received by members of each group (latest year). Countries belong to several groups, so totals overlap. Whole-world and UN-membership groups are left out.</p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="text-left text-[11px] uppercase tracking-wider text-primary-400 border-b border-primary-100">
              <th class="py-2 font-medium">Group</th><th class="py-2 px-3 font-medium text-right">Recipients</th><th class="py-2 px-3 font-medium text-right">ODA received</th><th class="py-2 px-3 font-medium text-right">1-yr</th><th class="py-2 px-3 font-medium text-right">Per person</th>
            </tr></thead>
            <tbody>
              <tr v-for="g in compare.slice(0, showGroups)" :key="g.gid" class="border-b border-primary-50 hover:bg-primary-50/60 cursor-pointer" @click="group = g.gid; scrollTop()">
                <td class="py-2 pr-3 text-primary-900">{{ g.name }} <span v-if="g.acronym && g.acronym !== g.name" class="text-primary-400 text-xs">{{ g.acronym }}</span></td>
                <td class="py-2 px-3 text-right tabular-nums text-primary-600">{{ g.recipients }}/{{ g.size }}</td>
                <td class="py-2 px-3 text-right tabular-nums">{{ aidUsd(g.total) }}</td>
                <td class="py-2 px-3 text-right tabular-nums text-xs" :class="aidChange(g.change1y).cls">{{ aidChange(g.change1y).arrow }} {{ g.change1y !== null ? Math.abs(g.change1y) + '%' : '–' }}</td>
                <td class="py-2 px-3 text-right tabular-nums">{{ g.perCapita !== null ? `$${g.perCapita}` : '–' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button v-if="compare.length > showGroups" class="mt-2 text-xs text-accent-700 hover:underline" @click="showGroups = compare.length">Show all {{ compare.length }} groups</button>
      </section>

      <!-- methodology -->
      <section class="card">
        <h3 class="h3">How these numbers are calculated</h3>
        <div class="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs text-primary-600 leading-relaxed method">
          <p><strong>Source.</strong> OECD Development Assistance Committee, table DAC2A: net official development assistance (ODA) disbursements from all official donors, current US dollars. Recipient detail runs to {{ v.latestYear }}; later years exist only as preliminary donor totals. Data downloaded {{ v.updatedAt ? aidDate(v.updatedAt) : 'unknown' }}.</p>
          <p><strong>Net.</strong> Disbursements minus loan principal repaid in the same year. A country repaying more than it receives (often a middle-income borrower) shows a negative figure.</p>
          <p><strong>Group totals.</strong> The sum over members on the OECD list of aid recipients; other members count as zero (shown as "receiving" out of the group size). Countries belong to several groups, so group totals overlap and cannot be added up.</p>
          <p><strong>Change.</strong> On the previous year, in current dollars: not adjusted for inflation or exchange rates, so part of a change can be price or currency movement.</p>
          <p><strong>Per person.</strong> Aid divided by population (World Bank, latest year). For a group, only members with a population figure are used, in both parts of the division.</p>
          <p><strong>% of GDP.</strong> Aid divided by gross domestic product in current dollars (World Bank, latest year). Aid and GDP years can differ by a year.</p>
          <p><strong>Donor countries.</strong> Bilateral net ODA from each OECD-reporting country to the recipients, as a share of all aid received. Contributions a country makes to the World Bank, the EU or UN funds are counted under those institutions, not the country, so nothing is counted twice.</p>
          <p><strong>Multilateral institutions.</strong> Net disbursements by the World Bank (IDA), regional development banks, UN funds, the Global Fund, EU institutions and similar bodies. The rest comes from private foundations that report to the OECD (such as the Gates Foundation).</p>
          <p><strong>Main donor (table).</strong> The largest single provider of each recipient, which can be a country or an institution, with its share of the recipient's total.</p>
          <p><strong>Not covered.</strong> China and other providers that do not report to the OECD, private investment, remittances and military aid.</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'
import { aidUsd, aidChange, aidDate } from '~/composables/useAidFormat'

/** Aid seen from the receiving side, by country and by group. */
const route = useRoute()
const router = useRouter()
const { show, hide } = useVizTip()
const QUICK = [
  { gid: 'ldcs', label: 'Least developed' }, { gid: 'lldcs', label: 'Landlocked developing' }, { gid: 'sids', label: 'Small island states' },
  { gid: 'au', label: 'African Union' }, { gid: 'g77', label: 'G77' }, { gid: 'asean', label: 'ASEAN' },
]
const SORTS = [{ v: 'total', label: 'Total' }, { v: 'perCapita', label: 'Per person' }, { v: 'pctGdp', label: '% of GDP' }, { v: 'change1y', label: 'Change' }] as const
const group = ref(String(route.query.group || ''))
const sort = ref<'total' | 'perCapita' | 'pctGdp' | 'change1y'>('total')
const shown = ref(25)
const showGroups = ref(12)
const pick = ref(String(route.query.recipient || ''))

const { data: all } = useFetch<any>('/api/donors/recipients', { server: false })
const { data: v, pending } = useFetch<any>('/api/donors/recipients', { query: computed(() => (group.value ? { group: group.value } : {})), server: false })
const groupOptions = computed(() => (all.value?.groups || []).slice().sort((a: any, b: any) => a.name.localeCompare(b.name)))
const groupIds = computed(() => new Set((all.value?.groups || []).map((g: any) => g.gid)))
const compare = computed(() => all.value?.compare || [])
const maxSeries = computed(() => Math.max(1, ...((v.value?.series || []).map((s: any) => s.usd))))
const sortedRows = computed(() => [...(v.value?.rows || [])].sort((a: any, b: any) => (b[sort.value] ?? -Infinity) - (a[sort.value] ?? -Infinity)))

watch(group, (g) => { shown.value = 25; router.replace({ query: { ...route.query, view: 'recipients', group: g || undefined } }) })
function choose(iso3: string) {
  pick.value = iso3
  router.replace({ query: { ...route.query, view: 'recipients', recipient: iso3 } })
  nextTick(() => document.getElementById('recipient-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }) }
</script>

<style scoped>
.card { @apply bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6 min-w-0; }
.h3 { @apply font-serif text-xl font-bold text-primary-900; }
.sub { @apply text-xs text-primary-500 mt-1 mb-3; }
.method strong { @apply font-medium text-primary-800; }
.tile { @apply bg-white rounded-2xl ring-1 ring-primary-200/70 p-4; }
.tl { @apply text-[11px] uppercase tracking-wider text-primary-400; }
.tv { @apply font-serif text-2xl sm:text-3xl font-bold text-primary-900 tabular-nums; }
.ts { @apply text-[11px] text-primary-500; }
</style>
