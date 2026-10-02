<template>
  <div class="ask bg-primary-50/40 min-h-screen">
    <section class="bg-white border-b border-primary-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <p class="text-[11px] uppercase tracking-[0.14em] text-primary-500">Research desk</p>
        <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">Ask the database</h1>
        <p class="text-primary-500 mt-3 max-w-3xl leading-relaxed">
          Ask a question or request a briefing. The desk looks up voting records, speeches, quotes, the Security Council, groups, people and the latest
          news in this database, then writes an answer with every fact linked to its source. Every question is saved with its date and how current the data was.
        </p>
      </div>
    </section>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid lg:grid-cols-12 gap-8">
      <!-- ===================== Main ===================== -->
      <main class="lg:col-span-8 min-w-0 space-y-6">
        <!-- Composer -->
        <form class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5" @submit.prevent="ask()">
          <textarea v-model="question" rows="3" maxlength="2000" :disabled="running"
            class="w-full resize-y rounded-xl ring-1 ring-primary-200 focus:ring-2 focus:ring-accent-400 focus:outline-none p-3 text-[15px]"
            placeholder="e.g. How has India's voting on Ukraine-related resolutions changed since 2022, and what did it say about Ukraine at the General Debate?"
            aria-label="Your question" @keydown.meta.enter="ask()" @keydown.ctrl.enter="ask()" />
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <div class="flex rounded-full bg-primary-100 p-0.5 text-sm" role="tablist" aria-label="Output">
              <button v-for="m in MODES" :key="m.v" type="button" role="tab" :aria-selected="mode === m.v" class="px-3 py-1 rounded-full"
                :class="mode === m.v ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-800'" @click="mode = m.v">{{ m.label }}</button>
            </div>
            <select v-if="mode === 'briefing'" v-model="template" class="text-sm rounded-lg ring-1 ring-primary-200 px-2 py-1.5 bg-white" aria-label="Briefing type">
              <option v-for="t in TEMPLATES" :key="t.v" :value="t.v">{{ t.label }}</option>
            </select>
            <span class="flex-1" />
            <span class="text-[11px] text-primary-400 hidden sm:inline">Ctrl + Enter</span>
            <button class="px-5 py-2 rounded-xl bg-primary-900 text-white text-sm hover:bg-primary-800 disabled:opacity-50" :disabled="running || question.trim().length < 5">
              {{ running ? 'Working…' : mode === 'briefing' ? 'Prepare briefing' : thread.length ? 'Ask new question' : 'Ask' }}
            </button>
          </div>
          <div v-if="!thread.length && !running" class="mt-4 flex flex-wrap gap-2">
            <button v-for="e in EXAMPLES" :key="e.q" type="button" class="text-xs text-left px-3 py-1.5 rounded-full ring-1 ring-primary-200 text-primary-600 hover:ring-primary-400"
              @click="question = e.q; mode = e.mode; template = e.template || 'free'">{{ e.label }}</button>
          </div>
        </form>

        <!-- Conversation -->
        <template v-if="thread.length">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span v-if="root?.shared" class="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 ring-1 ring-sky-200">Shared with the team</span>
            <span v-if="thread.length > 1" class="text-primary-500">{{ thread.length }} questions in this conversation</span>
            <span class="flex-1" />
            <button class="act" @click="downloadMd">Download conversation (.md)</button>
            <template v-if="root?.mine">
              <button class="act" @click="toggleShare">{{ root.shared ? 'Stop sharing' : 'Share with team' }}</button>
              <button class="act text-red-600" @click="removeThread">{{ confirmDelete ? 'Click again to delete all' : 'Delete conversation' }}</button>
            </template>
          </div>
          <AskTurn v-for="(t, i) in thread" :key="t.id" :turn="t" :index="i" :busy="running" :copied="copiedId === t.id"
            @copy="copyTurn" @rerun="rerun" @review="review" @remove="removeTurn" />
        </template>

        <!-- Progress -->
        <section v-if="running" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5" aria-live="polite">
          <div class="text-sm font-medium text-primary-900 mb-3">{{ pendingQuestion ? `Researching: ${pendingQuestion}` : 'Researching…' }}</div>
          <ol class="space-y-1.5">
            <li v-for="(st, i) in steps" :key="i" class="flex items-center gap-2 text-sm text-primary-600">
              <span class="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] flex items-center justify-center">✓</span>{{ st }}
            </li>
            <li class="flex items-center gap-2 text-sm text-primary-400">
              <span class="w-4 h-4 rounded-full border-2 border-accent-400 border-t-transparent animate-spin" />{{ steps.length ? 'Reading the results and writing' : 'Planning the research' }}
            </li>
          </ol>
        </section>

        <div v-if="errorMsg" class="rounded-2xl bg-red-50 ring-1 ring-red-200 p-4 text-sm text-red-700">{{ errorMsg }}</div>

        <!-- Follow-up -->
        <form v-if="thread.length && !running" class="bg-white rounded-2xl ring-1 ring-accent-200 p-4" @submit.prevent="askFollowUp">
          <label for="followup" class="text-xs font-medium text-primary-600">Ask a follow-up</label>
          <textarea id="followup" v-model="followUp" rows="2" maxlength="2000"
            class="mt-1.5 w-full resize-y rounded-xl ring-1 ring-primary-200 focus:ring-2 focus:ring-accent-400 focus:outline-none p-3 text-[15px]"
            placeholder="e.g. Now compare that with India · Shorten it to one page · What did they say about it at the General Debate?"
            @keydown.meta.enter="askFollowUp" @keydown.ctrl.enter="askFollowUp" />
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <div class="flex rounded-full bg-primary-100 p-0.5 text-sm" role="tablist" aria-label="Follow-up output">
              <button v-for="m in MODES" :key="m.v" type="button" role="tab" :aria-selected="followMode === m.v" class="px-3 py-1 rounded-full"
                :class="followMode === m.v ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-800'" @click="followMode = m.v">{{ m.label }}</button>
            </div>
            <span class="flex-1" />
            <button class="px-5 py-2 rounded-xl bg-primary-900 text-white text-sm hover:bg-primary-800 disabled:opacity-50" :disabled="followUp.trim().length < 3">Ask follow-up</button>
          </div>
        </form>
      </main>

      <!-- ===================== History ===================== -->
      <aside class="lg:col-span-4">
        <div class="lg:sticky lg:top-24 bg-white rounded-2xl ring-1 ring-primary-200/70">
          <div class="px-5 pt-5 pb-3 border-b border-primary-100">
            <div class="flex items-center justify-between">
              <h2 class="font-serif text-xl text-primary-900">Question log</h2>
              <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist">
                <button v-for="s in SCOPES" :key="s.v" role="tab" :aria-selected="scope === s.v" class="px-2.5 py-0.5 rounded-full"
                  :class="scope === s.v ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="scope = s.v">{{ s.label }}</button>
              </div>
            </div>
            <input v-model="historyQuery" type="search" placeholder="Search questions" class="mt-3 w-full text-sm rounded-lg ring-1 ring-primary-200 px-3 py-1.5" aria-label="Search questions">
          </div>
          <ul class="max-h-[70vh] overflow-y-auto divide-y divide-primary-50">
            <li v-for="h in history || []" :key="h.id">
              <button class="w-full text-left px-5 py-3 hover:bg-primary-50/60" :class="root?.id === h.id ? 'bg-accent-50/60' : ''" @click="open(h.id)">
                <div class="text-sm text-primary-800 leading-snug line-clamp-2">{{ h.question }}</div>
                <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-primary-400">
                  <span>{{ fmtDate(h.createdAt) }}</span>
                  <span>· {{ h.mode === 'briefing' ? templateLabel(h.template) : 'Answer' }}</span>
                  <span v-if="h.followUps">· {{ h.followUps }} follow-up{{ h.followUps > 1 ? 's' : '' }}</span>
                  <span v-if="!h.mine">· {{ h.userName }}</span>
                  <span v-if="h.status === 'error'" class="text-red-600">· failed</span>
                  <span v-if="h.review === 'verified'" class="text-emerald-700">· verified</span>
                  <span v-if="h.review === 'incorrect'" class="text-red-700">· incorrect</span>
                  <span v-if="h.stale" class="text-amber-700">· data updated</span>
                </div>
              </button>
            </li>
            <li v-if="history && !history.length" class="px-5 py-6 text-sm text-primary-400">{{ scope === 'shared' ? 'Nothing shared yet.' : 'Your questions will appear here.' }}</li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Ask the database — World Country Groups' })
const route = useRoute()
const router = useRouter()

const MODES = [{ v: 'answer', label: 'Quick answer' }, { v: 'briefing', label: 'Briefing' }] as const
const TEMPLATES = [
  { v: 'country', label: 'Country briefing' }, { v: 'bilateral', label: 'Bilateral meeting brief' },
  { v: 'issue', label: 'Issue briefing' }, { v: 'group', label: 'Group briefing' }, { v: 'free', label: 'Free-form briefing' },
]
const templateLabel = (t: string) => TEMPLATES.find(x => x.v === t)?.label || 'Briefing'
const EXAMPLES = [
  { label: 'Brief me on Brazil before a meeting', q: 'Prepare a briefing on Brazil for a meeting with its UN ambassador next week.', mode: 'briefing', template: 'country' },
  { label: 'Germany–India bilateral brief', q: 'Prepare a bilateral meeting brief for Germany and India.', mode: 'briefing', template: 'bilateral' },
  { label: 'Who vetoed what this year?', q: 'Which draft resolutions were vetoed in the Security Council in the past year, by whom, and on what?', mode: 'answer' },
  { label: 'Debt relief in speeches since 2000', q: 'Which countries have argued for debt relief or debt restructuring in their General Debate speeches since 2000, and how has the argument changed?', mode: 'answer' },
  { label: 'G77 cohesion', q: 'How cohesive is the G77 in General Assembly votes, and which members break ranks most often?', mode: 'briefing', template: 'group' },
]
const { state: authState } = useAuth()
const SCOPES = computed(() => [{ v: 'mine', label: 'Mine' }, { v: 'shared', label: 'Shared' }, ...(authState.value?.role === 'admin' ? [{ v: 'all', label: 'Everyone' }] : [])])

const question = ref(String(route.query.q || ''))
const mode = ref<'answer' | 'briefing'>(route.query.mode === 'briefing' ? 'briefing' : 'answer')
const template = ref(TEMPLATES.some(t => t.v === route.query.template) ? String(route.query.template) : 'free')
const running = ref(false)
const steps = ref<string[]>([])
const pendingQuestion = ref('')
const errorMsg = ref('')
const thread = ref<any[]>([])
const root = computed(() => thread.value[0] || null)
const followUp = ref('')
const followMode = ref<'answer' | 'briefing'>('answer')

// ---------- history ----------
const scope = ref(['mine', 'shared', 'all'].includes(String(route.query.scope)) ? String(route.query.scope) : 'mine')
const historyQuery = ref('')
const { data: history, refresh: refreshHistory } = useFetch<any[]>('/api/ask', { query: computed(() => ({ scope: scope.value, q: historyQuery.value })), server: false })

async function open(id: string, focusId?: string) {
  errorMsg.value = ''
  try {
    const r: any = await $fetch(`/api/ask/${id}`)
    thread.value = r.thread?.length ? r.thread : [r]
    const last = thread.value[thread.value.length - 1]
    followMode.value = 'answer'
    router.replace({ query: { id: thread.value[0].id } })
    if (focusId) nextTick(() => document.getElementById(`turn-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return last
  } catch { errorMsg.value = 'That conversation could not be opened.' }
}
onMounted(() => {
  if (route.query.id) open(String(route.query.id))
  else if (route.query.run === '1' && question.value.trim().length >= 5) {
    router.replace({ query: {} })
    ask()
  }
})

// ---------- asking (server-sent events over a POST) ----------
async function stream(body: Record<string, any>): Promise<string | null> {
  running.value = true; steps.value = []; errorMsg.value = ''
  pendingQuestion.value = body.question
  let doneId: string | null = null
  try {
    const res = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.statusMessage || err.message || `Request failed (${res.status})`)
    }
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() || ''
      for (const part of parts) {
        const line = part.split('\n').find(l => l.startsWith('data: '))
        if (!line) continue
        const ev = JSON.parse(line.slice(6))
        if (ev.type === 'step') steps.value.push(ev.label)
        else if (ev.type === 'done') doneId = ev.record.id
        else if (ev.type === 'error') { errorMsg.value = ev.message; doneId = ev.id || null }
      }
    }
  } catch (e: any) {
    errorMsg.value = e?.message || 'Something went wrong'
  } finally {
    running.value = false
    pendingQuestion.value = ''
    refreshHistory()
  }
  return doneId
}

async function ask() {
  const text = question.value.trim()
  if (text.length < 5 || running.value) return
  thread.value = []
  const id = await stream({ question: text, mode: mode.value, template: template.value })
  if (id) { await open(id); question.value = '' }
}
async function askFollowUp() {
  const text = followUp.value.trim()
  const parent = thread.value[thread.value.length - 1]
  if (text.length < 3 || running.value || !parent) return
  const id = await stream({ question: text, mode: followMode.value, template: followMode.value === 'briefing' ? (root.value?.template || 'free') : 'free', parentId: parent.id })
  if (id) { followUp.value = ''; await open(root.value?.id || id, id) }
}
async function rerun(turn: any) {
  const id = await stream({ question: turn.question, mode: turn.mode, template: turn.template, rerunOf: turn.id, ...(turn.parentId ? { parentId: turn.parentId } : {}) })
  if (id) await open(turn.parentId ? root.value.id : id, id)
}

// ---------- actions ----------
const copiedId = ref('')
function turnMarkdown(t: any, level = 1) {
  const src = (t.sources || []).map((s: any) => `${s.ref.slice(1)}. ${s.title} — ${s.url.startsWith('/') ? location.origin + s.url : s.url}`).join('\n')
  const h = '#'.repeat(level)
  return `${h} ${t.question}\n\n_${t.mode === 'briefing' ? templateLabel(t.template) : 'Answer'} · ${fmtDateTime(t.createdAt)} · ${t.model || ''}_\n\n${(t.answer || t.error || '').replace(/\[S(\d+)\]/g, '[$1]')}\n\n${src ? `${h}# Sources\n${src}\n` : ''}`
}
async function copyTurn(t: any) {
  try { await navigator.clipboard.writeText(turnMarkdown(t)); copiedId.value = t.id; setTimeout(() => { copiedId.value = '' }, 2000) } catch {}
}
function downloadMd() {
  const md = thread.value.map((t, i) => turnMarkdown(t, i === 0 ? 1 : 2)).join('\n---\n\n')
  const blob = new Blob([md], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${root.value.question.slice(0, 60).replace(/[^\w]+/g, '-').toLowerCase()}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}
async function review(t: any, status: string, note: string) {
  const r = await $fetch<any>(`/api/ask/${t.id}`, { method: 'POST', body: { action: 'review', status, note } })
  Object.assign(thread.value.find(x => x.id === t.id) || {}, { review: r.review })
  refreshHistory()
}
async function toggleShare() {
  const r = await $fetch<any>(`/api/ask/${root.value.id}`, { method: 'POST', body: { action: 'share', shared: !root.value.shared } })
  thread.value[0] = { ...thread.value[0], shared: r.shared }
  refreshHistory()
}
const confirmDelete = ref(false)
async function removeThread() {
  if (!confirmDelete.value) { confirmDelete.value = true; setTimeout(() => { confirmDelete.value = false }, 3000); return }
  await $fetch(`/api/ask/${root.value.id}`, { method: 'POST', body: { action: 'delete' } })
  thread.value = []; confirmDelete.value = false
  router.replace({ query: {} })
  refreshHistory()
}
async function removeTurn(t: any) {
  await $fetch(`/api/ask/${t.id}`, { method: 'POST', body: { action: 'delete' } })
  thread.value = thread.value.filter(x => x.id !== t.id)
  refreshHistory()
}

const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const fmtDateTime = (d: string) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
</script>

<style scoped>
.badge { @apply inline-flex items-center px-2 py-0.5 rounded-full; }
.act { @apply text-xs px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-primary-700 hover:bg-primary-50 disabled:opacity-40; }
</style>

<style>
.ask .cite { font-size: 0.68em; line-height: 0; margin-left: 2px; vertical-align: 0.45em; }
.ask .cite-link { display: inline-block; min-width: 1.35em; padding: 0 0.3em; margin-left: 1px; border-radius: 999px; background: #dbeafe; color: #1e40af; text-align: center; text-decoration: none; font-weight: 600; }
.ask .cite-link:hover { background: #bfdbfe; }
</style>
