<template>
  <div>
    <div v-if="pending" class="flex items-center justify-center py-8">
      <div class="h-6 w-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
    </div>
    <div v-else-if="graphData?.nodes?.length">
      <ChartsChartForceGraph
        :nodes="graphData.nodes"
        :edges="graphData.edges"
        :width="600"
        :height="380"
      />
    </div>
    <p v-else class="text-xs text-primary-400 py-4">No alliance network data available.</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ iso: string }>()

const { data: graphData, pending } = await useFetch<any>('/api/intelligence/alliance-network', {
  query: computed(() => ({ iso: props.iso })),
})
</script>
