<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <NuxtLink to="/people" class="text-sm text-primary-400 hover:text-primary-900">← People</NuxtLink>
    <div class="flex flex-wrap items-end justify-between gap-3 mt-2">
      <h1 class="font-serif text-3xl sm:text-4xl font-bold text-primary-900">Permanent Representatives in New York</h1>
      <AdminRegenerate :sources="[{ id: 'fetch-un-missions', label: 'UN Blue Book (missions and heads)' }]" />
    </div>
    <p class="text-primary-500 mt-2 max-w-3xl">The heads of the Permanent Missions to the United Nations, from the UN Protocol and Liaison Service's Blue Book<span v-if="d?.updatedAt">, checked {{ day(d.updatedAt) }}</span>.</p>

    <div v-if="!d" class="h-64 rounded-2xl bg-primary-50 animate-pulse mt-6" />
    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-px bg-primary-100 rounded-2xl overflow-hidden ring-1 ring-primary-100 mt-6">
        <div v-for="t in tiles" :key="t.label" class="bg-white px-4 py-3">
          <div class="font-serif text-2xl text-primary-900 tabular-nums">{{ t.value }}</div>
          <div class="text-xs text-primary-500 mt-0.5">{{ t.label }}</div>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6 mt-8">
        <section class="card">
          <h2 class="h2">Newly arrived</h2>
          <p class="sub">Credentials presented to the Secretary-General</p>
          <ul class="space-y-2 text-sm">
            <li v-for="m in d.recent" :key="m.entity" class="flex justify-between gap-3">
              <span class="min-w-0"><span class="mr-1">{{ flag(m.iso2) }}</span><span class="font-medium text-primary-900">{{ m.head.name }}</span><span class="block text-xs text-primary-500">{{ m.entity }}</span></span>
              <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ day(m.head.credentials) }}</span>
            </li>
          </ul>
        </section>
        <section class="card">
          <h2 class="h2">Longest serving</h2>
          <p class="sub">By date of credentials (or appointment)</p>
          <ul class="space-y-2 text-sm">
            <li v-for="m in d.longest" :key="m.entity" class="flex justify-between gap-3">
              <span class="min-w-0"><span class="mr-1">{{ flag(m.iso2) }}</span><span class="font-medium text-primary-900">{{ m.head.name }}</span><span class="block text-xs text-primary-500">{{ m.entity }}</span></span>
              <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">since {{ year(m.since) }}</span>
            </li>
          </ul>
        </section>
        <section class="card">
          <h2 class="h2">No Permanent Representative listed</h2>
          <p class="sub">Member States whose mission is led by a deputy or chargé d'affaires, or lists no head</p>
          <ul class="space-y-1.5 text-sm">
            <li v-for="m in vacant" :key="m.entity"><span class="mr-1">{{ flag(m.iso2) }}</span>{{ m.entity }} <span class="text-xs text-primary-500">{{ m.acting ? `· ${m.acting.name} (${m.acting.function || m.acting.rank})` : '· no head listed' }}</span></li>
          </ul>
        </section>
      </div>

      <section class="card mt-8">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <h2 class="h2 mr-auto">All missions</h2>
          <input v-model.trim="q" type="search" placeholder="Country or name…" class="text-sm px-3 py-1.5 rounded-lg ring-1 ring-primary-200 focus:ring-primary-400 outline-none w-full sm:w-56">
          <select v-model="region" class="text-sm px-2 py-1.5 rounded-lg ring-1 ring-primary-200 bg-white">
            <option value="">All Member States</option>
            <option v-for="r in REGIONS" :key="r" :value="r">{{ r }}</option>
            <option value="observers">Observers and organizations</option>
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="text-left text-[11px] uppercase tracking-wider text-primary-400 border-b border-primary-100">
              <th class="py-2 pr-3 font-medium">Mission</th><th class="py-2 px-3 font-medium">Head of mission</th><th class="py-2 px-3 font-medium">Since</th><th class="py-2 px-3 font-medium">Deputies</th><th class="py-2 px-3 font-medium">Contact</th>
            </tr></thead>
            <tbody>
              <tr v-for="m in rows" :key="m.entity" class="border-b border-primary-50 align-top">
                <td class="py-2 pr-3 whitespace-nowrap">
                  <NuxtLink v-if="m.iso3 && m.member" :to="`/countries/${m.iso3.toLowerCase()}`" class="text-primary-900 hover:text-accent-700">{{ flag(m.iso2) }} {{ m.entity }}</NuxtLink>
                  <span v-else class="text-primary-900">{{ m.entity }}</span>
                  <div v-if="m.region" class="text-[11px] text-primary-400">{{ m.region }}</div>
                  <div v-else class="text-[11px] text-primary-400">{{ m.category }}</div>
                </td>
                <td class="py-2 px-3">
                  <template v-if="m.head"><span class="font-medium text-primary-900">{{ m.head.name }}</span><div class="text-[11px] text-primary-500">{{ m.head.title }} · {{ m.head.function || m.head.rank }}</div></template>
                  <template v-else-if="m.acting"><span class="text-primary-700">{{ m.acting.name }}</span><div class="text-[11px] text-amber-700">{{ m.acting.function || m.acting.rank }} (no PR listed)</div></template>
                  <span v-else class="text-xs text-primary-400">No head of mission listed</span>
                </td>
                <td class="py-2 px-3 whitespace-nowrap text-xs text-primary-600 tabular-nums">{{ m.since ? day(m.since) : '–' }}</td>
                <td class="py-2 px-3 text-xs text-primary-600 min-w-[10rem]">{{ m.deputies.join(', ') || '–' }}</td>
                <td class="py-2 px-3 text-xs text-primary-500 min-w-[12rem]">
                  <div>{{ m.address }}</div>
                  <div v-if="m.telephone">Tel. {{ m.telephone }}</div>
                  <a v-if="m.website" :href="url(m.website)" target="_blank" rel="noopener" class="text-accent-700 hover:underline">Website</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-primary-400 mt-2">{{ rows.length }} missions shown.</p>
      </section>

      <MethodNote class="mt-6">
        <p><strong>Source.</strong> The UN Protocol and Liaison Service's online Blue Book (<a href="https://bluebook.unmeetings.org/" target="_blank" rel="noopener">bluebook.unmeetings.org</a>), the official directory of Permanent Missions, read daily. It is updated by the missions and the Secretariat and can lag behind changes.</p>
        <p><strong>Head of mission.</strong> The person listed as Permanent Representative or Permanent Observer, or otherwise the person whose credentials are recorded (the United States lists its ambassador as "Representative"). "Since" is the date credentials were presented to the Secretary-General, or the appointment date when that is missing. Where no head is listed, the deputy or chargé d'affaires is shown.</p>
        <p><strong>Women among Permanent Representatives</strong> is counted from the honorific in the Blue Book (Ms., Mrs.), which is how the UN lists them; it may not reflect how everyone identifies.</p>
        <p><strong>Privacy.</strong> Only heads of mission, their deputies' names and the missions' public contact details are shown; other staff, spouses and personal contact details in the Blue Book are not collected.</p>
      </MethodNote>
    </template>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

useHead({ title: 'Permanent Representatives in New York — World Country Groups' })
const REGIONS = ['African States', 'Asia-Pacific States', 'Eastern European States', 'Latin American and Caribbean States', 'Western European and other States']
const { data: d } = useFetch<any>('/api/people/permanent-representatives', { server: false })
const q = ref('')
const region = ref('')
const rows = computed(() => (d.value?.missions || []).filter((m: any) => {
  if (region.value === 'observers' ? m.member : region.value ? m.region !== region.value : !m.member) return false
  if (!q.value) return true
  const hay = `${m.entity} ${m.head?.name || ''} ${m.acting?.name || ''} ${m.deputies.join(' ')}`.toLowerCase()
  return hay.includes(q.value.toLowerCase())
}))
const vacant = computed(() => (d.value?.missions || []).filter((m: any) => m.member && !m.head))
const tiles = computed(() => {
  const s = d.value?.stats || {}
  return [
    { label: 'Member States with a Permanent Representative', value: `${s.withPr ?? '–'}/${s.members ?? '–'}` },
    { label: 'women (by honorific)', value: s.withPr ? `${Math.round((s.women / s.withPr) * 100)}%` : '–' },
    { label: 'arrived in the last 90 days', value: s.newLast90 ?? '–' },
    { label: 'median time in post (years)', value: s.medianYears ?? '–' },
    { label: 'observer missions and organizations', value: (d.value?.missions || []).filter((m: any) => !m.member).length },
  ]
})
const flag = (iso2: string | null) => (iso2 ? isoToFlag(iso2) : '')
const day = (iso: string) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '')
const year = (iso: string) => (iso || '').slice(0, 4)
const url = (u: string) => (/^https?:\/\//.test(u) ? u : `https://${u}`)
</script>

<style scoped>
.card { @apply bg-white rounded-2xl border border-primary-100 p-5 min-w-0; }
.h2 { @apply font-serif text-xl text-primary-900; }
.sub { @apply text-xs text-primary-500 mt-0.5 mb-3; }
</style>
