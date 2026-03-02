<template>
  <span
    :class="[
      'inline-block rounded-full font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      colorClass,
    ]"
  >
    {{ domain }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  domain: string
  size?: 'sm' | 'md'
}>()

const colorMap: Record<string, string> = {
  'UNGA': 'bg-blue-100 text-blue-700',
  'Europe': 'bg-indigo-100 text-indigo-700',
  'Africa': 'bg-amber-100 text-amber-700',
  'Asia': 'bg-rose-100 text-rose-700',
  'Latin America and the Caribbean': 'bg-emerald-100 text-emerald-700',
  'Caribbean': 'bg-teal-100 text-teal-700',
  'Oceania': 'bg-cyan-100 text-cyan-700',
  'Pacific': 'bg-sky-100 text-sky-700',
  'North America': 'bg-violet-100 text-violet-700',
  'Arab World': 'bg-orange-100 text-orange-700',
  'World Bank': 'bg-green-100 text-green-700',
  'WTO': 'bg-lime-100 text-lime-700',
  'IMF': 'bg-yellow-100 text-yellow-700',
  'Peace and Security': 'bg-red-100 text-red-700',
  'Standards': 'bg-gray-100 text-gray-700',
}

const colorClass = computed(() => colorMap[props.domain] || 'bg-gray-100 text-gray-600')
</script>
