<template>
  <div v-if="p && hasAny" id="cat-now" class="mb-16 scroll-mt-24">
    <div class="flex items-center gap-4 mb-2">
      <h2 class="font-serif text-2xl font-bold text-primary-900 whitespace-nowrap">At a glance</h2>
      <div class="flex-1 h-px bg-primary-200" />
    </div>
    <p class="text-sm text-primary-500 mb-6">The trackers added up for the {{ p.group.size }} members: aid, trade, elections, UN seats and votes, and this week's news.</p>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <!-- Aid received -->
      <section v-if="p.aid" class="card">
        <header class="flex items-baseline justify-between gap-3 mb-3">
          <h3 class="h3">Aid received</h3>
          <NuxtLink :to="`/partners/donors?view=recipients&group=${gid}`" class="more">Donor tracker →</NuxtLink>
        </header>
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div><div class="big">{{ aidUsd(p.aid.totalUsd) }}</div><div class="lbl">ODA in {{ p.aid.year }}</div></div>
          <div><div class="big" :class="aidChange(p.aid.change1y).cls">{{ aidChange(p.aid.change1y).arrow }} {{ aidChange(p.aid.change1y).text }}</div><div class="lbl">on {{ p.aid.year - 1 }}</div></div>
          <div><div class="big">{{ p.aid.perCapita != null ? '$' + p.aid.perCapita.toFixed(0) : '–' }}</div><div class="lbl">per person</div></div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="min-w-0">
            <div class="sub">Largest recipients</div>
            <ul class="space-y-1">
              <li v-for="r in p.aid.topRecipients" :key="r.iso3" class="row">
                <NuxtLink :to="`/countries/${r.iso3}`" class="truncate hover:text-primary-600">{{ r.iso2 ? isoToFlag(r.iso2) + ' ' : '' }}{{ r.name }}</NuxtLink>
                <span class="num">{{ aidUsd(r.usd) }}</span>
              </li>
            </ul>
          </div>
          <div class="min-w-0">
            <div class="sub">Main donor countries <span class="text-primary-400">(share of all aid)</span></div>
            <ul class="space-y-1.5">
              <li v-for="d in p.aid.topDonors" :key="d.code" :title="`${d.name}: ${aidUsd(d.usd)}, ${aidPct(d.share)} of aid received`">
                <div class="row"><span class="truncate">{{ d.iso2 ? isoToFlag(d.iso2) + ' ' : '' }}{{ d.name }}</span><span class="num">{{ aidPct(d.share) }}</span></div>
                <div class="track"><div class="bar" :style="{ width: barW(d.share, maxDonor), background: AID_COLORS.blue }" /></div>
              </li>
            </ul>
            <p v-if="p.aid.multilateralTotal > 0" class="text-xs text-primary-500 mt-2">Multilateral institutions (World Bank, EU, UN funds, development banks): {{ aidPct(p.aid.multilateralShare) }}</p>
            <p v-else-if="p.aid.multilateralTotal < 0" class="text-xs text-primary-500 mt-2">Members repaid multilateral lenders {{ aidUsd(-p.aid.multilateralTotal) }} more than they received from them (net).</p>
          </div>
        </div>
      </section>

      <!-- Trade -->
      <section v-if="p.trade" class="card">
        <header class="flex items-baseline justify-between gap-3 mb-3">
          <h3 class="h3">Trade with the big partners</h3>
          <NuxtLink to="/partners/trade" class="more">Trade tracker →</NuxtLink>
        </header>
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div><div class="big">{{ tradeUsd(p.trade.totalMusd) }}</div><div class="lbl">goods trade {{ p.trade.year }}</div></div>
          <div><div class="big">{{ aidPct(p.trade.emergingShare) }}</div><div class="lbl">with emerging partners</div></div>
          <div><div class="big">{{ pts(p.trade.emergingShare - p.trade.emergingShare5y) }}</div><div class="lbl">pts since {{ p.trade.baseYear }}</div></div>
        </div>
        <div class="flex flex-wrap gap-3 text-xs text-primary-500 mb-2">
          <span class="flex items-center gap-1"><i class="sw" :style="{ background: AID_COLORS.orange }" />Emerging</span>
          <span class="flex items-center gap-1"><i class="sw" :style="{ background: AID_COLORS.blue }" />Traditional</span>
          <span>· share of members' trade, change since {{ p.trade.baseYear }}</span>
        </div>
        <ul class="space-y-1.5">
          <li v-for="x in p.trade.partners.slice(0, 8)" :key="x.code" :title="`${x.name}: ${aidPct(x.share)} of trade (${aidPct(x.share5y)} in ${p.trade.baseYear}); top partner of ${x.topPartnerOf} member(s)`">
            <div class="row">
              <span class="truncate">{{ x.iso2 === 'EU' ? '🇪🇺 ' : x.iso2 ? isoToFlag(x.iso2) + ' ' : '' }}{{ x.name }}</span>
              <span class="num">{{ aidPct(x.share) }} <span class="text-primary-400 w-14 inline-block text-right">{{ pts(x.change5y) }}</span></span>
            </div>
            <div class="track"><div class="bar" :style="{ width: barW(x.share, maxPartner), background: x.group === 'emerging' ? AID_COLORS.orange : AID_COLORS.blue }" /></div>
          </li>
        </ul>
        <p class="text-xs text-primary-400 mt-2">{{ p.trade.members }} members with data. Trade between members is included.</p>
      </section>

      <!-- Elections -->
      <section v-if="p.elections.ahead.length || p.elections.recent.length" class="card">
        <header class="flex items-baseline justify-between gap-3 mb-3">
          <h3 class="h3">National elections</h3>
          <NuxtLink to="/elections?tab=national" class="more">Elections →</NuxtLink>
        </header>
        <div v-if="p.elections.ahead.length" class="sub">Next 12 months</div>
        <ul class="divide-y divide-primary-50 mb-3">
          <li v-for="e in p.elections.ahead.slice(0, 8)" :key="e.id" class="row py-1.5">
            <span class="truncate"><NuxtLink :to="`/countries/${e.iso3}`" class="hover:text-primary-600">{{ e.iso2 ? isoToFlag(e.iso2) + ' ' : '' }}{{ e.country }}</NuxtLink> <span class="text-primary-400">· {{ e.type }}</span></span>
            <span class="num">{{ when(e) }}</span>
          </li>
        </ul>
        <template v-if="p.elections.recent.length">
          <div class="sub">Held in the last 45 days</div>
          <ul class="divide-y divide-primary-50">
            <li v-for="e in p.elections.recent" :key="e.id" class="row py-1.5">
              <span class="truncate">{{ e.iso2 ? isoToFlag(e.iso2) + ' ' : '' }}{{ e.country }} <span class="text-primary-400">· {{ e.type }}</span></span>
              <span class="num">{{ when(e) }}</span>
            </li>
          </ul>
        </template>
      </section>

      <!-- UN -->
      <section v-if="p.voting || councilAny" class="card">
        <header class="flex items-baseline justify-between gap-3 mb-3">
          <h3 class="h3">At the UN</h3>
          <NuxtLink to="/elections?tab=council" class="more">Security Council →</NuxtLink>
        </header>
        <div v-if="p.voting" class="mb-4">
          <div class="flex items-baseline gap-3">
            <div class="big">{{ aidPct(p.voting.median, 0) }}</div>
            <div class="lbl">the typical member votes with the group majority on contested General Assembly votes ({{ p.voting.contested }} in the last 5 sessions)</div>
          </div>
          <div v-if="p.voting.leastLoyal.length" class="mt-2 text-sm text-primary-600">
            Most often apart:
            <span v-for="(m, i) in p.voting.leastLoyal.slice(0, 4)" :key="m.iso3">{{ i ? ', ' : '' }}{{ m.name }} <span class="text-primary-400">({{ aidPct(m.pct, 0) }})</span></span>
          </div>
        </div>
        <div v-if="councilAny" class="space-y-1.5 text-sm">
          <div v-if="p.council.sitting.length"><span class="lead">On the Security Council: </span>
            <span v-for="(c, i) in p.council.sitting" :key="c.iso3">{{ i ? ', ' : '' }}{{ c.name }}<span class="text-primary-400"> ({{ c.permanent ? 'permanent' : c.term }})</span></span></div>
          <div v-if="p.council.elected.length"><span class="lead">Elected, joining next: </span>
            <span v-for="(c, i) in p.council.elected" :key="c.iso3">{{ i ? ', ' : '' }}{{ c.name }}</span></div>
          <div v-if="p.council.candidates.length"><span class="lead">Candidates: </span>
            <span v-for="(c, i) in p.council.candidates" :key="c.iso3">{{ i ? ', ' : '' }}{{ c.name }}<span class="text-primary-400"> ({{ c.term }})</span></span></div>
        </div>
      </section>

      <!-- News -->
      <section v-if="p.news && p.news.total" class="card lg:col-span-2">
        <header class="flex items-baseline justify-between gap-3 mb-3">
          <h3 class="h3">This week's news</h3>
          <span class="text-xs text-primary-500">{{ p.news.total }} articles in 7 days<span v-if="newsChange != null" :class="aidChange(newsChange).cls"> {{ aidChange(newsChange).arrow }} {{ aidChange(newsChange).text }} on the week before</span></span>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div class="min-w-0">
            <div class="sub">Most covered</div>
            <ul class="space-y-1.5">
              <li v-for="c in p.news.byCountry.slice(0, 7)" :key="c.iso3" :title="`${c.name}: ${c.n} articles${c.prev != null ? ` (week before: ${c.prev})` : ''}`">
                <div class="row">
                  <NuxtLink :to="`/countries/${c.iso3}/news`" class="truncate hover:text-primary-600">{{ c.iso2 ? isoToFlag(c.iso2) + ' ' : '' }}{{ c.name }}</NuxtLink>
                  <span class="num">{{ c.n }}</span>
                </div>
                <div class="track"><div class="bar" :style="{ width: barW(c.n, maxNews), background: AID_COLORS.blue }" /></div>
              </li>
            </ul>
            <div v-if="p.news.topics.length" class="flex flex-wrap gap-1.5 mt-3">
              <span v-for="t in p.news.topics.slice(0, 6)" :key="t.id" class="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">{{ t.label }} · {{ t.n }}</span>
            </div>
          </div>
          <ul class="md:col-span-2 divide-y divide-primary-50 min-w-0">
            <li v-for="n in p.news.latest.slice(0, 8)" :key="n.id" class="py-2">
              <a :href="n.url" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:text-primary-600 line-clamp-2">{{ n.title }}</a>
              <div class="text-xs text-primary-400 mt-0.5">{{ n.outlet }} · {{ aidDate(n.publishedAt) }}<span v-if="n.countryNames.length"> · {{ n.countryNames.slice(0, 3).join(', ') }}</span></div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { aidUsd, aidPct, aidChange, aidDate, AID_COLORS } from '~/composables/useAidFormat'

const props = defineProps<{ gid: string }>()
const { data: p } = useFetch<any>(() => `/api/groups/${props.gid}/picture`, { lazy: true, server: false })

const councilAny = computed(() => !!p.value && (p.value.council.sitting.length + p.value.council.elected.length + p.value.council.candidates.length) > 0)
const hasAny = computed(() => !!p.value && !!(p.value.aid || p.value.trade || p.value.voting || councilAny.value || p.value.news?.total || p.value.elections.ahead.length))
const maxDonor = computed(() => Math.max(1, ...(p.value?.aid?.topDonors || []).map((d: any) => d.share || 0)))
const maxPartner = computed(() => Math.max(1, ...(p.value?.trade?.partners || []).map((x: any) => x.share || 0)))
const maxNews = computed(() => Math.max(1, ...(p.value?.news?.byCountry || []).map((c: any) => c.n)))
const newsChange = computed(() => (p.value?.news?.prev ? ((p.value.news.total - p.value.news.prev) / p.value.news.prev) * 100 : null))

const barW = (v: number | null, max: number) => `${Math.max(2, ((v || 0) / max) * 100)}%`
const pts = (v: number | null) => (v == null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`)
const tradeUsd = (musd: number) => (musd >= 1e6 ? `$${(musd / 1e6).toFixed(1)}tn` : aidUsd(musd * 1e6))
function when(e: any) {
  if (e.precision === 'day') return aidDate(e.date)
  if (e.precision === 'month') return new Date(e.date + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  return e.date
}
</script>

<style scoped>
.card { @apply bg-white rounded-xl border border-primary-100 p-5 min-w-0; }
.h3 { @apply font-serif text-lg font-bold text-primary-900; }
.more { @apply text-xs text-accent-600 hover:text-accent-700 whitespace-nowrap; }
.big { @apply text-xl font-semibold text-primary-900 tabular-nums leading-tight; }
.lbl { @apply text-xs text-primary-500; }
.sub { @apply text-xs font-medium text-primary-500 uppercase tracking-wide mb-1.5; }
.lead { @apply normal-case tracking-normal text-sm text-primary-500 font-normal; }
.row { @apply flex items-center justify-between gap-3 text-sm text-primary-800 min-w-0; }
.num { @apply tabular-nums text-primary-700 whitespace-nowrap shrink-0; }
.track { @apply h-1.5 rounded-full bg-primary-50 mt-0.5; }
.bar { @apply h-1.5 rounded-full; }
.sw { @apply inline-block w-2.5 h-2.5 rounded-sm; }
</style>
