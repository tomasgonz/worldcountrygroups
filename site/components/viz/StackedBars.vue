<template>
  <!-- Horizontal stacked bars; absolute counts, or 100% when `normalize` -->
  <div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-primary-500 mb-3">
      <span v-for="s in series" :key="s.key" class="inline-flex items-center gap-1.5">
        <span class="w-3 h-2.5 rounded-sm" :style="{ background: s.color, boxShadow: s.ring ? 'inset 0 0 0 1px #cbd5e1' : '' }" />{{ s.label }}
      </span>
    </div>
    <ul class="space-y-1.5">
      <li v-for="r in rows" :key="r.key" class="grid items-center gap-3" :style="{ gridTemplateColumns: `min(${labelWidth}, 38%) 1fr ${valueWidth}` }">
        <NuxtLink v-if="r.href" :to="r.href" class="text-[13px] text-primary-700 hover:text-accent-700 truncate" :title="r.label">
          <span v-if="r.prefix" class="mr-1">{{ r.prefix }}</span>{{ r.label }}
        </NuxtLink>
        <span v-else class="text-[13px] text-primary-700 truncate" :title="r.label">
          <span v-if="r.prefix" class="mr-1">{{ r.prefix }}</span>{{ r.label }}
        </span>
        <div class="flex h-4 gap-[2px]" tabindex="0" @mousemove="tip(r, $event)" @mouseleave="hide" @focus="tip(r, $event)" @blur="hide">
          <div v-for="(s, i) in series" :key="s.key" v-show="r.values[s.key] > 0"
            class="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
            :class="i === lastIdx(r) ? 'rounded-r-[4px]' : ''"
            :style="{ width: width(r, s.key), background: s.color, boxShadow: s.ring ? 'inset 0 0 0 1px #cbd5e1' : '' }" />
        </div>
        <span class="text-right text-[12px] tabular-nums text-primary-800">{{ r.valueLabel ?? total(r) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
interface Series { key: string; label: string; color: string; ring?: boolean }
interface Row { key: string; label: string; href?: string; prefix?: string; values: Record<string, number>; valueLabel?: string; detail?: string[] }
const props = withDefaults(defineProps<{ rows: Row[]; series: Series[]; normalize?: boolean; labelWidth?: string; valueWidth?: string; unitLabel?: string }>(),
  { normalize: false, labelWidth: '10rem', valueWidth: '3rem', unitLabel: '' })
const { show, hide } = useVizTip()
const total = (r: Row) => props.series.reduce((a, s) => a + (r.values[s.key] || 0), 0)
const maxTotal = computed(() => Math.max(1, ...props.rows.map(total)))
const width = (r: Row, k: string) => `${((r.values[k] || 0) / (props.normalize ? total(r) || 1 : maxTotal.value)) * 100}%`
const lastIdx = (r: Row) => { let i = -1; props.series.forEach((s, j) => { if (r.values[s.key] > 0) i = j }); return i }
function tip(r: Row, e: MouseEvent | FocusEvent) {
  const t = total(r) || 1
  show(e, r.label, [
    ...props.series.filter(s => r.values[s.key] > 0).map(s => ({
      text: `${s.label}: ${r.values[s.key]}${props.unitLabel}${props.normalize ? ` (${Math.round((r.values[s.key] / t) * 100)}%)` : ''}`,
      color: s.color,
    })),
    ...(r.detail || []).map(text => ({ text })),
  ])
}
</script>
