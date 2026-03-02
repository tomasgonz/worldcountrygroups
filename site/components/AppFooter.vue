<template>
  <footer class="border-t border-primary-100 mt-20">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-10 text-sm">
        <div>
          <h3 class="font-serif font-semibold text-primary-900 mb-3">World Country Groups</h3>
          <p class="text-primary-400 leading-relaxed">
            An open-data reference for {{ groupCount }} international country groupings.
          </p>
        </div>
        <div>
          <h3 class="font-serif font-semibold text-primary-900 mb-3">Navigate</h3>
          <ul class="space-y-2">
            <li><NuxtLink to="/groups" class="text-primary-400 hover:text-primary-900 transition-colors">Browse Groups</NuxtLink></li>
            <li><NuxtLink to="/compare" class="text-primary-400 hover:text-primary-900 transition-colors">Compare Groups</NuxtLink></li>
            <li><NuxtLink to="/about" class="text-primary-400 hover:text-primary-900 transition-colors">About</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h3 class="font-serif font-semibold text-primary-900 mb-3">Sources</h3>
          <ul class="space-y-2">
            <li><a href="https://data.worldbank.org/" target="_blank" rel="noopener" class="text-primary-400 hover:text-primary-900 transition-colors">World Bank Open Data</a></li>
            <li><a href="https://pypi.org/project/worldcountrygroups/" target="_blank" rel="noopener" class="text-primary-400 hover:text-primary-900 transition-colors">PyPI Package</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-primary-100 mt-10 pt-8 text-center text-primary-300 text-xs">
        Developed by Tomas Gonzalez &middot; <a href="mailto:me@tomasgonzalez.net" class="hover:text-primary-500 transition-colors">me@tomasgonzalez.net</a> &middot; &copy; {{ new Date().getFullYear() }}
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/groups')
const groupCount = computed(() => data.value?.length ?? 47)
</script>
