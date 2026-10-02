<template>
  <div class="bg-primary-50/40 min-h-screen">
    <section class="bg-white border-b border-primary-100">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p class="text-[11px] uppercase tracking-[0.14em] text-primary-500">People</p>
        <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">Who's who in world affairs</h1>
        <p class="text-primary-500 mt-3 max-w-3xl leading-relaxed">
          Heads of state and government, foreign ministers, UN officials and General Debate speakers: their roles, speeches, quotes,
          the statements they delivered and where they are mentioned.
        </p>
        <div class="mt-6 flex flex-wrap gap-2 max-w-3xl">
          <div class="relative flex-1 min-w-[16rem]">
            <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path stroke-linecap="round" d="M20 20l-3.5-3.5" /></svg>
            <input v-model="q" type="search" placeholder="Search a name" aria-label="Search people"
              class="w-full pl-10 pr-3 py-3 rounded-xl ring-1 ring-primary-200 focus:ring-2 focus:ring-accent-400 focus:outline-none text-[15px]" />
          </div>
          <select v-model="iso3" class="px-3 py-3 rounded-xl ring-1 ring-primary-200 bg-white text-sm" aria-label="Country">
            <option value="">All countries</option>
            <option value="UN">United Nations officials</option>
            <option v-for="c in countryList" :key="c.iso3" :value="c.iso3">{{ c.name }}</option>
          </select>
        </div>
      </div>
    </section>

    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-baseline justify-between mb-4">
        <h2 class="font-serif text-2xl text-primary-900">{{ heading }}</h2>
        <span class="text-xs text-primary-400">{{ data?.total ?? '' }} people</span>
      </div>
      <div v-if="pending && !data" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"><div v-for="i in 9" :key="i" class="skeleton h-28 rounded-2xl" /></div>
      <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink v-for="p in data?.people || []" :key="p.slug" :to="`/people/${p.slug}`"
          class="group flex gap-4 bg-white rounded-2xl ring-1 ring-primary-200/70 p-4 hover:ring-accent-300 transition">
          <PersonPhoto :image="p.image" :image-path="p.imagePath" :image-url="p.imageUrl" :name="p.name" size="h-16 w-16" />
          <div class="min-w-0">
            <div class="font-medium text-primary-900 group-hover:text-accent-700 truncate">{{ p.name }}</div>
            <div v-for="r in p.roles.slice(0, 2)" :key="r.role + r.iso3" class="text-xs text-primary-500 truncate">{{ r.iso2 ? flag(r.iso2) + ' ' : '' }}{{ r.role }}<span v-if="r.country">, {{ r.country }}</span></div>
            <div class="flex flex-wrap gap-x-3 mt-1.5 text-[11px] text-primary-400">
              <span v-if="p.mentions30d">{{ p.mentions30d }} mentions in 30 days</span>
              <span v-if="p.speeches">{{ p.speeches }} UN speech{{ p.speeches > 1 ? 'es' : '' }}</span>
              <span v-if="p.quoteCount">{{ p.quoteCount }} quotes</span>
            </div>
          </div>
        </NuxtLink>
      </div>
      <p v-if="data && !data.people.length" class="text-sm text-primary-500 mt-4">No one matches. Try part of the surname.</p>
      <p class="text-[11px] text-primary-400 mt-8">Current office holders from Wikidata; speakers and statements from UN sources; mentions from the news and statements feeds (updated every few hours).</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag, useCountries } from '~/composables/useGroups'

useHead({ title: 'People — World Country Groups' })
const route = useRoute()
const router = useRouter()
const q = ref(String(route.query.q || ''))
const iso3 = ref(String(route.query.country || ''))
const debounced = ref(q.value)
let t: any = null
watch(q, (v) => { clearTimeout(t); t = setTimeout(() => { debounced.value = v }, 250) })
watch([debounced, iso3], () => router.replace({ query: { ...(debounced.value ? { q: debounced.value } : {}), ...(iso3.value ? { country: iso3.value } : {}) } }))

const { data, pending } = useFetch<any>('/api/people', {
  query: computed(() => ({ q: debounced.value, iso3: iso3.value === 'UN' ? '' : iso3.value, un: iso3.value === 'UN' ? 1 : undefined, limit: 90, sort: debounced.value || iso3.value ? 'name' : 'mentions' })),
})
// a search from another page ("/people?q=Name") that matches exactly one person opens the profile
watch(data, (d) => {
  if (route.query.q && d?.people?.length === 1 && d.total === 1) navigateTo(`/people/${d.people[0].slug}`, { replace: true })
}, { immediate: true })

const { countries } = useCountries()
const countryList = computed(() => ((countries.value as any[]) || []).filter((c: any) => c.iso3).sort((a: any, b: any) => a.name.localeCompare(b.name)))
const flag = (iso2: string) => (iso2 ? isoToFlag(iso2) : '')
const heading = computed(() => (debounced.value ? `Matching “${debounced.value}”` : iso3.value === 'UN' ? 'United Nations officials' : iso3.value ? countryList.value.find((c: any) => c.iso3 === iso3.value)?.name || iso3.value : 'Most mentioned in the last 30 days'))
</script>
