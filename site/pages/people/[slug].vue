<template>
  <div class="bg-primary-50/40 min-h-screen">
    <VizTip />
    <div v-if="error" class="max-w-4xl mx-auto px-4 py-20 text-center">
      <h1 class="font-serif text-2xl text-primary-500">Person not found</h1>
      <NuxtLink to="/people" class="text-accent-600 hover:underline text-sm">Browse people &rarr;</NuxtLink>
    </div>

    <template v-else-if="p">
      <!-- Header -->
      <section class="bg-white border-b border-primary-100">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
          <NuxtLink to="/people" class="text-sm text-primary-400 hover:text-primary-700">&larr; People</NuxtLink>
          <div class="mt-4 flex flex-col sm:flex-row gap-6">
            <PersonPhoto :image="p.image" :image-path="p.imagePath" :image-url="p.imageUrl" :name="p.name" size="h-36 w-28 sm:h-44 sm:w-36" :width="500" />
            <div class="min-w-0">
              <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 leading-tight">{{ p.name }}</h1>
              <p v-if="p.description" class="text-primary-500 mt-1">{{ capitalize(p.description) }}</p>
              <ul class="mt-3 space-y-1">
                <li v-for="r in p.roles" :key="r.role + r.iso3" class="text-sm text-primary-800">
                  <span v-if="r.iso2" class="mr-1">{{ flag(r.iso2) }}</span>
                  <strong class="font-medium">{{ r.role }}</strong>
                  <template v-if="r.country">,
                    <NuxtLink v-if="r.iso3" :to="`/countries/${r.iso3.toLowerCase()}`" class="text-accent-700 hover:underline">{{ r.country }}</NuxtLink>
                    <NuxtLink v-else to="/un" class="text-accent-700 hover:underline">{{ r.country }}</NuxtLink>
                  </template>
                  <span v-if="r.since" class="text-primary-400"> · since {{ fmtMonth(r.since) }}</span>
                </li>
              </ul>
              <div class="flex flex-wrap gap-3 mt-4 text-xs">
                <a v-if="p.wikipedia" :href="`https://en.wikipedia.org/wiki/${encodeURIComponent(p.wikipedia)}`" target="_blank" rel="noopener" class="text-accent-600 hover:underline">Wikipedia</a>
                <a v-if="p.qid" :href="`https://www.wikidata.org/wiki/${p.qid}`" target="_blank" rel="noopener" class="text-accent-600 hover:underline">Wikidata</a>
                <a v-if="p.officialUrl" :href="p.officialUrl" target="_blank" rel="noopener" class="text-accent-600 hover:underline">Official page</a>
                <NuxtLink v-if="p.quoteCount" :to="`/quotes?speaker=${encodeURIComponent(p.name)}`" class="text-accent-600 hover:underline">All quotes</NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <!-- Numbers + trend -->
        <div class="grid lg:grid-cols-3 gap-4">
          <div class="grid grid-cols-2 gap-px bg-primary-200/70 rounded-2xl overflow-hidden ring-1 ring-primary-200/70 lg:col-span-1">
            <div v-for="t in tiles" :key="t.label" class="bg-white px-4 py-3">
              <div class="font-serif text-3xl text-primary-900 tabular-nums leading-none">{{ t.value }}</div>
              <div class="text-[11px] text-primary-500 mt-1">{{ t.label }}</div>
            </div>
          </div>
          <div class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 lg:col-span-2">
            <div class="text-sm font-medium text-primary-900">Mentions per day, last 30 days</div>
            <p class="text-[11px] text-primary-500 mb-3">News and statements naming {{ p.name }}; history builds up from {{ fmtDay(historyStart) }}</p>
            <div class="flex items-end gap-[3px] h-24">
              <div v-for="w in weeks" :key="w.week" class="flex-1 flex flex-col justify-end h-full" tabindex="0"
                   @mousemove="show($event, fmtDay(w.week), [{ text: `${w.count} mention${w.count === 1 ? '' : 's'}`, color: '#2a78d6' }])" @mouseleave="hide">
                <div class="w-full rounded-t-[3px]" :class="w.count ? 'bg-[#2a78d6]' : 'bg-primary-100'" :style="{ height: w.count ? Math.max(6, (w.count / maxWeek) * 100) + '%' : '2px' }" />
              </div>
            </div>
            
          </div>
        </div>

        <!-- Speeches & quotes -->
        <div class="grid lg:grid-cols-3 gap-4">
          <section class="card">
            <h2 class="h2">At the General Assembly</h2>
            <ul v-if="p.speeches.length" class="mt-3 space-y-3">
              <li v-for="s in p.speeches" :key="s.session + s.iso3" class="text-sm">
                <NuxtLink :to="`/countries/${s.iso3.toLowerCase()}/speeches`" class="text-primary-800 hover:text-accent-700 font-medium">General Debate {{ s.year }}</NuxtLink>
                <div class="text-xs text-primary-500">{{ s.title }}, {{ s.country }} · session {{ s.session }}<span v-if="s.date"> · {{ fmtDay(s.date) }}</span></div>
              </li>
            </ul>
            <p v-else class="text-sm text-primary-400 mt-3">No General Debate speech on record (names are recorded from 2025).</p>
          </section>
          <section class="card lg:col-span-2">
            <div class="flex items-baseline justify-between">
              <h2 class="h2">In their words</h2>
              <NuxtLink v-if="p.quoteCount > p.quotes.length" :to="`/quotes?speaker=${encodeURIComponent(p.name)}`" class="text-xs text-accent-600 hover:underline">All {{ p.quoteCount }} quotes &rarr;</NuxtLink>
            </div>
            <div v-if="p.quotes.length" class="mt-3 grid sm:grid-cols-2 gap-3">
              <blockquote v-for="(q, i) in p.quotes.slice(0, 6)" :key="i" class="rounded-xl bg-primary-50/70 p-4">
                <p class="font-serif text-[1.05rem] leading-snug text-primary-800">&ldquo;{{ q.q }}&rdquo;</p>
                <footer class="text-[11px] text-primary-500 mt-2">General Debate {{ q.year }}<span v-if="q.status === 'close'"> · close match to the text</span></footer>
              </blockquote>
            </div>
            <p v-else class="text-sm text-primary-400 mt-3">No verified quotes yet.</p>
          </section>
        </div>

        <!-- Delivered & mentions -->
        <div class="grid lg:grid-cols-2 gap-4">
          <section class="card">
            <h2 class="h2">Statements delivered</h2>
            <p class="sub">Where the source names {{ firstName }} as the speaker or author</p>
            <ItemList :items="p.delivered" empty="None in the current statements and news feeds." />
          </section>
          <section class="card">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h2 class="h2">Mentioned in</h2>
              <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist">
                <button v-for="t in TABS" :key="t.k" role="tab" :aria-selected="tab === t.k" class="px-2.5 py-0.5 rounded-full"
                  :class="tab === t.k ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="tab = t.k">{{ t.label }} {{ t.k === 'all' ? p.mentions.length : p.mentions.filter((m: any) => m.kind === t.k).length }}</button>
              </div>
            </div>
            <p class="sub">News and statements naming {{ firstName }}, newest first</p>
            <ItemList :items="mentionItems" empty="No mentions in the current feeds." />
          </section>
        </div>
        <p class="text-[11px] text-primary-400">Roles from Wikidata or the UN General Debate record. Mentions are found by name in headlines and summaries, so a few may refer to someone else with the same name.</p>
      </div>
    </template>

    <div v-else class="max-w-6xl mx-auto px-4 py-10 space-y-4"><div class="skeleton h-44 rounded-2xl" /><div class="skeleton h-64 rounded-2xl" /></div>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

const route = useRoute()
const { data: p, error } = useFetch<any>(() => `/api/people/${route.params.slug}`)
useHead({ title: computed(() => (p.value ? `${p.value.name} — People` : 'People')) })
const { show, hide } = useVizTip()

const flag = (iso2: string) => (iso2 ? isoToFlag(iso2) : '')
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const fmtDay = (d: string) => new Date(d.length === 10 ? d + 'T12:00:00Z' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtMonth = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const firstName = computed(() => p.value?.name || '')

const tiles = computed(() => p.value ? [
  { label: 'mentions, last 30 days', value: p.value.mentions30d },
  { label: 'statements delivered', value: p.value.delivered.length },
  { label: 'General Debate speeches', value: p.value.speeches.length },
  { label: 'verified quotes', value: p.value.quoteCount },
] : [])
const weeks = computed(() => {
  // one bar per day for the last 30 days, including days with no mentions
  const counts = new Map<string, number>((p.value?.daily || []) as [string, number][])
  const out: { week: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    out.push({ week: day, count: counts.get(day) || 0 })
  }
  return out
})
const historyStart = computed(() => ((p.value?.daily || [])[0]?.[0]) || new Date().toISOString().slice(0, 10))
const maxWeek = computed(() => Math.max(1, ...weeks.value.map((w: any) => w.count)))

const TABS = [{ k: 'all', label: 'All' }, { k: 'news', label: 'News' }, { k: 'statement', label: 'Statements' }]
const tab = ref('all')
const mentionItems = computed(() => (p.value?.mentions || []).filter((m: any) => tab.value === 'all' || m.kind === tab.value))

const SOURCE_TIDY = (s: string) => (s || '').replace(/^gnews-/, '').replace(/-/g, ' ').replace(/\b(un|eu|mfa|ohchr|ocha|icj|icc|pga|dppa|wto|bbc|who|wfp|unhcr|unicef)\b/gi, m => m.toUpperCase()).replace(/^\w/, c => c.toUpperCase())
const ItemList = defineComponent({
  props: { items: { type: Array, default: () => [] }, empty: String },
  setup(props) {
    const limit = ref(10)
    return () => {
      const items = props.items as any[]
      if (!items.length) return h('p', { class: 'text-sm text-primary-400' }, props.empty)
      return h('div', [
        h('ul', { class: 'divide-y divide-primary-100' }, items.slice(0, limit.value).map((m: any) => h('li', { class: 'py-2.5 text-sm', key: m.url }, [
          h('a', { href: m.url, target: '_blank', rel: 'noopener', class: 'text-primary-800 hover:text-accent-700 leading-snug' }, m.title),
          h('div', { class: 'text-[11px] text-primary-400 mt-0.5' }, `${SOURCE_TIDY(m.source)} · ${m.publishedAt ? fmtDay(m.publishedAt) : ''}`),
        ]))),
        items.length > limit.value ? h('button', { class: 'mt-2 text-xs text-accent-600 hover:underline', onClick: () => { limit.value += 15 } }, `Show more (${items.length - limit.value} left)`) : null,
      ])
    }
  },
})
</script>

<style scoped>
.card { @apply bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6; }
.h2 { @apply font-serif text-2xl text-primary-900; }
.sub { @apply text-xs text-primary-500 mt-1 mb-3; }
</style>
