<template>
  <section id="backup" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
      <h2 class="font-serif text-xl font-bold text-primary-900">Backup (Wasabi)</h2>
      <span class="text-xs px-2.5 py-1 rounded-full font-medium" :class="pill.cls">{{ pill.label }}</span>
    </div>
    <p class="text-xs text-primary-500 mb-5">
      Encrypted nightly backups with restic. In the Wasabi console, create a bucket and an access key with access to that bucket, then enter them here.
      Keys are stored only in the server's private settings file and are never shown again.
    </p>

    <div v-if="loadError" class="text-sm text-red-600 mb-4">{{ loadError }}</div>

    <!-- One-time generated password -->
    <div v-if="generatedPassword" class="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p class="text-sm font-semibold text-amber-900 mb-1">Save this backup encryption password now</p>
      <p class="text-xs text-amber-800 mb-3">{{ passwordNotice }}</p>
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <code class="font-mono text-sm bg-white ring-1 ring-amber-300 rounded px-2 py-1 break-all select-all">{{ generatedPassword }}</code>
        <button class="text-xs px-2.5 py-1 rounded bg-amber-100 text-amber-900 hover:bg-amber-200" @click="copyPassword">{{ copied ? 'Copied' : 'Copy' }}</button>
      </div>
      <label class="flex items-center gap-1.5 text-xs text-amber-900 mb-2">
        <input v-model="savedConfirm" type="checkbox" class="rounded"> I have saved it in a password manager
      </label>
      <button class="text-sm px-4 py-1.5 rounded-lg bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-40" :disabled="!savedConfirm" @click="dismissPassword">Done — hide it</button>
    </div>

    <!-- Settings form -->
    <form class="grid sm:grid-cols-2 gap-3 mb-4" autocomplete="off" @submit.prevent="save">
      <label class="block"><span class="block text-xs text-primary-500 mb-1">Region</span>
        <select v-model="form.region" class="w-full text-sm rounded-lg border border-primary-200 px-2 py-1.5 bg-white">
          <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>
      <label class="block"><span class="block text-xs text-primary-500 mb-1">Bucket</span>
        <input v-model.trim="form.bucket" type="text" spellcheck="false" placeholder="my-backup-bucket" class="w-full text-sm rounded-lg border border-primary-200 px-2 py-1.5 font-mono">
      </label>
      <label class="block"><span class="block text-xs text-primary-500 mb-1">Access key</span>
        <input v-model.trim="form.accessKey" type="text" spellcheck="false" autocomplete="off" :placeholder="status?.accessKeyMasked ? `${status.accessKeyMasked} (unchanged)` : 'Wasabi access key'" class="w-full text-sm rounded-lg border border-primary-200 px-2 py-1.5 font-mono">
      </label>
      <label class="block"><span class="block text-xs text-primary-500 mb-1">Secret key</span>
        <input v-model.trim="form.secretKey" type="password" autocomplete="new-password" :placeholder="status?.secretKeySet ? 'unchanged' : 'Wasabi secret key'" class="w-full text-sm rounded-lg border border-primary-200 px-2 py-1.5 font-mono">
      </label>
      <label class="block sm:col-span-2"><span class="block text-xs text-primary-500 mb-1">Folder in bucket</span>
        <input v-model.trim="form.path" type="text" spellcheck="false" placeholder="worldcountrygroups" class="w-full text-sm rounded-lg border border-primary-200 px-2 py-1.5 font-mono">
      </label>
      <div class="sm:col-span-2 flex flex-wrap items-center gap-2">
        <button type="submit" class="text-sm px-4 py-1.5 rounded-lg bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-40" :disabled="busy !== null">{{ busy === 'save' ? 'Saving…' : 'Save' }}</button>
        <span v-if="status?.passwordSet" class="text-xs text-primary-500">Encryption password: set</span>
        <span v-else-if="status" class="text-xs text-amber-700">Encryption password: will be generated on save</span>
      </div>
    </form>

    <!-- Actions -->
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <button class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40" :disabled="!status?.configured || busy !== null" @click="test">{{ busy === 'test' ? 'Testing…' : 'Test connection' }}</button>
      <button v-if="testResult?.state === 'not-initialized'" class="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40" :disabled="busy !== null" @click="init">{{ busy === 'init' ? 'Initializing…' : 'Initialize repository' }}</button>
      <button class="text-xs px-2.5 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40" :disabled="!status?.configured || status?.running || busy !== null" @click="runNow">{{ status?.running ? 'Backup running…' : busy === 'run' ? 'Starting…' : 'Back up now' }}</button>
      <button class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40" :disabled="!status?.configured || busy !== null" @click="loadSnapshots">{{ busy === 'snapshots' ? 'Loading…' : 'List snapshots' }}</button>
    </div>
    <p v-if="msg" class="text-xs mb-3" :class="msgError ? 'text-red-600' : 'text-green-700'">{{ msg }}</p>
    <div v-if="testResult" class="text-xs mb-4 rounded-lg px-3 py-2" :class="testResult.state === 'ok' ? 'bg-green-50 text-green-800' : testResult.state === 'not-initialized' ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'">
      <span class="font-medium">Connection test:</span> {{ testResult.message }}
      <span class="text-[11px] opacity-70 ml-1">{{ fmtTime(testResult.testedAt) }}</span>
      <pre v-if="testResult.detail" class="mt-1 whitespace-pre-wrap font-mono text-[11px] opacity-80">{{ testResult.detail }}</pre>
    </div>

    <!-- Last result -->
    <div v-if="status" class="border-t border-primary-100 pt-4 mb-4">
      <h3 class="font-serif text-base font-bold text-primary-900 mb-2">Last backup</h3>
      <p class="text-sm text-primary-700">
        <template v-if="status.running">A backup is running now<span v-if="status.lastResult.lastStartedAt"> (started {{ fmtTime(status.lastResult.lastStartedAt) }})</span>.</template>
        <template v-else-if="status.lastResult.lastFinishedAt">Last successful backup: {{ fmtTime(status.lastResult.lastFinishedAt) }}</template>
        <template v-else>No successful backup recorded yet.</template>
      </p>
      <div v-if="status.lastResult.lastRunFailed" class="mt-2 text-xs rounded-lg bg-red-50 text-red-800 px-3 py-2">
        <p class="font-medium mb-1">The most recent run failed<span v-if="status.lastResult.logUpdatedAt"> ({{ fmtTime(status.lastResult.logUpdatedAt) }})</span>:</p>
        <pre class="whitespace-pre-wrap font-mono text-[11px]">{{ status.lastResult.errorLines.join('\n') }}</pre>
      </div>
      <details v-if="status.lastResult.tail.length" class="mt-2">
        <summary class="text-xs text-primary-500 cursor-pointer">Log tail</summary>
        <pre class="mt-1 whitespace-pre-wrap font-mono text-[11px] text-primary-600 bg-primary-50 rounded-lg p-2 max-h-64 overflow-auto">{{ status.lastResult.tail.join('\n') }}</pre>
      </details>
    </div>

    <!-- Snapshots -->
    <div v-if="snapshots !== null" class="border-t border-primary-100 pt-4">
      <h3 class="font-serif text-base font-bold text-primary-900 mb-2">Snapshots <span class="text-xs font-sans font-normal text-primary-400">({{ snapshots.length }})</span></h3>
      <p v-if="!snapshots.length" class="text-xs text-primary-500">No snapshots yet.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead><tr class="text-left text-primary-400"><th class="py-1 pr-3 font-medium">ID</th><th class="py-1 pr-3 font-medium">Time</th><th class="py-1 pr-3 font-medium">Size</th><th class="py-1 font-medium">Added</th></tr></thead>
          <tbody>
            <tr v-for="s in snapshots" :key="s.id" class="border-t border-primary-50 text-primary-700">
              <td class="py-1 pr-3 font-mono">{{ s.shortId }}</td>
              <td class="py-1 pr-3">{{ fmtTime(s.time) }}</td>
              <td class="py-1 pr-3">{{ fmtBytes(s.size) }}</td>
              <td class="py-1">{{ fmtBytes(s.dataAdded) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface TestResult { state: string; message: string; detail?: string; testedAt: string }
interface Status {
  configured: boolean; envFileExists: boolean
  region: string | null; bucket: string | null; path: string | null
  accessKeyMasked: string | null; accessKeySet: boolean; secretKeySet: boolean; passwordSet: boolean
  regions: string[]; defaultPath: string; running: boolean
  lastResult: { logExists: boolean; logUpdatedAt: string | null; lastFinishedAt: string | null; lastStartedAt: string | null; lastRunFailed: boolean; errorLines: string[]; tail: string[] }
  lastTest: TestResult | null
}
interface Snapshot { id: string; shortId: string; time: string; size: number | null; dataAdded: number | null }

const FALLBACK_REGIONS = ['us-east-1', 'us-east-2', 'us-central-1', 'us-west-1', 'us-west-2', 'ca-central-1', 'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-south-1', 'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2']

const status = ref<Status | null>(null)
const loadError = ref('')
const form = reactive({ region: 'eu-central-1', bucket: '', accessKey: '', secretKey: '', path: 'worldcountrygroups' })
const busy = ref<null | 'save' | 'test' | 'init' | 'run' | 'snapshots'>(null)
const msg = ref('')
const msgError = ref(false)
const testResult = ref<TestResult | null>(null)
const snapshots = ref<Snapshot[] | null>(null)
const generatedPassword = ref('')
const passwordNotice = ref('')
const savedConfirm = ref(false)
const copied = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const regions = computed(() => status.value?.regions?.length ? status.value.regions : FALLBACK_REGIONS)

const pill = computed(() => {
  const s = status.value
  if (!s) return { label: 'Loading…', cls: 'bg-primary-50 text-primary-500' }
  if (s.running) return { label: 'Backing up…', cls: 'bg-blue-50 text-blue-700' }
  if (!s.configured) return { label: 'Not configured', cls: 'bg-amber-50 text-amber-800' }
  if (s.lastResult.lastRunFailed) return { label: 'Last backup failed', cls: 'bg-red-50 text-red-700' }
  if (s.lastResult.lastFinishedAt) {
    const age = Date.now() - new Date(s.lastResult.lastFinishedAt).getTime()
    if (age > 2 * 86400_000) return { label: 'Backup stale', cls: 'bg-amber-50 text-amber-800' }
    return { label: 'OK', cls: 'bg-green-50 text-green-700' }
  }
  return { label: 'Configured, no backup yet', cls: 'bg-primary-50 text-primary-700' }
})

function errMsg(e: any): string {
  return e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || 'Request failed'
}
function setMsg(text: string, isError = false) { msg.value = text; msgError.value = isError }

function applyStatus(s: Status, fillForm = false) {
  status.value = s
  if (s.lastTest && !testResult.value) testResult.value = s.lastTest
  if (fillForm) {
    if (s.region) form.region = s.region
    if (s.bucket) form.bucket = s.bucket
    form.path = s.path || s.defaultPath || 'worldcountrygroups'
  }
  managePolling()
}

async function loadStatus(fillForm = false) {
  try {
    applyStatus(await $fetch<Status>('/api/admin/backup/status'), fillForm)
    loadError.value = ''
  } catch (e) { loadError.value = `Could not load backup status: ${errMsg(e)}` }
}

function managePolling() {
  const running = !!status.value?.running
  if (running && !pollTimer) pollTimer = setInterval(() => loadStatus(), 5000)
  else if (!running && pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function save() {
  busy.value = 'save'; setMsg('')
  try {
    const r = await $fetch<any>('/api/admin/backup/config', { method: 'POST', body: { ...form } })
    form.accessKey = ''; form.secretKey = ''
    testResult.value = null
    applyStatus(r.status, true)
    if (r.generatedPassword) { generatedPassword.value = r.generatedPassword; passwordNotice.value = r.passwordNotice; savedConfirm.value = false; copied.value = false }
    setMsg(r.message || 'Saved.')
  } catch (e) { setMsg(errMsg(e), true) } finally { busy.value = null }
}

async function test() {
  busy.value = 'test'; setMsg('')
  try { testResult.value = await $fetch<TestResult>('/api/admin/backup/test', { method: 'POST' }) }
  catch (e) { setMsg(errMsg(e), true) } finally { busy.value = null }
}

async function init() {
  busy.value = 'init'; setMsg('')
  try {
    const r = await $fetch<any>('/api/admin/backup/init', { method: 'POST' })
    setMsg(r.message + (r.detail ? `\n${r.detail}` : ''), !r.ok)
    if (r.ok) testResult.value = { state: 'ok', message: 'Repository created.', testedAt: new Date().toISOString() }
  } catch (e) { setMsg(errMsg(e), true) } finally { busy.value = null }
}

async function runNow() {
  busy.value = 'run'; setMsg('')
  try {
    const r = await $fetch<any>('/api/admin/backup/run', { method: 'POST' })
    setMsg(r.message)
    setTimeout(() => loadStatus(), 1500)
  } catch (e) { setMsg(errMsg(e), true) } finally { busy.value = null }
}

async function loadSnapshots() {
  busy.value = 'snapshots'; setMsg('')
  try {
    const r = await $fetch<any>('/api/admin/backup/snapshots')
    if (r.ok) snapshots.value = r.snapshots
    else { snapshots.value = null; setMsg(r.message || 'Could not list snapshots', true) }
  } catch (e) { setMsg(errMsg(e), true) } finally { busy.value = null }
}

async function copyPassword() {
  try { await navigator.clipboard.writeText(generatedPassword.value); copied.value = true } catch { copied.value = false }
}
function dismissPassword() { generatedPassword.value = ''; passwordNotice.value = ''; savedConfirm.value = false }

function fmtTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
function fmtBytes(n: number | null) {
  if (n == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`
}

onMounted(() => loadStatus(true))
onBeforeUnmount(() => { if (pollTimer) clearInterval(pollTimer) })
</script>
