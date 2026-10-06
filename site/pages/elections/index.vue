<template>
  <div class="bg-primary-50/40 min-h-screen">
    <VizTip />
    <section class="bg-white border-b border-primary-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-0">
        <p class="text-[11px] uppercase tracking-[0.14em] text-primary-500">Elections</p>
        <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">Who gets elected, and how</h1>
        <p class="text-primary-500 mt-3 max-w-3xl leading-relaxed">
          The race for the next UN Secretary-General, elections to the Security Council, the Human Rights Council, ECOSOC and the International Court of Justice, the President of the General Assembly, and national elections around the world.
        </p>
        <nav class="mt-6 flex gap-1 overflow-x-auto -mb-px" role="tablist" aria-label="Elections">
          <button v-for="t in TABS" :key="t.id" role="tab" :aria-selected="tab === t.id" class="shrink-0 px-4 py-2.5 text-sm border-b-2 transition-colors"
            :class="tab === t.id ? 'border-primary-900 text-primary-900 font-medium' : 'border-transparent text-primary-500 hover:text-primary-800'" @click="setTab(t.id)">{{ t.label }}</button>
        </nav>
      </div>
    </section>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ElectionsSgSelection v-if="tab === 'sg'" />
      <template v-else-if="tab === 'council'">
        <ElectionsNewsList class="mb-6" :title="`The race for seats in ${news?.council?.year || 'the next election'}`" subtitle="Campaigns of declared candidates and coverage of the next Security Council election." :items="councilNews" :updated="news?.updated" />
        <ElectionsSecurityCouncilElections />
      </template>
      <template v-else-if="tab === 'pga'">
        <ElectionsNewsList class="mb-6" :title="`The race for the ${news?.pga?.session ? ordinal(news.pga.session) : 'next'} session`" :subtitle="news?.pga?.group ? `It is the ${news.pga.group}'s turn; candidates usually emerge in the months before the June election.` : ''" :items="news?.pga?.race || []" :updated="news?.updated" empty="No candidate has been reported yet." />
        <ElectionsPgaElections />
        <ElectionsNewsList class="mt-6" title="The current President in the news" :items="news?.pga?.current_president || []" :updated="news?.updated" />
      </template>
      <ElectionsHrcElections v-else-if="tab === 'hrc'" />
      <ElectionsEcosocElections v-else-if="tab === 'ecosoc'" />
      <ElectionsIcjElections v-else-if="tab === 'icj'" />
      <template v-else>
        <ElectionsNewsList class="mb-6" title="Latest election news" subtitle="Coverage of national elections in the coming three months and the past two weeks." :items="nationalNews" :updated="news?.updated" />
        <ElectionsNationalElections :news="news?.national || {}" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data: news } = useFetch<any>('/api/elections/news', { server: false })
const councilNews = computed(() => {
  const c = news.value?.council
  if (!c) return []
  const tagged = Object.values<any>(c.candidates || {}).flatMap(x => x.items.map((it: any) => ({ ...it, tag: x.name })))
  const seen = new Set<string>()
  return [...c.general, ...tagged].filter(it => (seen.has(it.url) ? false : (seen.add(it.url), true))).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
})
const nationalNews = computed(() => {
  const seen = new Set<string>()
  return Object.values<any>(news.value?.national || {}).flatMap(e => e.items.map((it: any) => ({ ...it, tag: e.country })))
    .filter(it => (seen.has(it.url) ? false : (seen.add(it.url), true))).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
})
const router = useRouter()
const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const TABS = [
  { id: 'sg', label: 'Secretary-General' },
  { id: 'council', label: 'Security Council' },
  { id: 'pga', label: 'President of the General Assembly' },
  { id: 'hrc', label: 'Human Rights Council' },
  { id: 'ecosoc', label: 'ECOSOC' },
  { id: 'icj', label: 'International Court of Justice' },
  { id: 'national', label: 'National elections' },
] as const
type TabId = typeof TABS[number]['id']
const tab = ref<TabId>((TABS.some(t => t.id === route.query.tab) ? route.query.tab : 'sg') as TabId)
function setTab(id: TabId) {
  tab.value = id
  router.replace({ query: id === 'sg' ? {} : { tab: id } })
}
const TITLES: Record<TabId, string> = { sg: 'Secretary-General selection', council: 'Security Council elections', pga: 'President of the General Assembly', hrc: 'Human Rights Council elections', ecosoc: 'ECOSOC elections', icj: 'International Court of Justice elections', national: 'National elections' }
useHead({ title: computed(() => `${TITLES[tab.value]} — Elections — World Country Groups`) })
</script>
