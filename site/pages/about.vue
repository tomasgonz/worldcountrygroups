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
          (GDP, population, CO2 emissions) are sourced from the
          <a href="https://data.worldbank.org/" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">World Bank Open Data API</a>.
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
        <ul class="space-y-2 text-primary-600">
          <li><strong>Country groups:</strong> Official organization sources, UN, and World Bank classifications</li>
          <li><strong>GDP (nominal):</strong> World Bank indicator NY.GDP.MKTP.CD</li>
          <li><strong>Population:</strong> World Bank indicator SP.POP.TOTL</li>
          <li><strong>CO2 Emissions:</strong> World Bank indicator EN.GHG.CO2.MT.CE.AR5</li>
        </ul>
      </div>

      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-3">Technology</h2>
        <p class="text-primary-600 leading-relaxed">
          Built with <strong>Nuxt 3</strong> and <strong>Tailwind CSS</strong>.
          Server-side rendered. World Bank data cached for 24 hours.
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
