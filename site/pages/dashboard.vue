<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div class="flex flex-wrap items-end justify-between gap-3 mb-2">
      <h1 class="font-serif text-3xl sm:text-4xl font-bold text-primary-900">My watchlist</h1>
      <div class="flex rounded-full bg-primary-100 p-0.5 text-sm" role="tablist" aria-label="Period">
        <button v-for="p in PERIODS" :key="p.days" role="tab" :aria-selected="days === p.days" class="px-3 py-1 rounded-full" :class="days === p.days ? 'bg-white shadow-sm text-primary-900' : 'text-primary-500'" @click="days = p.days">{{ p.label }}</button>
      </div>
    </div>
    <p class="text-sm text-primary-500 mb-6 max-w-3xl">What's new on the countries, groups, UN offices and topics you follow: votes, statements, appointments, quotes, elections and news.
      <NuxtLink to="/account" class="text-accent-700 hover:underline">Email digest: {{ digestLabel }}</NuxtLink>.</p>

    <!-- what you follow -->
    <details class="bg-white rounded-2xl border border-primary-100 p-5 mb-8" :open="empty">
      <summary class="cursor-pointer font-medium text-primary-900">What you follow <span class="text-sm font-normal text-primary-500">({{ count }})</span></summary>
      <div class="grid md:grid-cols-2 gap-6 mt-4">
        <div>
          <div class="lbl">Countries</div>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span v-for="iso2 in bookmarks.state.value.bookmarkedCountries" :key="iso2" class="chip">{{ isoToFlag(iso2) }} {{ countryName(iso2) }}<button class="x" :aria-label="`Stop following ${countryName(iso2)}`" @click="toggle('country', iso2)">×</button></span>
          </div>
          <input v-model="cq" list="wl-countries" placeholder="Add a country…" class="inp" @change="addCountry">
          <datalist id="wl-countries"><option v-for="c in countryList" :key="c.iso2" :value="c.name" /></datalist>
        </div>
        <div>
          <div class="lbl">Groups</div>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span v-for="gid in bookmarks.state.value.bookmarkedGroups" :key="gid" class="chip">{{ groupName(gid) }}<button class="x" :aria-label="`Stop following ${groupName(gid)}`" @click="toggle('group', gid)">×</button></span>
          </div>
          <input v-model="gq" list="wl-groups" placeholder="Add a group…" class="inp" @change="addGroup">
          <datalist id="wl-groups"><option v-for="g in groupList" :key="g.gid" :value="g.acronym ? `${g.acronym} — ${g.name}` : g.name" /></datalist>
        </div>
        <div>
          <div class="lbl">UN offices</div>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="o in feed?.offices_available || []" :key="o.id" class="chip" :class="set.offices.includes(o.id) ? 'chip-on' : ''" :title="o.label + (o.holder ? ` (${o.holder})` : '')" @click="toggleOffice(o.id)">{{ o.short }}</button>
          </div>
        </div>
        <div>
          <div class="lbl">Topics <span class="normal-case tracking-normal text-primary-400">(words to look for in news and statements)</span></div>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span v-for="t in set.topics" :key="t" class="chip">“{{ t }}”<button class="x" :aria-label="`Stop following ${t}`" @click="removeTopic(t)">×</button></span>
          </div>
          <form class="flex gap-2" @submit.prevent="addTopic"><input v-model.trim="tq" placeholder="e.g. liquidity crisis, Sudan ceasefire" class="inp" maxlength="60"><button class="text-sm px-3 rounded-lg bg-primary-900 text-white">Add</button></form>
        </div>
      </div>
    </details>

    <div v-if="pending && !feed" class="space-y-3"><div class="h-32 rounded-2xl bg-primary-50 animate-pulse" /><div class="h-32 rounded-2xl bg-primary-50 animate-pulse" /></div>
    <p v-else-if="empty" class="text-sm text-primary-500">Follow a few countries, groups, offices or topics above to see what's new on them.</p>

    <template v-else-if="feed">
      <!-- countries -->
      <section v-if="feed.countries.length" class="mb-10">
        <h2 class="h2">Countries</h2>
        <div class="grid lg:grid-cols-2 gap-4">
          <article v-for="c in feed.countries" :key="c.id" class="card">
            <header class="flex items-baseline justify-between gap-2">
              <NuxtLink :to="`/countries/${c.iso3.toLowerCase()}`" class="font-serif text-xl text-primary-900 hover:text-accent-700">{{ isoToFlag(c.iso2) }} {{ c.name }}</NuxtLink>
              <span class="text-xs text-primary-500">{{ c.total ? `${c.total} new` : 'quiet' }}</span>
            </header>
            <ul class="mt-3 space-y-2 text-[13px]">
              <li v-for="v in c.ga.slice(0, 4)" :key="v.id" class="row"><span class="tag">GA vote</span><span>Voted <strong :class="v.againstMajority ? 'text-red-700' : ''">{{ v.vote }}</strong><span v-if="v.againstMajority" class="text-red-700"> (against the majority)</span> · <a :href="v.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ v.title }}</a> <span class="when">{{ day(v.date) }}</span></span></li>
              <li v-for="v in c.sc.slice(0, 3)" :key="v.id" class="row"><span class="tag">Council</span><span>Voted <strong>{{ v.vote }}</strong> on {{ v.id }} ({{ v.title }}) <span class="when">{{ day(v.date) }}</span></span></li>
              <li v-for="a in c.appointments" :key="a.url" class="row"><span class="tag">Appointed</span><span>{{ a.person }}, <a :href="a.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ a.post }}</a> <span class="when">{{ a.kind }} · {{ day(a.date) }}</span></span></li>
              <li v-for="s in c.fifth.slice(0, 2)" :key="s.url" class="row"><span class="tag">5th Cttee</span><a :href="s.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ s.topic || 'Statement' }}<span v-if="s.onBehalfOf" class="when"> for {{ s.onBehalfOf }}</span></a></li>
              <li v-for="q in c.quotes" :key="q.url + q.q" class="row"><span class="tag">Quote</span><span>“{{ q.q }}” <span class="when">{{ q.speaker }}</span></span></li>
              <li v-for="s in c.sgStatements.slice(0, 2)" :key="s.url" class="row"><span class="tag">SG</span><a :href="s.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ s.title }}</a></li>
              <li v-for="s in c.statements.slice(0, 2)" :key="s.url" class="row"><span class="tag">Official</span><span><a :href="s.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ s.title }}</a> <span class="when">{{ s.outlet }}</span></span></li>
              <li v-for="s in c.news.slice(0, 3)" :key="s.url" class="row"><span class="tag">News</span><span><a :href="s.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ s.title }}</a> <span class="when">{{ s.outlet }}</span></span></li>
              <li v-for="e in c.elections" :key="e.date + e.type" class="row"><span class="tag">Election</span><span>{{ e.type }} · {{ e.precision === 'day' ? day(e.date) : e.date }}</span></li>
            </ul>
            <footer class="mt-3 pt-2 border-t border-primary-50 text-[11px] text-primary-400 flex flex-wrap gap-x-3">
              <span>{{ c.newsCount }} news · {{ c.statementCount }} official statements</span>
              <span v-if="c.dues">UN dues: {{ c.dues.paid ? `paid in full ${day(c.dues.paidDate)}` : 'not paid in full' }}<span v-if="c.dues.article19" class="text-red-700"> · Article 19</span></span>
              <NuxtLink :to="`/countries/${c.iso3.toLowerCase()}/news`" class="text-accent-700 hover:underline ml-auto">All news</NuxtLink>
            </footer>
          </article>
        </div>
      </section>

      <!-- groups -->
      <section v-if="feed.groups.length" class="mb-10">
        <h2 class="h2">Groups</h2>
        <div class="grid lg:grid-cols-2 gap-4">
          <article v-for="g in feed.groups" :key="g.id" class="card">
            <header class="flex items-baseline justify-between gap-2">
              <NuxtLink :to="`/groups/${g.id}`" class="font-serif text-xl text-primary-900 hover:text-accent-700">{{ g.acronym || g.name }}</NuxtLink>
              <span class="text-xs text-primary-500">{{ g.members }} members</span>
            </header>
            <p v-if="g.cohesion" class="text-[13px] text-primary-700 mt-2">Votes together {{ Math.round(g.cohesion.pct) }}% of the time on contested votes (session {{ g.cohesion.session }}<span v-if="g.cohesion.prev">; {{ Math.round(g.cohesion.prev) }}% before</span>)<span v-if="g.cohesion.apart.length">. Most often apart: {{ g.cohesion.apart.join(', ') }}</span>.</p>
            <ul class="mt-2 space-y-2 text-[13px]">
              <li v-for="m in g.mentions.slice(0, 3)" :key="m.url" class="row"><span class="tag">News</span><span><a :href="m.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ m.title }}</a> <span class="when">{{ m.outlet }}</span></span></li>
              <li v-for="e in g.elections" :key="e.iso3 + e.date" class="row"><span class="tag">Election</span><span>{{ e.country }}: {{ e.type }} · {{ day(e.date) }}</span></li>
            </ul>
            <p v-if="g.membersInNews.length" class="text-[11px] text-primary-400 mt-3">Members most in the news: {{ g.membersInNews.map((m: any) => `${m.name} (${m.n})`).join(', ') }}</p>
          </article>
        </div>
      </section>

      <!-- offices and topics -->
      <div class="grid lg:grid-cols-2 gap-8">
        <section v-if="feed.offices.length">
          <h2 class="h2">UN offices</h2>
          <article v-for="o in feed.offices" :key="o.id" class="card mb-4">
            <header class="flex items-baseline justify-between gap-2"><span class="font-serif text-lg text-primary-900">{{ o.short }}<span v-if="o.holder" class="text-sm text-primary-500"> · {{ o.holder.name }}</span></span><span class="text-xs text-primary-500">{{ o.total }} new</span></header>
            <p v-if="o.note" class="text-[11px] text-accent-700 mt-1">{{ o.note }}</p>
            <ul class="mt-2 space-y-1.5 text-[13px]"><li v-for="s in o.statements" :key="s.url"><a :href="s.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ s.title }}</a> <span class="when">{{ day(s.date) }}</span></li></ul>
          </article>
        </section>
        <section v-if="feed.topics.length">
          <h2 class="h2">Topics</h2>
          <article v-for="t in feed.topics" :key="t.id" class="card mb-4">
            <header class="flex items-baseline justify-between gap-2"><span class="font-serif text-lg text-primary-900">“{{ t.name }}”</span><span class="text-xs text-primary-500">{{ t.total }} items, {{ t.statements }} official</span></header>
            <ul class="mt-2 space-y-1.5 text-[13px]"><li v-for="i in t.items" :key="i.url"><a :href="i.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ i.title }}</a> <span class="when">{{ i.outlet }}</span></li></ul>
          </article>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag, useCountries, useGroups } from '~/composables/useGroups'

useHead({ title: 'My watchlist — World Country Groups' })
const PERIODS = [{ days: 1, label: '24 hours' }, { days: 7, label: '7 days' }, { days: 30, label: '30 days' }]
const days = ref(7)
const bookmarks = useBookmarks()
onMounted(() => { if (!bookmarks.state.value.loaded) bookmarks.fetchBookmarks() })
const { countries } = useCountries()
const { groups } = useGroups()
const { data: feed, pending, refresh } = useFetch<any>('/api/account/watchlist', { query: { days }, server: false })
const { data: digest } = useFetch<any>('/api/account/digest', { server: false })

const countryList = computed(() => ((countries.value as any)?.countries || countries.value || []).filter((c: any) => c.iso2))
const groupList = computed(() => ((groups.value as any)?.groups || groups.value || []) as any[])
const countryName = (iso2: string) => countryList.value.find((c: any) => c.iso2 === iso2)?.name || iso2
const groupName = (gid: string) => { const g = groupList.value.find((x: any) => x.gid === gid); return g ? (g.acronym || g.name) : gid }
const set = computed(() => feed.value?.set || { countries: [], groups: [], offices: [], topics: [] })
const count = computed(() => bookmarks.state.value.bookmarkedCountries.length + bookmarks.state.value.bookmarkedGroups.length + set.value.offices.length + set.value.topics.length)
const empty = computed(() => !!feed.value && count.value === 0)
const digestLabel = computed(() => ({ off: 'off', daily: 'daily', weekly: 'weekly' } as any)[digest.value?.frequency || 'off'] + (digest.value && !digest.value.email ? ' (add an email address on your account page)' : ''))

const cq = ref('')
const gq = ref('')
const tq = ref('')
async function toggle(type: 'country' | 'group', id: string) { await bookmarks.toggleBookmark(type, id); refresh() }
async function addCountry() {
  const c = countryList.value.find((x: any) => x.name.toLowerCase() === cq.value.trim().toLowerCase())
  cq.value = ''
  if (c && !bookmarks.state.value.bookmarkedCountries.includes(c.iso2)) await toggle('country', c.iso2)
}
async function addGroup() {
  const v = gq.value.trim().toLowerCase()
  const g = groupList.value.find((x: any) => (x.acronym ? `${x.acronym} — ${x.name}` : x.name).toLowerCase() === v || (x.acronym || '').toLowerCase() === v || x.name.toLowerCase() === v)
  gq.value = ''
  if (g && !bookmarks.state.value.bookmarkedGroups.includes(g.gid)) await toggle('group', g.gid)
}
async function saveExtras(b: any) { await $fetch('/api/account/watchlist', { method: 'POST', body: b }); refresh() }
function toggleOffice(id: string) { const o = set.value.offices; saveExtras({ offices: o.includes(id) ? o.filter((x: string) => x !== id) : [...o, id] }) }
function addTopic() { if (tq.value.length >= 3) saveExtras({ topics: [...set.value.topics, tq.value] }); tq.value = '' }
function removeTopic(t: string) { saveExtras({ topics: set.value.topics.filter((x: string) => x !== t) }) }
const day = (iso: string) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '')
</script>

<style scoped>
.h2 { @apply font-serif text-2xl text-primary-900 mb-4 pb-2 border-b border-primary-100; }
.card { @apply bg-white rounded-2xl border border-primary-100 p-5 min-w-0; }
.lbl { @apply text-xs font-medium text-primary-500 uppercase tracking-wide mb-2; }
.chip { @apply inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 ring-1 ring-primary-100 text-xs text-primary-700; }
.chip-on { @apply bg-primary-900 text-white ring-primary-900; }
.x { @apply ml-0.5 text-primary-400 hover:text-red-600 text-sm leading-none; }
.inp { @apply w-full text-sm px-3 py-1.5 rounded-lg ring-1 ring-primary-200 focus:ring-primary-400 outline-none; }
.row { @apply flex gap-2 items-baseline; }
.tag { @apply shrink-0 text-[10px] uppercase tracking-wide font-semibold text-primary-500 bg-primary-50 rounded px-1.5 py-0.5 w-[4.6rem] text-center; }
.when { @apply text-[11px] text-primary-400; }
</style>
