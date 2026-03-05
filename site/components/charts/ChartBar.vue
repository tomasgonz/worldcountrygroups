<template>
  <div class="space-y-2">
    <div v-for="(bar, i) in bars" :key="i" class="flex items-center gap-3">
      <span class="text-xs text-primary-600 flex-shrink-0 truncate" :style="{ width: labelWidth + 'px' }" :title="bar.label">
        {{ bar.label }}
      </span>
      <div class="flex-1 h-5 bg-primary-50 rounded-full overflow-hidden relative group cursor-default"
        @mouseenter="onHover($event, bar)" @mouseleave="hideTooltip"
      >
        <div
          class="h-full rounded-full transition-all duration-300"
          :style="{ width: barWidth(bar.value) + '%', background: bar.color || defaultColor }"
        />
      </div>
      <span class="text-xs font-medium text-primary-500 w-10 text-right flex-shrink-0">{{ bar.displayValue ?? bar.value }}</span>
    </div>
    <ChartTooltip :visible="tooltip.visible" :pos-x="tooltip.x" :pos-y="tooltip.y" :title="tooltip.title" :lines="tooltip.lines" />
  </div>
</template>

<script setup lang="ts">
import type { TooltipLine } from './ChartTooltip.vue'

export interface BarItem {
  label: string
  value: number
  displayValue?: string
  color?: string
  tooltipLines?: TooltipLine[]
}

const props = withDefaults(defineProps<{
  bars: BarItem[]
  labelWidth?: number
  defaultColor?: string
}>(), {
  labelWidth: 120,
  defaultColor: '#94a3b8',
})

const maxVal = computed(() => {
  if (!props.bars.length) return 1
  return Math.max(...props.bars.map(b => b.value)) || 1
})

function barWidth(val: number) {
  return Math.round((val / maxVal.value) * 100)
}

const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  lines: [] as TooltipLine[],
})

function onHover(e: MouseEvent, bar: BarItem) {
  if (!bar.tooltipLines?.length) return
  tooltip.visible = true
  tooltip.x = e.clientX + 12
  tooltip.y = e.clientY - 10
  tooltip.title = bar.label
  tooltip.lines = bar.tooltipLines
}

function hideTooltip() {
  tooltip.visible = false
}
</script>
