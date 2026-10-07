<template>
  <section id="sg" class="scroll-mt-24">
    <div class="flex flex-wrap items-end justify-between gap-2 mb-4 pb-2 border-b-2 border-[#009edb]/30">
      <h2 class="font-serif text-3xl text-primary-900">Secretary-General</h2>
      <span class="text-[11px] text-primary-400">Statements and senior appointments<span v-if="d?.meta.updatedAt"> · updated {{ stamp(d.meta.updatedAt) }}</span></span>
    </div>

    <div v-if="!d" class="skeleton h-64 rounded-2xl" />
    <div v-else-if="!d.available" class="card text-sm text-primary-500">Not collected yet.</div>
    <template v-else>
      <div class="grid lg:grid-cols-5 gap-6">
        <!-- Statements -->
        <div class="card lg:col-span-3 min-w-0">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="h3">Statements, messages and remarks</h3>
            <span class="text-xs text-primary-500">{{ d.statementsTotal }} {{ kind || q ? 'matching' : 'collected' }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 mt-3 mb-3">
            <button v-for="k in kindChips" :key="k.id" class="pill" :class="kind === k.id ? 'pill-on' : ''" @click="kind = kind === k.id ? '' : k.id">{{ k.label }} <span class="text-primary-400 tabular-nums">{{ k.n }}</span></button>
            <input v-model.trim="qInput" type="search" placeholder="Search headlines…" class="ml-auto w-full sm:w-44 text-sm px-3 py-1 rounded-lg ring-1 ring-sky-200 focus:ring-[#009edb] outline-none" @keyup.enter="q = qInput" @search="q = qInput">
          </div>
          <!-- weekly volume -->
          <div class="flex items-end gap-[3px] h-10 mb-1" aria-label="Statements per week, last 12 weeks">
            <div v-for="w in d.stats.statementWeeks" :key="w.week" class="flex-1 rounded-t-[3px] bg-[#2a78d6] min-h-[2px]" :style="{ height: `${(w.n / maxWeek) * 100}%` }"
              @mousemove="show($event, `Week of ${day(w.week)}`, [{ text: `${w.n} items`, color: '#2a78d6' }])" @mouseleave="hide" />
          </div>
          <div class="flex justify-between text-[10px] text-primary-400 mb-3"><span>12 weeks ago</span><span>items per week</span><span>this week</span></div>
          <ul class="divide-y divide-sky-50">
            <li v-for="s in shownStatements" :key="s.url + s.title" class="py-2.5">
              <a :href="s.url" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:text-[#0077b6] leading-snug">{{ s.title }}</a>
              <div class="text-[11px] text-primary-400 mt-0.5">
                {{ day(s.date) }} · {{ kindLabel(s.kind) }} · {{ s.source }}
                <span v-if="s.countriesC.length"> · <NuxtLink v-for="(c, i) in s.countriesC.slice(0, 4)" :key="c.iso3" :to="`/countries/${c.iso3.toLowerCase()}`" class="hover:text-[#0077b6]">{{ i ? ', ' : '' }}{{ flag(c.iso2) }} {{ c.name }}</NuxtLink></span>
              </div>
            </li>
            <li v-if="!shownStatements.length" class="py-3 text-sm text-primary-400">Nothing matches.</li>
          </ul>
          <button v-if="d.statements.length > showS" class="mt-2 text-xs text-[#0077b6] hover:underline" @click="showS += 15">Show more</button>
        </div>

        <!-- Appointments -->
        <div class="card lg:col-span-2 min-w-0">
          <h3 class="h3">Senior appointments</h3>
          <div class="grid grid-cols-3 gap-2 mt-3 mb-3">
            <div v-for="t in apptTiles" :key="t.label" class="rounded-lg bg-[#f1f8fd] px-3 py-2">
              <div class="font-serif text-2xl text-primary-900 tabular-nums leading-none">{{ t.n }}</div>
              <div class="text-[11px] text-primary-500 mt-1 leading-tight">{{ t.label }}</div>
            </div>
          </div>
          <p class="text-[11px] text-primary-400 -mt-1 mb-3">Last 12 months</p>
          <div class="flex flex-wrap gap-1.5 mb-3">
            <button v-for="c in categoryChips" :key="c.id" class="pill" :class="category === c.id ? 'pill-on' : ''" @click="category = category === c.id ? '' : c.id">{{ c.short }}</button>
          </div>
          <ul class="divide-y divide-sky-50">
            <li v-for="a in d.appointments.slice(0, showA)" :key="a.url + a.post" class="py-2.5">
              <div class="text-sm text-primary-900 leading-snug">
                <span v-if="a.person" class="font-medium">{{ a.person }}</span>{{ ' ' }}
                <NuxtLink v-if="a.nationalityC" :to="`/countries/${a.nationalityC.iso3.toLowerCase()}`" class="text-primary-500 hover:text-[#0077b6]"> {{ flag(a.nationalityC.iso2) }} {{ a.nationalityC.name }}</NuxtLink>
              </div>
              <a :href="a.url" target="_blank" rel="noopener" class="text-[13px] text-primary-700 hover:text-[#0077b6] leading-snug">{{ a.post }}</a>
              <div class="text-[11px] text-primary-400 mt-0.5">{{ day(a.date) }} · {{ catShort(a.category) }}<span v-if="a.acting"> · acting</span></div>
            </li>
            <li v-if="!d.appointments.length" class="py-3 text-sm text-primary-400">Nothing matches.</li>
          </ul>
          <button v-if="d.appointments.length > showA" class="mt-2 text-xs text-[#0077b6] hover:underline" @click="showA += 15">Show more</button>
        </div>
      </div>

      <!-- Who gets appointed / who is mentioned -->
      <div class="grid lg:grid-cols-3 gap-6 mt-6">
        <div class="card min-w-0">
          <h3 class="h3">Appointees by region of nationality</h3>
          <p class="sub">{{ d.stats.people36m }} people appointed in the last 3 years<span v-if="d.stats.unknownNationality"> ({{ d.stats.unknownNationality }} with no nationality in the headline)</span></p>
          <ul class="space-y-1.5">
            <li v-for="r in d.stats.byRegion" :key="r.region" @mousemove="show($event, r.region, [{ text: `${r.n} appointees`, color: '#2a78d6' }])" @mouseleave="hide">
              <div class="flex justify-between text-sm text-primary-800"><span class="truncate">{{ r.region }}</span><span class="tabular-nums text-primary-600">{{ r.n }}</span></div>
              <div class="h-1.5 rounded-full bg-sky-50"><div class="h-1.5 rounded-full bg-[#2a78d6]" :style="{ width: `${(r.n / maxRegion) * 100}%` }" /></div>
            </li>
          </ul>
        </div>
        <div class="card min-w-0">
          <h3 class="h3">Most frequent nationalities</h3>
          <p class="sub">Same period; each appointment counts once</p>
          <div class="flex flex-wrap gap-1.5">
            <NuxtLink v-for="c in d.stats.byNationality" :key="c.iso3" :to="`/countries/${c.iso3.toLowerCase()}`" class="chip">{{ flag(c.iso2) }} {{ c.name }} <span class="text-primary-400 tabular-nums">{{ c.n }}</span></NuxtLink>
          </div>
        </div>
        <div class="card min-w-0">
          <h3 class="h3">Countries in the headlines</h3>
          <p class="sub">Named in the Secretary-General's statements, last 90 days</p>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="c in d.stats.mentioned90d" :key="c.iso3" class="chip" :class="country === c.iso3 ? 'ring-[#009edb] text-[#0077b6]' : ''" @click="country = country === c.iso3 ? '' : c.iso3">{{ flag(c.iso2) }} {{ c.name }} <span class="text-primary-400 tabular-nums">{{ c.n }}</span></button>
          </div>
          <p v-if="country" class="text-xs text-primary-500 mt-2">Showing items about {{ d.stats.mentioned90d.find((c: any) => c.iso3 === country)?.name || country }}. <button class="text-[#0077b6] hover:underline" @click="country = ''">Clear</button></p>
        </div>
      </div>

      <MethodNote class="mt-4">
        <p><strong>Source.</strong> {{ d.meta.source }}. The UN's own pages block automated access, so the site reads the headline, date and link of each item as indexed by Google News and links to the original. Checked every 3 hours since {{ day(d.meta.firstRun) }}, with a backfill of three years for appointments (a few older ones appear where indexed) and one year for statements.</p>
        <p><strong>Appointments.</strong> Headlines of the form "Secretary-General appoints <em>name</em> of <em>country</em> as <em>post</em>" are split into person, nationality and post; countries named in the post (for example "Resident Coordinator in Egypt") are recorded as the duty country. Categories come from the post title: resident and humanitarian coordinators; envoys and special representatives; peace operations leadership (force commanders, police commissioners, heads and deputy heads of mission); under- and assistant secretaries-general and heads of funds and programmes; panels and advisory bodies.</p>
        <p><strong>Coverage.</strong> Most complete for resident coordinators, whose appointments the UN Development Coordination Office publishes systematically. Other senior appointments appear only when Google News has indexed the press release, so counts are a lower bound, not an official tally. The UN's official senior-appointments list is not readable automatically.</p>
        <p><strong>Nationality and region.</strong> Nationality as stated in the headline; region is the World Bank region of that country. Some headlines give no nationality and are counted separately.</p>
        <p><strong>Statements.</strong> Items from UN sites (press.un.org, un.org/sg, UN News, UN media) whose headline names the Secretary-General, Mr. Guterres, "UN chief" or his Spokesperson. The type (message, remarks, readout, Spokesperson's statement, note to correspondents, statement) is read from the headline wording. UN News stories report what the Secretary-General said rather than reproduce it. Countries are those named in the headline.</p>
      </MethodNote>
    </template>
  </section>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

const { show, hide } = useVizTip()
const kind = ref('')
const category = ref('')
const country = ref('')
const q = ref('')
const qInput = ref('')
const showS = ref(12)
const showA = ref(10)

const query = computed(() => ({ kind: kind.value || undefined, category: category.value || undefined, country: country.value || undefined, q: q.value || undefined, more: 1 }))
const { data: d } = useFetch<any>('/api/un/sg-office', { query, lazy: true, server: false })
watch(query, () => { showS.value = 12; showA.value = 10 })

const flag = (iso2: string | null) => (iso2 ? isoToFlag(iso2) : '')
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '–')
const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const SHORT: Record<string, string> = { 'resident-coordinator': 'Resident coordinators', envoy: 'Envoys', mission: 'Peace operations', senior: 'USG / ASG', body: 'Panels', other: 'Other' }
const catShort = (c: string) => SHORT[c] || c
const KINDS: Record<string, string> = { statement: 'Statement', readout: 'Readout', remarks: 'Remarks', message: 'Message', spokesperson: "Spokesperson's statement", note: 'Note to correspondents' }
const kindLabel = (k: string) => KINDS[k] || k

const shownStatements = computed(() => (d.value?.statements || []).slice(0, showS.value))
const maxWeek = computed(() => Math.max(1, ...(d.value?.stats.statementWeeks || []).map((w: any) => w.n)))
const maxRegion = computed(() => Math.max(1, ...(d.value?.stats.byRegion || []).map((r: any) => r.n)))
const kindChips = computed(() => (d.value?.stats.statementKinds || []).map((k: any) => ({ id: k.kind, n: k.n, label: kindLabel(k.kind) })))
const categoryChips = computed(() => Object.keys(SHORT).filter(k => (d.value?.stats.appointments12m || {})[k] || k === category.value).map(id => ({ id, short: SHORT[id] })))
const apptTiles = computed(() => {
  const c = d.value?.stats.appointments12m || {}
  const total = Object.entries(c).filter(([k]) => k !== 'body').reduce((a, [, n]) => a + (n as number), 0)
  return [
    { label: 'people appointed', n: total },
    { label: 'resident coordinators', n: c['resident-coordinator'] || 0 },
    { label: 'envoys, USGs, ASGs, mission heads', n: (c.envoy || 0) + (c.senior || 0) + (c.mission || 0) },
  ]
})
</script>

<style scoped>
.card { @apply bg-white rounded-2xl ring-1 ring-sky-100 p-5; }
.h3 { @apply font-serif text-xl text-primary-900; }
.sub { @apply text-xs text-primary-500 mt-1 mb-3; }
.chip { @apply inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#f1f8fd] ring-1 ring-sky-100 text-xs text-primary-700 hover:ring-[#009edb]; }
.pill { @apply text-xs px-2.5 py-1 rounded-full ring-1 ring-sky-200 text-primary-700 hover:ring-[#009edb]; }
.pill-on { @apply bg-[#0077b6] text-white ring-[#0077b6]; }
.pill-on span { @apply text-sky-100; }
</style>
