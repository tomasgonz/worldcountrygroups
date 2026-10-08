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
      <p class="text-[11px] text-primary-500 mt-0.5">Anyone with the link can view this page, read-only, without an account, and pass it on. Opens are counted; you can replace or turn off the link at any time.</p>

      <div v-if="loading" class="mt-3 h-9 rounded-lg bg-primary-50 animate-pulse" />
      <!-- the page's standing link -->
      <template v-else-if="link && mode === 'page'">
        <div class="mt-3 flex gap-2">
          <input :value="urlOf(link)" readonly class="flex-1 min-w-0 border border-primary-200 rounded-lg px-2.5 py-1.5 text-xs font-mono bg-primary-50" aria-label="Page link" @focus="($event.target as HTMLInputElement).select()">
          <button class="px-3 py-1.5 rounded-lg bg-primary-900 text-white text-xs hover:bg-primary-800" @click="copy(urlOf(link))">{{ copied ? 'Copied' : 'Copy' }}</button>
        </div>
        <p class="text-[11px] text-primary-500 mt-2">
          Opened {{ link.views }} {{ link.views === 1 ? 'time' : 'times' }}<span v-if="link.lastViewedAt">, last {{ when(link.lastViewedAt) }}</span>.
          {{ link.expiresAt ? `Expires ${when(link.expiresAt)}.` : 'Does not expire.' }}
        </p>
        <div class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <button class="text-accent-700 hover:underline" :disabled="working" title="Issue a new address; the current one stops working" @click="act('replace')">Replace link</button>
          <button class="text-red-700 hover:underline" :disabled="working" @click="act('revoke')">Turn off</button>
          <button class="text-accent-700 hover:underline" @click="mode = 'custom'">Separate private link…</button>
          <NuxtLink to="/admin?tab=sharing" class="text-accent-700 hover:underline ml-auto" @click="open = false">All links</NuxtLink>
        </div>
        <p v-if="note" class="text-[11px] text-emerald-700 mt-2">{{ note }}</p>
      </template>
      <!-- no standing link yet -->
      <template v-else-if="mode === 'page'">
        <label class="block text-xs text-primary-500 mt-3">Expires
          <select v-model.number="days" class="mt-1 w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm bg-white">
            <option :value="0">Never (turn it off when you like)</option><option :value="30">After 30 days</option><option :value="90">After 90 days</option><option :value="365">After a year</option>
          </select>
        </label>
        <button class="mt-3 w-full px-3 py-2 rounded-lg bg-primary-900 text-white text-sm hover:bg-primary-800 disabled:opacity-50" :disabled="working" @click="createPage">{{ working ? 'Creating…' : 'Create the link for this page' }}</button>
        <button class="mt-2 w-full text-xs text-accent-700 hover:underline" @click="mode = 'custom'">Or a separate private link…</button>
        <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
      </template>
      <!-- a separate one-off link (for one person, with its own expiry and limit) -->
      <template v-else>
        <template v-if="!customUrl">
          <label class="block text-xs text-primary-500 mt-3">Label (e.g. who it is for)
            <input v-model="label" class="mt-1 w-full border border-primary-200 rounded-lg px-2.5 py-1.5 text-sm" maxlength="120">
          </label>
          <label class="block text-xs text-primary-500 mt-2">Expires after
            <select v-model.number="customDays" class="mt-1 w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm bg-white">
              <option :value="1">1 day</option><option :value="7">7 days</option><option :value="30">30 days</option><option :value="90">90 days</option><option :value="0">Never</option>
            </select>
          </label>
          <button class="mt-3 w-full px-3 py-2 rounded-lg bg-primary-900 text-white text-sm hover:bg-primary-800 disabled:opacity-50" :disabled="working" @click="createCustom">{{ working ? 'Creating…' : 'Create private link' }}</button>
        </template>
        <template v-else>
          <div class="mt-3 flex gap-2">
            <input :value="customUrl" readonly class="flex-1 min-w-0 border border-primary-200 rounded-lg px-2.5 py-1.5 text-xs font-mono bg-primary-50" @focus="($event.target as HTMLInputElement).select()">
            <button class="px-3 py-1.5 rounded-lg bg-primary-900 text-white text-xs hover:bg-primary-800" @click="copy(customUrl)">{{ copied ? 'Copied' : 'Copy' }}</button>
          </div>
        </template>
        <button class="mt-2 text-xs text-accent-700 hover:underline" @click="mode = 'page'; customUrl = ''">← Back to the page link</button>
        <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Admins: the standing link of the page being viewed (one per page, passed on freely), or a separate private link. */
const route = useRoute()
const open = ref(false)
const mode = ref<'page' | 'custom'>('page')
const link = ref<any>(null)
const loading = ref(false)
const days = ref(0)
const label = ref('')
const customDays = ref(30)
const customUrl = ref('')
const working = ref(false)
const copied = ref(false)
const error = ref('')
const note = ref('')
const root = ref<HTMLElement | null>(null)

const urlOf = (l: any) => `${location.origin}/s/${l.token}`
const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const title = () => (document.title || route.path).replace(/ — World Country Groups$/, '')

async function load() {
  loading.value = true; error.value = ''
  try { link.value = (await $fetch<any>('/api/admin/share-links/page', { query: { path: route.fullPath } })).link } catch { link.value = null }
  loading.value = false
}
function toggle() {
  open.value = !open.value
  if (open.value) { mode.value = 'page'; note.value = ''; customUrl.value = ''; label.value = title(); load() }
}
async function createPage() {
  working.value = true; error.value = ''
  try {
    const r = await $fetch<any>('/api/admin/share-links', { method: 'POST', body: { path: route.fullPath, label: title(), expiresDays: days.value, kind: 'page' } })
    link.value = r.link
    await copy(urlOf(r.link))
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Could not create a link for this page' }
  working.value = false
}
async function act(action: 'replace' | 'revoke') {
  if (!link.value) return
  working.value = true; note.value = ''
  try {
    const r = await $fetch<any>(`/api/admin/share-links/${link.value.id}`, { method: 'POST', body: { action } })
    if (action === 'replace') { link.value = r.link; await copy(urlOf(r.link)); note.value = 'New link copied. The old one no longer works.' }
    else { link.value = null; note.value = '' }
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Could not update the link' }
  working.value = false
}
async function createCustom() {
  working.value = true; error.value = ''
  try {
    const r = await $fetch<any>('/api/admin/share-links', { method: 'POST', body: { path: route.fullPath, label: label.value, expiresDays: customDays.value, kind: 'custom' } })
    customUrl.value = urlOf(r.link)
    await copy(customUrl.value)
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Could not create the link' }
  working.value = false
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch {}
}
watch(() => route.fullPath, () => { open.value = false })
function outside(e: MouseEvent) { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
onMounted(() => document.addEventListener('click', outside))
onBeforeUnmount(() => document.removeEventListener('click', outside))
</script>
