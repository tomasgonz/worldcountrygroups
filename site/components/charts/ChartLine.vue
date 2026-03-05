<template>
  <div class="relative">
    <svg
      :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`"
      class="w-full h-auto"
    >
      <!-- Grid lines -->
      <line
        v-for="(y, i) in gridY" :key="'gy'+i"
        :x1="pad.left" :y1="y" :x2="width - pad.right" :y2="y"
        stroke="#e2e8f0" stroke-width="1"
      />
      <!-- X-axis labels -->
      <text
        v-for="(lbl, i) in xLabels" :key="'xl'+i"
        :x="lbl.x" :y="height - 4" class="fill-primary-400" font-size="10" text-anchor="middle"
      >{{ lbl.text }}</text>
      <!-- Y-axis labels -->
      <text
        v-for="(lbl, i) in yLabels" :key="'yl'+i"
        :x="pad.left - 6" :y="lbl.y + 3" class="fill-primary-400" font-size="10" text-anchor="end"
      >{{ lbl.text }}</text>

      <!-- Area fills -->
      <path
        v-for="(series, si) in seriesData" :key="'a'+si"
        v-if="showArea"
        :d="areaPath(series)"
        :fill="seriesColors[si % seriesColors.length]"
        fill-opacity="0.1"
      />
      <!-- Lines -->
      <polyline
        v-for="(series, si) in seriesData" :key="'l'+si"
        :points="linePath(series)"
        fill="none"
        :stroke="seriesColors[si % seriesColors.length]"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Hover line (always in DOM, opacity-controlled) -->
      <line
        :x1="hoverX" :y1="pad.top"
        :x2="hoverX" :y2="height - pad.bottom"
        stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 2"
        :opacity="hoverIndex != null ? 1 : 0"
      />
      <!-- Hover dots (always in DOM, opacity-controlled) -->
      <circle
        v-for="(series, si) in seriesData" :key="'d'+si"
        :cx="hoverIndex != null && series.points[hoverIndex] ? series.points[hoverIndex].x : 0"
        :cy="hoverIndex != null && series.points[hoverIndex] ? series.points[hoverIndex].y : 0"
        r="4"
        :fill="seriesColors[si % seriesColors.length]"
        stroke="white" stroke-width="2"
        :opacity="hoverIndex != null && series.points[hoverIndex] ? 1 : 0"
        pointer-events="none"
      />

      <!-- Invisible overlay rect for mouse tracking (prevents flicker) -->
      <rect
        :x="pad.left" :y="pad.top"
        :width="chartW" :height="chartH"
        fill="transparent"
        @mousemove="onMouseMove" @mouseleave="hideTooltip"
      />
    </svg>

    <!-- Legend -->
    <div v-if="legend && seriesNames.length > 1" class="flex flex-wrap gap-3 mt-2 justify-center">
      <span v-for="(name, i) in seriesNames" :key="name" class="flex items-center gap-1 text-xs text-primary-500">
        <span class="w-3 h-0.5 rounded-full" :style="{ background: seriesColors[i % seriesColors.length] }" />
        {{ name }}
      </span>
    </div>

    <ChartTooltip :visible="tooltip.visible" :pos-x="tooltip.x" :pos-y="tooltip.y" :title="tooltip.title" :lines="tooltip.lines" />
  </div>
</template>

<script setup lang="ts">
import type { TooltipLine } from './ChartTooltip.vue'

export interface LineDataPoint {
  x: number | string
  values: number[]
  label?: string
}

const props = withDefaults(defineProps<{
  data: LineDataPoint[]
  seriesNames?: string[]
  colors?: string[]
  width?: number
  height?: number
  showArea?: boolean
  legend?: boolean
  yMin?: number
  yMax?: number
  yFormat?: (v: number) => string
}>(), {
  seriesNames: () => [],
  colors: () => [],
  width: 600,
  height: 240,
  showArea: true,
  legend: true,
})

const DEFAULT_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8']
const seriesColors = computed(() => props.colors.length ? props.colors : DEFAULT_COLORS)

const pad = { top: 16, right: 16, bottom: 24, left: 40 }

const chartW = computed(() => props.width - pad.left - pad.right)
const chartH = computed(() => props.height - pad.top - pad.bottom)

const dataMinMax = computed(() => {
  let min = Infinity, max = -Infinity
  for (const d of props.data) {
    for (const v of d.values) {
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  if (min === Infinity) { min = 0; max = 1 }
  return { min: props.yMin ?? min, max: props.yMax ?? max }
})

interface PlotPoint { x: number; y: number; rawX: number | string; rawY: number }
interface PlotSeries { points: PlotPoint[] }

const seriesData = computed<PlotSeries[]>(() => {
  const { min, max } = dataMinMax.value
  const range = max - min || 1
  const n = props.data.length
  if (!n) return []

  const numSeries = Math.max(...props.data.map(d => d.values.length), 1)
  const result: PlotSeries[] = []

  for (let si = 0; si < numSeries; si++) {
    const points: PlotPoint[] = []
    for (let i = 0; i < n; i++) {
      const v = props.data[i].values[si] ?? 0
      const px = pad.left + (n > 1 ? (i / (n - 1)) * chartW.value : chartW.value / 2)
      const py = pad.top + chartH.value - ((v - min) / range) * chartH.value
      points.push({ x: px, y: py, rawX: props.data[i].x, rawY: v })
    }
    result.push({ points })
  }
  return result
})

function linePath(series: PlotSeries) {
  return series.points.map(p => `${p.x},${p.y}`).join(' ')
}

function areaPath(series: PlotSeries) {
  if (!series.points.length) return ''
  const baseline = pad.top + chartH.value
  const top = series.points.map(p => `${p.x},${p.y}`).join(' L')
  return `M${series.points[0].x},${baseline} L${top} L${series.points[series.points.length - 1].x},${baseline} Z`
}

// Grid
const gridY = computed(() => {
  const steps = 4
  return Array.from({ length: steps + 1 }, (_, i) => pad.top + (i / steps) * chartH.value)
})

const yLabels = computed(() => {
  const steps = 4
  const { min, max } = dataMinMax.value
  const fmt = props.yFormat || ((v: number) => v % 1 === 0 ? String(v) : v.toFixed(1))
  return Array.from({ length: steps + 1 }, (_, i) => ({
    y: pad.top + (i / steps) * chartH.value,
    text: fmt(max - (i / steps) * (max - min)),
  }))
})

const xLabels = computed(() => {
  const n = props.data.length
  if (!n) return []
  const maxLabels = Math.min(n, Math.floor(chartW.value / 40))
  const step = Math.max(1, Math.ceil(n / maxLabels))
  const labels: { x: number; text: string }[] = []
  for (let i = 0; i < n; i += step) {
    const px = pad.left + (n > 1 ? (i / (n - 1)) * chartW.value : chartW.value / 2)
    labels.push({ x: px, text: String(props.data[i].x) })
  }
  return labels
})

// Hover
const hoverIndex = ref<number | null>(null)
const hoverX = computed(() => {
  if (hoverIndex.value == null || !seriesData.value[0]?.points[hoverIndex.value]) return 0
  return seriesData.value[0].points[hoverIndex.value].x
})

const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  lines: [] as TooltipLine[],
})

function onMouseMove(e: MouseEvent) {
  const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect()
  const mouseX = ((e.clientX - rect.left) / rect.width) * chartW.value
  const n = props.data.length
  if (!n) return

  // Find closest data point
  let closest = 0
  let closestDist = Infinity
  for (let i = 0; i < n; i++) {
    const px = n > 1 ? (i / (n - 1)) * chartW.value : chartW.value / 2
    const dist = Math.abs(mouseX - px)
    if (dist < closestDist) {
      closestDist = dist
      closest = i
    }
  }

  hoverIndex.value = closest
  const d = props.data[closest]
  const fmt = props.yFormat || ((v: number) => v % 1 === 0 ? String(v) : v.toFixed(1))
  tooltip.visible = true
  tooltip.x = e.clientX + 12
  tooltip.y = e.clientY - 10
  tooltip.title = d.label || String(d.x)
  tooltip.lines = d.values.map((v, i) => ({
    label: props.seriesNames[i] || `Series ${i + 1}`,
    value: fmt(v),
    color: seriesColors.value[i % seriesColors.value.length],
  }))
}

function hideTooltip() {
  hoverIndex.value = null
  tooltip.visible = false
}
</script>
