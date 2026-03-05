<template>
  <div class="relative">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="w-full h-auto max-w-sm mx-auto">
      <!-- Grid rings -->
      <polygon
        v-for="ring in 4" :key="'ring'+ring"
        :points="ringPoints(ring / 4)"
        fill="none" stroke="#e2e8f0" stroke-width="1"
      />
      <!-- Axis lines -->
      <line
        v-for="(_, i) in axes" :key="'ax'+i"
        :x1="cx" :y1="cy"
        :x2="axisPoint(i, 1).x" :y2="axisPoint(i, 1).y"
        stroke="#e2e8f0" stroke-width="1"
      />
      <!-- Data polygon -->
      <polygon
        :points="dataPoints"
        :fill="fillColor"
        fill-opacity="0.2"
        :stroke="strokeColor"
        stroke-width="2"
      />
      <!-- Data points (always rendered, highlight on hover) -->
      <circle
        v-for="(pt, i) in dataPointsList" :key="'dp'+i"
        :cx="pt.x" :cy="pt.y" r="4"
        :fill="strokeColor" stroke="white" stroke-width="2"
        :opacity="hoveredAxis === i ? 1 : 0.7"
        pointer-events="none"
      />
      <!-- Invisible larger hit areas for each data point -->
      <circle
        v-for="(pt, i) in dataPointsList" :key="'hit'+i"
        :cx="pt.x" :cy="pt.y" r="14"
        fill="transparent"
        class="cursor-default"
        @mouseenter="onHover($event, i)"
        @mouseleave="hideTooltip"
      />
      <!-- Axis labels -->
      <text
        v-for="(ax, i) in axes" :key="'lbl'+i"
        :x="labelPoint(i).x" :y="labelPoint(i).y"
        class="fill-primary-500" font-size="11" :text-anchor="labelAnchor(i)"
        dominant-baseline="middle"
        pointer-events="none"
      >{{ ax.label }}</text>
    </svg>

    <ChartTooltip :visible="tooltip.visible" :pos-x="tooltip.x" :pos-y="tooltip.y" :title="tooltip.title" :lines="tooltip.lines" />
  </div>
</template>

<script setup lang="ts">
import type { TooltipLine } from './ChartTooltip.vue'

export interface RadarAxis {
  label: string
  value: number  // 0-1 normalized
  rawValue?: number | string
}

const props = withDefaults(defineProps<{
  axes: RadarAxis[]
  size?: number
  fillColor?: string
  strokeColor?: string
}>(), {
  size: 300,
  fillColor: '#3b82f6',
  strokeColor: '#3b82f6',
})

const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)
const radius = computed(() => props.size / 2 - 40)

function angleFor(i: number): number {
  return (Math.PI * 2 * i) / props.axes.length - Math.PI / 2
}

function axisPoint(i: number, scale: number) {
  const angle = angleFor(i)
  return {
    x: cx.value + Math.cos(angle) * radius.value * scale,
    y: cy.value + Math.sin(angle) * radius.value * scale,
  }
}

function ringPoints(scale: number): string {
  return props.axes.map((_, i) => {
    const p = axisPoint(i, scale)
    return `${p.x},${p.y}`
  }).join(' ')
}

const dataPoints = computed(() => {
  return props.axes.map((ax, i) => {
    const p = axisPoint(i, Math.max(ax.value, 0.02))
    return `${p.x},${p.y}`
  }).join(' ')
})

const dataPointsList = computed(() => {
  return props.axes.map((ax, i) => axisPoint(i, Math.max(ax.value, 0.02)))
})

function labelPoint(i: number) {
  const angle = angleFor(i)
  const offset = radius.value + 20
  return {
    x: cx.value + Math.cos(angle) * offset,
    y: cy.value + Math.sin(angle) * offset,
  }
}

function labelAnchor(i: number): string {
  const angle = angleFor(i)
  const x = Math.cos(angle)
  if (x > 0.3) return 'start'
  if (x < -0.3) return 'end'
  return 'middle'
}

const hoveredAxis = ref<number | null>(null)
const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  lines: [] as TooltipLine[],
})

function onHover(e: MouseEvent, i: number) {
  const ax = props.axes[i]
  hoveredAxis.value = i
  tooltip.visible = true
  tooltip.x = e.clientX + 12
  tooltip.y = e.clientY - 10
  tooltip.title = ax.label
  tooltip.lines = [{ label: 'Score', value: ax.rawValue != null ? String(ax.rawValue) : (ax.value * 100).toFixed(0) + '%' }]
}

function hideTooltip() {
  hoveredAxis.value = null
  tooltip.visible = false
}
</script>
