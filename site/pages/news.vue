<template>
  <div class="news bg-primary-50/40 min-h-screen">
    <VizTip />
    <section class="bg-white border-b border-primary-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <p class="text-[11px] uppercase tracking-[0.14em] text-primary-500">News analysis</p>
        <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">What the world is covering</h1>
        <p class="text-primary-500 mt-3 max-w-3xl leading-relaxed">
          Articles and official statements grouped into stories, with who is covering each one, which countries are drawing attention and which topics are moving.
        </p>
        <p v-if="a" class="text-xs text-primary-400 mt-3">
          {{ a.totals.news.toLocaleString() }} articles and {{ a.totals.statements.toLocaleString() }} official statements from {{ a.totals.outlets }} outlets and offices,
          mentioning {{ a.totals.countries }} countries · updated {{ ago(a.generatedAt) }}
          <template v-if="a.archive"> · archive of {{ a.archive.items.toLocaleString() }} items since {{ fmtDay(a.archive.firstDay) }}</template>
        </p>
      </div>
    </section>

    <!-- Filters -->
    <div class="filters sticky z-20 bg-white/95 backdrop-blur border-b border-primary-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-2">
        <input v-model="search" type="search" placeholder="Search headlines" aria-label="Search headlines" class="flex-1 min-w-[10rem] sm:max-w-xs text-sm rounded-lg ring-1 ring-primary-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-400">
        <select v-model="topic" class="sel" aria-label="Topic">
          <option value="">All topics</option>
          <option v-for="t in TOPIC_OPTIONS" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
        <select v-model="region" class="sel" aria-label="Region">
          <option value="">All regions</option>
          <option v-for="r in a?.regionNames || []" :key="r" :value="r">{{ r }}</option>
        </select>
        <select v-model="country" class="sel max-w-[12rem]" aria-label="Country">
          <option value="">All countries</option>
          <option v-for="c in countryOptions" :key="c.iso3" :value="c.iso3">{{ c.name }}</option>
        </select>
        <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist" aria-label="Kind">
          <button v-for="k in KINDS" :key="k.v" role="tab" :aria-selected="kind === k.v" class="px-2.5 py-1 rounded-full"
            :class="kind === k.v ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="kind = k.v">{{ k.label }}</button>
        </div>
        <button v-if="anyFilter" class="text-xs text-accent-600 hover:underline" @click="clearFilters">Clear</button>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid lg:grid-cols-12 gap-8">
      <!-- ===================== Stories ===================== -->
      <main class="lg:col-span-8 min-w-0">
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="font-serif text-2xl text-primary-900">Top stories</h2>
          <span class="text-xs text-primary-400">last 72 hours · ranked by how many outlets cover them, and how recently</span>
        </div>
        <div v-if="pending && !a" class="space-y-4"><div v-for="i in 5" :key="i" class="skeleton h-36 rounded-2xl" /></div>
        <p v-else-if="!stories.length" class="text-sm text-primary-500 bg-white rounded-2xl ring-1 ring-primary-200/70 p-6">No story is covered by more than one outlet with these filters. The full stream is below.</p>
        <ol class="space-y-4">
          <li v-for="(st, i) in stories.slice(0, shownStories)" :key="st.id" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5">
            <div class="flex gap-4">
              <span class="font-serif text-2xl text-primary-300 tabular-nums leading-none pt-1 w-6 shrink-0">{{ i + 1 }}</span>
              <div class="min-w-0 flex-1">
                <a :href="st.url" target="_blank" rel="noopener" class="font-serif text-xl text-primary-900 hover:text-accent-700 leading-snug">{{ st.headline }}</a>
                <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span class="chip bg-primary-100 text-primary-700">{{ st.outlets }} outlets · {{ st.items }} items</span>
                  <span v-if="st.officialItems" class="chip bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">{{ st.officialItems }} official {{ st.officialItems === 1 ? 'statement' : 'statements' }}</span>
                  <span v-if="st.stateMediaItems" class="chip bg-amber-50 text-amber-800 ring-1 ring-amber-200">{{ st.stateMediaItems }} from state media</span>
                  <button v-for="t in st.topics" :key="t" class="chip ring-1 ring-primary-200 text-primary-600 hover:ring-primary-400" @click="topic = t">{{ topicLabel(t) }}</button>
                  <span class="text-primary-400">· first seen {{ ago(st.firstSeen) }}, latest {{ ago(st.latest) }}</span>
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-1.5">
                  <button v-for="c in st.countries.slice(0, 5)" :key="c" class="text-xs text-primary-700 hover:text-accent-700 inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-primary-50" @click="country = c">
                    <span v-if="meta(c).iso2" aria-hidden="true">{{ flag(meta(c).iso2) }}</span>{{ meta(c).name }}
                  </button>
                </div>
                <!-- momentum: items per 6 hours over the last 72 hours -->
                <div class="mt-3 flex items-end gap-[2px] h-7 max-w-[16rem]" role="img" :aria-label="`Coverage over 72 hours, ${st.items} items`">
                  <div v-for="(n, b) in st.hourly" :key="b" class="flex-1 h-full flex flex-col justify-end"
                    @mousemove="show($event, bucketLabel(b, st.hourly.length), [{ text: `${n} item${n === 1 ? '' : 's'}`, color: '#2a78d6' }])" @mouseleave="hide">
                    <div class="w-full rounded-t-[2px]" :class="n ? 'bg-[#2a78d6]' : 'bg-primary-100'" :style="{ height: n ? Math.max(12, n / maxBucket(st) * 100) + '%' : '2px' }" />
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <button class="text-accent-700 hover:underline" :aria-expanded="openStory === st.id" @click="openStory = openStory === st.id ? '' : st.id">
                    {{ openStory === st.id ? 'Hide coverage' : `Who is covering it (${st.coverage.length})` }}
                  </button>
                  <NuxtLink :to="askLink(st)" class="text-accent-700 hover:underline">Analyse with Ask &rarr;</NuxtLink>
                </div>
                <ul v-if="openStory === st.id" class="mt-3 divide-y divide-primary-100 border-t border-primary-100">
                  <li v-for="c in st.coverage" :key="c.id" class="py-2 text-sm">
                    <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-primary-500">
                      <span class="font-medium text-primary-700">{{ c.outlet }}</span>
                      <span v-if="c.kind === 'statement'" class="chip bg-emerald-50 text-emerald-800">official</span>
                      <span v-if="c.ownership" class="chip bg-amber-50 text-amber-800" :title="`Outlet is ${c.ownership}`">{{ c.ownership }}</span>
                      <span>· {{ ago(c.publishedAt) }}</span>
                    </div>
                    <a :href="c.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-accent-700 leading-snug">{{ c.title }}</a>
                  </li>
                </ul>
              </div>
            </div>
          </li>
        </ol>
        <button v-if="stories.length > shownStories" class="mt-4 text-sm text-accent-700 hover:underline" @click="shownStories += 10">More stories ({{ stories.length - shownStories }})</button>

        <!-- Stream -->
        <div class="mt-12 flex items-baseline justify-between mb-3">
          <h2 class="font-serif text-2xl text-primary-900">Everything, newest first</h2>
          <span class="text-xs text-primary-400">{{ stream?.total?.toLocaleString() || 0 }} items</span>
        </div>
        <div class="bg-white rounded-2xl ring-1 ring-primary-200/70">
          <template v-for="g in streamGroups" :key="g.day">
            <div class="px-5 pt-4 pb-1 text-[11px] uppercase tracking-wider text-primary-400">{{ g.label }}</div>
            <ul class="divide-y divide-primary-50">
              <li v-for="it in g.items" :key="it.id" class="px-5 py-2.5 flex gap-3">
                <span class="w-12 shrink-0 text-xs text-primary-400 tabular-nums pt-0.5">{{ time(it.publishedAt) }}</span>
                <div class="min-w-0">
                  <a :href="it.url" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:text-accent-700 leading-snug">{{ it.title }}</a>
                  <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-primary-500">
                    <span>{{ it.outlet }}</span>
                    <span v-if="it.kind === 'statement'" class="chip bg-emerald-50 text-emerald-800">official</span>
                    <span v-if="it.ownership" class="chip bg-amber-50 text-amber-800">{{ it.ownership }}</span>
                    <button v-for="c in it.countries.slice(0, 3)" :key="c" class="hover:text-accent-700" @click="country = c">{{ streamMeta[c]?.iso2 ? flag(streamMeta[c].iso2) + ' ' : '' }}{{ streamMeta[c]?.name || c }}</button>
                  </div>
                </div>
              </li>
            </ul>
          </template>
          <div class="px-5 py-4 border-t border-primary-100">
            <button v-if="streamItems.length < (stream?.total || 0)" class="text-sm text-accent-700 hover:underline" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? 'Loading…' : 'Show more' }}</button>
            <span v-else class="text-xs text-primary-400">That's everything for these filters.</span>
          </div>
        </div>
      </main>

      <!-- ===================== Side analysis ===================== -->
      <aside class="lg:col-span-4 space-y-6">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-primary-500">Trends over</span>
          <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist" aria-label="Trend period">
            <button v-for="d in [14, 30, 90]" :key="d" role="tab" :aria-selected="days === d" class="px-2.5 py-1 rounded-full"
              :class="days === d ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="days = d">{{ d }} days</button>
          </div>
        </div>
        <!-- Countries -->
        <section class="card">
          <template v-if="a?.trends?.ready && a.rising.length">
            <h2 class="h2">Rising attention</h2>
            <p class="sub">Countries mentioned far more in the last two days than their usual daily level</p>
            <ul class="space-y-2">
              <li v-for="c in a.rising" :key="c.iso3" class="flex items-center gap-2 text-sm">
                <button class="flex-1 min-w-0 text-left truncate text-primary-800 hover:text-accent-700" @click="country = c.iso3">{{ c.iso2 ? flag(c.iso2) + ' ' : '' }}{{ c.name }}</button>
                <Spark :values="c.series" :days="a.days" />
                <span class="w-16 text-right text-xs tabular-nums text-primary-700">×{{ c.ratio.toFixed(1) }}</span>
              </li>
            </ul>
          </template>
          <template v-else>
            <h2 class="h2">Most covered, last 48 hours</h2>
            <p class="sub">Daily trends appear once a week of history has built up (collecting since {{ fmtDay(a?.trends?.historyStart) }}).</p>
            <ul class="space-y-2">
              <li v-for="c in a?.last48 || []" :key="c.iso3" class="flex items-center gap-2 text-sm">
                <button class="w-32 shrink-0 text-left truncate text-primary-800 hover:text-accent-700" @click="country = c.iso3">{{ c.iso2 ? flag(c.iso2) + ' ' : '' }}{{ c.name }}</button>
                <div class="flex-1 h-2 rounded-full bg-primary-100 overflow-hidden"><div class="h-full rounded-full bg-[#2a78d6]" :style="{ width: (c.recent / maxLast48 * 100) + '%' }" /></div>
                <span class="w-12 text-right text-xs tabular-nums text-primary-600">{{ Math.round(c.recent) }}/day</span>
              </li>
            </ul>
          </template>
        </section>

        <!-- Topics -->
        <section class="card">
          <h2 class="h2">Topics</h2>
          <p class="sub">Share of articles{{ a?.trends?.ready ? ', with the change over the last two days' : ', last days' }}. An article can have several topics.</p>
          <ul class="space-y-2">
            <li v-for="t in topicRows" :key="t.id" class="flex items-center gap-2 text-sm">
              <button class="w-36 shrink-0 text-left truncate hover:text-accent-700" :class="topic === t.id ? 'font-semibold text-primary-900' : 'text-primary-800'" @click="topic = topic === t.id ? '' : t.id">{{ t.label }}</button>
              <div class="flex-1 h-2 rounded-full bg-primary-100 overflow-hidden"
                @mousemove="show($event, t.label, [{ text: `${t.total} articles (${Math.round(t.share * 100)}%)`, color: '#2a78d6' }])" @mouseleave="hide">
                <div class="h-full rounded-full bg-[#2a78d6]" :style="{ width: (t.share / maxTopicShare * 100) + '%' }" />
              </div>
              <span class="w-10 text-right text-xs tabular-nums text-primary-600">{{ Math.round(t.share * 100) }}%</span>
              <span v-if="a?.trends?.ready" class="w-10 text-right text-[11px] tabular-nums" :class="t.ratio > 1.3 ? 'text-emerald-700' : t.ratio < 0.77 ? 'text-red-700' : 'text-primary-400'">{{ t.ratio > 1.3 ? '↑' : t.ratio < 0.77 ? '↓' : '→' }}{{ t.ratio.toFixed(1) }}</span>
            </li>
          </ul>
          <p class="text-[11px] text-primary-400 mt-3">Topics are assigned by keywords, so a few articles will be misclassified. {{ Math.round((a?.totals?.topicCoverage || 0) * 100) }}% of articles have at least one topic.</p>
        </section>

        <!-- Regions -->
        <section class="card">
          <h2 class="h2">Regional attention</h2>
          <p class="sub">Articles mentioning a country in each region, last 7 days</p>
          <ul class="space-y-2">
            <li v-for="r in a?.regions || []" :key="r.region" class="flex items-center gap-2 text-sm">
              <button class="w-40 shrink-0 text-left truncate hover:text-accent-700" :class="region === r.region ? 'font-semibold text-primary-900' : 'text-primary-800'" :title="r.region" @click="region = region === r.region ? '' : r.region">{{ shortRegion(r.region) }}</button>
              <div class="flex-1 h-2 rounded-full bg-primary-100 overflow-hidden"><div class="h-full rounded-full bg-[#1baf7a]" :style="{ width: (r.now / maxRegion * 100) + '%' }" /></div>
              <span class="w-10 text-right text-xs tabular-nums text-primary-600">{{ r.now }}</span>
            </li>
          </ul>
        </section>

        <!-- Source mix -->
        <section class="card">
          <h2 class="h2">Who is talking</h2>
          <p class="sub">Items by kind of source, last 7 days</p>
          <div class="flex h-3 rounded-full overflow-hidden gap-[2px] bg-white">
            <div v-for="(m, i) in a?.mix || []" :key="m.kind" :style="{ width: (m.count / mixTotal * 100) + '%', background: MIX_COLORS[i % MIX_COLORS.length] }"
              @mousemove="show($event, cap(m.kind), [{ text: `${m.count} items (${Math.round(m.count / mixTotal * 100)}%)`, color: MIX_COLORS[i % MIX_COLORS.length] }])" @mouseleave="hide" />
          </div>
          <ul class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <li v-for="(m, i) in a?.mix || []" :key="m.kind" class="flex items-center gap-1.5 text-primary-700">
              <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: MIX_COLORS[i % MIX_COLORS.length] }" />{{ cap(m.kind) }} <span class="text-primary-400 tabular-nums">{{ Math.round(m.count / mixTotal * 100) }}%</span>
            </li>
          </ul>
          <p class="text-[11px] text-primary-400 mt-3">State media are outlets run, owned or funded by a government; they are labelled wherever they appear.</p>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { isoToFlag, useCountries } from '~/composables/useGroups'

useHead({ title: 'News analysis — World Country Groups' })
const route = useRoute()
const router = useRouter()
const { show, hide } = useVizTip()

const TOPIC_OPTIONS = [
  { id: 'conflict', label: 'Conflict & security' }, { id: 'diplomacy', label: 'Diplomacy' }, { id: 'politics', label: 'Elections & politics' },
  { id: 'economy', label: 'Economy & trade' }, { id: 'humanitarian', label: 'Humanitarian' }, { id: 'climate', label: 'Climate & environment' },
  { id: 'rights', label: 'Rights & justice' }, { id: 'energy', label: 'Energy' }, { id: 'health', label: 'Health' }, { id: 'migration', label: 'Migration' },
  { id: 'tech', label: 'Technology & cyber' }, { id: 'sanctions', label: 'Sanctions' }, { id: 'multilateral', label: 'UN & multilateral' },
]
const topicLabel = (id: string) => TOPIC_OPTIONS.find(t => t.id === id)?.label || id
const KINDS = [{ v: 'all', label: 'All' }, { v: 'news', label: 'News' }, { v: 'statement', label: 'Official' }] as const
const MIX_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e34948']

// ---------- filters (kept in the URL) ----------
const q0 = route.query
const search = ref(String(q0.q || ''))
const topic = ref(String(q0.topic || ''))
const region = ref(String(q0.region || ''))
const country = ref(String(q0.country || '').toUpperCase())
const kind = ref<'all' | 'news' | 'statement'>((['news', 'statement'].includes(String(q0.kind)) ? q0.kind : 'all') as any)
const days = ref([14, 30, 90].includes(Number(q0.days)) ? Number(q0.days) : 14)
const debounced = ref(search.value)
let t: any = null
watch(search, v => { clearTimeout(t); t = setTimeout(() => { debounced.value = v }, 300) })
const params = computed(() => ({
  ...(debounced.value ? { q: debounced.value } : {}), ...(topic.value ? { topic: topic.value } : {}),
  ...(region.value ? { region: region.value } : {}), ...(country.value ? { country: country.value } : {}),
  ...(kind.value !== 'all' ? { kind: kind.value } : {}),
  ...(days.value !== 14 ? { days: days.value } : {}),
}))
const anyFilter = computed(() => Object.keys(params.value).length > 0)
function clearFilters() { search.value = ''; debounced.value = ''; topic.value = ''; region.value = ''; country.value = ''; kind.value = 'all'; days.value = 14 }
watch(params, (p) => { router.replace({ query: p }); shownStories.value = 10; openStory.value = '' })

// ---------- data ----------
const { data: a, pending } = useFetch<any>('/api/news/analysis', { query: params })
const stories = computed<any[]>(() => a.value?.stories || [])
const shownStories = ref(10)
const openStory = ref('')
const meta = (iso3: string) => a.value?.countryMeta?.[iso3] || { name: iso3, iso2: '' }

const stream = ref<any>(null)
const streamItems = ref<any[]>([])
const streamMeta = ref<Record<string, any>>({})
const loadingMore = ref(false)
async function loadStream(reset = true) {
  const r = await $fetch<any>('/api/news/stream', { query: { ...params.value, offset: reset ? 0 : streamItems.value.length, limit: 40 } })
  stream.value = r
  streamItems.value = reset ? r.items : [...streamItems.value, ...r.items]
  streamMeta.value = { ...(reset ? {} : streamMeta.value), ...r.countryMeta }
}
async function loadMore() { loadingMore.value = true; try { await loadStream(false) } finally { loadingMore.value = false } }
watch(params, () => loadStream(true))
onMounted(() => loadStream(true))
const streamGroups = computed(() => {
  const out: { day: string; label: string; items: any[] }[] = []
  for (const it of streamItems.value) {
    const d = it.publishedAt.slice(0, 10)
    if (!out.length || out[out.length - 1].day !== d) out.push({ day: d, label: dayLabel(d), items: [] })
    out[out.length - 1].items.push(it)
  }
  return out
})

const { countries } = useCountries()
const countryOptions = computed(() => ((countries.value as any[]) || []).filter((c: any) => c.iso3).sort((x: any, y: any) => x.name.localeCompare(y.name)))

// ---------- side panels ----------
const maxLast48 = computed(() => Math.max(1, ...(a.value?.last48 || []).map((c: any) => c.recent)))
const topicRows = computed(() => {
  const list = a.value?.topics || []
  const total = Math.max(1, a.value?.totals?.news || 1)
  return list.map((x: any) => ({ ...x, share: x.total / total })).slice(0, 13)
})
const maxTopicShare = computed(() => Math.max(0.01, ...topicRows.value.map((x: any) => x.share)))
const maxRegion = computed(() => Math.max(1, ...(a.value?.regions || []).map((r: any) => r.now)))
const mixTotal = computed(() => Math.max(1, (a.value?.mix || []).reduce((s: number, m: any) => s + m.count, 0)))

// ---------- helpers ----------
const flag = (iso2: string) => (iso2 ? isoToFlag(iso2) : '')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const shortRegion = (r: string) => r.replace('Middle East, North Africa, Afghanistan & Pakistan', 'Middle East & N. Africa').replace(' & ', ' & ')
function ago(d?: string) {
  if (!d) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  if (m < 60) return `${m || 1} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)} days ago`
}
const time = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
const fmtDay = (d?: string) => (d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
function dayLabel(d: string) {
  const today = new Date().toISOString().slice(0, 10)
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (d === today) return 'Today (UTC)'
  if (d === yest) return 'Yesterday'
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
const maxBucket = (st: any) => Math.max(1, ...st.hourly)
function bucketLabel(b: number, n: number) {
  const hoursAgo = (n - b) * 6
  return hoursAgo <= 6 ? 'Last 6 hours' : `${hoursAgo - 6}–${hoursAgo} hours ago`
}
function askLink(st: any) {
  const names = st.countries.slice(0, 3).map((c: string) => meta(c).name).join(', ')
  return { path: '/ask', query: { q: `Explain this story and its context: "${st.headline}". What are the positions of the countries involved${names ? ` (${names})` : ''}, what is the UN angle, and what has been said officially?`, mode: 'answer', run: '1' } }
}

// small sparkline for the country trends
const Spark = defineComponent({
  props: { values: { type: Array as PropType<number[]>, required: true }, days: { type: Array as PropType<string[]>, default: () => [] } },
  setup(props) {
    return () => {
      const v = props.values as number[]
      const max = Math.max(1, ...v)
      const w = 64, h = 18
      const pts = v.map((x, i) => `${(i / Math.max(1, v.length - 1)) * w},${h - (x / max) * (h - 2) - 1}`).join(' ')
      return h_('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: 'shrink-0', 'aria-hidden': 'true' }, [
        h_('polyline', { points: pts, fill: 'none', stroke: '#2a78d6', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
      ])
    }
  },
})
const h_ = h
</script>

<style scoped>
.filters { top: calc(env(safe-area-inset-top, 0px) + 72px); }
.sel { @apply text-sm rounded-lg ring-1 ring-primary-200 px-2 py-1.5 bg-white min-w-0; }
.chip { @apply inline-flex items-center px-2 py-0.5 rounded-full; }
.card { @apply bg-white rounded-2xl ring-1 ring-primary-200/70 p-5; }
.h2 { @apply font-serif text-xl text-primary-900; }
.sub { @apply text-xs text-primary-500 mt-1 mb-3; }
</style>
