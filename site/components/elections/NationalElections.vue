<template>
  <div>
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <input v-model="q" type="search" placeholder="Search a country" aria-label="Search a country" class="flex-1 min-w-[10rem] sm:max-w-xs text-sm rounded-lg ring-1 ring-primary-200 px-3 py-1.5 bg-white">
      <select v-model="type" class="text-sm rounded-lg ring-1 ring-primary-200 px-2 py-1.5 bg-white" aria-label="Type of election">
        <option value="">All types</option>
        <option v-for="t in types" :key="t" :value="t">{{ cap(t) }}</option>
      </select>
      <label class="flex items-center gap-1.5 text-xs text-primary-600"><input v-model="directOnly" type="checkbox" class="rounded"> Direct votes only</label>
      <div class="flex rounded-full bg-primary-100 p-0.5 text-xs ml-auto" role="tablist" aria-label="When">
        <button v-for="w in WHEN" :key="w.v" role="tab" :aria-selected="when === w.v" class="px-2.5 py-1 rounded-full"
          :class="when === w.v ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="when = w.v">{{ w.label }}</button>
      </div>
    </div>

    <!-- elections per month -->
    <div v-if="months.length" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 mb-6">
      <div class="text-sm font-medium text-primary-900">{{ when === 'past' ? 'Elections held per month' : 'Elections per month ahead' }}</div>
      <div class="flex items-end gap-1 h-20 mt-3">
        <div v-for="m in months" :key="m.key" class="flex-1 flex flex-col justify-end items-center h-full" tabindex="0"
          @mousemove="show($event, m.label, [{ text: `${m.items.length} election${m.items.length === 1 ? '' : 's'}`, color: '#2a78d6' }])" @mouseleave="hide">
          <div class="w-full rounded-t-[3px] bg-[#2a78d6]" :style="{ height: Math.max(4, m.items.length / maxMonth * 100) + '%' }" />
        </div>
      </div>
      <div class="flex gap-1 mt-1">
        <span v-for="m in months" :key="m.key" class="flex-1 text-center text-[10px] text-primary-400 truncate">{{ m.short }}</span>
      </div>
    </div>

    <div v-if="pending" class="space-y-3"><div v-for="i in 4" :key="i" class="skeleton h-24 rounded-2xl" /></div>
    <p v-else-if="!months.length" class="text-sm text-primary-500 bg-white rounded-2xl ring-1 ring-primary-200/70 p-6">No elections match.</p>
    <section v-for="m in months" :key="m.key" class="mb-6">
      <h3 class="font-serif text-xl text-primary-900 mb-2">{{ m.label }}</h3>
      <ul class="bg-white rounded-2xl ring-1 ring-primary-200/70 divide-y divide-primary-100">
        <li v-for="e in m.items" :key="e.id || e.country + e.date + e.description" class="px-5 py-3 flex gap-4">
          <div class="w-12 shrink-0 text-center">
            <div v-if="e.precision === 'day'" class="font-serif text-2xl text-primary-900 leading-none">{{ Number(e.date.slice(8, 10)) }}</div>
            <div v-else class="text-[11px] text-primary-400 leading-tight pt-1">date<br>tbc</div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <NuxtLink v-if="e.iso3" :to="`/countries/${e.iso3.toLowerCase()}`" class="font-medium text-primary-900 hover:text-accent-700">{{ flagFor(e.iso3) }} {{ e.country }}</NuxtLink>
              <span v-else class="font-medium text-primary-900">{{ e.country }}</span>
              <span class="text-[11px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">{{ cap(e.type) }}</span>
              <span v-if="e.indirect" class="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-primary-200 text-primary-500">indirect</span>
              <span v-if="e.status === 'upcoming'" class="text-[11px] text-primary-400">{{ countdown(e) }}</span>
            </div>
            <div class="text-sm text-primary-600 mt-0.5">{{ e.description }}</div>
            <ul v-if="newsFor(e).length" class="mt-2 space-y-1">
              <li v-for="n in newsFor(e).slice(0, openNews === (e.iso3 + e.date) ? 8 : 2)" :key="n.url" class="text-xs leading-snug">
                <a :href="n.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-accent-700">{{ n.title }}</a>
                <span class="text-primary-400"> · {{ n.outlet }}</span>
              </li>
            </ul>
            <div class="mt-1 flex flex-wrap gap-3 text-xs">
              <button v-if="newsFor(e).length > 2" class="text-accent-700 hover:underline" @click="openNews = openNews === (e.iso3 + e.date) ? '' : e.iso3 + e.date">{{ openNews === (e.iso3 + e.date) ? 'Less news' : `More news (${newsFor(e).length})` }}</button>
              <a v-if="e.article_url" :href="e.article_url" target="_blank" rel="noopener" class="text-accent-700 hover:underline">Background</a>
              <NuxtLink v-if="e.iso3" :to="askLink(e)" class="text-accent-700 hover:underline">Brief me on this election &rarr;</NuxtLink>
            </div>
          </div>
        </li>
      </ul>
    </section>
    <p class="text-[11px] text-primary-400">{{ data?.meta?.attribution || 'Source: Wikipedia, CC BY-SA' }} (national electoral calendars); dates can change.</p>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag, useCountries } from '~/composables/useGroups'

const props = withDefaults(defineProps<{ news?: Record<string, any> }>(), { news: () => ({}) })
const { show, hide } = useVizTip()
/** News for one election: matched by country and date. */
function newsFor(e: any): any[] {
  const hit = Object.values<any>(props.news).find(n => n.iso3 === e.iso3 && n.date === e.date)
  return hit?.items || []
}
const openNews = ref('')
const WHEN = [{ v: 'upcoming', label: 'Upcoming' }, { v: 'past', label: 'Recently held' }] as const
const when = ref<'upcoming' | 'past'>('upcoming')
const q = ref('')
const type = ref('')
const directOnly = ref(false)

const { data, pending } = useFetch<any>('/api/elections', { query: { status: 'all', limit: 500 } })
const { countries } = useCountries()
const iso2Of = computed(() => new Map(((countries.value as any[]) || []).map((c: any) => [c.iso3, c.iso2])))
const flagFor = (iso3: string) => { const i2 = iso2Of.value.get(iso3); return i2 ? isoToFlag(i2) : '' }

const types = computed(() => [...new Set((data.value?.elections || []).map((e: any) => e.type))].sort() as string[])
const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  return (data.value?.elections || []).filter((e: any) =>
    e.status === when.value && (!type.value || e.type === type.value) && (!directOnly.value || !e.indirect) &&
    (!s || `${e.country} ${e.description}`.toLowerCase().includes(s)))
})
const months = computed(() => {
  const groups = new Map<string, any[]>()
  const sorted = [...list.value].sort((a: any, b: any) => (when.value === 'past' ? b.sort_date.localeCompare(a.sort_date) : a.sort_date.localeCompare(b.sort_date)))
  for (const e of sorted) {
    const k = (e.sort_date || e.date).slice(0, 7)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(e)
  }
  return [...groups.entries()].slice(0, 14).map(([k, items]) => {
    const d = new Date(k + '-15T12:00:00Z')
    return { key: k, items, label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), short: d.toLocaleDateString('en-GB', { month: 'short' }) }
  })
})
const maxMonth = computed(() => Math.max(1, ...months.value.map(m => m.items.length)))

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
function countdown(e: any) {
  if (e.precision !== 'day') return ''
  const d = Math.round((new Date(e.date + 'T12:00:00Z').getTime() - Date.now()) / 86400000)
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`
}
function askLink(e: any) {
  return { path: '/ask', query: { q: `Prepare a briefing on the ${e.description} election in ${e.country} on ${e.date}: what is at stake, the main contenders, the country's foreign policy and UN positions, and what to watch.`, mode: 'briefing', template: 'country', run: '1' } }
}
</script>
