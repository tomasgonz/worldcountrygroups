<template>
  <div id="undl-key" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8 scroll-mt-24">
    <h2 class="font-serif text-xl font-bold text-primary-900">UN Digital Library API key</h2>
    <p class="text-sm text-primary-600 mt-1 max-w-3xl">Used to collect new General Assembly votes (and, if the key allows, other records) automatically. Stored privately on the server, never in the code.</p>
    <div v-if="st?.hasKey" class="mt-3 text-sm text-primary-700">Key saved: <code>{{ st.hint }}</code> on {{ st.savedAt?.slice(0, 10) }}</div>
    <div class="flex flex-wrap gap-2 mt-3">
      <input v-model.trim="key" type="password" autocomplete="off" :placeholder="st?.hasKey ? 'Paste a new key to replace it' : 'Paste the API key'" class="flex-1 min-w-0 sm:min-w-[20rem] text-sm px-3 py-2 rounded-lg ring-1 ring-primary-200 focus:ring-primary-400 outline-none">
      <button class="text-sm px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-50" :disabled="!key || busy" @click="saveKey">Save</button>
      <button v-if="st?.hasKey" class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 disabled:opacity-50" :disabled="busy" @click="test">Test</button>
      <button v-if="st?.hasKey" class="text-sm px-3 py-2 rounded-lg text-red-700 hover:bg-red-50" :disabled="busy" @click="remove">Remove</button>
    </div>
    <p v-if="msg" class="text-sm mt-2" :class="err ? 'text-red-700' : 'text-emerald-700'">{{ msg }}</p>
    <div v-if="st?.lastTest" class="mt-3 text-xs rounded-lg p-3" :class="st.lastTest.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'">
      Last test {{ st.lastTest.at.slice(0, 16).replace('T', ' ') }} UTC: {{ st.lastTest.ok ? 'the key works' : `did not work (HTTP ${st.lastTest.status})` }}
      <pre class="mt-1 whitespace-pre-wrap break-all text-[11px] opacity-80">{{ st.lastTest.detail }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
const key = ref('')
const busy = ref(false)
const msg = ref('')
const err = ref(false)
const { data: st, refresh } = useFetch<any>('/api/admin/undl', { lazy: true, server: false })
async function call(body: any, ok: string) {
  busy.value = true; msg.value = ''; err.value = false
  try { await $fetch('/api/admin/undl', { method: 'POST', body }); msg.value = ok } catch (e: any) { msg.value = e?.data?.statusMessage || 'Failed'; err.value = true }
  busy.value = false
  await refresh()
}
async function saveKey() { await call({ key: key.value }, 'Saved. Click Test to check it.'); if (!err.value) key.value = '' }
async function test() { await call({ test: true }, 'Test finished; see the result below.') }
async function remove() { await call({ key: '' }, 'Removed.') }
</script>
