<template>
  <!-- Next scheduled national election (Wikipedia electoral calendar, CC BY-SA) -->
  <p v-if="next" class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-primary-600">
    <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />Next election
    </span>
    <span class="text-primary-900 font-medium">{{ when }}</span>
    <span>&middot;</span>
    <a v-if="next.article_url" :href="next.article_url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ next.description || 'National election' }}</a>
    <span v-else>{{ next.description || 'National election' }}</span>
    <span v-if="next.indirect" class="text-xs text-primary-400">(indirect)</span>
    <span v-if="countdown" class="text-xs text-primary-400">{{ countdown }}</span>
    <a :href="next.source_url" target="_blank" rel="noopener" class="text-[11px] text-primary-400 hover:text-accent-700">Source: Wikipedia, CC BY-SA</a>
  </p>
</template>

<script setup lang="ts">
const props = defineProps<{ iso3: string }>()
const { data } = useFetch<any>('/api/elections', {
  query: computed(() => ({ iso3: props.iso3, status: 'upcoming', limit: 5 })),
  server: false,
})
const next = computed<any>(() => data.value?.next || null)

const MONTH_FMT: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric', timeZone: 'UTC' }
const when = computed(() => {
  const e = next.value
  if (!e) return ''
  if (e.precision === 'day') {
    const d = new Date(`${e.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    if (!e.date_end) return d
    const end = new Date(`${e.date_end}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    return `${d} to ${end}`
  }
  if (e.precision === 'month') {
    const [y, m] = String(e.date).split('-').map(Number)
    return `${new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString('en-GB', MONTH_FMT)} (date to be confirmed)`
  }
  return `${e.date} (date to be confirmed)`
})
const countdown = computed(() => {
  const e = next.value
  if (!e || e.precision !== 'day') return ''
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'UTC' })
  const days = Math.round((new Date(`${e.date}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000)
  if (days < 0) return 'under way'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
})
</script>
