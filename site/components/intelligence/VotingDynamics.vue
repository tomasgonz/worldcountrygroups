<template>
  <div class="mt-10">
    <div class="flex flex-wrap items-end justify-between gap-3 mb-4 pb-2 border-b border-primary-200">
      <div>
        <h3 class="font-serif text-2xl text-primary-900">Dynamics</h3>
        <p class="text-xs text-primary-500 mt-1 max-w-3xl">
          How the Assembly's alignments are shaped and how they are shifting, on the same contested votes.
          The West–South axis uses two reference groups:
          <span class="text-primary-700" :title="(d?.meta?.west || []).map((c: any) => c.name).join(', ')">12 large Western states</span> and
          <span class="text-primary-700" :title="(d?.meta?.south || []).map((c: any) => c.name).join(', ')">12 large Global South states</span>.
        </p>
      </div>
      <label class="text-xs text-primary-500">Compare with
        <select v-model.number="gap" class="ml-1 px-2 py-1 bg-white border border-primary-200 rounded-lg text-xs">
          <option :value="5">5 sessions earlier</option><option :value="10">10 sessions earlier</option><option :value="20">20 sessions earlier</option>
        </select>
      </label>
    </div>

    <div v-if="pending && !d" class="space-y-4"><div class="skeleton h-96 rounded-xl" /><div class="skeleton h-64 rounded-xl" /></div>

    <template v-else-if="d">
      <!-- 1. Map -->
      <section class="bg-white rounded-xl border border-primary-100 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 class="font-medium text-primary-900">Map of the Assembly</h4>
            <p class="text-xs text-primary-500 mt-0.5">Countries that vote alike sit close together (sessions {{ range(d.meta.recent.sessions) }}). Colours show the blocs above.</p>
          </div>
          <input v-model="mapQuery" type="search" placeholder="Find a country" class="text-sm border border-primary-200 rounded-lg px-3 py-1.5 w-48" aria-label="Highlight a country on the map" />
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-primary-600">
          <span v-for="b in d.blocs" :key="b.id" class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" :style="{ background: blocColor(b.id) }" />{{ b.id }}. {{ shorten(b.label, 34) }}</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-white ring-1 ring-primary-400" />Unaligned</span>
        </div>
        <div class="mt-3 overflow-x-auto">
          <svg :viewBox="`0 0 ${W} ${H}`" class="w-full min-w-[640px] h-auto" role="img" aria-label="Scatter map of countries by voting similarity">
            <line :x1="PAD" :x2="W - PAD" :y1="H - 22" :y2="H - 22" stroke="#e2e8f0" />
            <text :x="PAD" :y="H - 6" class="axis">← closer to the Global South group</text>
            <text :x="W - PAD" :y="H - 6" text-anchor="end" class="axis">closer to the Western group →</text>
            <g v-for="p in plotted" :key="p.iso3"
               @mousemove="tip($event, p)" @mouseleave="hide" style="cursor: pointer" @click="navigateTo(`/countries/${p.iso3.toLowerCase()}`)">
              <circle :cx="p.px" :cy="p.py" r="10" fill="transparent" />
              <circle :cx="p.px" :cy="p.py" :r="p.hl ? 7 : 4.5" :fill="p.bloc ? blocColor(p.bloc) : '#fff'" :stroke="p.bloc ? '#fff' : '#64748b'" :stroke-width="p.hl ? 2.5 : 1.5"
                      :opacity="matchActive && !p.hl ? 0.25 : 1" />
            </g>
            <g v-for="p in labelled" :key="'l' + p.iso3" pointer-events="none">
              <text :x="p.px + 7" :y="p.py + 3.5" class="lbl-halo">{{ p.name }}</text>
              <text :x="p.px + 7" :y="p.py + 3.5" class="lbl">{{ p.name }}</text>
            </g>
          </svg>
        </div>
        <p class="text-[10px] text-primary-400 mt-1">Horizontal position is the main dividing line in the votes; vertical position is the second. Click a country to open its page.</p>
      </section>

      <div class="grid lg:grid-cols-2 gap-4 mt-4">
        <!-- 2. Drift -->
        <section class="bg-white rounded-xl border border-primary-100 p-5">
          <h4 class="font-medium text-primary-900">Who is drifting</h4>
          <p class="text-xs text-primary-500 mt-0.5 mb-4">Change in position on the West–South axis, sessions {{ range(d.meta.earlier.sessions) }} vs {{ range(d.meta.recent.sessions) }} (percentage points; positive = toward the Western group)</p>
          <VizDiverging :rows="driftRows" label-width="10rem" />
          <p class="text-[10px] text-primary-400 mt-3">Position = agreement with the Western group minus agreement with the Global South group. Countries must have voted in at least 60% of contested votes in both periods.</p>
        </section>

        <!-- 3. Divides -->
        <section class="bg-white rounded-xl border border-primary-100 p-5">
          <h4 class="font-medium text-primary-900">What divides West and South</h4>
          <p class="text-xs text-primary-500 mt-0.5 mb-4">Agreement between the two reference groups on contested votes, by subject</p>
          <VizDumbbell :rows="divideRows" :max="100" current-label="West–South agreement" label-width="13rem" color="#2a78d6" />
          <p class="text-[10px] text-primary-400 mt-3">Hover a bar for agreement within each group on the same votes.</p>
        </section>

        <!-- 4. Loyalty -->
        <section class="bg-white rounded-xl border border-primary-100 p-5">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 class="font-medium text-primary-900">Who breaks ranks</h4>
              <p class="text-xs text-primary-500 mt-0.5">How often members vote with their group's majority</p>
            </div>
            <select v-model="group" class="px-2 py-1 bg-white border border-primary-200 rounded-lg text-xs" aria-label="Group">
              <option v-for="g in GROUPS" :key="g.id" :value="g.id">{{ g.label }}</option>
            </select>
          </div>
          <div v-if="loyalty" class="mt-3">
            <p class="text-xs text-primary-600 mb-3">Typical {{ loyalty.acronym }} member: <strong class="font-medium">{{ Math.round((loyalty.median || 0) * 100) }}%</strong> with the majority. Least loyal:</p>
            <VizDumbbell :rows="loyaltyRows" :max="100" current-label="Votes with group majority" label-width="10rem" color="#2a78d6" />
          </div>
          <div v-else class="skeleton h-48 rounded-lg mt-3" />
        </section>

        <!-- 5. Bridges -->
        <section class="bg-white rounded-xl border border-primary-100 p-5">
          <h4 class="font-medium text-primary-900">Bridge countries</h4>
          <p class="text-xs text-primary-500 mt-0.5 mb-4">Countries outside the reference groups that agree substantially with both</p>
          <div class="flex gap-4 text-[11px] text-primary-500 mb-3">
            <span class="inline-flex items-center gap-1.5"><span class="w-3 h-2.5 rounded-sm bg-[#2a78d6]" />Western group</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-3 h-2.5 rounded-sm bg-[#eb6834]" />Global South group</span>
          </div>
          <ul class="space-y-2">
            <li v-for="b in bridgeRows" :key="b.key" class="grid grid-cols-[min(10rem,38%)_1fr] items-center gap-3"
                @mousemove="show($event, b.label, [{ text: `Agrees with Western group: ${b.west}%`, color: '#2a78d6' }, { text: `Agrees with Global South group: ${b.south}%`, color: '#eb6834' }])" @mouseleave="hide">
              <NuxtLink :to="b.href" class="text-[13px] text-primary-700 hover:text-accent-700 truncate">{{ b.label }}</NuxtLink>
              <div class="space-y-1">
                <div class="flex items-center gap-2"><div class="h-2 rounded-r-[3px] bg-[#2a78d6]" :style="{ width: b.west * 0.85 + '%' }" /><span class="text-[11px] tabular-nums text-primary-600">{{ b.west }}%</span></div>
                <div class="flex items-center gap-2"><div class="h-2 rounded-r-[3px] bg-[#eb6834]" :style="{ width: b.south * 0.85 + '%' }" /><span class="text-[11px] tabular-nums text-primary-600">{{ b.south }}%</span></div>
              </div>
            </li>
          </ul>
          <p class="text-[10px] text-primary-400 mt-3">Ranked by the lower of the two agreement figures.</p>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ sessions: number; threshold: number }>()
const { show, hide } = useVizTip()

const gap = ref(10)
const { data, pending } = useFetch<any>('/api/intelligence/voting-dynamics', {
  query: computed(() => ({ sessions: props.sessions, threshold: props.threshold, gap: gap.value })), server: false,
})
const d = computed(() => data.value)

const GROUPS = [
  { id: 'nato', label: 'NATO' }, { id: 'eu', label: 'European Union' }, { id: 'au', label: 'African Union' }, { id: 'g77', label: 'G77' },
  { id: 'nam', label: 'Non-Aligned Movement' }, { id: 'asean', label: 'ASEAN' }, { id: 'oic', label: 'OIC' }, { id: 'las', label: 'Arab League' },
  { id: 'caricom', label: 'CARICOM' }, { id: 'grulac', label: 'Latin America & Caribbean' }, { id: 'brics11', label: 'BRICS' }, { id: 'sids', label: 'Small island states' },
]
const group = ref('nato')
const { data: loyalty } = useFetch<any>('/api/intelligence/voting-dynamics', {
  query: computed(() => ({ group: group.value, sessions: props.sessions })), server: false,
})

const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const blocColor = (id: number | null) => (id ? PALETTE[(id - 1) % PALETTE.length] : '#cbd5e1')
const shorten = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const range = (s: number[]) => (s?.length ? `${s[0]}–${s[s.length - 1]}` : '')
const pts = (v: number) => Math.round(v * 1000) / 10

// ---------- map ----------
const W = 900, H = 520, PAD = 30
const mapQuery = ref('')
const NOTABLE = ['USA', 'CHN', 'RUS', 'GBR', 'FRA', 'DEU', 'IND', 'BRA', 'ZAF', 'ISR', 'TUR', 'JPN', 'IRN', 'SAU', 'NGA', 'MEX', 'IDN', 'UKR', 'CUB', 'HUN', 'ARG', 'PAK', 'EGY', 'AUS', 'SRB']
const matchActive = computed(() => mapQuery.value.trim().length >= 2)
const plotted = computed(() => {
  const m = d.value?.map || []
  if (!m.length) return []
  const xs = m.map((p: any) => p.x), ys = m.map((p: any) => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const q = mapQuery.value.trim().toLowerCase()
  return m.map((p: any) => ({
    ...p,
    px: PAD + ((p.x - x0) / (x1 - x0 || 1)) * (W - 2 * PAD - 90),
    py: PAD + (1 - (p.y - y0) / (y1 - y0 || 1)) * (H - 2 * PAD - 30),
    hl: matchActive.value && (p.name.toLowerCase().includes(q) || p.iso3.toLowerCase() === q),
  }))
})
const labelled = computed(() => {
  const want = new Set([...NOTABLE, ...(d.value?.bridges || []).slice(0, 3).map((b: any) => b.iso3)])
  const list = plotted.value.filter((p: any) => (matchActive.value ? p.hl : want.has(p.iso3)))
  // drop labels that would overlap one already placed
  const placed: any[] = []
  for (const p of list) {
    if (placed.some(o => Math.abs(o.px - p.px) < 60 && Math.abs(o.py - p.py) < 12)) continue
    placed.push(p)
  }
  return placed
})
function tip(e: MouseEvent, p: any) {
  const b = d.value?.blocs.find((x: any) => x.id === p.bloc)
  show(e, p.name, [{ text: b ? `Bloc ${b.id}: ${shorten(b.label, 40)}` : 'Unaligned', color: blocColor(p.bloc) }])
}

// ---------- charts ----------
const driftRows = computed(() => {
  const t = (d.value?.drift?.toWest || []).slice(0, 7), a = (d.value?.drift?.awayFromWest || []).slice(0, 7)
  return [...t, ...a.reverse()].map((x: any) => ({
    key: x.iso3, label: x.name, value: pts(x.change),
    detail: [`Before: ${signed(pts(x.before))} · now: ${signed(pts(x.now))}`],
  }))
})
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`
const divideRows = computed(() => (d.value?.divides || []).map((x: any) => ({
  key: x.theme, label: x.theme, value: x.westSouth * 100,
  detail: [`${x.votes} contested votes`, `Within the Western group: ${Math.round(x.withinWest * 100)}%`, `Within the Global South group: ${Math.round(x.withinSouth * 100)}%`],
})))
const loyaltyRows = computed(() => (loyalty.value?.members || []).slice(0, 10).map((m: any) => ({
  key: m.iso3, label: m.name, value: m.loyalty * 100, detail: [`${m.votes} contested votes`],
})))
const bridgeRows = computed(() => (d.value?.bridges || []).slice(0, 10).map((b: any) => ({
  key: b.iso3, label: b.name, href: `/countries/${b.iso3.toLowerCase()}`,
  west: Math.round(b.west * 100), south: Math.round(b.south * 100),
})))
</script>

<style scoped>
.axis { font-size: 11px; fill: #64748b; }
.lbl { font-size: 11px; fill: #1e293b; }
.lbl-halo { font-size: 11px; stroke: #fff; stroke-width: 3px; fill: #fff; }
</style>
