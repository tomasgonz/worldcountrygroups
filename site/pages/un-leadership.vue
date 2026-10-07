<template>
  <div class="min-h-screen bg-[#f6f9fc]">
    <header class="border-b border-sky-100 bg-gradient-to-b from-[#e8f4fb] to-[#f6f9fc]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#0077b6] font-semibold">
          <span class="inline-block w-2 h-2 rounded-full bg-[#009edb]" />UN Monitor
        </div>
        <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">UN leadership</h1>
        <p class="text-primary-600 mt-3 max-w-3xl leading-relaxed">
          Who leads the UN's principal organs, departments, and funds and programmes, and what they have said lately.
          Follow one office to see its latest statements below.
        </p>
        <nav class="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Sections">
          <a v-for="(label, id) in d?.groups || {}" :key="id" :href="`#g-${id}`" class="px-3 py-1.5 rounded-full bg-white ring-1 ring-sky-200 text-primary-700 hover:ring-[#009edb] hover:text-[#0077b6]">{{ label }}</a>
          <a href="#feed" class="px-3 py-1.5 rounded-full bg-white ring-1 ring-sky-200 text-primary-700 hover:ring-[#009edb] hover:text-[#0077b6]">Latest statements</a>
        </nav>
      </div>
    </header>

    <div v-if="!d" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10"><div class="skeleton h-96 rounded-2xl" /></div>
    <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <p class="text-xs text-primary-500">
        <template v-if="d.roster">Holders from the UN's leadership team page (copied {{ day(d.roster.pastedAt) }}), with appointments announced since.</template>
        <template v-else>Holders from appointment announcements and public records; the UN's own leadership list has not been loaded yet.</template>
        Updated {{ stamp(d.updatedAt) }}.
      </p>

      <SaidPanel section="leadership" />

      <section v-for="(label, gid) in d.groups" :id="`g-${gid}`" :key="gid" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-2xl text-primary-900">{{ label }}</h2></div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="o in d.offices.filter((x: any) => x.group === gid)" :key="o.id" class="card cursor-pointer transition-shadow" :class="follow === o.id ? 'ring-2 ring-[#009edb]' : 'hover:ring-sky-300'" @click="pick(o.id)">
            <div class="text-[11px] uppercase tracking-wider text-[#0077b6] font-semibold">{{ o.short }}</div>
            <div class="text-xs text-primary-500 leading-snug">{{ o.label }}</div>
            <div class="flex items-center gap-3 mt-3">
              <img v-if="o.holder?.image" :src="relayImage(o.holder.image)" :alt="o.holder.name" class="w-11 h-11 rounded-full object-cover bg-sky-50 shrink-0" loading="lazy" @error="(e: any) => (e.target.hidden = true)">
              <div class="min-w-0">
                <template v-if="o.holder">
                  <NuxtLink v-if="o.holder.slug" :to="`/people/${o.holder.slug}`" class="font-serif text-lg text-primary-900 hover:text-[#0077b6] leading-tight" @click.stop>{{ o.holder.name }}</NuxtLink>
                  <div v-else class="font-serif text-lg text-primary-900 leading-tight">{{ o.holder.name }}</div>
                  <div class="text-xs text-primary-500">
                    <span v-if="o.holder.country">{{ flag(o.holder.country.iso2) }} {{ o.holder.country.name }} · </span>
                    <span v-if="o.holder.since">since {{ day(o.holder.since) }}</span>
                    <span v-else-if="o.holder.listedOn">on the UN list of {{ day(o.holder.listedOn) }}</span>
                  </div>
                </template>
                <div v-else class="text-sm text-primary-400 italic">Holder not confirmed</div>
              </div>
            </div>
            <div v-if="o.holder?.stale" class="mt-2 text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-800">Based on a {{ (o.holder.since || '').slice(0, 4) }} announcement: needs confirmation.</div>
            <div v-if="o.note" class="mt-2 text-[11px] px-2 py-1 rounded bg-sky-50 text-[#0077b6]">{{ o.note }}</div>
            <ul v-if="o.statements.length" class="mt-3 space-y-1.5 border-t border-sky-50 pt-2">
              <li v-for="s in o.statements.slice(0, 2)" :key="s.url" class="text-[13px] leading-snug">
                <a :href="s.url" target="_blank" rel="noopener" class="text-primary-800 hover:text-[#0077b6]" @click.stop>{{ s.title }}</a>
                <span class="text-[11px] text-primary-400"> · {{ day(s.date) }}</span>
              </li>
            </ul>
            <div class="mt-2 text-[11px] text-primary-400">{{ o.statements.length }} items in the last year<span v-if="o.holder"> · source: {{ o.holder.source }}</span></div>
          </div>
        </div>
      </section>

      <section v-if="d.roster?.others?.length" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-2xl text-primary-900">Rest of the leadership team</h2><span class="text-[11px] text-primary-400">{{ d.roster.others.length }} more on the UN's list</span></div>
        <div class="card">
          <input v-model.trim="q" type="search" placeholder="Find a name or post…" class="w-full sm:w-64 text-sm px-3 py-1 rounded-lg ring-1 ring-sky-200 focus:ring-[#009edb] outline-none mb-3">
          <ul class="grid md:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            <li v-for="(e, i) in others" :key="i"><span class="text-primary-900">{{ e.name }}</span> <span class="text-primary-500">— {{ e.title }}</span></li>
          </ul>
        </div>
      </section>

      <section id="feed" class="scroll-mt-24">
        <div class="head"><h2 class="font-serif text-2xl text-primary-900">Latest statements</h2>
          <span class="text-[11px] text-primary-400">{{ followed ? followed.short + ' · ' + (followed.holder?.name || '') : 'All offices' }}</span></div>
        <div class="card">
          <div class="flex flex-wrap gap-1.5 mb-3">
            <button class="pill" :class="!follow ? 'pill-on' : ''" @click="follow = ''">All</button>
            <button v-for="o in d.offices.filter((x: any) => x.statements.length)" :key="o.id" class="pill" :class="follow === o.id ? 'pill-on' : ''" @click="follow = o.id">{{ o.short }}</button>
          </div>
          <ul class="divide-y divide-sky-50">
            <li v-for="s in feed.slice(0, showFeed)" :key="s.url + s.office" class="py-2.5 flex gap-3">
              <span class="text-[11px] text-primary-400 w-20 shrink-0 tabular-nums pt-0.5">{{ day(s.date) }}</span>
              <div class="min-w-0">
                <a :href="s.url" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:text-[#0077b6] leading-snug">{{ s.title }}</a>
                <div class="text-[11px] text-primary-400"><span class="text-[#0077b6]">{{ s.office }}</span> · {{ s.host }}</div>
              </div>
            </li>
          </ul>
          <button v-if="feed.length > showFeed" class="mt-2 text-xs text-[#0077b6] hover:underline" @click="showFeed += 25">Show more</button>
        </div>
      </section>

      <MethodNote>
        <p><strong>Who holds each office.</strong> The UN's own <a href="https://www.un.org/sg/en/leadership-team" target="_blank" rel="noopener">Leadership team</a> page is the reference, but it blocks automated reading, so an editor copies it into the site from time to time (date shown above). Between copies, and for offices it does not list (the Presidents of the General Assembly and ECOSOC), holders come from evidence: the Secretary-General's appointment announcements (collected back to 2017), the General Assembly President's own site, ECOSOC's election announcement and Wikidata. When a newer appointment is announced after the list was copied, the card says so. Holders known only from an announcement more than six years old are marked as needing confirmation; an office with no evidence shows "holder not confirmed" rather than a guess.</p>
        <p><strong>Statements.</strong> Headlines on UN websites (press releases, UN News, departments' and agencies' own sites) that name the office or its holder, as indexed by Google News, over the last year. The Secretary-General's come from the dedicated tracker on the UN Monitor. Headline matching can include items about the office rather than by its holder.</p>
      </MethodNote>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'
import { relayImage } from '~/utils/relayImage'

useHead({ title: 'UN leadership — World Country Groups' })
const route = useRoute()
const router = useRouter()
const { data: d } = useFetch<any>('/api/un/leadership', { lazy: true, server: false })
const follow = ref(String(route.query.office || ''))
watch(follow, v => router.replace({ query: v ? { office: v } : {} }))
const q = ref('')
const showFeed = ref(25)
const followed = computed(() => (d.value?.offices || []).find((o: any) => o.id === follow.value))
const feed = computed(() => {
  const list = (d.value?.offices || []).filter((o: any) => !follow.value || o.id === follow.value)
    .flatMap((o: any) => o.statements.map((s: any) => ({ ...s, office: o.short })))
  const seen = new Set<string>()
  return list.sort((a: any, b: any) => b.date.localeCompare(a.date)).filter((s: any) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
})
const others = computed(() => (d.value?.roster?.others || []).filter((e: any) => !q.value || `${e.name} ${e.title}`.toLowerCase().includes(q.value.toLowerCase())))
function pick(id: string) {
  follow.value = follow.value === id ? '' : id
  showFeed.value = 25
  if (follow.value) nextTick(() => document.getElementById('feed')?.scrollIntoView({ behavior: 'smooth' }))
}
const flag = (iso2: string | null) => (iso2 ? isoToFlag(iso2) : '')
const day = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '–')
const stamp = (iso: string) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
</script>

<style scoped>
.head { @apply flex flex-wrap items-end justify-between gap-2 mb-4 pb-2 border-b-2 border-[#009edb]/30; }
.card { @apply bg-white rounded-2xl ring-1 ring-sky-100 p-5 min-w-0; }
.pill { @apply text-xs px-2.5 py-1 rounded-full ring-1 ring-sky-200 text-primary-700 hover:ring-[#009edb]; }
.pill-on { @apply bg-[#0077b6] text-white ring-[#0077b6]; }
</style>
