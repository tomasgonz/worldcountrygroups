<template>
  <div class="bg-white rounded-2xl border border-primary-100 p-6">
    <div class="flex items-start justify-between flex-wrap gap-3 mb-5">
      <div>
        <h2 class="font-serif text-xl font-bold text-primary-900">What Changed</h2>
        <p class="text-xs text-primary-400 mt-1">Differences between two General Debate speeches, based on their AI analyses</p>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <select v-model.number="fromSession" class="border border-primary-200 rounded-lg px-2 py-1 bg-white text-primary-700">
          <option v-for="s in analysed" :key="s.session" :value="s.session" :disabled="s.session >= toSession">{{ s.year }}</option>
        </select>
        <span class="text-primary-400">vs</span>
        <select v-model.number="toSession" class="border border-primary-200 rounded-lg px-2 py-1 bg-white text-primary-700">
          <option v-for="s in analysed" :key="s.session" :value="s.session" :disabled="s.session <= fromSession">{{ s.year }}</option>
        </select>
      </div>
    </div>

    <div v-if="diff" class="grid gap-5 md:grid-cols-2">
      <!-- Speaker & tone -->
      <div class="md:col-span-2 grid gap-3 sm:grid-cols-2">
        <div v-for="side in [diff.a, diff.b]" :key="side.session" class="rounded-xl bg-primary-50/60 p-4">
          <div class="text-xs text-primary-400 mb-1">{{ side.year }} &middot; Session {{ side.session }}</div>
          <div class="text-sm font-medium text-primary-800">{{ side.speaker || 'Speaker not recorded' }}<span v-if="side.speaker_title" class="font-normal text-primary-400"> &middot; {{ side.speaker_title }}</span></div>
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="sentimentClass(side.analysis.sentiment?.overall)">{{ side.analysis.sentiment?.overall || 'n/a' }}</span>
            <span v-for="t in side.analysis.sentiment?.tone_descriptors?.slice(0, 3)" :key="t" class="text-xs text-primary-500">{{ t }}</span>
            <span class="text-xs text-primary-400 tabular-nums ml-auto">{{ side.word_count.toLocaleString() }} words</span>
          </div>
        </div>
      </div>

      <DiffList title="Themes" :added="diff.themes.added" :removed="diff.themes.removed" :kept="diff.themes.kept" :fmt="themeLabel" />
      <DiffList title="Countries mentioned" :added="diff.countries.added" :removed="diff.countries.removed" :kept="diff.countries.kept" :fmt="countryLabel" />
      <DiffList title="Criticism targets" :added="diff.criticism.added" :removed="diff.criticism.removed" :kept="diff.criticism.kept" />
      <DiffList title="Conflicts referenced" :added="diff.conflicts.added" :removed="diff.conflicts.removed" :kept="diff.conflicts.kept" />

      <div v-if="diff.contextShifts.length" class="md:col-span-2">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-primary-500 mb-2">Changed framing of countries</h3>
        <div class="flex flex-wrap gap-2">
          <span v-for="c in diff.contextShifts" :key="c.iso3" class="text-xs px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
            {{ countryLabel(c.iso3) }}: {{ c.from }} &rarr; {{ c.to }}
          </span>
        </div>
      </div>
    </div>
    <p v-else class="text-sm text-primary-400">At least two analysed speeches are needed for a comparison.</p>
  </div>
</template>

<script setup lang="ts">
import { h, type PropType } from 'vue'

const props = defineProps({
  speeches: { type: Array as PropType<any[]>, required: true },
  countryName: { type: Function as PropType<(iso3: string) => string>, required: true },
})

const analysed = computed(() =>
  props.speeches.filter(s => s.analysis).slice().sort((a, b) => a.session - b.session),
)

const fromSession = ref<number>(0)
const toSession = ref<number>(0)
watch(analysed, (list) => {
  if (list.length >= 2 && !toSession.value) {
    toSession.value = list[list.length - 1].session
    fromSession.value = list[list.length - 2].session
  }
}, { immediate: true })

function setDiff<T>(a: T[], b: T[]) {
  const A = new Set(a), B = new Set(b)
  return {
    added: [...B].filter(x => !A.has(x)),
    removed: [...A].filter(x => !B.has(x)),
    kept: [...B].filter(x => A.has(x)),
  }
}

// Normalize so 'U.S. administration' and 'US administration' compare equal
const norm = (s: string) => s.toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, ' ').trim()

const diff = computed(() => {
  const a = analysed.value.find(s => s.session === fromSession.value)
  const b = analysed.value.find(s => s.session === toSession.value)
  if (!a || !b) return null
  const themes = (s: any) => (s.analysis.themes || []).filter((t: any) => t.relevance !== 'low').map((t: any) => t.name)
  const countries = (s: any) => (s.analysis.mentioned_countries || []).map((c: any) => c.iso3)
  const criticism = (s: any) => (s.analysis.sentiment?.criticism_targets || []).map(norm)
  const conflicts = (s: any) => (s.analysis.mentioned_conflicts || []).map((c: any) => norm(c.name))

  const ctxA = new Map((a.analysis.mentioned_countries || []).map((c: any) => [c.iso3, c.context]))
  const contextShifts = (b.analysis.mentioned_countries || [])
    .filter((c: any) => ctxA.has(c.iso3) && ctxA.get(c.iso3) !== c.context)
    .map((c: any) => ({ iso3: c.iso3, from: ctxA.get(c.iso3), to: c.context }))

  return {
    a, b,
    themes: setDiff(themes(a), themes(b)),
    countries: setDiff(countries(a), countries(b)),
    criticism: setDiff(criticism(a), criticism(b)),
    conflicts: setDiff(conflicts(a), conflicts(b)),
    contextShifts,
  }
})

const themeLabel = (t: string) => t.replace(/_/g, ' ')
const countryLabel = (iso3: string) => props.countryName(iso3)

function sentimentClass(s?: string) {
  if (s === 'positive') return 'bg-emerald-100 text-emerald-800'
  if (s === 'negative') return 'bg-red-100 text-red-800'
  if (s === 'mixed') return 'bg-amber-100 text-amber-800'
  return 'bg-primary-100 text-primary-600'
}

// Small presentational helper for added / dropped / kept lists
const DiffList = defineComponent({
  props: {
    title: String,
    added: { type: Array as PropType<string[]>, default: () => [] },
    removed: { type: Array as PropType<string[]>, default: () => [] },
    kept: { type: Array as PropType<string[]>, default: () => [] },
    fmt: { type: Function as PropType<(s: string) => string>, default: (s: string) => s },
  },
  setup(p) {
    const chip = (text: string, cls: string, prefix: string) =>
      h('span', { class: `text-xs px-2 py-0.5 rounded-full border ${cls}` }, `${prefix}${p.fmt!(text)}`)
    return () => h('div', [
      h('h3', { class: 'text-xs font-semibold uppercase tracking-wider text-primary-500 mb-2' }, p.title),
      (p.added!.length + p.removed!.length + p.kept!.length === 0)
        ? h('p', { class: 'text-xs text-primary-300' }, 'None recorded')
        : h('div', { class: 'flex flex-wrap gap-1.5' }, [
            ...p.added!.map(x => chip(x, 'bg-emerald-50 border-emerald-200 text-emerald-800', '+ ')),
            ...p.removed!.map(x => chip(x, 'bg-red-50 border-red-200 text-red-700 line-through decoration-red-300', '− ')),
            ...p.kept!.map(x => chip(x, 'bg-primary-50 border-primary-100 text-primary-500', '')),
          ]),
    ])
  },
})
</script>
