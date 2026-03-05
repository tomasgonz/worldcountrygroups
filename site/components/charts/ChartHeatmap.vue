<template>
  <div class="overflow-x-auto">
    <div class="inline-block min-w-full">
      <!-- Column headers -->
      <div class="flex items-end mb-1" :style="{ paddingLeft: labelWidth + 'px' }">
        <div
          v-for="col in columns" :key="col"
          class="text-center text-[10px] text-primary-400 font-medium"
          :style="{ width: cellSize + 'px', minWidth: cellSize + 'px' }"
        >{{ col }}</div>
      </div>

      <!-- Rows -->
      <div v-for="(row, ri) in rows" :key="row" class="flex items-center">
        <span
          class="text-xs text-primary-600 truncate flex-shrink-0 pr-2"
          :style="{ width: labelWidth + 'px' }"
          :title="row"
        >{{ row }}</span>
        <div
          v-for="(col, ci) in columns" :key="col"
          class="flex-shrink-0 rounded-sm cursor-default transition-colors"
          :style="{
            width: (cellSize - 2) + 'px',
            height: (cellSize - 2) + 'px',
            margin: '1px',
            background: cellColor(ri, ci),
          }"
          :title="cellTitle(ri, ci)"
          @mouseenter="onHover($event, ri, ci)"
          @mouseleave="hideTooltip"
        />
      </div>

      <!-- Color scale legend -->
      <div class="flex items-center gap-2 mt-3" :style="{ paddingLeft: labelWidth + 'px' }">
        <span class="text-[10px] text-primary-400">Low</span>
        <div class="flex">
          <div v-for="i in 5" :key="i" class="w-5 h-3 rounded-sm" :style="{ background: scaleColor((i - 1) / 4) }" />
        </div>
        <span class="text-[10px] text-primary-400">High</span>
      </div>
    </div>

    <ChartTooltip :visible="tooltip.visible" :pos-x="tooltip.x" :pos-y="tooltip.y" :title="tooltip.title" :lines="tooltip.lines" />
  </div>
</template>

<script setup lang="ts">
import type { TooltipLine } from './ChartTooltip.vue'

const props = withDefaults(defineProps<{
  rows: string[]
  columns: string[]
  values: number[][]  // values[row][col]
  labelWidth?: number
  cellSize?: number
  colorFrom?: string
  colorTo?: string
}>(), {
  labelWidth: 140,
  cellSize: 40,
  colorFrom: '#f1f5f9',
  colorTo: '#3b82f6',
})

const globalMax = computed(() => {
  let max = 0
  for (const row of props.values) {
    for (const v of row) {
      if (v > max) max = v
    }
  }
  return max || 1
})

function scaleColor(t: number): string {
  // Interpolate between colorFrom and colorTo
  const from = hexToRgb(props.colorFrom)
  const to = hexToRgb(props.colorTo)
  const r = Math.round(from.r + (to.r - from.r) * t)
  const g = Math.round(from.g + (to.g - from.g) * t)
  const b = Math.round(from.b + (to.b - from.b) * t)
  return `rgb(${r},${g},${b})`
}

function cellColor(ri: number, ci: number): string {
  const v = props.values[ri]?.[ci] ?? 0
  const t = v / globalMax.value
  return scaleColor(t)
}

function cellTitle(ri: number, ci: number): string {
  return `${props.rows[ri]} / ${props.columns[ci]}: ${props.values[ri]?.[ci] ?? 0}`
}

function hexToRgb(hex: string) {
  const c = hex.replace('#', '')
  return {
    r: parseInt(c.substring(0, 2), 16),
    g: parseInt(c.substring(2, 4), 16),
    b: parseInt(c.substring(4, 6), 16),
  }
}

const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  lines: [] as TooltipLine[],
})

function onHover(e: MouseEvent, ri: number, ci: number) {
  tooltip.visible = true
  tooltip.x = e.clientX + 12
  tooltip.y = e.clientY - 10
  tooltip.title = `${props.rows[ri]}`
  tooltip.lines = [{ label: props.columns[ci], value: props.values[ri]?.[ci] ?? 0 }]
}

function hideTooltip() {
  tooltip.visible = false
}
</script>
