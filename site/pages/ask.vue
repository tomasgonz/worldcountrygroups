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
              {{ running ? 'Working…' : mode === 'briefing' ? 'Prepare briefing' : 'Ask' }}
            </button>
          </div>
          <div v-if="!current && !running" class="mt-4 flex flex-wrap gap-2">
            <button v-for="e in EXAMPLES" :key="e.q" type="button" class="text-xs text-left px-3 py-1.5 rounded-full ring-1 ring-primary-200 text-primary-600 hover:ring-primary-400"
              @click="question = e.q; mode = e.mode; template = e.template || 'free'">{{ e.label }}</button>
          </div>
        </form>

        <!-- Progress -->
        <section v-if="running" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5" aria-live="polite">
          <div class="text-sm font-medium text-primary-900 mb-3">Researching…</div>
          <ol class="space-y-1.5">
            <li v-for="(s, i) in steps" :key="i" class="flex items-center gap-2 text-sm text-primary-600">
              <span class="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] flex items-center justify-center">✓</span>{{ s }}
            </li>
            <li class="flex items-center gap-2 text-sm text-primary-400">
              <span class="w-4 h-4 rounded-full border-2 border-accent-400 border-t-transparent animate-spin" />{{ steps.length ? 'Reading the results and writing' : 'Planning the research' }}
            </li>
          </ol>
        </section>

        <div v-if="errorMsg" class="rounded-2xl bg-red-50 ring-1 ring-red-200 p-4 text-sm text-red-700">{{ errorMsg }}</div>

        <!-- Answer -->
        <article v-if="current && !running" class="bg-white rounded-2xl ring-1 ring-primary-200/70">
          <header class="px-6 pt-5 pb-4 border-b border-primary-100">
            <div class="flex flex-wrap items-center gap-2 text-[11px]">
              <span class="badge bg-primary-100 text-primary-700">{{ current.mode === 'briefing' ? templateLabel(current.template) : 'Answer' }}</span>
              <span class="text-primary-500">{{ fmtDateTime(current.createdAt) }} · {{ current.userName }} · {{ current.model }}</span>
              <span v-if="current.status === 'error'" class="badge bg-red-50 text-red-700 ring-1 ring-red-200">Failed</span>
              <span v-else-if="current.stale?.length" class="badge bg-amber-50 text-amber-800 ring-1 ring-amber-200" :title="`Updated since: ${current.stale.join(', ')}`">Data updated since · may be outdated</span>
              <span v-else class="badge bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">Data unchanged since</span>
              <span v-if="current.review?.status === 'verified'" class="badge bg-emerald-600 text-white">Verified</span>
              <span v-if="current.review?.status === 'incorrect'" class="badge bg-red-600 text-white">Marked incorrect</span>
              <span v-if="current.shared" class="badge bg-sky-50 text-sky-800 ring-1 ring-sky-200">Shared</span>
            </div>
            <h2 class="font-serif text-2xl text-primary-900 mt-2 leading-snug">{{ current.question }}</h2>
          </header>
          <div v-if="current.status === 'done'" class="px-6 py-5">
            <VizHighlightLegend class="mb-4" />
            <div class="brief prose max-w-none" v-html="answerHtml" />
            <details class="mt-5 text-xs text-primary-500">
              <summary class="cursor-pointer">How this was researched ({{ current.steps?.length || 0 }} lookups)</summary>
              <ol class="mt-2 list-decimal pl-5 space-y-0.5"><li v-for="(s, i) in current.steps" :key="i">{{ s.label }}</li></ol>
              <p class="mt-2">Data as of: <span v-for="(t, f) in current.datasets" :key="f" class="mr-2">{{ f.replace('.json', '') }} ({{ t ? fmtDate(t) : 'n/a' }})</span></p>
            </details>
          </div>
          <div v-else class="px-6 py-5 text-sm text-red-700">{{ current.error }}</div>

          <!-- Sources -->
          <section v-if="current.sources?.length" class="px-6 py-4 border-t border-primary-100">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-primary-500 mb-2">Sources</h3>
            <ol class="space-y-1.5">
              <li v-for="s in current.sources" :id="`src-${s.ref}`" :key="s.ref" class="text-sm flex gap-2 scroll-mt-24">
                <span class="w-7 shrink-0 text-right text-xs font-semibold text-accent-700 tabular-nums pt-0.5">{{ s.ref.slice(1) }}</span>
                <span class="min-w-0">
                  <a :href="s.url" :target="s.url.startsWith('/') ? undefined : '_blank'" rel="noopener" class="text-primary-800 hover:text-accent-700">{{ s.title }}</a>
                  <span class="ml-1.5 text-[10px] uppercase tracking-wider text-primary-400">{{ s.kind }}</span>
                </span>
              </li>
            </ol>
          </section>

          <!-- Actions -->
          <footer class="px-6 py-4 border-t border-primary-100 flex flex-wrap items-center gap-2">
            <button class="act" @click="copyAnswer">{{ copied ? 'Copied' : 'Copy' }}</button>
            <button class="act" @click="downloadMd">Download (.md)</button>
            <button class="act" :disabled="running" @click="rerun">Re-run with current data</button>
            <template v-if="current.mine">
              <button class="act" @click="toggleShare">{{ current.shared ? 'Stop sharing' : 'Share with team' }}</button>
              <button class="act text-red-600" @click="remove">{{ confirmDelete ? 'Click again to delete' : 'Delete' }}</button>
            </template>
            <span class="flex-1" />
            <div class="flex items-center gap-1.5">
              <input v-model="reviewNote" class="text-xs rounded-lg ring-1 ring-primary-200 px-2 py-1.5 w-44" placeholder="Review note (optional)" aria-label="Review note">
              <button class="act !text-emerald-700" @click="review('verified')">Verified</button>
              <button class="act !text-red-700" @click="review('incorrect')">Incorrect</button>
            </div>
            <p v-if="current.review?.note" class="w-full text-xs text-primary-500">Review by {{ current.review.by }}, {{ fmtDate(current.review.at) }}: {{ current.review.note }}</p>
          </footer>
        </article>
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
              <button class="w-full text-left px-5 py-3 hover:bg-primary-50/60" :class="current?.id === h.id ? 'bg-accent-50/60' : ''" @click="open(h.id)">
                <div class="text-sm text-primary-800 leading-snug line-clamp-2">{{ h.question }}</div>
                <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-primary-400">
                  <span>{{ fmtDate(h.createdAt) }}</span>
                  <span>· {{ h.mode === 'briefing' ? templateLabel(h.template) : 'Answer' }}</span>
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
import { marked } from 'marked'

useHead({ title: 'Ask the database — World Country Groups' })
const route = useRoute()
const router = useRouter()
const { highlight } = useBriefHighlight()

const MODES = [{ v: 'answer', label: 'Quick answer' }, { v: 'briefing', label: 'Briefing' }]
const TEMPLATES = [
  { v: 'country', label: 'Country briefing' }, { v: 'bilateral', label: 'Bilateral meeting brief' },
  { v: 'issue', label: 'Issue briefing' }, { v: 'group', label: 'Group briefing' }, { v: 'free', label: 'Free-form briefing' },
]
const templateLabel = (t: string) => TEMPLATES.find(x => x.v === t)?.label || 'Briefing'
const EXAMPLES = [
  { label: 'Brief me on Brazil before a meeting', q: 'Prepare a briefing on Brazil for a meeting with its UN ambassador next week.', mode: 'briefing', template: 'country' },
  { label: 'Germany–India bilateral brief', q: 'Prepare a bilateral meeting brief for Germany and India.', mode: 'briefing', template: 'bilateral' },
  { label: 'Who vetoed what this year?', q: 'Which draft resolutions were vetoed in the Security Council in the past year, by whom, and on what?', mode: 'answer' },
  { label: 'Climate at UNGA 81', q: 'How prominent was climate change at the 2026 General Debate compared with 2025, and which countries said the most about it?', mode: 'answer' },
  { label: 'G77 cohesion', q: 'How cohesive is the G77 in General Assembly votes, and which members break ranks most often?', mode: 'briefing', template: 'group' },
]
const SCOPES = [{ v: 'mine', label: 'Mine' }, { v: 'shared', label: 'Shared' }]

const question = ref('')
const mode = ref<'answer' | 'briefing'>('answer')
const template = ref('free')
const running = ref(false)
const steps = ref<string[]>([])
const errorMsg = ref('')
const current = ref<any>(null)

// ---------- history ----------
const scope = ref('mine')
const historyQuery = ref('')
const { data: history, refresh: refreshHistory } = useFetch<any[]>('/api/ask', { query: computed(() => ({ scope: scope.value, q: historyQuery.value })), server: false })

async function open(id: string) {
  errorMsg.value = ''
  try {
    current.value = await $fetch(`/api/ask/${id}`)
    router.replace({ query: { id } })
  } catch { errorMsg.value = 'That question could not be opened.' }
}
onMounted(() => { if (route.query.id) open(String(route.query.id)) })

// ---------- asking (server-sent events over a POST) ----------
async function ask(q?: string, rerunOf?: string) {
  const text = (q ?? question.value).trim()
  if (text.length < 5 || running.value) return
  running.value = true; steps.value = []; errorMsg.value = ''
  try {
    const res = await fetch('/api/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text, mode: mode.value, template: template.value, rerunOf }),
    })
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
        else if (ev.type === 'done') { await open(ev.record.id) }
        else if (ev.type === 'error') { errorMsg.value = ev.message; if (ev.id) await open(ev.id) }
      }
    }
  } catch (e: any) {
    errorMsg.value = e?.message || 'Something went wrong'
  } finally {
    running.value = false
    refreshHistory()
  }
}
function rerun() {
  if (!current.value) return
  mode.value = current.value.mode; template.value = current.value.template
  ask(current.value.question, current.value.id)
}

// ---------- rendering ----------
function renderCites(md: string) {
  return md.replace(/\[(S\d+)\]/g, (_m, ref) => `<sup class="cite"><a href="#src-${ref}" class="cite-link">${ref.slice(1)}</a></sup>`)
}
const answerHtml = computed(() => (current.value?.answer ? (marked.parse(renderCites(highlight(current.value.answer))) as string) : ''))

// ---------- actions ----------
const copied = ref(false)
function asMarkdown() {
  const c = current.value
  const src = (c.sources || []).map((s: any) => `${s.ref.slice(1)}. ${s.title} — ${s.url.startsWith('/') ? location.origin + s.url : s.url}`).join('\n')
  return `# ${c.question}\n\n_${templateLabel(c.template)} · ${fmtDateTime(c.createdAt)} · ${c.model}_\n\n${c.answer.replace(/\[S(\d+)\]/g, '[$1]')}\n\n## Sources\n${src}\n`
}
async function copyAnswer() {
  try { await navigator.clipboard.writeText(asMarkdown()); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch {}
}
function downloadMd() {
  const blob = new Blob([asMarkdown()], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${current.value.question.slice(0, 60).replace(/[^\w]+/g, '-').toLowerCase()}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}
const reviewNote = ref('')
async function review(status: string) {
  current.value = { ...current.value, ...(await $fetch<any>(`/api/ask/${current.value.id}`, { method: 'POST', body: { action: 'review', status, note: reviewNote.value } })) }
  reviewNote.value = ''
  refreshHistory()
}
async function toggleShare() {
  current.value = { ...current.value, ...(await $fetch<any>(`/api/ask/${current.value.id}`, { method: 'POST', body: { action: 'share', shared: !current.value.shared } })) }
  refreshHistory()
}
const confirmDelete = ref(false)
async function remove() {
  if (!confirmDelete.value) { confirmDelete.value = true; setTimeout(() => { confirmDelete.value = false }, 3000); return }
  await $fetch(`/api/ask/${current.value.id}`, { method: 'POST', body: { action: 'delete' } })
  current.value = null; confirmDelete.value = false
  router.replace({ query: {} })
  refreshHistory()
}

const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const fmtDateTime = (d: string) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
</script>

<style scoped>
.badge { @apply inline-flex items-center px-2 py-0.5 rounded-full; }
.act { @apply text-xs px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-primary-700 hover:bg-primary-50 disabled:opacity-40; }
.brief :deep(p), .brief :deep(li) { @apply text-[15px] leading-7 text-primary-700; }
.brief :deep(h2) { @apply font-serif text-2xl text-primary-900 mt-6 mb-2; }
.brief :deep(table) { @apply text-sm; }
</style>

<style>
.ask .cite { font-size: 0.68em; line-height: 0; margin-left: 2px; vertical-align: 0.45em; }
.ask .cite-link { display: inline-block; min-width: 1.35em; padding: 0 0.3em; margin-left: 1px; border-radius: 999px; background: #dbeafe; color: #1e40af; text-align: center; text-decoration: none; font-weight: 600; }
.ask .cite-link:hover { background: #bfdbfe; }
</style>
