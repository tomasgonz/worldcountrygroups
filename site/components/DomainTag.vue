<template>
  <span
    :class="[
      'inline-block rounded-md font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs tracking-wide',
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
  'UNGA': 'bg-blue-50 text-blue-700',
  'Europe': 'bg-indigo-50 text-indigo-700',
  'Africa': 'bg-amber-50 text-amber-700',
  'Asia': 'bg-rose-50 text-rose-700',
  'Latin America and the Caribbean': 'bg-emerald-50 text-emerald-700',
  'Caribbean': 'bg-teal-50 text-teal-700',
  'Oceania': 'bg-cyan-50 text-cyan-700',
  'Pacific': 'bg-sky-50 text-sky-700',
  'North America': 'bg-violet-50 text-violet-700',
  'Arab World': 'bg-orange-50 text-orange-700',
  'World Bank': 'bg-green-50 text-green-700',
  'WTO': 'bg-lime-50 text-lime-700',
  'IMF': 'bg-yellow-50 text-yellow-700',
  'Peace and Security': 'bg-red-50 text-red-700',
  'Standards': 'bg-slate-100 text-slate-600',
}

const colorClass = computed(() => colorMap[props.domain] || 'bg-slate-50 text-slate-600')
</script>
