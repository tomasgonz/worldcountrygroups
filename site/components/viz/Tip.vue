<template>
  <Teleport to="body">
    <div v-if="tip.visible" class="viz-tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }" role="tooltip">
      <div v-if="tip.title" class="font-semibold text-primary-900 mb-0.5">{{ tip.title }}</div>
      <div v-for="(l, i) in tip.lines" :key="i" class="flex items-center gap-1.5 text-primary-600">
        <span v-if="l.color" class="w-2 h-2 rounded-sm shrink-0" :style="{ background: l.color }" />
        <span>{{ l.text }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const tip = useVizTip().state
</script>

<style scoped>
.viz-tip {
  position: fixed;
  z-index: 60;
  pointer-events: none;
  max-width: 18rem;
  transform: translate(12px, 12px);
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.6rem;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  padding: 0.5rem 0.65rem;
  font-size: 12px;
  line-height: 1.45;
}
</style>
