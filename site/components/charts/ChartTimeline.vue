<template>
  <div class="relative" ref="containerRef">
    <svg
      :width="width"
      :height="computedHeight"
      class="overflow-visible"
      @mousemove="onMouseMove"
      @mouseleave="hideTooltip"
    >
      <!-- Grid -->
      <line
        v-for="(label, i) in xLabels"
        :key="'grid-' + i"
        :x1="label.x" :y1="topPad"
        :x2="label.x" :y2="computedHeight - bottomPad"
        stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,4"
      />

      <!-- Lanes -->
      <g v-for="(lane, li) in lanes" :key="lane.type">
        <text
          :x="leftPad - 8" :y="laneY(li) + 4"
          text-anchor="end" class="text-[10px] fill-primary-400"
        >{{ lane.label }}</text>
        <line
          :x1="leftPad" :y1="laneY(li)"
          :x2="width - rightPad" :y2="laneY(li)"
          stroke="#f3f4f6" stroke-width="1"
        />
      </g>

      <!-- Events -->
      <circle
        v-for="(evt, ei) in plotEvents"
        :key="ei"
        :cx="evt.x" :cy="evt.y"
        :r="evt.r"
        :fill="evt.color"
        :opacity="hoverIndex === ei ? 1 : 0.7"
        class="cursor-pointer transition-opacity"
      />

      <!-- X-axis labels -->
      <text
        v-for="label in xLabels"
        :key="'xlabel-' + label.text"
        :x="label.x" :y="computedHeight - 4"
        text-anchor="middle" class="text-[10px] fill-primary-400"
      >{{ label.text }}</text>
    </svg>

    <!-- Tooltip -->
    <ChartsChartTooltip
      :visible="tooltip.visible"
      :pos-x="tooltip.x"
      :pos-y="tooltip.y"
      :title="tooltip.title"
      :lines="tooltip.lines"
    />

    <!-- Legend -->
    <div class="flex items-center gap-4 mt-2 text-[10px] text-primary-400">
      <span v-for="lane in lanes" :key="lane.type" class="flex items-center gap-1">
        <span class="w-2 h-2 rounded-full" :style="{ background: lane.color }" />
        {{ lane.label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface TimelineEvent {
  date: string
  type: 'news' | 'conflict' | 'speech'
  title: string
  detail?: string
  intensity?: number
}

const props = withDefaults(defineProps<{
  events: TimelineEvent[]
  width?: number
  height?: number
}>(), {
  width: 700,
  height: 160,
})

const containerRef = ref<HTMLElement | null>(null)

const leftPad = 70
const rightPad = 20
const topPad = 20
const bottomPad = 24

const lanes = [
  { type: 'news', label: 'News', color: '#3b82f6' },
  { type: 'conflict', label: 'Conflict', color: '#ef4444' },
  { type: 'speech', label: 'Speech', color: '#6366f1' },
]

const computedHeight = computed(() => props.height)

function laneY(index: number) {
  const usable = computedHeight.value - topPad - bottomPad
  const spacing = usable / (lanes.length + 1)
  return topPad + spacing * (index + 1)
}

const sortedEvents = computed(() => {
  return [...props.events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
})

const timeRange = computed(() => {
  if (!sortedEvents.value.length) return { min: Date.now(), max: Date.now() }
  const times = sortedEvents.value.map(e => new Date(e.date).getTime())
  return { min: Math.min(...times), max: Math.max(...times) }
})

const plotEvents = computed(() => {
  const { min, max } = timeRange.value
  const range = max - min || 1
  const plotW = props.width - leftPad - rightPad

  return sortedEvents.value.map(evt => {
    const t = new Date(evt.date).getTime()
    const x = leftPad + ((t - min) / range) * plotW
    const laneIdx = lanes.findIndex(l => l.type === evt.type)
    const y = laneY(laneIdx >= 0 ? laneIdx : 0)
    const r = 3 + (evt.intensity || 0.5) * 5
    const color = lanes[laneIdx >= 0 ? laneIdx : 0].color
    return { x, y, r, color, ...evt }
  })
})

const xLabels = computed(() => {
  const { min, max } = timeRange.value
  const range = max - min || 1
  const plotW = props.width - leftPad - rightPad
  const count = Math.min(6, Math.max(2, Math.floor(plotW / 100)))
  const labels: { x: number; text: string }[] = []
  for (let i = 0; i <= count; i++) {
    const t = min + (range * i) / count
    const d = new Date(t)
    labels.push({
      x: leftPad + (plotW * i) / count,
      text: d.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
    })
  }
  return labels
})

// Tooltip
const hoverIndex = ref(-1)
const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  lines: [] as { label: string; value?: string; color?: string }[],
})

function onMouseMove(e: MouseEvent) {
  if (!plotEvents.value.length) return
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  let closest = -1
  let minDist = Infinity
  for (let i = 0; i < plotEvents.value.length; i++) {
    const p = plotEvents.value[i]
    const dist = Math.hypot(p.x - mx, p.y - my)
    if (dist < minDist && dist < 30) {
      minDist = dist
      closest = i
    }
  }

  hoverIndex.value = closest
  if (closest >= 0) {
    const evt = plotEvents.value[closest]
    tooltip.visible = true
    tooltip.x = e.clientX
    tooltip.y = e.clientY
    tooltip.title = evt.title
    tooltip.lines = [
      { label: 'Date', value: new Date(evt.date).toLocaleDateString() },
      { label: 'Type', value: evt.type, color: evt.color },
    ]
    if (evt.detail) tooltip.lines.push({ label: 'Detail', value: evt.detail })
  } else {
    tooltip.visible = false
  }
}

function hideTooltip() {
  tooltip.visible = false
  hoverIndex.value = -1
}
</script>
