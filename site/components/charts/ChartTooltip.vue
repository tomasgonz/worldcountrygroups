<template>
  <div
    v-if="visible"
    class="pointer-events-none fixed z-50 px-3 py-2 rounded-lg bg-primary-900 text-white text-xs shadow-lg whitespace-nowrap"
    :style="{ left: posX + 'px', top: posY + 'px' }"
  >
    <div v-if="title" class="font-medium mb-0.5">{{ title }}</div>
    <div v-for="(line, i) in lines" :key="i" class="flex items-center gap-1.5">
      <span v-if="line.color" class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: line.color }" />
      <span>{{ line.label }}<span v-if="line.value != null" class="ml-1 font-medium">{{ line.value }}</span></span>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface TooltipLine {
  label: string
  value?: string | number
  color?: string
}

defineProps<{
  visible: boolean
  posX: number
  posY: number
  title?: string
  lines: TooltipLine[]
}>()
</script>
