<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="text-3xl font-bold text-primary-500 mb-6">About</h1>

    <div class="prose prose-gray max-w-none">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
        <h2 class="text-xl font-bold text-primary-500 mb-4">World Country Groups</h2>
        <p class="text-gray-600 leading-relaxed mb-4">
          This website provides an interactive browser for international country groups and organizations.
          It draws on the <strong>worldcountrygroups</strong> open-data package which defines
          {{ groupCount }} country groups covering {{ countryCount }} countries and territories.
        </p>
        <p class="text-gray-600 leading-relaxed mb-4">
          Each group includes member country lists with ISO 3166-1 codes. The site also pulls
          aggregate statistics (GDP, population, and CO2 emissions) from the
          <a href="https://data.worldbank.org/" target="_blank" rel="noopener" class="text-accent-500 hover:text-accent-600 underline">World Bank Open Data API</a>.
        </p>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
        <h2 class="text-xl font-bold text-primary-500 mb-4">Data Package</h2>
        <p class="text-gray-600 leading-relaxed mb-4">
          The underlying data is available as open-source packages:
        </p>
        <ul class="space-y-3">
          <li class="flex items-center gap-3">
            <span class="bg-yellow-100 text-yellow-700 text-xs font-bold px-2.5 py-1 rounded">PyPI</span>
            <a href="https://pypi.org/project/worldcountrygroups/" target="_blank" rel="noopener" class="text-accent-500 hover:text-accent-600 underline">
              worldcountrygroups
            </a>
          </li>
          <li class="flex items-center gap-3">
            <span class="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded">GitHub</span>
            <a href="https://github.com/tomasgonz/worldcountrygroups" target="_blank" rel="noopener" class="text-accent-500 hover:text-accent-600 underline">
              tomasgonz/worldcountrygroups
            </a>
          </li>
        </ul>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
        <h2 class="text-xl font-bold text-primary-500 mb-4">Data Sources</h2>
        <ul class="space-y-2 text-gray-600">
          <li><strong>Country groups:</strong> Compiled from official organization sources, United Nations, and World Bank classifications</li>
          <li><strong>GDP (nominal):</strong> World Bank indicator NY.GDP.MKTP.CD (current US$)</li>
          <li><strong>Population:</strong> World Bank indicator SP.POP.TOTL</li>
          <li><strong>CO2 Emissions:</strong> World Bank indicator EN.ATM.CO2E.KT (kilotons)</li>
        </ul>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <h2 class="text-xl font-bold text-primary-500 mb-4">Technology</h2>
        <p class="text-gray-600 leading-relaxed">
          Built with <strong>Nuxt 3</strong> (Vue 3 + Nitro server), styled with <strong>Tailwind CSS</strong>.
          Server-side rendered for fast initial loads. World Bank data is cached for 24 hours.
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
