<template>
  <div v-if="hasAnyInfo" class="bg-white rounded-2xl border border-primary-100 p-6 mb-8">
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div v-if="info.capital">
        <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-1">Capital</div>
        <div class="text-sm text-primary-800 font-medium">{{ info.capital }}</div>
      </div>
      <div v-if="info.region">
        <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-1">Region</div>
        <div class="text-sm text-primary-800">{{ info.region }}</div>
        <div v-if="info.subregion" class="text-xs text-primary-400">{{ info.subregion }}</div>
      </div>
      <div v-if="info.area_km2">
        <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-1">Area</div>
        <div class="text-sm text-primary-800">{{ formatArea(info.area_km2) }}</div>
      </div>
      <div v-if="info.income_group">
        <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-1">Income Group</div>
        <div class="text-sm text-primary-800">{{ info.income_group }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  info: {
    capital?: string | null
    region?: string | null
    subregion?: string | null
    area_km2?: number | null
    income_group?: string | null
  }
}>()

const hasAnyInfo = computed(() => {
  const i = props.info
  return i.capital || i.region || i.area_km2 || i.income_group
})

function formatArea(km2: number): string {
  if (km2 >= 1e6) return `${(km2 / 1e6).toFixed(2)}M km²`
  if (km2 >= 1e3) return `${(km2 / 1e3).toFixed(0)}K km²`
  return `${km2.toLocaleString()} km²`
}
</script>
