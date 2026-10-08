<template>
  <section v-if="g" class="mb-12 rounded-2xl border border-primary-100 bg-white p-5 sm:p-6">
    <div class="flex flex-wrap items-baseline justify-between gap-2 mb-4">
      <h2 class="font-serif text-2xl font-bold text-primary-900">This week at a glance</h2>
      <span class="text-xs text-primary-400">Last 7 days · details in the sections below</span>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-primary-100 rounded-xl overflow-hidden ring-1 ring-primary-100">
      <a href="#cat-media" class="tile"><div class="big">{{ g.week.news }}</div><div class="lbl">news items</div><div class="sub">{{ g.week.statements }} official statements</div></a>
      <a href="#cat-united-nations" class="tile">
        <div class="big">{{ g.withMajority ? g.withMajority.pct + '%' : '–' }}</div><div class="lbl">votes with the General Assembly majority</div>
        <div v-if="g.withMajority" class="sub">contested votes, session {{ g.withMajority.session }} · rank {{ g.withMajority.rank }} of {{ g.withMajority.of }}</div>
      </a>
      <div class="tile">
        <div class="big text-lg leading-snug">{{ g.nextElection ? g.nextElection.type : 'None scheduled' }}</div><div class="lbl">next national election</div>
        <div v-if="g.nextElection" class="sub">{{ g.nextElection.precision === 'day' ? day(g.nextElection.date) : g.nextElection.date }}</div>
      </div>
      <a href="#cat-united-nations" class="tile">
        <div class="big text-lg leading-snug">{{ g.pr ? g.pr.name : '–' }}</div><div class="lbl">Permanent Representative in New York</div>
        <div class="sub"><span v-if="g.council">{{ g.council.permanent ? 'Permanent Security Council member' : `On the Security Council to ${g.council.termEnd}` }} · </span><span v-if="g.dues">UN dues {{ g.dues.paid ? 'paid in full' : 'not paid in full' }}</span></div>
      </a>
    </div>

    <div class="grid md:grid-cols-2 gap-x-8 gap-y-2 mt-5 text-[13px]">
      <ul class="space-y-2 min-w-0">
        <li v-for="v in g.week.ga.slice(0, 3)" :key="v.id" class="row"><span class="tag">GA vote</span><span>Voted <strong :class="v.againstMajority ? 'text-red-700' : ''">{{ v.vote }}</strong><span v-if="v.againstMajority" class="text-red-700"> (against the majority)</span> · <a :href="v.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ v.title }}</a></span></li>
        <li v-for="v in g.week.sc.slice(0, 2)" :key="v.id" class="row"><span class="tag">Council</span><span>Voted <strong>{{ v.vote }}</strong> on {{ v.id }}</span></li>
        <li v-if="g.week.topStatement" class="row"><span class="tag">Official</span><span><a :href="g.week.topStatement.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ g.week.topStatement.title }}</a> <span class="when">{{ g.week.topStatement.outlet }}</span></span></li>
        <li v-if="g.week.topNews" class="row"><span class="tag">News</span><span><a :href="g.week.topNews.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ g.week.topNews.title }}</a> <span class="when">{{ g.week.topNews.outlet }}</span></span></li>
      </ul>
      <ul class="space-y-2 min-w-0">
        <li v-for="a in g.week.appointments" :key="a.url" class="row"><span class="tag">Appointed</span><span>{{ a.person }}, {{ a.post }} <span class="when">{{ a.kind }}</span></span></li>
        <li v-for="q in g.week.quotes.slice(0, 2)" :key="q.q" class="row"><span class="tag">Quote</span><span>“{{ q.q }}” <span class="when">{{ q.speaker }}</span></span></li>
        <li v-for="s in g.week.sgStatements.slice(0, 1)" :key="s.url" class="row"><span class="tag">SG</span><a :href="s.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ s.title }}</a></li>
        <li v-if="g.trade" class="row"><span class="tag">Trade</span><span>Main partner {{ g.trade.topPartner }}<span v-if="g.trade.share"> ({{ Math.round(g.trade.share) }}% of trade, {{ g.trade.year }})</span></span></li>
        <li v-if="g.aid" class="row"><span class="tag">Aid</span><span v-if="g.aid.role === 'donor'">Gave {{ usd(g.aid.usd) }} in aid ({{ g.aid.year }}<span v-if="g.aid.gniPct">, {{ g.aid.gniPct }}% of national income</span>)</span><span v-else>Received {{ usd(g.aid.usd) }} in aid ({{ g.aid.year }})<span v-if="g.aid.topDonor">; main donor {{ g.aid.topDonor }}</span></span></li>
      </ul>
    </div>
    <p v-if="quiet" class="text-sm text-primary-400 mt-3">A quiet week: no votes, appointments or quotes recorded in the last 7 days.</p>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ iso: string }>()
const { data: g } = useFetch<any>(() => `/api/countries/${props.iso}/glance`, { lazy: true, server: false })
const quiet = computed(() => g.value && !g.value.week.ga.length && !g.value.week.sc.length && !g.value.week.appointments.length && !g.value.week.quotes.length)
const day = (iso: string) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '')
const usd = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}bn` : v >= 1e6 ? `$${Math.round(v / 1e6)}m` : `$${Math.round(v)}`)
</script>

<style scoped>
.tile { @apply block bg-white px-4 py-3 hover:bg-primary-50/50 min-w-0; }
.big { @apply font-serif text-2xl text-primary-900 tabular-nums truncate; }
.lbl { @apply text-xs text-primary-500 mt-0.5; }
.sub { @apply text-[11px] text-primary-400 mt-0.5; }
.row { @apply flex gap-2 items-baseline; }
.tag { @apply shrink-0 text-[10px] uppercase tracking-wide font-semibold text-primary-500 bg-primary-50 rounded px-1.5 py-0.5 w-[4.6rem] text-center; }
.when { @apply text-[11px] text-primary-400; }
</style>
