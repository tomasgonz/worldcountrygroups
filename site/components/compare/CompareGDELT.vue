<template>
  <div id="section-media" class="mb-10">
    <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Media & Events</h2>
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
              <td class="px-5 py-3 text-primary-600 font-medium">Average Tone</td>
              <td v-for="e in identifiers" :key="e.id" class="px-5 py-3 text-right tabular-nums" :class="toneClass(getTone(e.id))">
                {{ fmtTone(getTone(e.id)) }}
              </td>
            </tr>
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Total Events</td>
              <CompareBarCell
                v-for="e in identifiers"
                :key="e.id"
                :value="getEvents(e.id)"
                :max-value="maxEvents"
                :formatted="fmtNum(getEvents(e.id))"
              />
            </tr>
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Cooperation Ratio</td>
              <td v-for="e in identifiers" :key="e.id" class="px-5 py-3 text-right tabular-nums text-primary-800">
                {{ fmtPct(getCoopRatio(e.id)) }}
              </td>
            </tr>
            <tr v-if="mode === 'countries'" class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Article Volume</td>
              <CompareBarCell
                v-for="e in identifiers"
                :key="e.id"
                :value="getArticleVol(e.id)"
                :max-value="maxArticleVol"
                :formatted="fmtNum(getArticleVol(e.id))"
              />
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="p-8 text-center text-primary-400">
        No GDELT data available for the selected {{ mode === 'groups' ? 'groups' : 'countries' }}.
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
        ? `/api/groups/${e.id}/gdelt`
        : `/api/countries/${e.id}/gdelt`
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

function getTone(id: string): number | null {
  const d = dataMap.value[id]
  if (!d?.has_data) return null
  return d.avg_tone ?? d.media?.avg_tone ?? null
}

function getEvents(id: string): number | null {
  const d = dataMap.value[id]
  if (!d?.has_data) return null
  return d.total_events ?? d.events?.total ?? null
}

function getCoopRatio(id: string): number | null {
  const d = dataMap.value[id]
  if (!d?.has_data) return null
  return d.cooperation_ratio ?? d.events?.cooperation_ratio ?? null
}

function getArticleVol(id: string): number | null {
  const d = dataMap.value[id]
  if (!d?.has_data) return null
  return d.media?.article_volume ?? null
}

const maxEvents = computed(() => Math.max(...props.identifiers.map(e => getEvents(e.id) ?? 0)))
const maxArticleVol = computed(() => Math.max(...props.identifiers.map(e => getArticleVol(e.id) ?? 0)))

function fmtNum(n: number | null): string {
  if (n == null) return 'N/A'
  return n.toLocaleString()
}

function fmtTone(n: number | null): string {
  if (n == null) return 'N/A'
  return n.toFixed(2)
}

function fmtPct(n: number | null): string {
  if (n == null) return 'N/A'
  return `${(n * 100).toFixed(1)}%`
}

function toneClass(tone: number | null): string {
  if (tone == null) return 'text-primary-800'
  if (tone > 0) return 'text-emerald-600 font-medium'
  if (tone < -1) return 'text-red-600 font-medium'
  return 'text-amber-600 font-medium'
}
</script>
