<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div class="text-sm text-gray-500 mb-1">GDP (nominal)</div>
      <template v-if="pending">
        <div class="skeleton h-7 w-32 mb-1" />
        <div class="skeleton h-4 w-24" />
      </template>
      <template v-else-if="stats?.gdp">
        <div class="text-2xl font-bold text-primary-500">{{ formatNumber(stats.gdp.total) }}</div>
        <div class="text-xs text-gray-400">{{ stats.gdp.coverage }}</div>
      </template>
      <div v-else class="text-gray-400">No data</div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div class="text-sm text-gray-500 mb-1">Population</div>
      <template v-if="pending">
        <div class="skeleton h-7 w-32 mb-1" />
        <div class="skeleton h-4 w-24" />
      </template>
      <template v-else-if="stats?.population">
        <div class="text-2xl font-bold text-primary-500">{{ formatPopulation(stats.population.total) }}</div>
        <div class="text-xs text-gray-400">{{ stats.population.coverage }}</div>
      </template>
      <div v-else class="text-gray-400">No data</div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div class="text-sm text-gray-500 mb-1">CO2 Emissions</div>
      <template v-if="pending">
        <div class="skeleton h-7 w-32 mb-1" />
        <div class="skeleton h-4 w-24" />
      </template>
      <template v-else-if="stats?.co2">
        <div class="text-2xl font-bold text-primary-500">{{ formatCO2(stats.co2.total) }}</div>
        <div class="text-xs text-gray-400">{{ stats.co2.coverage }}</div>
      </template>
      <div v-else class="text-gray-400">No data</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  stats: {
    gdp: { total: number; count: number; coverage: string } | null
    population: { total: number; count: number; coverage: string } | null
    co2: { total: number; count: number; coverage: string } | null
  } | null
  pending: boolean
}>()
</script>
