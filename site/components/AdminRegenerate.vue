<template>
  <div v-if="isAdmin" ref="root" class="relative inline-block text-left">
    <button class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ring-1 ring-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
      :aria-expanded="open" title="Admin: refresh the data and analysis on this page now" @click="toggle">
      <svg class="w-4 h-4" :class="anyRunning ? 'animate-spin' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4v5h5M20 20v-5h-5M5.6 15A7 7 0 0018 17.6M18.4 9A7 7 0 006 6.4" /></svg>
      Regenerate
    </button>
    <div v-if="open" class="absolute z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] left-0 sm:left-auto sm:right-0 bg-white rounded-xl ring-1 ring-primary-200 shadow-lg p-4">
      <div class="flex items-baseline justify-between">
        <span class="text-sm font-medium text-primary-900">Refresh this page's sources</span>
        <button class="text-xs text-accent-700 hover:underline disabled:opacity-50" :disabled="anyRunning" @click="runAll">Run all</button>
      </div>
      <p class="text-[11px] text-primary-500 mt-0.5">Admins only. Runs the same jobs as the schedule, now. The page updates when they finish.</p>
      <ul class="mt-3 divide-y divide-primary-50">
        <li v-for="it in items" :key="it.id" class="py-2 flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-sm text-primary-900 truncate">{{ labelOf(it) }}</div>
            <div class="text-[11px]" :class="it.ok ? 'text-primary-400' : 'text-red-600'">
              <template v-if="it.running">Running…</template>
              <template v-else-if="!it.ok">Last run failed{{ it.error ? `: ${it.error}` : '' }}</template>
              <template v-else>Updated {{ ago(it.updatedAt) }}</template>
            </div>
          </div>
          <button class="text-xs px-2.5 py-1 rounded-lg ring-1 ring-primary-200 text-primary-700 hover:bg-primary-50 disabled:opacity-40" :disabled="it.running" @click="run(it.id)">{{ it.running ? '…' : 'Run' }}</button>
        </li>
      </ul>
      <p v-if="msg" class="text-xs mt-2" :class="err ? 'text-red-600' : 'text-emerald-700'">{{ msg }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Admins: start the jobs and AI tasks behind a page now. `sources`: [{ id, label? }] (job ids or 'un-briefing' / 'said'). */
const props = defineProps<{ sources: { id: string; label?: string }[] }>()
const { state } = useAuth()
const isAdmin = computed(() => state.value?.role === 'admin')
const open = ref(false)
const items = ref<any[]>([])
const msg = ref('')
const err = ref(false)
const root = ref<HTMLElement | null>(null)
let timer: any = null
// when Run was clicked, per id: a job counts as running until it has recorded a start and an end after this
const clicked: Record<string, string> = {}

const anyRunning = computed(() => items.value.some(i => i.running))
const labelOf = (it: any) => props.sources.find(s => s.id === it.id)?.label || it.label
function ago(iso: string | null) {
  if (!iso) return 'never'
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
async function load() {
  try {
    const got = (await $fetch<any>('/api/admin/regenerate', { query: { ids: props.sources.map(s => s.id).join(',') } })).items
    for (const it of got) {
      const t = clicked[it.id]
      if (t && it.kind === 'job' && !it.running && !(it.lastStart && it.lastStart >= t && it.lastEnd && it.lastEnd >= t)) it.running = true
      if (t && !it.running) delete clicked[it.id]
    }
    items.value = got
  } catch {}
}
function poll() {
  clearInterval(timer)
  let wasRunning = anyRunning.value
  timer = setInterval(async () => {
    await load()
    if (wasRunning && !anyRunning.value) {
      clearInterval(timer)
      await refreshNuxtData()
      msg.value = 'Done: the page now shows the new data.'; err.value = false
    }
    wasRunning = anyRunning.value
    if (!anyRunning.value && !open.value) clearInterval(timer)
  }, 4000)
}
async function run(id: string) {
  msg.value = ''; err.value = false
  try {
    clicked[id] = new Date(Date.now() - 2000).toISOString().slice(0, 19) + 'Z'
    const r: any = await $fetch('/api/admin/regenerate', { method: 'POST', body: { id } })
    if (!r.started) msg.value = `Not started: ${r.note}`
    await load()
    const it = items.value.find(i => i.id === id)
    if (it) it.running = true
    poll()
  } catch (e: any) { msg.value = e?.data?.statusMessage || 'Could not start it'; err.value = true }
}
async function runAll() { for (const it of items.value) if (!it.running) await run(it.id) }
function toggle() { open.value = !open.value; if (open.value) { load(); if (anyRunning.value) poll() } }
function outside(e: MouseEvent) { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
onMounted(() => document.addEventListener('click', outside))
onBeforeUnmount(() => { document.removeEventListener('click', outside); clearInterval(timer) })
</script>
