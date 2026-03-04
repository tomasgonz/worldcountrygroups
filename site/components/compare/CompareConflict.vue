<template>
  <div id="section-conflict" class="mb-10">
    <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Conflict</h2>
    <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="i in 3" :key="i" class="skeleton h-10 rounded-lg" />
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
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Total Events</td>
              <CompareBarCell
                v-for="e in identifiers"
                :key="e.id"
                :value="getEvents(e.id)"
                :max-value="maxEvents"
                :formatted="fmt(getEvents(e.id))"
                color="amber"
              />
            </tr>
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Total Fatalities</td>
              <CompareBarCell
                v-for="e in identifiers"
                :key="e.id"
                :value="getFatalities(e.id)"
                :max-value="maxFatalities"
                :formatted="fmt(getFatalities(e.id))"
                color="red"
              />
            </tr>
            <tr v-if="mode === 'countries'" class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Conflict Intensity</td>
              <td v-for="e in identifiers" :key="e.id" class="px-5 py-3 text-right">
                <span
                  v-if="getIntensity(e.id)"
                  class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="intensityClass(getIntensity(e.id)!)"
                >{{ getIntensity(e.id) }}</span>
                <span v-else class="text-primary-300 text-sm">N/A</span>
              </td>
            </tr>
            <tr v-if="mode === 'groups'" class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Affected Members</td>
              <td v-for="e in identifiers" :key="e.id" class="px-5 py-3 text-right tabular-nums text-primary-800">
                {{ getAffectedCount(e.id) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="p-8 text-center text-primary-400">
        No conflict data available for the selected {{ mode === 'groups' ? 'groups' : 'countries' }}.
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
        ? `/api/groups/${e.id}/conflict`
        : `/api/countries/${e.id}/conflict`
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

function getEvents(id: string): number | null {
  const d = dataMap.value[id]
  if (!d?.has_data) return null
  return d.total_events ?? null
}

function getFatalities(id: string): number | null {
  const d = dataMap.value[id]
  if (!d?.has_data) return null
  return d.total_fatalities ?? null
}

function getIntensity(id: string): string | null {
  const d = dataMap.value[id]
  if (!d?.has_data) return null
  return d.conflict_intensity ?? null
}

function getAffectedCount(id: string): string {
  const d = dataMap.value[id]
  if (!d?.has_data) return 'N/A'
  return String(d.affected_members?.length ?? 0)
}

const maxEvents = computed(() => Math.max(...props.identifiers.map(e => getEvents(e.id) ?? 0)))
const maxFatalities = computed(() => Math.max(...props.identifiers.map(e => getFatalities(e.id) ?? 0)))

function fmt(n: number | null): string {
  if (n == null) return 'N/A'
  return n.toLocaleString()
}

function intensityClass(intensity: string): string {
  switch (intensity) {
    case 'high': return 'bg-red-100 text-red-700'
    case 'medium': return 'bg-amber-100 text-amber-700'
    case 'low': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-emerald-100 text-emerald-700'
  }
}
</script>
