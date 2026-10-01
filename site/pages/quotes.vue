<template>
  <div class="bg-primary-50/40 min-h-screen">
    <VizTip />
    <!-- ===================== Hero + search ===================== -->
    <section class="bg-white border-b border-primary-100">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p class="text-[11px] uppercase tracking-[0.14em] text-primary-500">UN General Debate &middot; 1946&ndash;{{ latestYear }}</p>
        <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">Quote explorer</h1>
        <p class="text-primary-500 mt-3 max-w-3xl leading-relaxed">
          Search {{ meta ? meta.total.toLocaleString() : '' }} key passages from leaders' and delegations' speeches at the General Assembly.
          Each quote is checked against the speech text before it is shown.
        </p>

        <form class="mt-6 flex gap-2 max-w-3xl" role="search" @submit.prevent="apply">
          <div class="relative flex-1">
            <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path stroke-linecap="round" d="M20 20l-3.5-3.5" /></svg>
            <input v-model="draft" type="search" aria-label="Search quotes" placeholder='Words, a leader or a country. Use "quotes" for an exact phrase'
              class="w-full pl-10 pr-3 py-3 rounded-xl ring-1 ring-primary-200 focus:ring-2 focus:ring-accent-400 focus:outline-none text-[15px]" />
          </div>
          <button class="px-5 rounded-xl bg-primary-900 text-white text-sm hover:bg-primary-800">Search</button>
        </form>
        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          <span class="text-primary-400 self-center">Try:</span>
          <button v-for="s in SUGGESTIONS" :key="s.label" class="px-2.5 py-1 rounded-full ring-1 ring-primary-200 text-primary-600 hover:ring-primary-400" @click="preset(s)">{{ s.label }}</button>
        </div>
      </div>
    </section>

    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid lg:grid-cols-12 gap-8">
      <!-- ===================== Filters & facets ===================== -->
      <aside class="lg:col-span-4 space-y-5">
        <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-xl text-primary-900">Filters</h2>
            <button v-if="activeCount" class="text-xs text-accent-600 hover:text-accent-700" @click="reset">Clear all</button>
          </div>
          <label class="block">
            <span class="lbl">Country</span>
            <select v-model="f.country" class="ctl" @change="apply">
              <option value="">All countries</option>
              <option v-for="c in countryOptions" :key="c.iso3" :value="c.iso3">{{ c.name }}</option>
            </select>
          </label>
          <label class="block">
            <span class="lbl">Speaker</span>
            <input v-model="f.speaker" class="ctl" placeholder="e.g. Mandela, Lula, Merkel" @change="apply" @keyup.enter="apply" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block"><span class="lbl">From</span><input v-model.number="f.from" type="number" min="1946" :max="latestYear" class="ctl" placeholder="1946" @change="apply" /></label>
            <label class="block"><span class="lbl">To</span><input v-model.number="f.to" type="number" min="1946" :max="latestYear" class="ctl" :placeholder="String(latestYear)" @change="apply" /></label>
          </div>
          <label class="block">
            <span class="lbl">Theme of the speech</span>
            <select v-model="f.theme" class="ctl" @change="apply">
              <option value="">Any theme</option>
              <option v-for="t in THEMES" :key="t" :value="t">{{ themeLabel(t) }}</option>
            </select>
          </label>
          <label class="block">
            <span class="lbl">Speaker level</span>
            <select v-model="f.level" class="ctl" @change="apply">
              <option value="">Any level</option>
              <option v-for="l in LEVELS" :key="l" :value="l">{{ l }}</option>
            </select>
            <span class="text-[11px] text-primary-400">Speaker names and titles are recorded from 2025 onward.</span>
          </label>
          <label class="block">
            <span class="lbl">Verification</span>
            <select v-model="f.status" class="ctl" @change="apply">
              <option value="verified">Found in the speech text</option>
              <option value="exact">Verbatim only</option>
              <option value="all">Include unconfirmed</option>
            </select>
          </label>
        </div>

        <!-- facets -->
        <div v-if="res?.facets?.decades?.length" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5">
          <h3 class="lbl !mb-3">Matches by decade</h3>
          <div class="flex items-end gap-1 h-24">
            <button v-for="d in res.facets.decades" :key="d.decade" class="flex-1 flex flex-col items-center justify-end h-full group" :aria-label="`${d.decade}s: ${d.count} quotes`"
              @click="setDecade(d.decade)" @mousemove="tipShow($event, `${d.decade}s`, [{ text: `${d.count.toLocaleString()} quotes`, color: '#2a78d6' }])" @mouseleave="tipHide">
              <span class="w-full rounded-t-[4px] bg-accent-600 group-hover:bg-accent-700" :style="{ height: Math.max(3, (d.count / decadeMax) * 100) + '%' }" />
            </button>
          </div>
          <div class="flex gap-1 mt-1">
            <span v-for="d in res.facets.decades" :key="d.decade" class="flex-1 text-center text-[9px] text-primary-400">{{ String(d.decade).slice(2) }}s</span>
          </div>
        </div>

        <div v-if="res?.facets?.speakers?.length" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5">
          <h3 class="lbl !mb-2">Leaders in these results</h3>
          <ul class="space-y-1">
            <li v-for="s in res.facets.speakers" :key="s.speaker + s.iso3">
              <button class="w-full flex items-center justify-between gap-2 text-left text-sm py-1 hover:text-accent-700" @click="pickSpeaker(s)">
                <span class="truncate"><span class="mr-1">{{ flag(s.iso2) }}</span>{{ s.speaker }}</span>
                <span class="text-xs text-primary-400 tabular-nums shrink-0">{{ s.count }}</span>
              </button>
            </li>
          </ul>
        </div>

        <div v-if="res?.facets?.countries?.length" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5">
          <h3 class="lbl !mb-2">Countries in these results</h3>
          <ul class="space-y-1">
            <li v-for="c in res.facets.countries" :key="c.iso3">
              <button class="w-full flex items-center gap-2 text-left text-sm py-0.5 hover:text-accent-700" @click="f.country = c.iso3; apply()">
                <span class="w-36 truncate"><span class="mr-1">{{ flag(c.iso2) }}</span>{{ c.name }}</span>
                <span class="flex-1 h-1.5 rounded-full bg-primary-100 overflow-hidden"><span class="block h-full bg-accent-600 rounded-full" :style="{ width: (c.count / res.facets.countries[0].count) * 100 + '%' }" /></span>
                <span class="text-xs text-primary-400 tabular-nums w-10 text-right">{{ c.count }}</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>

      <!-- ===================== Results ===================== -->
      <main class="lg:col-span-8 min-w-0">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p class="text-sm text-primary-600" aria-live="polite">
            <template v-if="pending && !res">Searching…</template>
            <template v-else-if="res"><strong class="text-primary-900">{{ res.total.toLocaleString() }}</strong>{{ ` ${res.total === 1 ? 'quote' : 'quotes'} ${summary}` }}</template>
          </p>
          <div class="flex items-center gap-2 text-xs">
            <span class="text-primary-400">Sort</span>
            <div class="flex rounded-full bg-primary-100 p-0.5" role="tablist">
              <button v-for="s in SORTS" :key="s.v" role="tab" :aria-selected="f.sort === s.v" class="px-3 py-1 rounded-full"
                :class="f.sort === s.v ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-800'" @click="f.sort = s.v; apply()">{{ s.label }}</button>
            </div>
          </div>
        </div>

        <div v-if="chips.length" class="flex flex-wrap gap-2 mb-4">
          <button v-for="c in chips" :key="c.key" class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary-900 text-white" @click="clear(c.key)">
            {{ c.label }} <span aria-hidden="true">&times;</span><span class="sr-only">remove filter</span>
          </button>
        </div>

        <ul class="space-y-4">
          <li v-for="x in items" :key="x.id" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 group">
            <blockquote class="font-serif text-xl sm:text-[1.35rem] leading-snug text-primary-900" v-html="'&ldquo;' + highlight(x.q) + '&rdquo;'" />
            <div class="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span class="text-lg leading-none">{{ flag(x.iso2) }}</span>
              <span v-if="x.speaker" class="font-medium text-primary-800">{{ x.speaker }}</span>
              <span v-if="x.title" class="text-primary-500">{{ x.title }},</span>
              <button class="text-primary-700 hover:text-accent-700" @click="f.country = x.iso3; apply()">{{ x.country }}</button>
              <span class="text-primary-300">&middot;</span>
              <span class="text-primary-500 tabular-nums">{{ x.date ? fmtDate(x.date) : x.year }}</span>
              <span class="text-primary-400 text-xs">(session {{ x.session }})</span>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="text-[11px] px-2 py-0.5 rounded-full ring-1" :class="STATUS[x.status].cls" :title="STATUS[x.status].hint">{{ STATUS[x.status].label }}</span>
              <button v-for="t in x.themes.slice(0, 3)" :key="t" class="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100" @click="f.theme = t; apply()">{{ themeLabel(t) }}</button>
              <span class="flex-1" />
              <button class="text-xs text-primary-500 hover:text-accent-700" @click="copy(x)">{{ copied === x.id ? 'Copied' : 'Copy citation' }}</button>
              <NuxtLink :to="`/countries/${x.iso3.toLowerCase()}/speeches`" class="text-xs text-primary-500 hover:text-accent-700">Read the speech</NuxtLink>
              <a v-if="x.url" :href="x.url" target="_blank" rel="noopener" class="text-xs text-primary-500 hover:text-accent-700">UN record</a>
            </div>
          </li>
        </ul>

        <div v-if="res && !res.total" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-8 text-center text-sm text-primary-500">
          No quotes match. Try fewer words, a wider year range, or include unconfirmed quotes.
        </div>
        <div v-if="res && items.length < res.total" class="mt-6 text-center">
          <button class="px-5 py-2.5 rounded-xl ring-1 ring-primary-200 bg-white text-sm text-primary-700 hover:ring-primary-400 disabled:opacity-50" :disabled="loadingMore" @click="more">
            {{ loadingMore ? 'Loading…' : `Show more (${(res.total - items.length).toLocaleString()} left)` }}
          </button>
        </div>
        <p class="mt-8 text-[11px] text-primary-400">
          Quotes were picked from each speech by AI, then checked against the speech text: <em>verbatim</em> quotes appear word for word; <em>close match</em> quotes match most of the wording;
          <em>unconfirmed</em> quotes could not be found and may be paraphrases. Older speeches use the English texts of the UN General Debate Corpus.
        </p>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag, useCountries } from '~/composables/useGroups'

useHead({ title: 'Quote explorer — UN General Debate' })
const route = useRoute()
const router = useRouter()
const { show: tipShow, hide: tipHide } = useVizTip()

const THEMES = ['peace_security', 'multilateralism', 'reform_un', 'climate_change', 'human_rights', 'sustainable_development', 'sovereignty', 'nuclear_disarmament',
  'colonialism', 'self_determination', 'apartheid', 'terrorism', 'poverty', 'economic_growth', 'debt', 'trade', 'technology', 'migration', 'democracy', 'gender_equality', 'health', 'food_security', 'sanctions']
const LEVELS = ['Head of State', 'Head of Government', 'Vice-President / Deputy', 'Minister', 'Ambassador']
const SORTS = [{ v: 'relevance', label: 'Best match' }, { v: 'newest', label: 'Newest' }, { v: 'oldest', label: 'Oldest' }]
const SUGGESTIONS = [
  { label: 'Apartheid, 1960s–80s', q: '', theme: 'apartheid', from: 1960, to: 1989 },
  { label: 'Climate, since 2015', q: 'climate', from: 2015, to: 0 },
  { label: '"United Nations reform"', q: '"reform of the security council"', from: 0, to: 0 },
  { label: 'Artificial intelligence', q: 'artificial intelligence', from: 0, to: 0 },
  { label: 'Decolonization', q: '', theme: 'colonialism', from: 1946, to: 1979 },
]
const THEME_LABELS: Record<string, string> = { peace_security: 'Peace & security', reform_un: 'UN reform', climate_change: 'Climate change', human_rights: 'Human rights',
  sustainable_development: 'Sustainable development', nuclear_disarmament: 'Nuclear disarmament', self_determination: 'Self-determination', economic_growth: 'Economic growth',
  gender_equality: 'Gender equality', food_security: 'Food security' }
const themeLabel = (t: string) => THEME_LABELS[t] || t.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
const STATUS: Record<string, { label: string; cls: string; hint: string }> = {
  exact: { label: 'Verbatim', cls: 'ring-emerald-200 bg-emerald-50 text-emerald-800', hint: 'Appears word for word in the speech text' },
  close: { label: 'Close match', cls: 'ring-sky-200 bg-sky-50 text-sky-800', hint: 'Most of the wording appears in the speech; it may be trimmed' },
  unverified: { label: 'Unconfirmed', cls: 'ring-amber-200 bg-amber-50 text-amber-800', hint: 'Not found in the speech text; may be a paraphrase' },
}

// ---------- filter state, synced with the URL ----------
const fromQuery = () => ({
  q: String(route.query.q || ''), country: String(route.query.country || ''), speaker: String(route.query.speaker || ''),
  theme: String(route.query.theme || ''), level: String(route.query.level || ''),
  from: Number(route.query.from) || (undefined as number | undefined), to: Number(route.query.to) || (undefined as number | undefined),
  status: String(route.query.status || 'verified'), sort: String(route.query.sort || ''),
})
const f = reactive(fromQuery())
const draft = ref(f.q)
if (!f.sort) f.sort = f.q ? 'relevance' : 'newest'

const params = computed(() => {
  const p: Record<string, string> = {}
  for (const [k, v] of Object.entries(f)) if (v !== '' && v != null && !(k === 'status' && v === 'verified')) p[k] = String(v)
  return p
})
function apply() {
  f.q = draft.value.trim()
  if (f.q && f.sort === 'newest' && !route.query.sort) f.sort = 'relevance'
  router.replace({ query: params.value })
}
function reset() {
  Object.assign(f, { q: '', country: '', speaker: '', theme: '', level: '', from: undefined, to: undefined, status: 'verified', sort: 'newest' })
  draft.value = ''
  router.replace({ query: {} })
}
function clear(k: string) {
  if (k === 'years') { f.from = undefined; f.to = undefined } else (f as any)[k] = ''
  if (k === 'q') draft.value = ''
  apply()
}
function preset(s: any) {
  reset()
  draft.value = s.q; f.theme = s.theme || ''; f.from = s.from || undefined; f.to = s.to || undefined
  apply()
}
function setDecade(d: number) { f.from = d; f.to = d + 9; apply() }
function pickSpeaker(s: any) { f.speaker = s.speaker; f.country = s.iso3; apply() }

// ---------- data ----------
const page = ref(1)
const extra = ref<any[]>([])
const loadingMore = ref(false)
const { data: res, pending } = useFetch<any>('/api/quotes', { query: computed(() => ({ ...route.query, size: 30 })), watch: [() => route.query] })
watch(() => route.query, () => { page.value = 1; extra.value = [] })
const items = computed(() => [...(res.value?.quotes || []), ...extra.value])
async function more() {
  loadingMore.value = true
  try {
    page.value++
    const r = await $fetch<any>('/api/quotes', { query: { ...route.query, size: 30, page: page.value } })
    extra.value = [...extra.value, ...r.quotes]
  } finally { loadingMore.value = false }
}

const meta = computed(() => res.value?.meta)
const latestYear = new Date().getFullYear()
const decadeMax = computed(() => Math.max(1, ...(res.value?.facets?.decades || []).map((d: any) => d.count)))

const { countries } = useCountries()
const countryOptions = computed(() => [...((countries.value as any[]) || [])].filter(c => c.iso3).sort((a, b) => a.name.localeCompare(b.name)))
const countryName = (iso3: string) => countryOptions.value.find((c: any) => c.iso3 === iso3)?.name || iso3
const flag = (iso2: string) => (iso2 ? isoToFlag(iso2) : '')

const chips = computed(() => {
  const out: { key: string; label: string }[] = []
  if (f.q) out.push({ key: 'q', label: `“${f.q}”` })
  if (f.country) out.push({ key: 'country', label: countryName(f.country) })
  if (f.speaker) out.push({ key: 'speaker', label: f.speaker })
  if (f.theme) out.push({ key: 'theme', label: themeLabel(f.theme) })
  if (f.level) out.push({ key: 'level', label: f.level })
  if (f.from || f.to) out.push({ key: 'years', label: `${f.from || 1946}–${f.to || latestYear}` })
  return out
})
const activeCount = computed(() => chips.value.length + (f.status !== 'verified' ? 1 : 0))
const summary = computed(() => (chips.value.length ? 'matching your filters' : 'in the repository'))

// ---------- helpers ----------
const fmtDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function highlight(text: string) {
  const terms = (f.q.startsWith('"') ? [f.q.replace(/"/g, '')] : f.q.split(/\s+/)).filter(t => t.length > 2)
  let out = esc(text)
  for (const t of terms) {
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    out = out.replace(re, '<mark class="bg-amber-100 text-primary-900 rounded px-0.5">$1</mark>')
  }
  return out
}
const copied = ref('')
async function copy(x: any) {
  const who = [x.speaker, x.title].filter(Boolean).join(', ')
  const when = x.date ? fmtDate(x.date) : String(x.year)
  const cite = `“${x.q}” — ${who ? who + ', ' : ''}${x.country}, UN General Assembly General Debate, ${when} (session ${x.session}).${x.url ? ' ' + x.url : ''}`
  try { await navigator.clipboard.writeText(cite); copied.value = x.id; setTimeout(() => { copied.value = '' }, 2000) } catch {}
}
</script>

<style scoped>
.lbl { @apply block text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500 mb-1; }
.ctl { @apply w-full text-sm rounded-lg ring-1 ring-primary-200 px-3 py-2 bg-white focus:ring-2 focus:ring-accent-400 focus:outline-none; }
</style>
