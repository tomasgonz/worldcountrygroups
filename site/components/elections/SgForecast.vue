<template>
  <section class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
    <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
      <h3 class="font-serif text-xl font-bold text-primary-900">Forecasts</h3>
      <span class="text-xs text-primary-400">Model as of {{ f._meta.basis }}</span>
    </div>
    <p class="text-sm text-primary-500 mb-3">
      The betting market and a model built on the Council's own rule: a candidate needs 9 of 15 votes and no veto from a permanent member.
      <template v-if="isAdmin">Your own call sits beside them; only you can see it.</template>
    </p>

    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary-600 mb-2">
      <span v-for="s in series" :key="s.key" class="inline-flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><path :d="SHAPES[s.key]" :fill="s.colour" /></svg>{{ s.label }}
      </span>
    </div>

    <div class="grid gap-x-3 text-[10px] uppercase tracking-wider text-primary-400 pb-1" :class="cols">
      <span /><span class="hidden sm:block" />
      <span v-for="s in series" :key="s.key" class="text-right">{{ s.short }}</span>
    </div>
    <div v-for="r in rows" :key="r.id" class="grid items-center gap-x-3 py-1.5 border-t border-primary-100" :class="cols">
      <div class="min-w-0">
        <div class="text-[13px] text-primary-800 truncate" :title="r.name">{{ r.name }}</div>
        <div v-if="r.basis" class="text-[11px] text-primary-400 truncate" :title="r.basis">{{ r.basis }}</div>
      </div>
      <div class="relative h-7 rounded-md hover:bg-primary-50 cursor-default hidden sm:block" tabindex="0" :aria-label="rowAria(r)"
        @mousemove="tipRow(r, $event)" @mouseleave="hide" @focus="tipRow(r, $event)" @blur="hide">
        <div class="absolute inset-x-0 top-1/2 h-px bg-primary-200" />
        <template v-for="s in series" :key="s.key">
          <svg v-if="r[s.key] != null" width="14" height="14" viewBox="-7 -7 14 14" class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
            :style="{ left: x(r[s.key]!) }" aria-hidden="true">
            <path :d="SHAPES[s.key]" :fill="s.colour" stroke="#fff" stroke-width="2" paint-order="stroke" />
          </svg>
        </template>
      </div>
      <span v-for="s in series" :key="s.key" class="text-[13px] tabular-nums text-right" :class="s.key === 'model' ? 'font-semibold text-primary-900' : 'text-primary-700'">
        {{ r[s.key] != null ? pct(r[s.key]!) : '–' }}
      </span>
    </div>
    <div class="hidden sm:grid gap-x-3 text-[10px] text-primary-400 tabular-nums pt-1" :class="cols">
      <span /><div class="flex justify-between"><span>0</span><span>{{ Math.round(xMax * 100) }}%</span></div>
    </div>
    <p v-if="marketOther != null" class="mt-2 text-[11px] text-primary-400">
      Market "someone else": what its prices leave over after the official candidates, including withdrawn and unlisted names.
    </p>

    <!-- model after each poll -->
    <details class="mt-5 group">
      <summary class="cursor-pointer select-none text-xs font-medium uppercase tracking-wider text-primary-400 hover:text-primary-700">The model after each straw poll</summary>
      <div class="overflow-x-auto mt-2">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[11px] uppercase tracking-wider text-primary-400">
              <th class="py-1 pr-3 font-medium">Name</th>
              <th v-for="p in f.by_poll" :key="p.n" class="py-1 px-2 font-medium text-center whitespace-nowrap">Poll {{ p.n }}<br><span class="normal-case tracking-normal">{{ fmtDate(p.date) }}</span></th>
              <th class="py-1 px-2 font-medium text-center">Now</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="id in pollIds" :key="id" class="border-t border-primary-100">
              <td class="py-1.5 pr-3 text-primary-800 whitespace-nowrap">{{ nameOf(id) }}</td>
              <td v-for="p in f.by_poll" :key="p.n" class="py-1.5 px-2 text-center tabular-nums text-primary-700">
                <template v-if="p.probs[id] != null">{{ pct(p.probs[id]) }}</template><span v-else class="text-primary-300">–</span>
              </td>
              <td class="py-1.5 px-2 text-center tabular-nums font-semibold text-primary-900">{{ nowOf(id) != null ? pct(nowOf(id)!) : '–' }}</td>
            </tr>
          </tbody>
        </table>
        <p class="text-[11px] text-primary-400 mt-1">Replayed with only what was known on each poll day: the polls held so far and the candidates nominated by then.</p>
      </div>
    </details>

    <!-- method -->
    <details class="mt-3">
      <summary class="cursor-pointer select-none text-xs font-medium uppercase tracking-wider text-primary-400 hover:text-primary-700">How the model works</summary>
      <ul class="mt-2 list-disc pl-5 space-y-1 text-xs text-primary-600">
        <li v-for="(n, i) in f._meta.notes" :key="i">{{ n }}</li>
      </ul>
      <h5 class="mt-3 text-[11px] uppercase tracking-wider text-primary-400">Checked against past races</h5>
      <ul class="mt-1 space-y-1 text-xs text-primary-600">
        <li v-for="(b, year) in f.backtest" :key="year">
          <span class="font-medium text-primary-800">{{ year }}, {{ b.winner }}:</span>
          {{ b.by_poll.map(s => pct(s.p_winner)).join(' → ') }} after each straw poll<template v-if="b.by_poll.every(s => s.rank === 1)">; ranked first every time</template>.
          <a :href="b.source" target="_blank" rel="noopener" class="text-primary-400 underline decoration-dotted">poll table</a>
        </li>
      </ul>
      <p class="mt-2 text-[11px] text-primary-400">
        Settings: {{ Object.entries(f._meta.params).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(' · ') }}.
        Two races are a small check: both front-runners led from the first poll, so the test says little about deadlocks.
      </p>
    </details>

    <!-- your call (admins; each account sees only its own) -->
    <div v-if="isAdmin" class="mt-6 rounded-xl bg-primary-50/70 ring-1 ring-primary-200/60 p-4">
      <div class="flex flex-wrap items-baseline gap-2">
        <h4 class="text-sm font-semibold text-primary-900">Your call</h4>
        <span class="text-[11px] text-primary-500">only you can see this</span>
      </div>
      <p class="text-xs text-primary-500 mt-0.5 mb-3">
        Give each candidate a chance in %; what is left goes to someone else. Every save is kept with its date, so your calls can be scored against the market and the model when the Council decides.
      </p>
      <div class="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
        <label v-for="c in active" :key="c.id" class="flex items-center justify-between gap-2 text-sm text-primary-800">
          <span class="truncate">{{ c.name }}</span>
          <span class="flex items-center gap-1 shrink-0">
            <input v-model="draft[c.id]" type="number" min="0" max="100" step="1" inputmode="decimal"
              class="w-16 text-right rounded-md border-primary-200 py-1 text-sm tabular-nums" :aria-label="`Your chance for ${c.name}, in percent`">
            <span class="text-primary-400">%</span>
          </span>
        </label>
        <div class="flex items-center justify-between gap-2 text-sm text-primary-800">
          <span>Someone else</span>
          <span class="tabular-nums pr-5" :class="draftOther < 0 ? 'text-red-700 font-semibold' : 'text-primary-600'">{{ fmtNum(draftOther) }}</span>
        </div>
      </div>
      <textarea v-model="note" rows="2" maxlength="1000" placeholder="Why (optional)" class="mt-3 w-full text-sm rounded-md border-primary-200" />
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" :disabled="saving || draftOther < 0 || !draftAny"
          class="px-3 py-1.5 rounded-lg bg-primary-900 text-white text-sm disabled:opacity-40" @click="saveMine">Save my call</button>
        <span v-if="draftOther < 0" class="text-xs text-red-700">The chances add up to more than 100%.</span>
        <span v-else-if="msg" class="text-xs" :class="msgErr ? 'text-red-700' : 'text-primary-500'">{{ msg }}</span>
      </div>

      <div v-if="entries.length" class="mt-4">
        <h5 class="text-[11px] uppercase tracking-wider text-primary-400 mb-1">Your record</h5>
        <ul class="divide-y divide-primary-200/70 text-xs">
          <li v-for="e in entries" :key="e.at" class="py-1.5 flex gap-3 items-start">
            <span class="tabular-nums text-primary-400 shrink-0 w-28">{{ fmtDateTime(e.at) }}</span>
            <span class="flex-1 min-w-0 text-primary-700">
              {{ summary(e) }}
              <span v-if="e.note" class="block text-primary-500 mt-0.5">{{ e.note }}</span>
            </span>
            <button type="button" class="text-primary-400 hover:text-red-700 shrink-0" @click="remove(e)">Delete</button>
          </li>
        </ul>
      </div>

      <div class="mt-4">
        <h5 class="text-[11px] uppercase tracking-wider text-primary-400 mb-1">Scores</h5>
        <table v-if="score?.resolved && score.scores?.length" class="text-sm">
          <thead>
            <tr class="text-left text-[11px] uppercase tracking-wider text-primary-400">
              <th class="py-1 pr-4 font-medium">Forecaster</th><th class="py-1 pr-4 font-medium text-right">Brier</th><th class="py-1 font-medium text-right">Avg. chance on {{ score.winner?.name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in score.scores" :key="s.who" class="border-t border-primary-200/70">
              <td class="py-1 pr-4 text-primary-800">{{ s.label }}</td>
              <td class="py-1 pr-4 text-right tabular-nums">{{ s.brier.toFixed(3) }}</td>
              <td class="py-1 text-right tabular-nums">{{ pct(s.p_winner) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="score?.resolved && score.scores?.length" class="text-[11px] text-primary-400 mt-1">Read at the end of each of {{ score.days }} days, {{ score.from }} to {{ score.to }}, on which all had a forecast. Brier: 0 is perfect, lower is better.</p>
        <p v-else class="text-xs text-primary-500">
          Scored when the Council recommends someone: the Brier score (0 is perfect, lower is better) and the average chance each forecaster gave the winner, read at the end of every day on which all three had a forecast.
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Rows mirror server/utils/sg-selection.ts (SgForecast) and sg-my-forecast.ts (MyForecast).
interface FRow { id: string; name: string; prob: number; p_reach_9: number | null; p_no_veto: number | null; vetoes: number | null; vetoes_known: boolean; polled: boolean; basis: string }
interface Forecast {
  _meta: { updated_at: string; params: Record<string, number>; basis: string; notes: string[] }
  current: FRow[]
  someone_else: number
  by_poll: { n: number; date: string; probs: Record<string, number> }[]
  backtest: Record<string, { winner: string; source: string; by_poll: { n: number; p_winner: number; rank: number }[] }>
}
interface Mine { at: string; probs: Record<string, number>; other: number; note?: string }
interface Score { resolved: boolean; winner: { id: string; name: string } | null; from?: string | null; to?: string | null; days?: number; scores?: { who: string; label: string; brier: number; p_winner: number }[] }
type Key = 'market' | 'model' | 'you'
interface Row { id: string; name: string; basis: string | null; detail: FRow | null; market: number | null; model: number | null; you: number | null }

const props = defineProps<{ sg: any }>()
const f = computed(() => props.sg.forecast as Forecast)
const OTHER = '_other'
// categorical slots 1-3 (validated as a set, all pairs) plus a different shape for each
const BLUE = '#2a78d6'
const ORANGE = '#eb6834'
const AQUA = '#1baf7a'
const SHAPES: Record<Key, string> = {
  market: 'M0,-5 A5,5 0 1,1 0,5 A5,5 0 1,1 0,-5Z',
  model: 'M-4.5,-4.5H4.5V4.5H-4.5Z',
  you: 'M0,-6L6,0L0,6L-6,0Z',
}

const { state } = useAuth()
const isAdmin = computed(() => state.value?.role === 'admin')
const { show, hide } = useVizTip()

// ---- your call ----
const active = computed(() => (props.sg.candidates as { id: string; name: string; status: string }[]).filter(c => c.status !== 'withdrawn'))
const entries = ref<Mine[]>([])
const score = ref<Score | null>(null)
const draft = reactive<Record<string, string | number>>({})
const note = ref('')
const saving = ref(false)
const msg = ref('')
const msgErr = ref(false)
const latestMine = computed(() => entries.value[0] || null)

async function loadMine() {
  try {
    const r = await $fetch<{ entries: Mine[]; score: Score }>('/api/admin/sg-forecast')
    entries.value = r.entries
    score.value = r.score
    fillDraft()
  } catch { /* not an admin any more, or offline */ }
}
function fillDraft() {
  const last = latestMine.value
  for (const c of active.value) draft[c.id] = last?.probs[c.id] != null ? Math.round(last.probs[c.id] * 1000) / 10 : ''
}
watch(isAdmin, (yes) => { if (yes) loadMine() }, { immediate: true })

const num = (v: unknown) => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) ? 0 : n }
const draftAny = computed(() => active.value.some(c => draft[c.id] !== '' && draft[c.id] != null))
const draftOther = computed(() => Math.round((100 - active.value.reduce((a, c) => a + num(draft[c.id]), 0)) * 10) / 10)
async function saveMine() {
  saving.value = true
  msg.value = ''
  try {
    const percent = Object.fromEntries(active.value.map(c => [c.id, draft[c.id] === '' ? null : num(draft[c.id])]))
    const r = await $fetch<{ entries: Mine[] }>('/api/admin/sg-forecast', { method: 'POST', body: { percent, note: note.value } })
    entries.value = r.entries
    note.value = ''
    msgErr.value = false
    msg.value = 'Saved.'
  } catch (e: any) {
    msgErr.value = true
    msg.value = e?.data?.statusMessage || e?.statusMessage || 'Could not save.'
  } finally {
    saving.value = false
  }
}
async function remove(e: Mine) {
  if (!confirm(`Delete your call of ${fmtDateTime(e.at)}?`)) return
  try {
    const r = await $fetch<{ entries: Mine[] }>('/api/admin/sg-forecast', { method: 'DELETE', query: { at: e.at } })
    entries.value = r.entries
  } catch { /* stays listed */ }
}
const summary = (e: Mine) => [
  ...Object.entries(e.probs).sort((a, b) => b[1] - a[1]).map(([id, p]) => `${nameOf(id)} ${pct(p)}`),
  `someone else ${pct(e.other)}`,
].join(' · ')

// ---- comparison rows ----
const marketBy = computed(() => {
  const m = new Map<string, number>()
  for (const o of props.sg.markets?.markets?.[0]?.outcomes || []) if (o.person_id) m.set(o.person_id, o.price)
  return m
})
const hasMarket = computed(() => marketBy.value.size > 0)
const marketOther = computed(() => {
  if (!hasMarket.value) return null
  const named = f.value.current.reduce((a, r) => a + (marketBy.value.get(r.id) ?? 0), 0)
  return Math.max(0, 1 - named)
})
const series = computed(() => [
  ...(hasMarket.value ? [{ key: 'market' as Key, label: 'Betting market', short: 'Market', colour: BLUE }] : []),
  { key: 'model' as Key, label: 'Model', short: 'Model', colour: ORANGE },
  ...(isAdmin.value && latestMine.value ? [{ key: 'you' as Key, label: 'You (latest call)', short: 'You', colour: AQUA }] : []),
])
// phones drop the dot plot and keep the numbers (class names written out in full for Tailwind)
const COLS: Record<number, string> = {
  1: 'grid-cols-[minmax(0,1fr)_3.2rem] sm:grid-cols-[minmax(8rem,34%)_1fr_3.2rem]',
  2: 'grid-cols-[minmax(0,1fr)_repeat(2,3.2rem)] sm:grid-cols-[minmax(8rem,34%)_1fr_repeat(2,3.2rem)]',
  3: 'grid-cols-[minmax(0,1fr)_repeat(3,3.2rem)] sm:grid-cols-[minmax(8rem,34%)_1fr_repeat(3,3.2rem)]',
}
const cols = computed(() => COLS[series.value.length])
const rows = computed<Row[]>(() => {
  const mine = latestMine.value
  const out: Row[] = f.value.current.map(r => ({
    id: r.id, name: r.name, basis: r.basis, detail: r,
    market: hasMarket.value ? (marketBy.value.get(r.id) ?? null) : null,
    model: r.prob,
    you: mine ? (mine.probs[r.id] ?? 0) : null,
  }))
  out.push({ id: OTHER, name: 'Someone else', basis: 'Not yet nominated', detail: null, market: marketOther.value, model: f.value.someone_else, you: mine ? mine.other : null })
  return out
})
const xMax = computed(() => {
  const top = Math.max(0.1, ...rows.value.flatMap(r => [r.market, r.model, r.you].filter((v): v is number => v != null)))
  return Math.min(1, Math.ceil(top * 10) / 10)
})
const x = (v: number) => `${(Math.min(v, xMax.value) / xMax.value) * 100}%`
const rowAria = (r: Row) => series.value.map(s => `${s.label} ${r[s.key] != null ? pct(r[s.key]!) : 'none'}`).join(', ') + ` for ${r.name}`
function tipRow(r: Row, e: MouseEvent | FocusEvent) {
  const lines: { text: string; color?: string }[] = series.value.map(s => ({ text: `${r[s.key] != null ? pct(r[s.key]!) : '–'} ${s.label}`, color: s.colour }))
  const m = r.detail
  if (m?.polled && m.p_reach_9 != null && m.p_no_veto != null) {
    lines.push({ text: `Model: ${pct(m.p_reach_9)} chance of 9 votes × ${pct(m.p_no_veto)} chance every P5 veto is lifted` })
  } else if (m && !m.polled) {
    lines.push({ text: 'Model: not yet polled, weighted as a new entrant' })
  }
  show(e, r.name, lines)
}

// ---- model by poll ----
const pollIds = computed(() => {
  const ids = new Set<string>()
  for (const p of f.value.by_poll) for (const [id, v] of Object.entries(p.probs)) if (id !== OTHER && v >= 0.01) ids.add(id)
  for (const r of f.value.current) if (r.prob >= 0.01) ids.add(r.id)
  return [...ids].sort((a, b) => (nowOf(b) ?? 0) - (nowOf(a) ?? 0)).concat(OTHER)
})
const nowOf = (id: string) => (id === OTHER ? f.value.someone_else : f.value.current.find(r => r.id === id)?.prob ?? null)
const nameOf = (id: string) => (id === OTHER ? 'Someone else' : (props.sg.candidates as { id: string; name: string }[]).find(c => c.id === id)?.name || id)

// ---- formatting ----
const pct = (v: number) => (v < 0.001 ? '0%' : v < 0.1 ? `${(v * 100).toFixed(1)}%` : `${Math.round(v * 100)}%`)
const fmtNum = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`
function fmtDate(s: string) {
  const dt = new Date(s + 'T12:00:00Z')
  return isNaN(dt.getTime()) ? s : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
function fmtDateTime(s: string) {
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? s : dt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
}
</script>
