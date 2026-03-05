<template>
  <div class="chart-range-slider">
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-medium text-primary-500">{{ startValue }}</span>
      <span class="text-xs text-primary-400">Year Range</span>
      <span class="text-xs font-medium text-primary-500">{{ endValue }}</span>
    </div>
    <div class="slider-track" ref="trackRef">
      <div
        class="slider-highlight"
        :style="{ left: startPct + '%', width: (endPct - startPct) + '%' }"
      />
      <input
        type="range"
        :min="min"
        :max="max"
        :value="startValue"
        class="slider-input"
        @input="onStartInput"
      />
      <input
        type="range"
        :min="min"
        :max="max"
        :value="endValue"
        class="slider-input"
        @input="onEndInput"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  min: number
  max: number
  start: number
  end: number
}>()

const emit = defineEmits<{
  'update:start': [value: number]
  'update:end': [value: number]
}>()

const startValue = computed(() => props.start)
const endValue = computed(() => props.end)

const range = computed(() => props.max - props.min || 1)
const startPct = computed(() => ((startValue.value - props.min) / range.value) * 100)
const endPct = computed(() => ((endValue.value - props.min) / range.value) * 100)

function onStartInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  emit('update:start', Math.min(v, endValue.value))
}

function onEndInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  emit('update:end', Math.max(v, startValue.value))
}
</script>

<style scoped>
.chart-range-slider {
  padding: 0 2px;
}

.slider-track {
  position: relative;
  height: 24px;
  background: #e2e8f0;
  border-radius: 4px;
}

.slider-highlight {
  position: absolute;
  top: 8px;
  height: 8px;
  background: #6366f1;
  border-radius: 4px;
  pointer-events: none;
}

.slider-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background: none;
  pointer-events: none;
  -webkit-appearance: none;
  appearance: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #6366f1;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  cursor: pointer;
  pointer-events: all;
  position: relative;
  z-index: 2;
}

.slider-input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #6366f1;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  cursor: pointer;
  pointer-events: all;
  position: relative;
  z-index: 2;
}

.slider-input::-webkit-slider-runnable-track {
  background: transparent;
  height: 24px;
}

.slider-input::-moz-range-track {
  background: transparent;
  height: 24px;
  border: none;
}
</style>
