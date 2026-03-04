<template>
  <div id="section-military" class="mb-10">
    <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Military & Defense</h2>
    <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="i in 4" :key="i" class="skeleton h-10 rounded-lg" />
      </div>
      <div v-else-if="hasAnyData" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-primary-100 text-left">
              <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Metric</th>
              <th v-for="e in identifiers" :key="e.id" class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">
                {{ e.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key" class="border-b border-primary-50 last:border-0">
              <td class="px-5 py-3 text-primary-600 font-medium">{{ row.label }}</td>
              <CompareBarCell
                v-for="e in identifiers"
                :key="e.id"
                :value="getVal(e.id, row.key)"
                :max-value="row.max"
                :formatted="row.format(getVal(e.id, row.key))"
                :color="row.color"
              />
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="p-8 text-center text-primary-400">
        No military data available for the selected {{ mode === 'groups' ? 'groups' : 'countries' }}.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  identifiers: { id: string; label: string }[]
  mode: 'groups' | 'countries'
}>()

const dataMap = ref<Record<string, any>>({})
const loading = ref(true)

onMounted(async () => {
  const fetches = props.identifiers.map(async (e) => {
    try {
      const url = props.mode === 'groups'
        ? `/api/groups/${e.id}/military`
        : `/api/countries/${e.id}/military`
      const data = await $fetch(url)
      dataMap.value[e.id] = data
    } catch {
      dataMap.value[e.id] = { has_data: false }
    }
  })
  await Promise.all(fetches)
  loading.value = false
})

const hasAnyData = computed(() => Object.values(dataMap.value).some((d: any) => d?.has_data))

function getVal(id: string, key: string): number | null {
  const d = dataMap.value[id]
  if (!d?.has_data) return null
  if (props.mode === 'groups') {
    return d.aggregate?.[key] ?? null
  }
  return d[key] ?? null
}

const rows = computed(() => {
  const defs = [
    { key: 'active_military', label: 'Active Personnel', format: formatMilitary, color: 'default' as const },
    { key: 'reserve_military', label: 'Reserve Personnel', format: formatMilitary, color: 'default' as const },
    { key: 'aircraft_total', label: 'Total Aircraft', format: formatMilitary, color: 'default' as const },
    { key: 'tank_strength', label: 'Tank Strength', format: formatMilitary, color: 'default' as const },
    { key: 'naval_total', label: 'Naval Vessels', format: formatMilitary, color: 'default' as const },
    { key: 'defense_budget', label: 'Defense Budget', format: formatDefenseBudget, color: 'default' as const },
  ]

  return defs.map(d => ({
    ...d,
    max: Math.max(...props.identifiers.map(e => getVal(e.id, d.key) ?? 0)),
  }))
})
</script>
