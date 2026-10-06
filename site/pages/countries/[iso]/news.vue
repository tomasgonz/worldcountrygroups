<template>
  <div class="bg-primary-50/40 min-h-screen">
    <VizTip />
    <div v-if="error" class="max-w-4xl mx-auto px-4 py-20 text-center">
      <h1 class="font-serif text-2xl text-primary-500">Country not found</h1>
    </div>
    <template v-else-if="country">
      <section class="bg-white border-b border-primary-100">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <nav class="flex items-center gap-2 text-sm text-primary-400 mb-5">
            <NuxtLink to="/countries" class="hover:text-primary-900">Countries</NuxtLink><span>/</span>
            <NuxtLink :to="`/countries/${iso}`" class="hover:text-primary-900">{{ c.name }}</NuxtLink><span>/</span>
            <span class="text-primary-600">News</span>
          </nav>
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div class="flex items-center gap-4">
              <span v-if="c.iso2" class="text-5xl" aria-hidden="true">{{ isoToFlag(c.iso2) }}</span>
              <div>
                <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 leading-tight">{{ c.name }} in the news</h1>
                <p class="text-primary-500 mt-1">Stories, official statements and coverage, updated through the day.</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <NuxtLink :to="{ path: '/ask', query: { q: `What are the most important recent developments concerning ${c.name}, from the news and official statements, and what do they mean for its foreign policy?`, mode: 'answer', run: '1' } }" class="text-sm px-3.5 py-1.5 rounded-full bg-primary-900 text-white hover:bg-primary-800">Summarise the week</NuxtLink>
              <NuxtLink :to="`/news?country=${c.iso3}`" class="text-sm px-3.5 py-1.5 rounded-full ring-1 ring-primary-200 text-primary-700 hover:bg-primary-50">Open in News analysis</NuxtLink>
            </div>
          </div>

          <!-- figures and 30-day trend -->
          <div v-if="a" class="mt-6 grid lg:grid-cols-3 gap-4">
            <div class="grid grid-cols-3 gap-px bg-primary-100 rounded-xl overflow-hidden ring-1 ring-primary-100 lg:col-span-1 text-center">
              <div class="bg-white py-3"><div class="font-serif text-2xl text-primary-900 tabular-nums">{{ week.news }}</div><div class="text-[11px] text-primary-500">articles, 7 days</div></div>
              <div class="bg-white py-3"><div class="font-serif text-2xl text-primary-900 tabular-nums">{{ week.statements }}</div><div class="text-[11px] text-primary-500">official statements</div></div>
              <div class="bg-white py-3"><div class="font-serif text-2xl text-primary-900 tabular-nums">{{ a.totals.outlets }}</div><div class="text-[11px] text-primary-500">outlets and offices</div></div>
            </div>
            <div class="lg:col-span-2 bg-primary-50/50 rounded-xl ring-1 ring-primary-100 px-4 py-3">
              <div class="flex items-baseline justify-between text-xs">
                <span class="font-medium text-primary-800">Coverage per day, last 30 days</span>
                <span class="text-primary-400 flex items-center gap-3"><span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-[#2a78d6]" />news</span><span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-[#1baf7a]" />official</span></span>
              </div>
              <div class="flex items-end gap-[2px] h-16 mt-2">
                <div v-for="(d, i) in a.focus?.days || []" :key="d" class="flex-1 h-full flex flex-col justify-end gap-[1px]" tabindex="0"
                  @mousemove="show($event, fmtDay(d), [{ text: `${a.focus.news[i]} articles`, color: '#2a78d6' }, { text: `${a.focus.statements[i]} official statements`, color: '#1baf7a' }])" @mouseleave="hide">
                  <div class="w-full rounded-t-[2px] bg-[#1baf7a]" :style="{ height: a.focus.statements[i] ? Math.max(3, a.focus.statements[i] / maxDay * 100) + '%' : '0' }" />
                  <div class="w-full bg-[#2a78d6]" :class="a.focus.statements[i] ? '' : 'rounded-t-[2px]'" :style="{ height: a.focus.news[i] ? Math.max(3, a.focus.news[i] / maxDay * 100) + '%' : '1px' }" />
                </div>
              </div>
              <p class="text-[10px] text-primary-400 mt-1">Collected since {{ fmtDay(a.focus?.collectingSince) }}; earlier days are incomplete.</p>
            </div>
          </div>
        </div>
      </section>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <main class="lg:col-span-8 min-w-0 space-y-8">
          <!-- stories -->
          <section>
            <h2 class="font-serif text-2xl text-primary-900 mb-3">Top stories</h2>
            <p v-if="a && !a.stories.length" class="text-sm text-primary-500 bg-white rounded-2xl ring-1 ring-primary-200/70 p-5">No story about {{ c.name }} has been covered by several outlets in the last three days.</p>
            <ol class="space-y-3">
              <li v-for="st in (a?.stories || []).slice(0, 8)" :key="st.id" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-4">
                <a :href="st.url" target="_blank" rel="noopener" class="font-serif text-lg text-primary-900 hover:text-accent-700 leading-snug break-words">{{ st.headline }}</a>
                <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-primary-500">
                  <span class="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">{{ st.outlets }} outlets</span>
                  <span v-if="st.officialItems" class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">{{ st.officialItems }} official</span>
                  <span v-if="st.stateMediaItems" class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">{{ st.stateMediaItems }} state media</span>
                  <span>· latest {{ ago(st.latest) }}</span>
                  <button class="text-accent-700 hover:underline ml-1" @click="openStory = openStory === st.id ? '' : st.id">{{ openStory === st.id ? 'hide' : 'who covers it' }}</button>
                </div>
                <ul v-if="openStory === st.id" class="mt-2 divide-y divide-primary-50 border-t border-primary-100">
                  <li v-for="it in st.coverage" :key="it.id" class="py-1.5 text-sm">
                    <span class="text-[11px] text-primary-500">{{ it.outlet }}<span v-if="it.ownership" class="text-amber-700"> · {{ it.ownership }}</span> · </span>
                    <a :href="it.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-accent-700">{{ it.title }}</a>
                  </li>
                </ul>
              </li>
            </ol>
          </section>

          <!-- official statements and coverage -->
          <section>
            <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 class="font-serif text-2xl text-primary-900">{{ kind === 'statement' ? 'Official statements' : 'All coverage' }}</h2>
              <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist">
                <button v-for="k in KINDS" :key="k.v" role="tab" :aria-selected="kind === k.v" class="px-2.5 py-1 rounded-full" :class="kind === k.v ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="kind = k.v">{{ k.label }}</button>
              </div>
            </div>
            <input v-model="search" type="search" :placeholder="`Search news on ${c.name}`" class="mb-3 w-full sm:max-w-sm text-sm rounded-lg ring-1 ring-primary-200 px-3 py-1.5" aria-label="Search">
            <div class="bg-white rounded-2xl ring-1 ring-primary-200/70">
              <template v-for="g in groups" :key="g.day">
                <div class="px-5 pt-4 pb-1 text-[11px] uppercase tracking-wider text-primary-400">{{ g.label }}</div>
                <ul class="divide-y divide-primary-50">
                  <li v-for="it in g.items" :key="it.id" class="px-5 py-2.5">
                    <a :href="it.url" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:text-accent-700 leading-snug">{{ it.title }}</a>
                    <div class="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-primary-500">
                      <span>{{ it.outlet }}</span>
                      <span v-if="it.kind === 'statement'" class="px-1.5 rounded-full bg-emerald-50 text-emerald-800">official</span>
                      <span v-if="it.ownership" class="text-amber-700">{{ it.ownership }}</span>
                      <span>· {{ time(it.publishedAt) }}</span>
                    </div>
                  </li>
                </ul>
              </template>
              <p v-if="!items.length && !loading" class="px-5 py-6 text-sm text-primary-400">Nothing found.</p>
              <div class="px-5 py-3 border-t border-primary-100">
                <button v-if="items.length < total" class="text-sm text-accent-700 hover:underline" :disabled="loading" @click="more">{{ loading ? 'Loading…' : `Show more (${total - items.length} older)` }}</button>
              </div>
            </div>
          </section>
        </main>

        <aside class="lg:col-span-4 space-y-6 min-w-0">
          <section v-if="election" class="card">
            <h2 class="h2">Next election</h2>
            <p class="text-sm text-primary-800 mt-1"><strong>{{ election.description }}</strong>, {{ election.precision === 'day' ? fmtDay(election.date) : election.date }}</p>
            <ul v-if="electionNews.length" class="mt-2 space-y-1">
              <li v-for="n in electionNews.slice(0, 4)" :key="n.url" class="text-xs leading-snug"><a :href="n.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-accent-700">{{ n.title }}</a> <span class="text-primary-400">· {{ n.outlet }}</span></li>
            </ul>
            <NuxtLink to="/elections?tab=national" class="text-xs text-accent-700 hover:underline mt-2 inline-block">All elections &rarr;</NuxtLink>
          </section>

          <section class="card">
            <h2 class="h2">Topics</h2>
            <p class="sub">What coverage of {{ c.name }} is about</p>
            <ul class="space-y-2">
              <li v-for="t in topicRows" :key="t.id" class="flex items-center gap-2 text-sm">
                <span class="w-36 shrink-0 truncate text-primary-800">{{ t.label }}</span>
                <div class="flex-1 h-2 rounded-full bg-primary-100 overflow-hidden"><div class="h-full rounded-full bg-[#2a78d6]" :style="{ width: (t.share / maxTopic * 100) + '%' }" /></div>
                <span class="w-10 text-right text-xs tabular-nums text-primary-600">{{ Math.round(t.share * 100) }}%</span>
              </li>
            </ul>
          </section>

          <section class="card">
            <h2 class="h2">Mentioned together</h2>
            <p class="sub">Countries that appear most often in the same stories</p>
            <ul class="space-y-1.5">
              <li v-for="m in together" :key="m.iso3" class="flex items-center justify-between text-sm">
                <NuxtLink :to="`/countries/${m.iso3.toLowerCase()}/news`" class="text-primary-800 hover:text-accent-700">{{ m.iso2 ? isoToFlag(m.iso2) + ' ' : '' }}{{ m.name }}</NuxtLink>
                <span class="text-xs tabular-nums text-primary-500">{{ m.total }}</span>
              </li>
            </ul>
          </section>

          <section class="card">
            <h2 class="h2">Who is talking</h2>
            <p class="sub">Items by kind of source, last 7 days</p>
            <ul class="space-y-1 text-sm">
              <li v-for="m in a?.mix || []" :key="m.kind" class="flex justify-between"><span class="text-primary-700">{{ m.kind.charAt(0).toUpperCase() + m.kind.slice(1) }}</span><span class="tabular-nums text-primary-500">{{ m.count }}</span></li>
            </ul>
          </section>

          <section class="card">
            <h2 class="h2">Ask about {{ c.name }}</h2>
            <AskButtons kind="country" :name="c.name" :iso3="c.iso3" class="mt-3" />
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

const route = useRoute()
const iso = route.params.iso as string
const { country, error } = useCountry(iso)
const c = computed<any>(() => country.value || {})
useHead({ title: computed(() => `${c.value.name || 'Country'} in the news — World Country Groups`) })
const { show, hide } = useVizTip()

const { data: a, execute: loadAnalysis } = useFetch<any>('/api/news/analysis', { query: computed(() => ({ country: c.value.iso3, days: 30 })), server: false, immediate: false, watch: false })
watch(() => c.value.iso3, (v) => { if (v) loadAnalysis() }, { immediate: true })

const week = computed(() => {
  const f = a.value?.focus
  if (!f) return { news: 0, statements: 0 }
  return { news: f.news.slice(-7).reduce((x: number, y: number) => x + y, 0), statements: f.statements.slice(-7).reduce((x: number, y: number) => x + y, 0) }
})
const maxDay = computed(() => Math.max(1, ...((a.value?.focus?.days || []).map((_: any, i: number) => a.value.focus.news[i] + a.value.focus.statements[i]))))
const topicRows = computed(() => {
  const total = Math.max(1, a.value?.totals?.news || 1)
  return (a.value?.topics || []).map((t: any) => ({ ...t, share: t.total / total })).slice(0, 8)
})
const maxTopic = computed(() => Math.max(0.01, ...topicRows.value.map((t: any) => t.share)))
const together = computed(() => (a.value?.mostCovered || []).filter((m: any) => m.iso3 !== c.value.iso3).slice(0, 8))
const openStory = ref('')

// stream (live feed, then the archive)
const KINDS = [{ v: 'all', label: 'All' }, { v: 'news', label: 'News' }, { v: 'statement', label: 'Official' }] as const
const kind = ref<'all' | 'news' | 'statement'>('all')
const search = ref('')
const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
let t: any = null
async function load(reset = true) {
  if (!c.value.iso3) return
  loading.value = true
  try {
    const r = await $fetch<any>('/api/news/stream', { query: { country: c.value.iso3, kind: kind.value === 'all' ? undefined : kind.value, q: search.value || undefined, offset: reset ? 0 : items.value.length, limit: 40 } })
    items.value = reset ? r.items : [...items.value, ...r.items]
    total.value = r.total
  } finally { loading.value = false }
}
const more = () => load(false)
watch([kind, () => c.value.iso3], () => load(true))
watch(search, () => { clearTimeout(t); t = setTimeout(() => load(true), 300) })
onMounted(() => load(true))
const groups = computed(() => {
  const out: { day: string; label: string; items: any[] }[] = []
  for (const it of items.value) {
    const d = it.publishedAt.slice(0, 10)
    if (!out.length || out[out.length - 1].day !== d) out.push({ day: d, label: dayLabel(d), items: [] })
    out[out.length - 1].items.push(it)
  }
  return out
})

// next election and its news
const { data: el, execute: loadElection } = useFetch<any>('/api/elections', { query: computed(() => ({ iso3: c.value.iso3 })), server: false, immediate: false, watch: false })
watch(() => c.value.iso3, (v) => { if (v) loadElection() }, { immediate: true })
const election = computed(() => el.value?.next || null)
const { data: en } = useFetch<any>('/api/elections/news', { query: { section: 'national' }, server: false })
const electionNews = computed(() => {
  const e = election.value
  if (!e) return []
  const hit: any = Object.values<any>(en.value?.national || {}).find((x: any) => x.iso3 === c.value.iso3 && x.date === e.date)
  return hit?.items || []
})

function ago(d?: string) {
  if (!d) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  if (m < 60) return `${m || 1} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)} days ago`
}
const time = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
const fmtDay = (d?: string | null) => (d ? new Date(d.length === 10 ? d + 'T12:00:00Z' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
function dayLabel(d: string) {
  const today = new Date().toISOString().slice(0, 10)
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  return d === today ? 'Today (UTC)' : d === yest ? 'Yesterday' : new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
</script>

<style scoped>
.card { @apply bg-white rounded-2xl ring-1 ring-primary-200/70 p-5; }
.h2 { @apply font-serif text-xl text-primary-900; }
.sub { @apply text-xs text-primary-500 mt-1 mb-3; }
</style>
