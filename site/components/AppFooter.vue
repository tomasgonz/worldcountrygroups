<template>
  <footer class="bg-primary-500 text-white mt-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 class="font-bold text-lg mb-2">World Country Groups</h3>
          <p class="text-primary-200 text-sm">
            Open-data project with {{ groupCount }} country group definitions.
            Browse memberships, GDP, population, and CO2 data.
          </p>
        </div>
        <div>
          <h3 class="font-bold text-lg mb-2">Links</h3>
          <ul class="space-y-1 text-sm">
            <li><NuxtLink to="/groups" class="text-primary-200 hover:text-white transition-colors">Browse Groups</NuxtLink></li>
            <li><NuxtLink to="/about" class="text-primary-200 hover:text-white transition-colors">About</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h3 class="font-bold text-lg mb-2">Data Sources</h3>
          <ul class="space-y-1 text-sm">
            <li><a href="https://data.worldbank.org/" target="_blank" rel="noopener" class="text-primary-200 hover:text-white transition-colors">World Bank Open Data</a></li>
            <li><a href="https://pypi.org/project/worldcountrygroups/" target="_blank" rel="noopener" class="text-primary-200 hover:text-white transition-colors">PyPI Package</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-primary-400 mt-8 pt-4 text-center text-primary-300 text-sm">
        &copy; {{ new Date().getFullYear() }} worldcountrygroups.org
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/groups')
const groupCount = computed(() => data.value?.length ?? 47)
</script>
