<template>
  <!-- Ranked bars (this session) with a tick for the previous session -->
  <div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-primary-500 mb-3">
      <span class="inline-flex items-center gap-1.5"><span class="w-3 h-2.5 rounded-sm" :style="{ background: color }" />{{ currentLabel }}</span>
      <span v-if="hasPrev" class="inline-flex items-center gap-1.5"><span class="w-0.5 h-3 bg-primary-700" />{{ prevLabel }}</span>
    </div>
    <ul class="space-y-1">
      <li v-for="r in rows" :key="r.key" class="grid items-center gap-3" :style="{ gridTemplateColumns: `min(${labelWidth}, 38%) 1fr 4.5rem` }">
        <span class="text-[13px] text-primary-700 truncate" :title="r.label">{{ r.label }}</span>
        <div
          class="relative h-6 rounded-md hover:bg-primary-50"
          :class="[clickable ? 'cursor-pointer' : 'cursor-default', selected === r.key ? 'bg-accent-50 ring-1 ring-accent-200' : '']"
          tabindex="0" :role="clickable ? 'button' : undefined"
          @mousemove="tip(r, $event)" @mouseleave="hide" @focus="tip(r, $event)" @blur="hide"
          @click="clickable && emit('select', r.key)" @keydown.enter="clickable && emit('select', r.key)"
        >
          <div class="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 rounded-r-[4px]" :style="{ width: w(r.value), background: color }" />
          <div v-if="r.prev != null" class="absolute top-0.5 bottom-0.5 w-0.5 bg-primary-700 rounded" :style="{ left: `calc(${w(r.prev)} - 1px)` }" />
        </div>
        <span class="text-right text-[12px] tabular-nums">
          <span class="text-primary-800">{{ fmt(r.value) }}</span>
          <span v-if="r.prev != null" class="ml-1" :class="deltaClass(r)">{{ deltaText(r) }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
interface Row { key: string; label: string; value: number; prev?: number | null; detail?: string[] }
const props = withDefaults(defineProps<{
  rows: Row[]
  color?: string
  max?: number
  unit?: string
  currentLabel?: string
  prevLabel?: string
  labelWidth?: string
  clickable?: boolean
  selected?: string | null
}>(), { color: '#2a78d6', unit: '%', currentLabel: 'This session', prevLabel: 'Previous session', labelWidth: '11rem' })

const emit = defineEmits<{ select: [key: string] }>()
const { show, hide } = useVizTip()
const hasPrev = computed(() => props.rows.some(r => r.prev != null))
const scaleMax = computed(() => props.max ?? Math.max(1, ...props.rows.flatMap(r => [r.value, r.prev ?? 0])))
const w = (v: number) => `${Math.max(0, (v / scaleMax.value) * 100)}%`
const fmt = (v: number) => `${Math.round(v)}${props.unit}`
const delta = (r: Row) => (r.prev == null ? 0 : Math.round(r.value - r.prev))
const deltaText = (r: Row) => { const d = delta(r); return d === 0 ? '±0' : d > 0 ? `+${d}` : `${d}` }
const deltaClass = (r: Row) => { const d = delta(r); return Math.abs(d) < 3 ? 'text-primary-400' : d > 0 ? 'text-accent-700' : 'text-red-700' }
function tip(r: Row, e: MouseEvent | FocusEvent) {
  const lines = [{ text: `${props.currentLabel}: ${r.value.toFixed(1)}${props.unit}`, color: props.color }]
  if (r.prev != null) lines.push({ text: `${props.prevLabel}: ${r.prev.toFixed(1)}${props.unit} (${deltaText(r)} pts)`, color: '#334155' })
  for (const d of r.detail || []) lines.push({ text: d })
  show(e, r.label, lines)
}
</script>
