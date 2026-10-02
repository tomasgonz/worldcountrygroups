<template>
  <div>
    <VizTip />
    <!-- Controls -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-1">Voting Bloc Detector</h3>
      <p class="text-sm text-primary-500 mb-5 max-w-3xl">
        Finds groups of countries that vote alike in the General Assembly. It looks only at <strong class="font-medium text-primary-700">contested votes</strong>,
        where at least 10% of countries broke from the majority, because near-unanimous resolutions say nothing about alignment.
        An abstention counts as half-agreement with a yes or a no.
      </p>
      <div class="flex flex-wrap items-end gap-5">
        <label class="block">
          <span class="block text-xs text-primary-500 mb-1">Sessions (most recent)</span>
          <select v-model.number="sessions" class="px-3 py-2 bg-white border border-primary-200 rounded-lg text-sm">
            <option v-for="n in [1, 2, 3, 5, 8, 10]" :key="n" :value="n">Last {{ n }}</option>
          </select>
        </label>
        <label class="block flex-1 min-w-[220px]">
          <span class="block text-xs text-primary-500 mb-1">How alike a bloc must vote: {{ (threshold * 100).toFixed(0) }}% average agreement</span>
          <input v-model.number="threshold" type="range" min="0.70" max="0.95" step="0.01" class="w-full accent-[#2a78d6]" />
          <span class="flex justify-between text-[10px] text-primary-400"><span>fewer, broader blocs</span><span>more, tighter blocs</span></span>
        </label>
        <button :disabled="loading" class="px-4 py-2 bg-primary-900 text-white text-sm font-medium rounded-lg hover:bg-primary-800 disabled:opacity-50" @click="detect">
          {{ loading ? 'Detecting…' : 'Detect blocs' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="skeleton h-32 rounded-xl" />
    </div>

    <template v-else-if="res?.blocs?.length">
      <p class="text-xs text-primary-500 mb-4">
        {{ res.meta.contested }} contested votes out of {{ res.meta.resolutions }} in sessions {{ res.meta.sessions[0] }}–{{ res.meta.sessions[res.meta.sessions.length - 1] }},
        {{ res.meta.countries }} countries. {{ res.blocs.length }} blocs, {{ res.unaligned.length }} unaligned.
      </p>

      <!-- Blocs -->
      <div class="space-y-4">
        <div v-for="bloc in res.blocs" :key="bloc.id" class="bg-white rounded-xl border border-primary-100 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-sm shrink-0" :style="{ background: blocColor(bloc.id) }" />
                <span class="font-medium text-primary-900"><span class="text-primary-400 mr-1">{{ bloc.id }}.</span>{{ bloc.label }}</span>
              </div>
              <div class="text-xs text-primary-500 mt-0.5">{{ bloc.size }} countries</div>
            </div>
            <div class="flex gap-6 text-right">
              <div><div class="text-lg font-serif text-primary-900 tabular-nums">{{ Math.round(bloc.cohesion * 100) }}%</div><div class="text-[10px] text-primary-500">agree with each other</div></div>
              <div><div class="text-lg font-serif text-primary-900 tabular-nums">{{ Math.round(bloc.yesRate * 100) }}%</div><div class="text-[10px] text-primary-500">yes on contested votes</div></div>
            </div>
          </div>
          <div v-if="bloc.matchingGroups?.length" class="mb-3 text-xs text-primary-500">
            Overlaps with
            <template v-for="(g, i) in bloc.matchingGroups.slice(0, 3)" :key="g.gid">
              <NuxtLink :to="`/groups/${g.gid}`" class="text-primary-700 hover:text-accent-700 underline decoration-dotted">{{ g.acronym }}</NuxtLink>
              <span class="text-primary-400"> ({{ Math.round(g.jaccard * 100) }}%)</span>{{ i < Math.min(3, bloc.matchingGroups.length) - 1 ? ', ' : '' }}
            </template>
          </div>
          <div class="flex flex-wrap gap-1">
            <NuxtLink v-for="m in bloc.memberNames.slice(0, expanded[bloc.id] ? undefined : 24)" :key="m.iso3" :to="`/countries/${m.iso3.toLowerCase()}`"
              class="text-xs px-1.5 py-0.5 bg-primary-50 rounded text-primary-700 hover:bg-primary-100">{{ flag(m.iso2) }} {{ m.name }}</NuxtLink>
            <button v-if="bloc.memberNames.length > 24" class="text-xs text-accent-600 hover:text-accent-700" @click="expanded[bloc.id] = !expanded[bloc.id]">
              {{ expanded[bloc.id] ? 'Show less' : `+${bloc.memberNames.length - 24} more` }}
            </button>
          </div>
        </div>
      </div>

      <div class="mt-4">
        <!-- Unaligned -->
        <div class="bg-white rounded-xl border border-primary-100 p-5">
          <h4 class="font-medium text-primary-900">Unaligned countries</h4>
          <p class="text-xs text-primary-500 mb-3">Countries that don't vote closely enough with any bloc, and the bloc they come closest to</p>
          <ul class="grid md:grid-cols-2 gap-x-8 gap-y-1.5">
            <li v-for="u in res.unaligned" :key="u.iso3" class="grid grid-cols-[1fr_auto] gap-2 text-sm">
              <NuxtLink :to="`/countries/${u.iso3.toLowerCase()}`" class="text-primary-800 hover:text-accent-700">{{ flag(u.iso2) }} {{ u.name }}</NuxtLink>
              <span class="text-xs text-primary-500 text-right" :title="u.closestLabel"><span class="inline-block w-2 h-2 rounded-sm mr-1" :style="{ background: blocColor(u.closestBloc) }" />closest: Bloc {{ u.closestBloc }} · {{ Math.round(u.agreement * 100) }}%</span>
            </li>
            <li v-if="!res.unaligned.length" class="text-sm text-primary-400">Every country fits a bloc at this threshold.</li>
          </ul>
        </div>
      </div>

      <!-- Between blocs -->
      <div v-if="res.blocs.length > 1" class="bg-white rounded-xl border border-primary-100 p-5 mt-4 min-w-0">
        <h4 class="font-medium text-primary-900">How often blocs agree with each other</h4>
        <p class="text-xs text-primary-500 mb-3">Average agreement between members of two blocs on contested votes; columns follow the row order</p>
        <VizHeatmap :rows="pairRows" :columns="pairCols" :values="pairValues" tip-note="agreement" />
      </div>

      <p class="text-[10px] text-primary-400 mt-4">Computed {{ new Date(res.computedAt).toLocaleString() }} from recorded General Assembly votes.</p>
    </template>

    <div v-else-if="hasRun" class="bg-white rounded-xl border border-primary-100 p-8 text-center text-primary-500">
      {{ error || 'No blocs found at this threshold. Try a lower agreement level or more sessions.' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

const sessions = ref(5)
const threshold = ref(0.85)
const loading = ref(false)
const hasRun = ref(false)
const error = ref('')
const res = ref<any>(null)
const expanded = reactive<Record<number, boolean>>({})

// categorical slots in fixed order (bloc 1 = slot 1, ...)
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const blocColor = (id: number | null) => (id ? PALETTE[(id - 1) % PALETTE.length] : '#cbd5e1')
const flag = (iso2: string) => (iso2 ? isoToFlag(iso2) : '')
const shortLabel = (l: string) => (l.length > 28 ? l.slice(0, 26) + '…' : l)

const pairRows = computed(() => (res.value?.blocs || []).map((b: any) => ({ key: String(b.id), label: `${b.id}. ${shortLabel(b.label)}` })))
const pairCols = computed(() => (res.value?.blocs || []).map((b: any) => ({ key: String(b.id), label: `Bloc ${b.id}` })))
const pairValues = computed(() => {
  const out: Record<string, Record<string, number>> = {}
  const m = res.value?.blocAgreement || []
  ;(res.value?.blocs || []).forEach((a: any, i: number) => {
    out[String(a.id)] = {}
    ;(res.value?.blocs || []).forEach((b: any, j: number) => { out[String(a.id)][String(b.id)] = m[i]?.[j] == null ? 100 : Math.round(m[i][j] * 100) })
  })
  return out
})

async function detect() {
  loading.value = true; hasRun.value = true; error.value = ''
  try {
    res.value = await $fetch<any>('/api/intelligence/voting-blocs', { query: { sessions: sessions.value, threshold: threshold.value } })
  } catch (e: any) {
    res.value = null
    error.value = 'The detector could not run: ' + (e?.data?.statusMessage || e?.message || 'server error')
  }
  loading.value = false
}

// run once with the defaults so the tab isn't empty
onMounted(detect)
</script>
