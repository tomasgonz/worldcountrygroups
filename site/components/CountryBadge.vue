<template>
  <NuxtLink
    :to="`/countries/${country.iso2 || country.iso3}`"
    class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-primary-200/60 hover:border-accent-300 hover:bg-accent-50 rounded-lg text-sm transition-all"
  >
    <span v-if="country.iso2" class="text-base">{{ isoToFlag(country.iso2) }}</span>
    <span class="text-primary-700">{{ country.name }}</span>
    <span v-if="country.iso2" class="text-primary-400 text-xs">({{ country.iso2 }})</span>
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
