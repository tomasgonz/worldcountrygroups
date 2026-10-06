<template>
  <article :id="`turn-${turn.id}`" class="bg-white rounded-2xl ring-1 ring-primary-200/70 scroll-mt-24">
    <header class="px-6 pt-5 pb-4 border-b border-primary-100">
      <div class="flex flex-wrap items-center gap-2 text-[11px]">
        <span v-if="index > 0" class="badge bg-accent-50 text-accent-800 ring-1 ring-accent-200">Follow-up {{ index }}</span>
        <span class="badge bg-primary-100 text-primary-700">{{ turn.mode === 'briefing' ? templateLabel(turn.template) : 'Answer' }}</span>
        <span class="text-primary-500">{{ fmtDateTime(turn.createdAt) }} · {{ turn.userName }}<template v-if="turn.model"> · {{ turn.model }}</template></span>
        <span v-if="turn.status === 'error'" class="badge bg-red-50 text-red-700 ring-1 ring-red-200">Failed</span>
        <span v-else-if="turn.stale?.length" class="badge bg-amber-50 text-amber-800 ring-1 ring-amber-200" :title="`Updated since: ${turn.stale.join(', ')}`">Data updated since · may be outdated</span>
        <span v-else-if="turn.status === 'done'" class="badge bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">Data unchanged since</span>
        <span v-if="turn.review?.status === 'verified'" class="badge bg-emerald-600 text-white">Verified</span>
        <span v-if="turn.review?.status === 'incorrect'" class="badge bg-red-600 text-white">Marked incorrect</span>
      </div>
      <component :is="index === 0 ? 'h2' : 'h3'" class="font-serif text-primary-900 mt-2 leading-snug" :class="index === 0 ? 'text-2xl' : 'text-xl'">{{ turn.question }}</component>
    </header>

    <div v-if="turn.status === 'done'" class="px-6 py-5">
      <VizHighlightLegend v-if="index === 0" class="mb-4" />
      <div class="brief prose max-w-none" :dir="turn.language === 'ar' ? 'rtl' : 'auto'" v-html="html" />
      <details class="mt-5 text-xs text-primary-500">
        <summary class="cursor-pointer">How this was researched ({{ turn.steps?.length || 0 }} lookups)</summary>
        <ol class="mt-2 list-decimal pl-5 space-y-0.5"><li v-for="(s, i) in turn.steps" :key="i">{{ s.label }}</li></ol>
        <p class="mt-2">Data as of: <span v-for="(t, f) in turn.datasets" :key="f" class="mr-2">{{ String(f).replace('.json', '') }} ({{ t ? fmtDate(t) : 'n/a' }})</span></p>
      </details>
    </div>
    <div v-else class="px-6 py-5 text-sm text-red-700">{{ turn.error }}</div>

    <section v-if="turn.sources?.length" class="px-6 py-4 border-t border-primary-100">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-primary-500 mb-2">Sources</h4>
      <ol class="space-y-1.5">
        <li v-for="s in turn.sources" :id="`src-${turn.id}-${s.ref}`" :key="s.ref" class="text-sm flex gap-2 scroll-mt-24">
          <span class="w-7 shrink-0 text-right text-xs font-semibold text-accent-700 tabular-nums pt-0.5">{{ s.ref.slice(1) }}</span>
          <span class="min-w-0">
            <a :href="s.url" :target="s.url.startsWith('/') ? undefined : '_blank'" rel="noopener" class="text-primary-800 hover:text-accent-700">{{ s.title }}</a>
            <span class="ml-1.5 text-[10px] uppercase tracking-wider text-primary-400">{{ s.kind }}</span>
          </span>
        </li>
      </ol>
    </section>

    <footer class="px-6 py-3 border-t border-primary-100 flex flex-wrap items-center gap-2">
      <button class="act" @click="$emit('copy', turn)">{{ copied ? 'Copied' : 'Copy' }}</button>
      <AskExportButtons v-if="turn.status === 'done'" :id="turn.id" />
      <button v-if="!readonly" class="act" :disabled="busy" @click="$emit('rerun', turn)">Re-run with current data</button>
      <button v-if="index > 0 && turn.mine" class="act text-red-600" @click="del">{{ confirmDelete ? 'Click again to delete' : 'Delete' }}</button>
      <span class="flex-1" />
      <div v-if="!readonly" class="flex flex-wrap items-center gap-1.5">
        <input v-model="note" class="text-xs rounded-lg ring-1 ring-primary-200 px-2 py-1.5 w-44" placeholder="Review note (optional)" aria-label="Review note">
        <button class="act !text-emerald-700" @click="$emit('review', turn, 'verified', note); note = ''">Verified</button>
        <button class="act !text-red-700" @click="$emit('review', turn, 'incorrect', note); note = ''">Incorrect</button>
      </div>
      <p v-if="turn.review?.note" class="w-full text-xs text-primary-500">Review by {{ turn.review.by }}, {{ fmtDate(turn.review.at) }}: {{ turn.review.note }}</p>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { marked } from 'marked'

const props = defineProps<{ turn: any; index: number; busy?: boolean; copied?: boolean; readonly?: boolean }>()
const emit = defineEmits<{ copy: [any]; rerun: [any]; review: [any, string, string]; remove: [any] }>()
const { highlight } = useBriefHighlight()

const TEMPLATES: Record<string, string> = { country: 'Country briefing', bilateral: 'Bilateral meeting brief', issue: 'Issue briefing', group: 'Group briefing', free: 'Free-form briefing' }
const templateLabel = (t: string) => TEMPLATES[t] || 'Briefing'
const note = ref('')
const confirmDelete = ref(false)
function del() {
  if (!confirmDelete.value) { confirmDelete.value = true; setTimeout(() => { confirmDelete.value = false }, 3000); return }
  emit('remove', props.turn)
}

const html = computed(() => {
  const md = props.turn.answer || ''
  const cited = highlight(md).replace(/\[(S\d+)\]/g, (_m: string, ref: string) =>
    `<sup class="cite"><a href="#src-${props.turn.id}-${ref}" class="cite-link">${ref.slice(1)}</a></sup>`)
  return marked.parse(cited) as string
})

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
