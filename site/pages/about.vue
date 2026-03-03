<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-8">About</h1>

    <div class="space-y-8">
      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-3">World Country Groups</h2>
        <p class="text-primary-600 leading-relaxed mb-3">
          This site provides an interactive reference for international country groups and organizations.
          It draws on the <strong>worldcountrygroups</strong> open-data package, which defines
          {{ groupCount }} country groups covering {{ countryCount }} countries and territories.
        </p>
        <p class="text-primary-600 leading-relaxed">
          Each group includes member country lists with ISO 3166-1 codes. Aggregate statistics
          (GDP, population, CO2 emissions, and more) are sourced from the
          <a href="https://data.worldbank.org/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">World Bank Open Data API</a>,
          <a href="https://restcountries.com/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">REST Countries</a>,
          and <a href="https://hdr.undp.org/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">UNDP Human Development Reports</a>.
        </p>
      </div>

      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-3">Data Package</h2>
        <p class="text-primary-600 leading-relaxed mb-4">Available as open-source:</p>
        <ul class="space-y-3">
          <li class="flex items-center gap-3">
            <span class="text-xs font-medium text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-md">PyPI</span>
            <a href="https://pypi.org/project/worldcountrygroups/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">worldcountrygroups</a>
          </li>
          <li class="flex items-center gap-3">
            <span class="text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-md">GitHub</span>
            <a href="https://github.com/tomasgonz/worldcountrygroups" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">tomasgonz/worldcountrygroups</a>
          </li>
        </ul>
      </div>

      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-3">Data Sources</h2>
        <p class="text-primary-600 leading-relaxed mb-4">
          All data is drawn from public, authoritative sources including the World Bank, United Nations Digital Library,
          SIPRI, Global Firepower, ACLED, and more.
        </p>
        <NuxtLink
          to="/sources"
          class="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white text-sm rounded-lg hover:bg-primary-800 transition-colors"
        >
          View all data sources
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </NuxtLink>
      </div>

      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-3">Technology</h2>
        <p class="text-primary-600 leading-relaxed">
          Built with <strong>Nuxt 3</strong> and <strong>Tailwind CSS</strong>.
          Server-side rendered with local data store for instant page loads.
        </p>
      </div>

      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-3">Created by</h2>
        <p class="text-primary-600 leading-relaxed">
          Created by <strong>Tomas Gonzalez</strong>.
          For questions, suggestions, or contributions, reach out at
          <a href="mailto:me@tomasgonzalez.net" class="text-accent-600 hover:text-accent-700 underline">me@tomasgonzalez.net</a>.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'About — World Country Groups' })

const { groups } = useGroups()
const groupCount = computed(() => groups.value?.length ?? 47)
const countryCount = computed(() => {
  if (!groups.value) return 0
  const world = (groups.value as any[]).find(g => g.gid === 'world')
  return world ? world.country_count : 220
})

</script>
