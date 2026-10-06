<template>
  <span class="inline-flex items-center gap-2 flex-wrap">
    <a
      v-for="f in formats" :key="f.format" :href="url(f.format)" class="exp"
      :class="{ 'opacity-40 pointer-events-none': busy }"
      :title="`Download ${thread ? 'the whole conversation' : 'this answer'} as ${f.title}`"
      @click.prevent="download(f.format)"
    >{{ busy === f.format ? 'Preparing…' : f.label }}</a>
    <span v-if="error" class="text-xs text-red-600">{{ error }}</span>
  </span>
</template>

<script setup lang="ts">
/** "Word" and "PDF" download buttons for one Ask answer, or (thread) its whole conversation. */
const props = defineProps<{ id: string; thread?: boolean }>()

const formats = [
  { format: 'docx', label: 'Word', title: 'a Word document' },
  { format: 'pdf', label: 'PDF', title: 'a PDF' },
] as const

const busy = ref<string | null>(null)
const error = ref('')

const url = (format: string) => `/api/ask/${encodeURIComponent(props.id)}/export?format=${format}${props.thread ? '&thread=1' : ''}`

async function download(format: string) {
  if (busy.value) return
  busy.value = format
  error.value = ''
  try {
    const res = await fetch(url(format), { credentials: 'same-origin' })
    if (!res.ok) {
      let msg = `Export failed (${res.status})`
      try { const j = await res.json(); msg = j.statusMessage || j.message || msg } catch {}
      throw new Error(msg)
    }
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition') || ''
    const name = decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/)?.[1] || cd.match(/filename="([^"]+)"/)?.[1] || `briefing.${format}`)
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 10000)
  } catch (e: any) {
    error.value = e?.message || 'Export failed'
    setTimeout(() => { error.value = '' }, 6000)
  } finally {
    busy.value = null
  }
}
</script>

<style scoped>
.exp { @apply text-xs px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-primary-700 hover:bg-primary-50 cursor-pointer select-none; }
</style>
