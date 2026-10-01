<template>
  <!-- Change in percentage points, centred on zero -->
  <ul class="space-y-1">
    <li v-for="r in rows" :key="r.key" class="grid items-center gap-3" :style="{ gridTemplateColumns: `min(${labelWidth}, 38%) 1fr 3.5rem` }">
      <span class="text-[13px] text-primary-700 truncate">{{ r.label }}</span>
      <div class="relative h-6 rounded-md hover:bg-primary-50" tabindex="0"
        @mousemove="tip(r, $event)" @mouseleave="hide" @focus="tip(r, $event)" @blur="hide">
        <div class="absolute top-0 bottom-0 left-1/2 w-px bg-primary-300" />
        <div v-if="r.value >= 0" class="absolute top-1/2 -translate-y-1/2 h-3.5 rounded-r-[4px]" :style="{ left: '50%', width: half(r.value), background: pos }" />
        <div v-else class="absolute top-1/2 -translate-y-1/2 h-3.5 rounded-l-[4px]" :style="{ right: '50%', width: half(r.value), background: neg }" />
      </div>
      <span class="text-right text-[12px] tabular-nums text-primary-800">{{ r.value > 0 ? '+' : '' }}{{ r.value.toFixed(1) }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
interface Row { key: string; label: string; value: number; detail?: string[] }
const props = withDefaults(defineProps<{ rows: Row[]; pos?: string; neg?: string; labelWidth?: string; unit?: string }>(),
  { pos: '#2a78d6', neg: '#e34948', labelWidth: '11rem', unit: ' pts' })
const { show, hide } = useVizTip()
const maxAbs = computed(() => Math.max(1, ...props.rows.map(r => Math.abs(r.value))))
const half = (v: number) => `${(Math.abs(v) / maxAbs.value) * 50}%`
function tip(r: Row, e: MouseEvent | FocusEvent) {
  show(e, r.label, [{ text: `${r.value > 0 ? '+' : ''}${r.value.toFixed(1)}${props.unit}`, color: r.value >= 0 ? props.pos : props.neg }, ...(r.detail || []).map(text => ({ text }))])
}
</script>
