<template>
  <td class="px-5 py-3 text-right">
    <div class="flex items-center justify-end gap-2">
      <div class="w-20 h-1.5 bg-primary-100 rounded-full overflow-hidden flex-shrink-0">
        <div
          class="h-full rounded-full transition-all"
          :class="color === 'red' ? 'bg-red-400' : color === 'amber' ? 'bg-amber-400' : 'bg-primary-400'"
          :style="{ width: `${pct}%` }"
        />
      </div>
      <span class="text-primary-800 tabular-nums text-sm whitespace-nowrap">{{ formatted }}</span>
    </div>
  </td>
</template>

<script setup lang="ts">
const props = defineProps<{
  value: number | null
  maxValue: number
  formatted: string
  color?: 'default' | 'red' | 'amber'
}>()

const pct = computed(() => {
  if (props.value == null || props.maxValue <= 0) return 0
  return Math.min(100, Math.round((props.value / props.maxValue) * 100))
})
</script>
