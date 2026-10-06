<template>
  <div id="briefings" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 scroll-mt-24">
    <h2 class="font-serif text-xl font-bold text-primary-900 mb-1">Scheduled briefings</h2>
    <p class="text-sm text-primary-500 mb-4">The research desk prepares a fresh briefing on a schedule and sends it to you{{ hasEmail ? ' by email' : '' }} and to your notifications. Create one here, or with “Schedule” on any answer in <NuxtLink to="/ask" class="underline">Ask</NuxtLink>.</p>
    <p v-if="!hasEmail" class="text-xs text-amber-700 mb-3">Add an email address in your profile to receive briefings by email; until then they appear in your notifications.</p>

    <ul v-if="list.length" class="divide-y divide-primary-100 mb-4">
      <li v-for="s in list" :key="s.id" class="py-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-medium text-primary-900">{{ s.title }}</span>
          <span class="text-[11px] px-2 py-0.5 rounded-full" :class="s.enabled ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-500'">{{ s.enabled ? 'On' : 'Paused' }}</span>
          <span class="text-xs text-primary-500">{{ s.summary }} · {{ langName(s.language) }}{{ s.email && hasEmail ? ' · by email' : '' }}</span>
        </div>
        <div class="text-xs text-primary-400 mt-0.5">
          <template v-if="s.lastRunAt">Last: {{ new Date(s.lastRunAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}<NuxtLink v-if="s.lastAskId && !s.lastError" :to="`/ask?id=${s.lastAskId}`" class="ml-1 text-accent-700 hover:underline">read</NuxtLink></template>
          <template v-else>Not run yet</template>
          <span v-if="s.lastError" class="text-red-600"> · failed: {{ s.lastError }}</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button class="btn" :disabled="running === s.id" @click="run(s)">{{ running === s.id ? 'Preparing… (about a minute)' : 'Run now' }}</button>
          <button class="btn" @click="update(s, { enabled: !s.enabled })">{{ s.enabled ? 'Pause' : 'Resume' }}</button>
          <button class="btn" @click="edit(s)">Edit</button>
          <button class="btn !text-red-600" @click="remove(s)">{{ confirmDel === s.id ? 'Click again' : 'Delete' }}</button>
        </div>
      </li>
    </ul>

    <button v-if="!form" class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50" @click="newForm">+ New scheduled briefing</button>
    <AccountScheduleForm v-else :model="form" :submit-label="form.id ? 'Save' : 'Create'" @cancel="form = null" @save="save" />
    <p v-if="msg" class="text-sm mt-2" :class="msg.ok ? 'text-emerald-700' : 'text-red-600'">{{ msg.text }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ hasEmail?: boolean }>()
const list = ref<any[]>([])
const form = ref<any>(null)
const msg = ref<{ ok: boolean; text: string } | null>(null)
const running = ref('')
const confirmDel = ref('')
const LANGS: Record<string, string> = { en: 'English', es: 'Español', fr: 'Français', ar: 'العربية', zh: '中文', ru: 'Русский', pt: 'Português', de: 'Deutsch' }
const langName = (l: string) => LANGS[l] || l
async function load() { try { list.value = (await $fetch<any>('/api/briefings')).schedules } catch {} }
onMounted(load)
function newForm() { form.value = { title: '', question: '', mode: 'briefing', template: 'free', language: 'en', frequency: 'weekly', weekday: 1, day: 1, hour: 6, email: true } }
function edit(s: any) { form.value = { ...s } }
async function save(f: any) {
  msg.value = null
  try {
    if (f.id) await $fetch(`/api/briefings/${f.id}`, { method: 'POST', body: f })
    else await $fetch('/api/briefings', { method: 'POST', body: f })
    form.value = null; msg.value = { ok: true, text: 'Saved.' }; load()
  } catch (e: any) { msg.value = { ok: false, text: e?.data?.statusMessage || 'Could not save' } }
}
async function update(s: any, patch: any) { await $fetch(`/api/briefings/${s.id}`, { method: 'POST', body: patch }); load() }
async function run(s: any) {
  running.value = s.id; msg.value = null
  try {
    const r = await $fetch<any>(`/api/briefings/${s.id}`, { method: 'POST', body: { action: 'run' } })
    msg.value = r.ok ? { ok: true, text: 'Briefing ready; it is in your notifications' + (s.email ? ' and on its way by email.' : '.') } : { ok: false, text: r.error || 'Failed' }
  } catch (e: any) { msg.value = { ok: false, text: e?.data?.statusMessage || 'Failed' } } finally { running.value = ''; load() }
}
async function remove(s: any) {
  if (confirmDel.value !== s.id) { confirmDel.value = s.id; setTimeout(() => { if (confirmDel.value === s.id) confirmDel.value = '' }, 3000); return }
  await $fetch(`/api/briefings/${s.id}`, { method: 'POST', body: { action: 'delete' } }); confirmDel.value = ''; load()
}
</script>

<style scoped>
.btn { @apply text-xs px-2.5 py-1 rounded-lg ring-1 ring-primary-200 text-primary-700 hover:bg-primary-50 disabled:opacity-50; }
</style>
