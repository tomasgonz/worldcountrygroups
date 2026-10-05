<template>
  <div ref="root" class="relative">
    <button class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ring-1 ring-primary-200 text-sm text-primary-700 hover:bg-primary-50 hover:text-primary-900"
      :aria-expanded="open" aria-haspopup="dialog" title="Share this page with a link" @click="toggle">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
      </svg>
      <span class="hidden sm:inline xl:hidden 2xl:inline">Share</span>
    </button>
    <div v-if="open" role="dialog" aria-label="Share this page" class="fixed inset-x-4 top-[80px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem] bg-white rounded-xl ring-1 ring-primary-200 shadow-lg p-4 z-50 text-left">
      <div class="text-sm font-medium text-primary-900">Share this page</div>
      <p class="text-[11px] text-primary-500 mt-0.5">Anyone with the link can view this page only, read-only, without an account. Visits are logged.</p>
      <template v-if="!url">
        <label class="block text-xs text-primary-500 mt-3">Label
          <input v-model="label" class="mt-1 w-full border border-primary-200 rounded-lg px-2.5 py-1.5 text-sm" maxlength="120">
        </label>
        <label class="block text-xs text-primary-500 mt-2">Expires after
          <select v-model.number="days" class="mt-1 w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm bg-white">
            <option :value="1">1 day</option><option :value="7">7 days</option><option :value="30">30 days</option><option :value="90">90 days</option><option :value="0">Never</option>
          </select>
        </label>
        <button class="mt-3 w-full px-3 py-2 rounded-lg bg-primary-900 text-white text-sm hover:bg-primary-800 disabled:opacity-50" :disabled="working" @click="create">{{ working ? 'Creating…' : 'Create link' }}</button>
        <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
      </template>
      <template v-else>
        <div class="mt-3 flex gap-2">
          <input :value="url" readonly class="flex-1 min-w-0 border border-primary-200 rounded-lg px-2.5 py-1.5 text-xs font-mono bg-primary-50" aria-label="Share link" @focus="($event.target as HTMLInputElement).select()">
          <button class="px-3 py-1.5 rounded-lg bg-primary-900 text-white text-xs hover:bg-primary-800" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
        </div>
        <p class="text-[11px] text-primary-500 mt-2">{{ days ? `Expires in ${days} ${days === 1 ? 'day' : 'days'}.` : 'Does not expire.' }} You can revoke it at any time.</p>
        <div class="mt-3 flex justify-between text-xs">
          <button class="text-accent-700 hover:underline" @click="reset">Make another</button>
          <NuxtLink to="/admin?tab=sharing" class="text-accent-700 hover:underline" @click="open = false">Manage links &amp; clicks</NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Admins: create a share link for the page being viewed. */
const route = useRoute()
const open = ref(false)
const label = ref('')
const days = ref(30)
const url = ref('')
const working = ref(false)
const copied = ref(false)
const error = ref('')
const root = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
  if (open.value && !url.value) label.value = (document.title || route.path).replace(/ — World Country Groups$/, '')
}
function reset() { url.value = ''; error.value = ''; copied.value = false; label.value = (document.title || route.path).replace(/ — World Country Groups$/, '') }
async function create() {
  working.value = true; error.value = ''
  try {
    const r = await $fetch<any>('/api/admin/share-links', { method: 'POST', body: { path: route.fullPath, label: label.value, expiresDays: days.value } })
    url.value = `${location.origin}/s/${r.link.token}`
    await copy()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not create a link for this page'
  } finally { working.value = false }
}
async function copy() {
  try { await navigator.clipboard.writeText(url.value); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch {}
}
// a new page gets a fresh form; clicks outside close the panel
watch(() => route.fullPath, () => { open.value = false; url.value = '' })
function outside(e: MouseEvent) { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
onMounted(() => document.addEventListener('click', outside))
onBeforeUnmount(() => document.removeEventListener('click', outside))
</script>
