<template>
  <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
    <h2 class="font-serif text-xl font-bold text-primary-900">UN leadership list</h2>
    <p class="text-sm text-primary-600 mt-1 max-w-3xl">
      The UN's <a href="https://www.un.org/sg/en/leadership-team" target="_blank" rel="noopener" class="underline">Leadership team</a> page blocks automated reading.
      Open it in your browser, select everything (Ctrl+A or ⌘A), copy, and paste it here. The names and titles become the official holder list on
      <NuxtLink to="/un-leadership" class="underline">UN leadership</NuxtLink>; newer appointments announced after you paste are flagged automatically.
    </p>
    <p v-if="current" class="text-xs text-primary-500 mt-2">Last pasted {{ current.pastedAt.slice(0, 10) }} ({{ current.count }} people).</p>
    <textarea v-model="text" rows="6" class="mt-3 w-full text-sm rounded-lg ring-1 ring-primary-200 focus:ring-primary-400 outline-none p-3 font-mono" placeholder="Paste the page text here…" />
    <div class="flex flex-wrap gap-2 mt-2">
      <button class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 disabled:opacity-50" :disabled="!text.trim() || busy" @click="preview">Preview</button>
      <button v-if="parsed" class="text-sm px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-50" :disabled="busy || parsed.entries.length < 5" @click="save">Save as official list</button>
      <span v-if="msg" class="text-sm self-center" :class="err ? 'text-red-700' : 'text-emerald-700'">{{ msg }}</span>
    </div>
    <div v-if="parsed" class="mt-4 grid md:grid-cols-2 gap-4 text-sm">
      <div>
        <div class="text-xs font-medium text-primary-500 uppercase tracking-wide mb-1">Matched to tracked offices ({{ parsed.matched.length }})</div>
        <ul class="space-y-0.5"><li v-for="m in parsed.matched" :key="m.office"><span class="text-primary-400 w-28 inline-block">{{ m.office }}</span> {{ m.name }}</li></ul>
      </div>
      <div>
        <div class="text-xs font-medium text-primary-500 uppercase tracking-wide mb-1">All names found ({{ parsed.entries.length }})</div>
        <ul class="space-y-0.5 max-h-64 overflow-y-auto"><li v-for="(e, i) in parsed.entries" :key="i">{{ e.name }} <span class="text-primary-500">— {{ e.title }}</span></li></ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const text = ref('')
const parsed = ref<any>(null)
const busy = ref(false)
const msg = ref('')
const err = ref(false)
const { data: lead, refresh } = useFetch<any>('/api/un/leadership', { lazy: true, server: false })
const current = computed(() => lead.value?.roster)

async function preview() {
  busy.value = true; msg.value = ''; err.value = false
  try { parsed.value = await $fetch('/api/admin/un-leadership/roster', { method: 'POST', body: { text: text.value } }) } catch (e: any) { msg.value = e?.data?.statusMessage || 'Could not read it'; err.value = true }
  if (parsed.value && parsed.value.entries.length < 5) { msg.value = 'Too few names found: copy the whole page and try again'; err.value = true }
  busy.value = false
}
async function save() {
  busy.value = true; msg.value = ''; err.value = false
  try {
    const r: any = await $fetch('/api/admin/un-leadership/roster', { method: 'POST', body: { text: text.value, save: true } })
    msg.value = `Saved ${r.count} people`; text.value = ''; parsed.value = null; refresh()
  } catch (e: any) { msg.value = e?.data?.statusMessage || 'Could not save'; err.value = true }
  busy.value = false
}
</script>
