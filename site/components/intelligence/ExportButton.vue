<template>
  <div class="flex items-center gap-2">
    <button
      @click="handlePrint"
      class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-500 hover:text-primary-700 hover:bg-primary-50 transition-colors"
      title="Print / Save as PDF"
    >
      <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
      </svg>
      Print
    </button>
    <button
      @click="handleCopy"
      class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-500 hover:text-primary-700 hover:bg-primary-50 transition-colors"
      title="Copy as text"
    >
      <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
      </svg>
      {{ copied ? 'Copied!' : 'Copy' }}
    </button>
  </div>
</template>

<script setup lang="ts">
const copied = ref(false)

function handlePrint() {
  window.print()
}

async function handleCopy() {
  const sections = document.querySelectorAll('section')
  const text = Array.from(sections).map(s => s.textContent?.trim()).filter(Boolean).join('\n\n---\n\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}
</script>
