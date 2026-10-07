<template>
  <div v-if="d && hasAny" id="sec-un-secretariat" class="mb-10 scroll-mt-24">
    <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">UN budget and Secretariat</h3>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- dues -->
      <div v-if="b?.pct != null" class="card">
        <div class="lbl">Share of the UN regular budget</div>
        <div class="flex items-baseline gap-2">
          <span class="big">{{ b.pct < 0.01 ? b.pct.toFixed(3) : b.pct.toFixed(2) }}%</span>
          <span class="text-xs text-primary-500">rank {{ b.rank }} of {{ b.of }}</span>
        </div>
        <div class="text-xs text-primary-500">{{ b.period }} scale<span v-if="b.prevPct != null">; {{ b.prevPct }}% in {{ b.prevPeriod }}</span></div>
        <div class="mt-3 text-sm" :class="b.paid ? 'text-emerald-700' : 'text-primary-700'">
          <template v-if="b.paid">✓ Paid its {{ year }} dues in full on {{ day(b.paidDate) }}<span v-if="b.paidUsd"> ({{ usd(b.paidUsd) }})</span><span v-if="b.onTime">, within the due period</span>.</template>
          <template v-else>✗ Not on the {{ year }} honour roll (as of {{ b.asOf }}): it has not paid in full, though it may have paid in part.</template>
        </div>
        <div v-if="b.article19" class="mt-2 text-xs px-2 py-1 rounded bg-red-50 text-red-700">Under Article 19: arrears equal to two years of dues, so it can lose its General Assembly vote.</div>
        <div v-if="b.statements?.length" class="mt-3">
          <div class="lbl">Fifth Committee statements this session</div>
          <ul class="space-y-1 text-[13px]">
            <li v-for="s in b.statements" :key="s.url"><a :href="s.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-accent-600">{{ s.topic || 'Statement' }}</a><span class="text-[11px] text-primary-400"> · {{ day(s.date) }}<span v-if="s.onBehalfOf"> · for {{ s.onBehalfOf }}</span></span></li>
          </ul>
        </div>
        <NuxtLink to="/un-budget#dues" class="more">UN budget and dues →</NuxtLink>
      </div>

      <!-- appointments -->
      <div v-if="d.nationals.length || d.postedHere.length" class="card">
        <template v-if="d.nationals.length">
          <div class="lbl">Nationals appointed by the Secretary-General</div>
          <ul class="space-y-2 text-[13px]">
            <li v-for="a in d.nationals.slice(0, 6)" :key="a.url + a.post">
              <span class="font-medium text-primary-900">{{ a.person }}</span>
              <a :href="a.url" target="_blank" rel="noopener" class="block text-primary-700 hover:text-accent-600 leading-snug">{{ a.post }}</a>
              <span class="text-[11px] text-primary-400">{{ day(a.date) }}</span>
            </li>
          </ul>
        </template>
        <template v-if="d.postedHere.length">
          <div class="lbl" :class="d.nationals.length ? 'mt-4' : ''">Appointed to serve here</div>
          <ul class="space-y-2 text-[13px]">
            <li v-for="a in d.postedHere.slice(0, 4)" :key="a.url + a.post">
              <span class="font-medium text-primary-900">{{ a.person }}</span><span v-if="a.nationalityC" class="text-primary-500"> ({{ a.nationalityC.name }})</span>
              <a :href="a.url" target="_blank" rel="noopener" class="block text-primary-700 hover:text-accent-600 leading-snug">{{ a.post }}</a>
              <span class="text-[11px] text-primary-400">{{ day(a.date) }}</span>
            </li>
          </ul>
        </template>
        <NuxtLink to="/un#sg" class="more">All appointments →</NuxtLink>
      </div>

      <!-- SG statements -->
      <div v-if="d.sgStatements.length" class="card">
        <div class="lbl">The Secretary-General on {{ name }}</div>
        <ul class="space-y-2 text-[13px]">
          <li v-for="s in d.sgStatements.slice(0, 6)" :key="s.url">
            <a :href="s.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-accent-600 leading-snug">{{ s.title }}</a>
            <div class="text-[11px] text-primary-400">{{ day(s.date) }} · {{ s.source }}</div>
          </li>
        </ul>
        <NuxtLink to="/un#sg" class="more">{{ d.sgStatementsTotal }} in the last year →</NuxtLink>
      </div>
    </div>
    <MethodNote>
      <p><strong>Budget share and dues.</strong> The scale of assessments adopted by the General Assembly, and the Committee on Contributions' honour roll of Member States that have paid their regular-budget assessment in full this year (date and amount). Partial payments, and peacekeeping and tribunal assessments, are not shown.</p>
      <p><strong>Appointments and statements.</strong> Headlines from the UN press office, the Secretary-General's website and UN News, as indexed by Google News: appointments since 2023 (most complete for resident coordinators), and statements for the last year, matched to the country by name in the headline. See the UN Monitor for the full method.</p>
    </MethodNote>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ iso: string; name: string }>()
const { data: d } = useFetch<any>(() => `/api/countries/${props.iso}/un-footprint`, { lazy: true, server: false })
const b = computed(() => d.value?.budget)
const hasAny = computed(() => !!d.value && (b.value?.pct != null || d.value.nationals.length || d.value.postedHere.length || d.value.sgStatements.length))
const year = computed(() => (b.value?.asOf || '').match(/\d{4}/)?.[0] || new Date().getFullYear())
const day = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '–')
const usd = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}m` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${v}`)
</script>

<style scoped>
.card { @apply bg-white rounded-xl border border-primary-100 p-5 min-w-0 flex flex-col; }
.lbl { @apply text-xs font-medium text-primary-500 uppercase tracking-wide mb-1.5; }
.big { @apply text-2xl font-semibold text-primary-900 tabular-nums; }
.more { @apply mt-auto pt-3 text-xs text-accent-600 hover:text-accent-700; }
</style>
