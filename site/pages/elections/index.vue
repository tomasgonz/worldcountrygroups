<template>
  <div class="bg-primary-50/40 min-h-screen">
    <VizTip />
    <section class="bg-white border-b border-primary-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-0">
        <p class="text-[11px] uppercase tracking-[0.14em] text-primary-500">Elections</p>
        <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">Who gets elected, and how</h1>
        <p class="text-primary-500 mt-3 max-w-3xl leading-relaxed">
          The race for the next UN Secretary-General, elections to the Security Council and for the President of the General Assembly, and national elections around the world.
        </p>
        <nav class="mt-6 flex gap-1 overflow-x-auto -mb-px" role="tablist" aria-label="Elections">
          <button v-for="t in TABS" :key="t.id" role="tab" :aria-selected="tab === t.id" class="shrink-0 px-4 py-2.5 text-sm border-b-2 transition-colors"
            :class="tab === t.id ? 'border-primary-900 text-primary-900 font-medium' : 'border-transparent text-primary-500 hover:text-primary-800'" @click="setTab(t.id)">{{ t.label }}</button>
        </nav>
      </div>
    </section>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ElectionsSgSelection v-if="tab === 'sg'" />
      <ElectionsSecurityCouncilElections v-else-if="tab === 'council'" />
      <ElectionsPgaElections v-else-if="tab === 'pga'" />
      <ElectionsNationalElections v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const TABS = [
  { id: 'sg', label: 'Secretary-General' },
  { id: 'council', label: 'Security Council' },
  { id: 'pga', label: 'President of the General Assembly' },
  { id: 'national', label: 'National elections' },
] as const
type TabId = typeof TABS[number]['id']
const tab = ref<TabId>((TABS.some(t => t.id === route.query.tab) ? route.query.tab : 'sg') as TabId)
function setTab(id: TabId) {
  tab.value = id
  router.replace({ query: id === 'sg' ? {} : { tab: id } })
}
const TITLES: Record<TabId, string> = { sg: 'Secretary-General selection', council: 'Security Council elections', pga: 'President of the General Assembly', national: 'National elections' }
useHead({ title: computed(() => `${TITLES[tab.value]} — Elections — World Country Groups`) })
</script>
