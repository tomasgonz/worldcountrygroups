<template>
  <button
    v-if="aiStatus?.configured"
    @click="download"
    :disabled="downloading"
    class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-500 hover:text-primary-700 hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    :title="buttonTitle"
  >
    <svg v-if="!downloading" class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
    <svg v-else class="w-4 h-4 inline-block mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
    {{ downloading ? 'Generating...' : label }}
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  type: string
  params: Record<string, string>
  aiStatus: { configured: boolean; provider: string | null } | null
  label?: string
  endpoint?: string
}>()

const buttonTitle = computed(() => props.label || 'Download Word')
const label = computed(() => props.label || 'Word')

const downloading = ref(false)

async function download() {
  downloading.value = true
  try {
    const endpoint = props.endpoint || '/api/intelligence/ai/briefing-doc'
    const queryParams = new URLSearchParams({ type: props.type, ...props.params })
    const res = await fetch(`${endpoint}?${queryParams.toString()}`)
    if (!res.ok) throw new Error('Download failed')

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    // Extract filename from Content-Disposition header
    const disposition = res.headers.get('Content-Disposition')
    const filenameMatch = disposition?.match(/filename="(.+?)"/)
    a.download = filenameMatch?.[1] || 'briefing.docx'
    a.href = url
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Download failed:', e)
  }
  downloading.value = false
}
</script>
