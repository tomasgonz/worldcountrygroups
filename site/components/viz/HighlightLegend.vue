<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-primary-500">
    <span class="inline-flex items-center gap-1.5"><span class="hl-country !text-[11px]">Country</span></span>
    <span class="inline-flex items-center gap-1.5"><span class="hl-un">UN body</span></span>
    <span v-for="t in HIGHLIGHT_THEMES" :key="t.key" class="inline-flex items-center gap-1.5">
      <span class="w-4 h-0.5 rounded-full" :style="{ background: t.color }" />{{ t.label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { HIGHLIGHT_THEMES } from '~/composables/useBriefHighlight'
</script>
