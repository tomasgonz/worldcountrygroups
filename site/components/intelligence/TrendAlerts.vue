<template>
  <div v-if="alerts.length" class="mb-6">
    <button
      @click="expanded = !expanded"
      class="w-full flex items-center justify-between bg-white rounded-xl border border-amber-200 px-4 py-3 hover:bg-amber-50 transition-colors"
    >
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-primary-900">Trend Alerts</span>
        <div class="flex items-center gap-1.5">
          <span v-if="highCount" class="w-2.5 h-2.5 rounded-full bg-red-500" :title="`${highCount} high severity`" />
          <span v-if="mediumCount" class="w-2.5 h-2.5 rounded-full bg-amber-400" :title="`${mediumCount} medium severity`" />
          <span v-if="lowCount" class="w-2.5 h-2.5 rounded-full bg-blue-400" :title="`${lowCount} low severity`" />
        </div>
        <span class="text-xs text-primary-400">{{ alerts.length }} alert{{ alerts.length !== 1 ? 's' : '' }}</span>
      </div>
      <svg class="w-4 h-4 text-primary-400 transition-transform" :class="expanded ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
      </svg>
    </button>

    <div v-if="expanded" class="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      <NuxtLink
        v-for="alert in alerts.slice(0, 12)"
        :key="alert.id"
        :to="`/intelligence?tab=briefing&iso=${alert.iso3}`"
        class="flex items-start gap-3 p-3 bg-white rounded-lg border transition-colors hover:bg-primary-50"
        :class="alertBorder(alert.severity)"
      >
        <span class="mt-0.5 w-2 h-2 rounded-full flex-shrink-0" :class="alertDot(alert.severity)" />
        <div class="min-w-0">
          <p class="text-xs font-medium text-primary-900 truncate">{{ alert.title }}</p>
          <p class="text-[10px] text-primary-400 leading-snug mt-0.5">{{ alert.detail }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const expanded = ref(false)

const { data: raw } = await useFetch<any>('/api/intelligence/trend-alerts')

const alerts = computed(() => raw.value?.alerts || [])
const highCount = computed(() => alerts.value.filter((a: any) => a.severity === 'high').length)
const mediumCount = computed(() => alerts.value.filter((a: any) => a.severity === 'medium').length)
const lowCount = computed(() => alerts.value.filter((a: any) => a.severity === 'low').length)

function alertBorder(s: string) {
  if (s === 'high') return 'border-red-200'
  if (s === 'medium') return 'border-amber-200'
  return 'border-primary-100'
}

function alertDot(s: string) {
  if (s === 'high') return 'bg-red-500'
  if (s === 'medium') return 'bg-amber-400'
  return 'bg-blue-400'
}
</script>
