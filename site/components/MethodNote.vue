<template>
  <details class="method-note group mt-3 text-xs text-primary-600">
    <summary class="cursor-pointer select-none text-primary-500 hover:text-primary-800 list-none flex items-center gap-1">
      <span class="inline-block transition-transform group-open:rotate-90">›</span>
      {{ title }}
    </summary>
    <div class="mt-2 space-y-1.5 leading-relaxed border-l-2 border-primary-100 pl-3">
      <slot />
    </div>
  </details>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'How these numbers are calculated' })
</script>

<style scoped>
.method-note summary::-webkit-details-marker { display: none; }
.method-note :deep(strong) { @apply font-medium text-primary-800; }
.method-note :deep(a) { @apply text-accent-600 hover:text-accent-700 underline; }
</style>
