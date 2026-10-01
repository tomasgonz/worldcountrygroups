<template>
  <!-- Rows x columns, single-hue sequential scale shared by every cell -->
  <div class="overflow-x-auto">
    <table class="border-separate" style="border-spacing: 2px">
      <thead>
        <tr>
          <th />
          <th v-for="c in columns" :key="c.key" class="px-1 pb-2 align-bottom">
            <div class="text-[11px] font-medium text-primary-500 leading-tight w-[4.25rem]">{{ c.label }}</div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.key">
          <th class="pr-3 text-left text-[13px] font-normal text-primary-700 whitespace-nowrap">
            {{ r.label }}<span v-if="r.sub" class="ml-1 text-[11px] text-primary-400">{{ r.sub }}</span>
          </th>
          <td v-for="c in columns" :key="c.key" class="p-0">
            <div class="w-[4.25rem] h-9 rounded-[4px] flex items-center justify-center text-[11px] tabular-nums cursor-default"
              :style="cellStyle(value(r, c))" tabindex="0"
              @mousemove="tip(r, c, $event)" @mouseleave="hide" @focus="tip(r, c, $event)" @blur="hide">
              {{ Math.round(value(r, c)) }}{{ unit }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="flex items-center gap-2 mt-3 text-[11px] text-primary-500">
      <span>0{{ unit }}</span>
      <span class="h-2 w-40 rounded-full" :style="{ background: `linear-gradient(90deg, ${RAMP.join(',')})` }" />
      <span>{{ Math.round(max) }}{{ unit }}</span>
      <span v-if="caption" class="ml-2">{{ caption }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Axis { key: string; label: string; sub?: string }
const props = withDefaults(defineProps<{ rows: Axis[]; columns: Axis[]; values: Record<string, Record<string, number>>; unit?: string; caption?: string; tipNote?: string }>(),
  { unit: '%', caption: '', tipNote: '' })
const { show, hide } = useVizTip()
// Blue sequential ramp, light -> dark
const RAMP = ['#eef5fd', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
const value = (r: Axis, c: Axis) => props.values[r.key]?.[c.key] ?? 0
const max = computed(() => Math.max(1, ...props.rows.flatMap(r => props.columns.map(c => value(r, c)))))
function cellStyle(v: number) {
  const i = Math.min(RAMP.length - 1, Math.round((v / max.value) * (RAMP.length - 1)))
  return { background: RAMP[i], color: i >= 4 ? '#fff' : '#334155' }
}
function tip(r: Axis, c: Axis, e: MouseEvent | FocusEvent) {
  show(e, `${r.label} · ${c.label}`, [{ text: `${value(r, c).toFixed(1)}${props.unit}${props.tipNote ? ' ' + props.tipNote : ''}` }])
}
</script>
