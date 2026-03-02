<template>
  <NuxtLink
    :to="`/countries/${country.iso2 || country.iso3}`"
    class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-accent-50 border border-gray-200 hover:border-accent-300 rounded-full text-sm transition-colors"
  >
    <span v-if="country.iso2" class="text-base">{{ isoToFlag(country.iso2) }}</span>
    <span class="text-gray-700">{{ country.name }}</span>
    <span v-if="country.iso2" class="text-gray-400 text-xs">({{ country.iso2 }})</span>
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{
  country: {
    name: string
    iso2: string
    iso3: string
  }
}>()
</script>
