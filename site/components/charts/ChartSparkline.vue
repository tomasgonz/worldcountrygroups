<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="inline-block align-middle">
    <polyline
      :points="points"
      fill="none"
      :stroke="color"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: number[]
  width?: number
  height?: number
  color?: string
  strokeWidth?: number
}>(), {
  width: 60,
  height: 16,
  color: '#64748b',
  strokeWidth: 1.5,
})

const points = computed(() => {
  if (!props.data.length) return ''
  const min = Math.min(...props.data)
  const max = Math.max(...props.data)
  const range = max - min || 1
  const pad = 1
  const w = props.width - pad * 2
  const h = props.height - pad * 2
  const step = props.data.length > 1 ? w / (props.data.length - 1) : 0
  return props.data
    .map((v, i) => `${pad + i * step},${pad + h - ((v - min) / range) * h}`)
    .join(' ')
})
</script>
