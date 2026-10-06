<template>
  <div ref="root" class="relative">
    <button class="relative p-2 rounded-lg text-primary-600 hover:bg-primary-50 hover:text-primary-900" :aria-label="`Notifications${unread ? `, ${unread} unread` : ''}`" :aria-expanded="open" @click="toggle">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" /></svg>
      <span v-if="unread" class="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">{{ unread > 9 ? '9+' : unread }}</span>
    </button>
    <div v-if="open" class="fixed inset-x-3 top-[76px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 bg-white rounded-xl ring-1 ring-primary-200 shadow-lg z-50 max-h-[70vh] flex flex-col" role="dialog" aria-label="Notifications">
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-primary-100">
        <span class="text-sm font-medium text-primary-900">Notifications</span>
        <div class="flex gap-3 text-xs">
          <button v-if="unread" class="text-accent-700 hover:underline" @click="markAll">Mark all read</button>
          <NuxtLink to="/account#alerts" class="text-accent-700 hover:underline" @click="open = false">Settings</NuxtLink>
        </div>
      </div>
      <ul class="overflow-y-auto divide-y divide-primary-50">
        <li v-for="n in items" :key="n.id" :class="n.read ? '' : 'bg-accent-50/40'">
          <button class="w-full text-left px-4 py-2.5 hover:bg-primary-50" @click="go(n)">
            <div class="text-sm text-primary-900 leading-snug">{{ n.title }}</div>
            <div v-if="n.body" class="text-xs text-primary-500 mt-0.5 whitespace-pre-line line-clamp-3">{{ n.body }}</div>
            <div class="text-[11px] text-primary-400 mt-0.5">{{ ago(n.t) }}</div>
          </button>
        </li>
        <li v-if="!items.length" class="px-4 py-6 text-sm text-primary-400 text-center">Nothing yet. Set up alerts and scheduled briefings on your <NuxtLink to="/account#alerts" class="underline" @click="open = false">account page</NuxtLink>.</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Bell with alerts and finished scheduled briefings. */
const open = ref(false)
const items = ref<any[]>([])
const unread = ref(0)
const root = ref<HTMLElement | null>(null)
async function load() {
  try { const r = await $fetch<any>('/api/notifications'); items.value = r.items; unread.value = r.unread } catch {}
}
function toggle() { open.value = !open.value; if (open.value) load() }
async function markAll() { await $fetch('/api/notifications/read', { method: 'POST', body: { all: true } }); load() }
async function go(n: any) {
  if (!n.read) $fetch('/api/notifications/read', { method: 'POST', body: { ids: [n.id] } }).then(load)
  open.value = false
  if (n.url) navigateTo(n.url)
}
function ago(d: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  if (m < 60) return `${m || 1} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)} days ago`
}
let timer: any
function outside(e: MouseEvent) { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
onMounted(() => { load(); timer = setInterval(load, 120_000); document.addEventListener('click', outside) })
onBeforeUnmount(() => { clearInterval(timer); document.removeEventListener('click', outside) })
</script>
