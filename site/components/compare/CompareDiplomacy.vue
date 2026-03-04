<template>
  <div id="section-diplomacy" class="mb-10">
    <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Diplomacy</h2>

    <!-- Treaties -->
    <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden mb-5">
      <button class="w-full flex items-center justify-between px-5 py-4 hover:bg-primary-50/50 transition-colors" @click="showTreaties = !showTreaties">
        <h3 class="text-sm font-semibold text-primary-800">Treaties</h3>
        <svg class="w-4 h-4 text-primary-400 transition-transform" :class="showTreaties ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
      </button>
      <div v-if="showTreaties">
        <div v-if="treatiesLoading" class="p-6 space-y-3">
          <div v-for="i in 3" :key="i" class="skeleton h-8 rounded-lg" />
        </div>
        <div v-else-if="treatyRows.length > 0" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-primary-100 text-left">
                <th class="px-5 py-3 font-medium text-primary-400 text-xs uppercase tracking-wider">Treaty</th>
                <th v-for="e in identifiers" :key="e.id" class="px-5 py-3 font-medium text-primary-400 text-xs uppercase tracking-wider text-center">
                  {{ e.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in treatyRows" :key="row.name" class="border-b border-primary-50 last:border-0">
                <td class="px-5 py-2.5 text-primary-700 max-w-[200px] truncate" :title="row.fullName">{{ row.name }}</td>
                <td v-for="e in identifiers" :key="e.id" class="px-5 py-2.5 text-center">
                  <span v-if="mode === 'countries'" class="text-xs px-1.5 py-0.5 rounded" :class="statusClass(row.statuses[e.id])">
                    {{ row.statuses[e.id] || '—' }}
                  </span>
                  <span v-else class="text-xs text-primary-600 tabular-nums">
                    {{ row.statuses[e.id] || '—' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-5 py-6 text-center text-primary-400 text-sm">No treaty data available.</div>
      </div>
    </div>

    <!-- Sanctions -->
    <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden mb-5">
      <button class="w-full flex items-center justify-between px-5 py-4 hover:bg-primary-50/50 transition-colors" @click="showSanctions = !showSanctions">
        <h3 class="text-sm font-semibold text-primary-800">Sanctions</h3>
        <svg class="w-4 h-4 text-primary-400 transition-transform" :class="showSanctions ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
      </button>
      <div v-if="showSanctions">
        <div v-if="sanctionsLoading" class="p-6 space-y-3">
          <div v-for="i in 2" :key="i" class="skeleton h-8 rounded-lg" />
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-primary-100 text-left">
                <th class="px-5 py-3 font-medium text-primary-400 text-xs uppercase tracking-wider">Entity</th>
                <th class="px-5 py-3 font-medium text-primary-400 text-xs uppercase tracking-wider text-center">Sanctioned</th>
                <th class="px-5 py-3 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Regimes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in identifiers" :key="e.id" class="border-b border-primary-50 last:border-0">
                <td class="px-5 py-2.5 text-primary-700 font-medium">{{ e.label }}</td>
                <td class="px-5 py-2.5 text-center">
                  <span
                    class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="isSanctioned(e.id) ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'"
                  >{{ isSanctioned(e.id) ? 'Yes' : 'No' }}</span>
                </td>
                <td class="px-5 py-2.5 text-right text-primary-600 tabular-nums">{{ sanctionCount(e.id) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Recognition -->
    <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
      <button class="w-full flex items-center justify-between px-5 py-4 hover:bg-primary-50/50 transition-colors" @click="showRecognition = !showRecognition">
        <h3 class="text-sm font-semibold text-primary-800">Recognition Stances</h3>
        <svg class="w-4 h-4 text-primary-400 transition-transform" :class="showRecognition ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
      </button>
      <div v-if="showRecognition">
        <div v-if="recognitionLoading" class="p-6 space-y-3">
          <div v-for="i in 3" :key="i" class="skeleton h-8 rounded-lg" />
        </div>
        <div v-else-if="recognitionRows.length > 0" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-primary-100 text-left">
                <th class="px-5 py-3 font-medium text-primary-400 text-xs uppercase tracking-wider">Entity</th>
                <th v-for="e in identifiers" :key="e.id" class="px-5 py-3 font-medium text-primary-400 text-xs uppercase tracking-wider text-center">
                  {{ e.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in recognitionRows" :key="row.name" class="border-b border-primary-50 last:border-0">
                <td class="px-5 py-2.5 text-primary-700">{{ row.name }}</td>
                <td v-for="e in identifiers" :key="e.id" class="px-5 py-2.5 text-center">
                  <span v-if="mode === 'countries'" class="text-xs px-1.5 py-0.5 rounded" :class="recognitionStanceClass(row.stances[e.id])">
                    {{ formatStance(row.stances[e.id]) }}
                  </span>
                  <span v-else class="text-xs text-primary-600 tabular-nums">
                    {{ row.stances[e.id] || '—' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-5 py-6 text-center text-primary-400 text-sm">No recognition data available.</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  identifiers: { id: string; label: string }[]
  mode: 'groups' | 'countries'
}>()

const showTreaties = ref(true)
const showSanctions = ref(true)
const showRecognition = ref(true)

const treatiesData = ref<Record<string, any>>({})
const sanctionsData = ref<Record<string, any>>({})
const recognitionData = ref<Record<string, any>>({})
const treatiesLoading = ref(true)
const sanctionsLoading = ref(true)
const recognitionLoading = ref(true)

onMounted(async () => {
  const prefix = props.mode === 'groups' ? '/api/groups' : '/api/countries'

  // Fetch all three in parallel for all entities
  const [tResults, sResults, rResults] = await Promise.all([
    Promise.all(props.identifiers.map(async (e) => {
      try { return { id: e.id, data: await $fetch(`${prefix}/${e.id}/treaties`) } }
      catch { return { id: e.id, data: null } }
    })),
    Promise.all(props.identifiers.map(async (e) => {
      try { return { id: e.id, data: await $fetch(`${prefix}/${e.id}/sanctions`) } }
      catch { return { id: e.id, data: null } }
    })),
    Promise.all(props.identifiers.map(async (e) => {
      try { return { id: e.id, data: await $fetch(`${prefix}/${e.id}/recognition`) } }
      catch { return { id: e.id, data: null } }
    })),
  ])

  for (const r of tResults) treatiesData.value[r.id] = r.data
  for (const r of sResults) sanctionsData.value[r.id] = r.data
  for (const r of rResults) recognitionData.value[r.id] = r.data

  treatiesLoading.value = false
  sanctionsLoading.value = false
  recognitionLoading.value = false
})

// Treaties
const treatyRows = computed(() => {
  const allTreaties = new Map<string, { name: string; fullName: string }>()
  for (const d of Object.values(treatiesData.value)) {
    if (!d?.treaties) continue
    for (const t of d.treaties) {
      const treaty = t.treaty || t
      const id = treaty.id || treaty.short_name
      if (!allTreaties.has(id)) {
        allTreaties.set(id, { name: treaty.short_name || treaty.name, fullName: treaty.name })
      }
    }
  }

  return [...allTreaties.entries()].map(([id, info]) => {
    const statuses: Record<string, string> = {}
    for (const e of props.identifiers) {
      const d = treatiesData.value[e.id]
      if (!d?.treaties) { statuses[e.id] = ''; continue }
      const found = d.treaties.find((t: any) => (t.treaty?.id || t.treaty?.short_name) === id)
      if (props.mode === 'countries') {
        statuses[e.id] = found?.status || ''
      } else {
        statuses[e.id] = found ? `${found.coverage ?? Math.round((found.parties / found.total) * 100)}%` : ''
      }
    }
    return { name: info.name, fullName: info.fullName, statuses }
  })
})

function statusClass(status: string): string {
  switch (status) {
    case 'party': return 'bg-emerald-100 text-emerald-700'
    case 'signatory': return 'bg-blue-100 text-blue-700'
    case 'withdrawn': return 'bg-red-100 text-red-700'
    default: return 'bg-primary-100 text-primary-500'
  }
}

// Sanctions
function isSanctioned(id: string): boolean {
  const d = sanctionsData.value[id]
  if (!d) return false
  if (props.mode === 'countries') return d.sanctioned === true
  return (d.totalSanctioned ?? d.sanctioned?.length ?? 0) > 0
}

function sanctionCount(id: string): string {
  const d = sanctionsData.value[id]
  if (!d) return '0'
  if (props.mode === 'countries') return String(d.regimes?.length ?? 0)
  return String(d.totalSanctioned ?? d.sanctioned?.length ?? 0)
}

// Recognition
const recognitionRows = computed(() => {
  const allEntities = new Map<string, string>()
  for (const d of Object.values(recognitionData.value)) {
    if (!d?.entities) continue
    for (const e of d.entities) {
      const ent = e.entity || e
      if (!allEntities.has(ent.id)) {
        allEntities.set(ent.id, ent.name)
      }
    }
  }

  return [...allEntities.entries()].map(([entId, name]) => {
    const stances: Record<string, string> = {}
    for (const e of props.identifiers) {
      const d = recognitionData.value[e.id]
      if (!d?.entities) { stances[e.id] = ''; continue }
      const found = d.entities.find((x: any) => (x.entity?.id || x.entity) === entId)
      if (props.mode === 'countries') {
        stances[e.id] = found?.stance || ''
      } else {
        stances[e.id] = found ? `${found.recognizers}/${found.total}` : ''
      }
    }
    return { name, stances }
  })
})

function recognitionStanceClass(stance: string): string {
  switch (stance) {
    case 'recognizes': return 'bg-emerald-100 text-emerald-700'
    case 'withdrawn': return 'bg-amber-100 text-amber-700'
    case 'does_not_recognize': return 'bg-red-100 text-red-700'
    default: return 'bg-primary-100 text-primary-500'
  }
}

function formatStance(stance: string): string {
  if (!stance) return '—'
  return stance.replace(/_/g, ' ')
}
</script>
