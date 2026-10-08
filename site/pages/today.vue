<template>
  <div class="today max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <!-- ======================= Masthead ======================= -->
    <header class="mb-6 sm:mb-8">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-primary-500">
        <span>{{ dateLabel || '—' }}</span>
        <span class="text-primary-300" aria-hidden="true">/</span>
        <span class="tabular-nums">New York {{ nyClock }}</span>
        <span
          v-if="agenda?.freshness"
          class="normal-case tracking-normal inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px]"
          :class="staleFeeds.length ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'"
          :title="agenda.freshness.map((f: any) => `${f.label}: ${f.updated ? timeAgo(f.updated) : 'n/a'}`).join('\n')"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="staleFeeds.length ? 'bg-amber-500' : 'bg-emerald-500'" />
          {{ staleFeeds.length ? `${staleFeeds.join(', ')} not updated in over a day` : 'All sources current' }}
        </span>
      </div>
      <h1 class="font-serif text-4xl sm:text-5xl text-primary-900 mt-2 leading-[1.05]">Today at the UN <span class="text-primary-400">&amp; in the world</span></h1>
    </header>

    <!-- ======================= Summary strip ======================= -->
    <div v-if="agenda?.stats" class="grid grid-cols-2 md:grid-cols-4 gap-px bg-primary-200/70 rounded-2xl overflow-hidden ring-1 ring-primary-200/70 mb-6 sm:mb-8">
      <div v-for="s in statTiles" :key="s.label" class="bg-white px-4 py-3.5 sm:px-5 sm:py-4">
        <div class="font-serif text-3xl text-primary-900 tabular-nums leading-none">{{ s.value }}</div>
        <div class="text-xs text-primary-500 mt-1.5">{{ s.label }}</div>
        <div v-if="s.sub" class="text-[11px] mt-0.5" :class="s.subClass || 'text-primary-400'">{{ s.sub }}</div>
      </div>
    </div>

    <!-- ======================= Story of the day ======================= -->
    <section v-if="data?.briefing?.headline" class="relative rounded-2xl bg-primary-900 text-white px-6 py-6 sm:px-8 sm:py-7 mb-8 overflow-hidden">
      <div class="absolute inset-y-0 left-0 w-1.5 bg-accent-500" aria-hidden="true" />
      <div class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-primary-300 mb-3">
        <span>Story of the day</span>
        <span class="normal-case tracking-normal rounded-full bg-white/10 px-2 py-0.5">AI brief &middot; {{ timeAgo(data.generatedAt) }}</span>
        <span v-if="data.refreshing" class="normal-case tracking-normal text-primary-400">updating&hellip;</span>
      </div>
      <p class="font-serif text-2xl sm:text-[1.9rem] leading-snug text-white max-w-4xl" v-html="inline(data.briefing.headline)" />
    </section>
    <div v-else-if="pending" class="rounded-2xl bg-primary-900 px-8 py-8 mb-8">
      <div class="h-3 w-40 bg-primary-700 rounded-full animate-pulse mb-4" />
      <div class="h-6 w-full bg-primary-700 rounded-full animate-pulse mb-2" />
      <div class="h-6 w-3/4 bg-primary-700 rounded-full animate-pulse" />
    </div>

    <!-- ======================= Main grid ======================= -->
    <div class="grid lg:grid-cols-12 gap-8">
      <!-- ---------- Sidebar: live agenda + Council (first on mobile) ---------- -->
      <aside class="lg:col-span-4 lg:order-2 space-y-6">
        <div class="lg:sticky lg:top-24 space-y-6">
          <!-- Agenda timeline -->
          <section v-if="agenda" class="bg-white rounded-2xl ring-1 ring-primary-200/70 overflow-hidden">
            <div class="px-5 pt-5 pb-3 border-b border-primary-100">
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-serif text-2xl text-primary-900">On the agenda</h2>
                <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist" aria-label="Day">
                  <button v-for="d in (['today', 'tomorrow'] as const)" :key="d" role="tab" :aria-selected="agendaDay === d"
                    class="px-3 py-1 rounded-full transition-colors"
                    :class="agendaDay === d ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-800'"
                    @click="agendaDay = d">{{ d === 'today' ? 'Today' : 'Tomorrow' }}</button>
                </div>
              </div>
              <div v-if="bodies.length > 1" class="flex flex-wrap gap-1.5 mt-3">
                <button class="chip" :class="!bodyFilter ? 'chip-on' : ''" @click="bodyFilter = null">All</button>
                <button v-for="b in bodies" :key="b" class="chip" :class="bodyFilter === b ? 'chip-on' : ''" @click="bodyFilter = bodyFilter === b ? null : b">
                  <span class="w-1.5 h-1.5 rounded-full" :class="bodyStyle(b).dot" />{{ shortBody(b) }}
                </button>
              </div>
            </div>

            <button v-if="earlierCount && agendaDay === 'today'" class="w-full px-5 pt-3 text-left text-xs text-accent-600 hover:text-accent-700" @click="showEarlier = !showEarlier">
              {{ showEarlier ? 'Hide' : 'Show' }} {{ earlierCount }} earlier {{ earlierCount === 1 ? 'meeting' : 'meetings' }}
            </button>
            <ol v-if="timeline.length" class="px-5 py-3 max-h-[34rem] overflow-y-auto">
              <template v-for="it in visibleTimeline" :key="it.start + it.title">
                <li v-if="it.isNowMarker" class="flex items-center gap-2 py-2" aria-label="Current time">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-red-600 w-14 shrink-0">Now</span>
                  <span class="flex-1 h-px bg-red-300" />
                </li>
                <li v-if="it.isNowMarker && !nextUp" class="pb-2 pl-[4.25rem] text-xs text-primary-400">
                  Nothing else scheduled today.
                  <button v-if="agenda?.schedule?.tomorrowCount" class="text-accent-600 hover:text-accent-700" @click="agendaDay = 'tomorrow'">See tomorrow ({{ agenda.schedule.tomorrowCount }})</button>
                </li>
                <li v-else class="relative flex gap-3 py-2" :class="it.state === 'past' ? 'opacity-55' : ''">
                  <span class="w-14 shrink-0 text-xs tabular-nums text-primary-500 pt-0.5">{{ it.time }}</span>
                  <span class="relative mt-1.5 shrink-0">
                    <span class="block w-2 h-2 rounded-full" :class="bodyStyle(it.body).dot" />
                    <span v-if="it.state === 'live'" class="absolute inset-0 rounded-full animate-ping" :class="bodyStyle(it.body).dot" />
                  </span>
                  <div class="min-w-0">
                    <a :href="it.url" target="_blank" rel="noopener" class="text-sm text-primary-800 hover:text-accent-700 leading-snug">{{ cleanTitle(it.title) }}</a>
                    <div class="text-[11px] text-primary-400 mt-0.5">
                      {{ it.body }}<span v-if="it.state === 'live'" class="ml-1.5 font-semibold text-red-600">&bull; Live on UN Web TV</span>
                    </div>
                  </div>
                </li>
              </template>
            </ol>
            <p v-else class="px-5 py-6 text-sm text-primary-400">No meetings published for {{ agendaDay }} yet. The UN Web TV schedule is checked every few hours.</p>
            <p class="px-5 pb-4 text-[11px] text-primary-400">New York time &middot; source: UN Web TV schedule</p>
          </section>

          <!-- From the UN Monitor -->
          <section v-if="agenda?.securityCouncil" class="rounded-2xl ring-1 ring-sky-200 bg-[#f2f8fc] p-5">
            <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#0077b6] font-semibold">
              <span class="w-2 h-2 rounded-full bg-[#009edb]" />From the UN Monitor
            </div>
            <div v-if="agenda.securityCouncil.lastDecision" class="mt-3 text-sm">
              <div class="text-[11px] text-primary-500">Latest Security Council decision · {{ shortDate(agenda.securityCouncil.lastDecision.date) }}</div>
              <div class="text-primary-900 leading-snug mt-0.5">{{ agenda.securityCouncil.lastDecision.title }}</div>
              <span class="inline-block mt-1 text-[11px] rounded-md px-1.5 py-0.5" :class="agenda.securityCouncil.lastDecision.adopted ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'">
                {{ agenda.securityCouncil.lastDecision.adopted ? 'Adopted' : agenda.securityCouncil.lastDecision.vetoed ? 'Vetoed' : 'Not adopted' }}
                {{ agenda.securityCouncil.lastDecision.tally ? `${agenda.securityCouncil.lastDecision.tally.yes}-${agenda.securityCouncil.lastDecision.tally.no}-${agenda.securityCouncil.lastDecision.tally.abstain}` : '' }}
              </span>
            </div>
            <p class="text-xs text-primary-500 mt-3">Council composition and presidency, every decision and veto, General Assembly votes, and the wider UN system.</p>
            <NuxtLink to="/un" class="inline-block mt-3 text-sm font-medium text-[#0077b6] hover:underline">Open the UN Monitor &rarr;</NuxtLink>
          </section>
        </div>
      </aside>

      <!-- ---------- Main column: AI brief ---------- -->
      <main class="lg:col-span-8 lg:order-1 min-w-0">
        <div v-if="isAdmin" class="mb-4 flex items-center gap-3">
          <button class="text-xs px-3 py-1.5 rounded-lg ring-1 ring-primary-200 text-primary-600 hover:bg-primary-50 disabled:opacity-50" :disabled="regenerating" @click="regenerate">
            {{ regenerating ? 'Writing a new brief…' : 'Regenerate brief' }}
          </button>
          <span v-if="adminMsg" class="text-xs" :class="adminMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-700'">{{ adminMsg }}</span>
        </div>

        <div v-if="pending" class="space-y-4">
          <div v-for="i in 3" :key="i" class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 space-y-3">
            <div class="h-4 w-32 bg-primary-100 rounded-full animate-pulse" />
            <div class="h-3 w-full bg-primary-100 rounded-full animate-pulse" />
            <div class="h-3 w-11/12 bg-primary-100 rounded-full animate-pulse" />
          </div>
        </div>

        <template v-else-if="data?.briefing">
          <VizHighlightLegend class="mb-3 px-1" />
          <article class="bg-white rounded-2xl ring-1 ring-primary-200/70 divide-y divide-primary-100">
            <section v-for="sec in briefSections" :key="sec.key" class="px-6 py-6 sm:px-8 sm:py-7">
              <div class="flex items-baseline gap-3 mb-4">
                <span class="text-[11px] font-semibold uppercase tracking-[0.14em]" :class="sec.accent">{{ sec.kicker }}</span>
                <span class="flex-1 h-px bg-primary-100" />
              </div>
              <h2 class="font-serif text-3xl text-primary-900 mb-4">{{ sec.title }}</h2>
              <p v-if="sec.note" class="text-xs text-primary-400 -mt-2 mb-4">{{ sec.note }}</p>
              <div class="brief prose prose-primary max-w-none" v-html="md(sec.body)" />
            </section>
          </article>

          <!-- Primary sources -->
          <section class="mt-8 bg-white rounded-2xl ring-1 ring-primary-200/70">
            <div class="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3 border-b border-primary-100">
              <h2 class="font-serif text-2xl text-primary-900">Sources behind the brief</h2>
              <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist">
                <button v-for="t in sourceTabs" :key="t.key" role="tab" :aria-selected="sourceTab === t.key"
                  class="px-3 py-1 rounded-full transition-colors"
                  :class="sourceTab === t.key ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-800'"
                  @click="sourceTab = t.key">{{ t.label }} <span class="tabular-nums text-primary-400">{{ t.count }}</span></button>
              </div>
            </div>
            <ul class="divide-y divide-primary-50">
              <li v-for="item in sourceItems" :key="item.id" class="px-6 py-3 flex gap-3">
                <span class="w-12 shrink-0 text-[11px] text-primary-400 tabular-nums pt-0.5">{{ timeAgo(item.publishedAt) }}</span>
                <div class="min-w-0">
                  <a :href="item.url" target="_blank" rel="noopener" class="text-sm text-primary-800 hover:text-accent-700 leading-snug">{{ cleanTitle(item.title) }}</a>
                  <div class="text-[11px] text-primary-400 mt-0.5 flex flex-wrap gap-x-2">
                    <span>{{ sourceName(item.source) }}</span>
                    <span v-if="item.sourceOwnership" class="text-amber-700">{{ item.sourceOwnership }}</span>
                    <span v-if="item.countries?.length">{{ item.countries.slice(0, 4).map(flagFor).join(' ') }}</span>
                  </div>
                </div>
              </li>
              <li v-if="!sourceItems.length" class="px-6 py-6 text-sm text-primary-400">Nothing dated today (New York) yet.</li>
            </ul>
            <button v-if="sourceAll.length > sourceLimit" class="w-full py-3 text-xs text-accent-600 hover:text-accent-700 border-t border-primary-100" @click="sourceLimit += 15">
              Show more ({{ sourceAll.length - sourceLimit }} left)
            </button>
          </section>

          <p v-if="data.generatedAt" class="mt-4 text-[11px] text-primary-400 text-right">
            AI brief generated {{ timeAgo(data.generatedAt) }} by {{ data.provider }} {{ data.model }}. Refreshed every few hours; check citations before relying on it.
          </p>
        </template>

        <div v-else class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-8 text-sm text-primary-500">
          The AI brief is unavailable right now. The agenda and Security Council record on this page are still current.
        </div>
      </main>
    </div>

    <!-- ======================= The week ahead ======================= -->
    <div v-if="agenda?.journal || agenda?.elections" class="grid lg:grid-cols-12 gap-8 mt-10">
      <!-- ---------- This week at the UN (Journal of the United Nations) ---------- -->
      <section v-if="agenda?.journal" class="lg:col-span-8 min-w-0 bg-white rounded-2xl ring-1 ring-primary-200/70 overflow-hidden" aria-labelledby="week-at-un">
        <div class="px-5 sm:px-6 pt-5 pb-3 border-b border-primary-100">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-700">Upcoming</div>
              <h2 id="week-at-un" class="font-serif text-2xl sm:text-3xl text-primary-900">This week at the UN</h2>
            </div>
            <div class="flex rounded-full bg-primary-100 p-0.5 text-xs" role="tablist" aria-label="Duty station">
              <button v-for="l in journalLocations" :key="l.key" role="tab" :aria-selected="journalLoc === l.key"
                class="px-3 py-1 rounded-full transition-colors"
                :class="journalLoc === l.key ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-800'"
                @click="journalLoc = l.key">{{ l.label }} <span class="tabular-nums text-primary-400">{{ l.count }}</span></button>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 mt-3">
            <button class="chip" :class="!journalGroup ? 'chip-on' : ''" @click="journalGroup = null">All bodies</button>
            <button v-for="g in journalGroups" :key="g" class="chip" :class="journalGroup === g ? 'chip-on' : ''" @click="journalGroup = journalGroup === g ? null : g">
              <span class="w-1.5 h-1.5 rounded-full" :class="bodyStyle(g).dot" />{{ shortBody(g) }}
            </button>
            <label class="ml-auto inline-flex items-center gap-1.5 text-[11px] text-primary-500 cursor-pointer select-none">
              <input v-model="journalPublicOnly" type="checkbox" class="rounded border-primary-300 text-accent-600 focus:ring-accent-500 h-3.5 w-3.5">
              Public meetings only
            </label>
          </div>
        </div>

        <div v-if="journalDaysShown.length" class="divide-y divide-primary-100">
          <div v-for="day in journalDaysShown" :key="day.location + day.date" class="px-5 sm:px-6 py-4">
            <div class="flex items-baseline gap-3 mb-2">
              <h3 class="font-serif text-lg text-primary-900">{{ journalDayLabel(day.date) }}</h3>
              <span class="text-[11px] text-primary-400 tabular-nums">{{ day.meetings.length }} {{ day.meetings.length === 1 ? 'meeting' : 'meetings' }}</span>
              <a v-if="day.journalUrl" :href="day.journalUrl" target="_blank" rel="noopener" class="ml-auto text-[11px] text-accent-600 hover:text-accent-700">Journal &#8599;</a>
            </div>
            <ol class="space-y-1">
              <li v-for="m in day.meetings" :key="m.id" class="flex gap-3 py-1.5" :class="m.cancelled || isMeetingOver(m) ? 'opacity-55' : ''">
                <span class="w-14 shrink-0 text-xs tabular-nums text-primary-500 pt-0.5">{{ m.followed_by ? 'then' : (m.time || '—') }}</span>
                <span class="mt-1.5 w-2 h-2 rounded-full shrink-0" :class="bodyStyle(m.group || '').dot" />
                <div class="min-w-0 flex-1">
                  <div class="text-sm leading-snug">
                    <span class="font-medium text-primary-900">{{ m.organ }}</span>
                    <span v-if="m.title" class="text-primary-600"> &middot; {{ m.title }}</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-primary-400 mt-0.5">
                    <span v-if="m.room">{{ m.room }}</span>
                    <span v-if="m.cancelled" class="rounded px-1.5 bg-red-50 text-red-700 ring-1 ring-red-200">Cancelled</span>
                    <span v-else-if="m.closed" class="rounded px-1.5 bg-primary-50 text-primary-500 ring-1 ring-primary-200">Closed</span>
                    <span v-else class="rounded px-1.5 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Public</span>
                    <a v-if="m.webcast_url" :href="m.webcast_url" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700">Webcast &#8599;</a>
                    <a v-if="m.journal_url" :href="m.journal_url" target="_blank" rel="noopener" class="hover:text-accent-700">Details &#8599;</a>
                    <button v-if="m.agenda?.length" class="text-primary-500 hover:text-primary-800" :aria-expanded="!!openAgenda[m.id]" @click="openAgenda[m.id] = !openAgenda[m.id]">
                      {{ openAgenda[m.id] ? 'Hide agenda' : `Agenda (${m.agenda.length})` }}
                    </button>
                  </div>
                  <ul v-if="openAgenda[m.id] && m.agenda?.length" class="mt-1.5 pl-3 border-l-2 border-primary-100 space-y-0.5">
                    <li v-for="(a, i) in m.agenda" :key="i" class="text-xs text-primary-600 leading-snug">{{ a }}</li>
                  </ul>
                </div>
              </li>
            </ol>
          </div>
        </div>
        <p v-else class="px-6 py-6 text-sm text-primary-400">No official meetings published in the Journal for the coming days{{ journalGroup ? ` for ${journalGroup}` : '' }}.</p>
        <button v-if="journalDaysAll.length > journalDayLimit" class="w-full py-3 text-xs text-accent-600 hover:text-accent-700 border-t border-primary-100" @click="journalDayLimit += 3">
          Show more days ({{ journalDaysAll.length - journalDayLimit }} left)
        </button>
        <p class="px-5 sm:px-6 py-3 text-[11px] text-primary-400 border-t border-primary-100">
          {{ journalLoc === 'geneva' ? 'Geneva' : 'New York' }} local time &middot; source:
          <a :href="agenda.journal.sourceUrl" target="_blank" rel="noopener" class="hover:text-accent-700">Journal of the United Nations</a>,
          official meetings<span v-if="agenda.journal.updated"> &middot; updated {{ timeAgo(agenda.journal.updated) }}</span>.
          Later days are provisional; Security Council meetings are usually announced a day ahead.
        </p>
      </section>

      <!-- ---------- Upcoming elections ---------- -->
      <section v-if="agenda?.elections" class="lg:col-span-4 min-w-0 bg-white rounded-2xl ring-1 ring-primary-200/70 overflow-hidden" aria-labelledby="upcoming-elections">
        <div class="px-5 pt-5 pb-3 border-b border-primary-100">
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Next 60 days</div>
          <div class="flex items-baseline justify-between gap-2">
            <h2 id="upcoming-elections" class="font-serif text-2xl text-primary-900">Upcoming elections</h2>
            <NuxtLink to="/elections" class="text-xs text-accent-600 hover:underline whitespace-nowrap">All elections &rarr;</NuxtLink>
          </div>
        </div>
        <ul v-if="agenda.elections.upcoming?.length" class="divide-y divide-primary-50">
          <li v-for="e in agenda.elections.upcoming" :key="e.id" class="px-5 py-3 flex gap-3">
            <div class="w-12 shrink-0 text-center">
              <div class="text-[10px] uppercase tracking-wider text-primary-400">{{ electionMonth(e) }}</div>
              <div class="font-serif text-xl leading-none text-primary-900 tabular-nums">{{ e.precision === 'day' ? Number(e.date.slice(8, 10)) : '—' }}</div>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm text-primary-900 leading-snug">
                <span v-if="e.iso3" class="mr-1">{{ flagFor(e.iso3) }}</span>
                <NuxtLink v-if="e.iso3" :to="`/countries/${e.iso3}`" class="font-medium hover:text-accent-700">{{ e.country }}</NuxtLink>
                <span v-else class="font-medium">{{ e.country }}</span>
              </div>
              <div class="text-xs text-primary-600 leading-snug mt-0.5">
                <a v-if="e.article_url" :href="e.article_url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ e.description || 'Election' }}</a>
                <span v-else>{{ e.description || 'Election' }}</span>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                <span class="rounded px-1.5 py-px ring-1" :class="electionTypeClass(e.type)">{{ electionTypeLabel(e.type) }}</span>
                <span v-if="e.indirect" class="rounded px-1.5 py-px ring-1 ring-primary-200 text-primary-500">indirect</span>
                <span class="text-primary-400">{{ electionWhen(e) }}</span>
              </div>
            </div>
          </li>
        </ul>
        <p v-else class="px-5 py-6 text-sm text-primary-400">No national elections scheduled in the next 60 days.</p>
        <div v-if="agenda.elections.recent?.length" class="px-5 py-3 border-t border-primary-100">
          <div class="text-[11px] uppercase tracking-[0.14em] text-primary-400 mb-1.5">Recently held</div>
          <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-primary-600">
            <span v-for="e in agenda.elections.recent" :key="e.id">
              {{ e.iso3 ? flagFor(e.iso3) : '' }} {{ e.country }} <span class="text-primary-400">{{ electionShortDate(e) }}</span>
            </span>
          </div>
        </div>
        <p class="px-5 py-3 text-[11px] text-primary-400 border-t border-primary-100">
          National elections and referendums.
          <template v-for="(p, i) in agenda.elections.pages" :key="p.url">{{ i ? ', ' : 'From ' }}<a :href="p.url" target="_blank" rel="noopener" class="hover:text-accent-700">{{ p.title }}</a></template>.
          Source: Wikipedia, <a :href="agenda.elections.licenseUrl" target="_blank" rel="noopener" class="hover:text-accent-700">CC BY-SA</a>.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import { isoToFlag } from '~/composables/useGroups'

useHead({ title: 'Today at the UN — World Country Groups' })

const auth = useAuth()
const isAdmin = computed(() => auth.state.value.role === 'admin')

const { data, pending, refresh } = useAsyncData('today-brief', () => $fetch<any>('/api/today/briefing').catch(() => null))
const { data: agenda } = useAsyncData('today-agenda', () => $fetch<any>('/api/today/agenda').catch(() => null))
const { countries } = useCountries()

const { highlight } = useBriefHighlight()

// ---------- clock (ticks client-side so "Now" and live markers stay right) ----------
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 30_000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
const nyClock = computed(() => new Date(now.value).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }))
const dateLabel = computed(() => data.value?.dateLabel
  || new Date(now.value).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))

// ---------- freshness ----------
const staleFeeds = computed(() => (agenda.value?.freshness || [])
  .filter((f: any) => !f.updated || now.value - new Date(f.updated).getTime() > 26 * 3600 * 1000)
  .map((f: any) => f.label))

// ---------- summary strip ----------
const statTiles = computed(() => {
  const s = agenda.value?.stats
  if (!s) return []
  const live = timeline.value.filter((i: any) => i.state === 'live').length
  return [
    { label: 'UN meetings today', value: s.meetingsToday, sub: live ? `${live} in progress` : (nextUp.value ? `Next ${nextUp.value.time}` : ''), subClass: live ? 'text-red-600 font-medium' : '' },
    { label: 'Council resolutions this year', value: s.scResolutionsThisYear, sub: s.scVetoesThisYear ? `${s.scVetoesThisYear} vetoed draft${s.scVetoesThisYear > 1 ? 's' : ''}` : '', subClass: 'text-red-600' },
    { label: 'Official statements today', value: s.statementsToday },
    { label: 'News items today', value: s.newsToday },
  ]
})

// ---------- agenda timeline ----------
const agendaDay = ref<'today' | 'tomorrow'>('today')
const bodyFilter = ref<string | null>(null)
const showEarlier = ref(false)
watch(agendaDay, () => { bodyFilter.value = null; showEarlier.value = false })

const dayItems = computed<any[]>(() => (agenda.value?.schedule?.[agendaDay.value] || []).flatMap((g: any) => g.items))
const bodies = computed(() => [...new Set(dayItems.value.map(i => i.body))])
const LIVE_MS = 2 * 3600 * 1000

const timeline = computed(() => {
  const items = dayItems.value
    .filter(i => !bodyFilter.value || i.body === bodyFilter.value)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((i) => {
      const t = new Date(i.start).getTime()
      const state = agendaDay.value === 'tomorrow' ? 'future' : t > now.value ? 'future' : now.value - t < LIVE_MS ? 'live' : 'past'
      return { ...i, state }
    })
  if (agendaDay.value !== 'today' || !items.length) return items
  // insert a "Now" marker before the first item that hasn't started
  const idx = items.findIndex(i => i.state === 'future')
  const marker = { isNowMarker: true, start: 'now', title: '' }
  if (idx === -1) return [...items, marker]
  return [...items.slice(0, idx), marker, ...items.slice(idx)]
})
const earlierCount = computed(() => timeline.value.filter((i: any) => i.state === 'past').length)
const visibleTimeline = computed(() => (showEarlier.value ? timeline.value : timeline.value.filter((i: any) => i.state !== 'past')))
const nextUp = computed(() => timeline.value.find((i: any) => i.state === 'future'))

const BODY_STYLES: Record<string, { dot: string; short: string }> = {
  'General Assembly': { dot: 'bg-accent-600', short: 'GA' },
  'Security Council': { dot: 'bg-red-500', short: 'Security Council' },
  'Human Rights Council': { dot: 'bg-amber-500', short: 'Human Rights' },
  'Economic and Social Council': { dot: 'bg-emerald-500', short: 'ECOSOC' },
  'Conferences': { dot: 'bg-violet-500', short: 'Conferences' },
  'Press Conferences': { dot: 'bg-primary-400', short: 'Press' },
  'Media Stakeouts': { dot: 'bg-primary-400', short: 'Stakeouts' },
  'Human Rights Treaty Bodies': { dot: 'bg-amber-300', short: 'Treaty bodies' },
  'Other bodies': { dot: 'bg-primary-300', short: 'Other bodies' },
}
const bodyStyle = (b: string) => BODY_STYLES[b] || { dot: 'bg-primary-300', short: b }
const shortBody = (b: string) => bodyStyle(b).short

// Web TV titles repeat the body name ("… - General Assembly, 81st session"); trim it in the list
function cleanTitle(t: string): string {
  return (t || '').replace(/\s*-\s*(General Assembly|Security Council),\s*\d+(st|nd|rd|th) (session|meeting)\s*$/i, '').trim()
}

// ---------- the week ahead: UN Journal ----------
type JournalLoc = 'newYork' | 'geneva'
const JOURNAL_TZ: Record<JournalLoc, string> = { newYork: 'America/New_York', geneva: 'Europe/Zurich' }
const JOURNAL_GROUP_ORDER = ['General Assembly', 'Security Council', 'Economic and Social Council', 'Human Rights Council', 'Human Rights Treaty Bodies', 'Other bodies']
const journalLoc = ref<JournalLoc>('newYork')
const journalGroup = ref<string | null>(null)
const journalPublicOnly = ref(false)
const journalDayLimit = ref(3)
const openAgenda = reactive<Record<string, boolean>>({})
watch(journalLoc, () => { journalGroup.value = null; journalDayLimit.value = 3 })

const countMeetings = (days: any[] | undefined): number => (days || []).reduce((n: number, d: any) => n + (d.meetings?.length || 0), 0)
const journalLocations = computed(() => [
  { key: 'newYork' as const, label: 'New York', count: countMeetings(agenda.value?.journal?.newYork) },
  { key: 'geneva' as const, label: 'Geneva', count: countMeetings(agenda.value?.journal?.geneva) },
])
const journalRaw = computed<any[]>(() => agenda.value?.journal?.[journalLoc.value] || [])
const groupOf = (m: any): string => m.group || 'Other bodies'
const journalGroups = computed(() => {
  const set = new Set<string>(journalRaw.value.flatMap((d: any) => (d.meetings || []).map(groupOf)))
  const rank = (g: string) => { const i = JOURNAL_GROUP_ORDER.indexOf(g); return i === -1 ? 99 : i }
  return [...set].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
})
const journalDaysAll = computed<any[]>(() => journalRaw.value
  .map((d: any) => ({
    ...d,
    meetings: (d.meetings || []).filter((m: any) =>
      (!journalGroup.value || groupOf(m) === journalGroup.value) && (!journalPublicOnly.value || !m.closed)),
  }))
  .filter((d: any) => d.meetings.length))
const journalDaysShown = computed(() => journalDaysAll.value.slice(0, journalDayLimit.value))

function localDayKey(tz: string, offsetDays = 0): string {
  return new Date(now.value + offsetDays * 24 * 3600 * 1000).toLocaleDateString('en-CA', { timeZone: tz })
}
function journalDayLabel(date: string): string {
  const tz = JOURNAL_TZ[journalLoc.value]
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })
  if (date === localDayKey(tz)) return `Today, ${label}`
  if (date === localDayKey(tz, 1)) return `Tomorrow, ${label}`
  return label
}
function isMeetingOver(m: any): boolean {
  if (m.end) return new Date(m.end).getTime() < now.value
  if (m.start) return new Date(m.start).getTime() + 3 * 3600 * 1000 < now.value
  return false
}

// ---------- upcoming elections ----------
const nyTodayKey = computed(() => localDayKey('America/New_York'))
function electionMonth(e: any): string {
  const [y, m] = String(e.date || '').split('-').map(Number)
  if (!y || !m) return String(e.date || '')
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}
function electionWhen(e: any): string {
  if (e.precision !== 'day') return 'date to be confirmed'
  const days = Math.round((new Date(`${e.date}T12:00:00Z`).getTime() - new Date(`${nyTodayKey.value}T12:00:00Z`).getTime()) / 86400000)
  if (days < 0 && e.date_end && e.date_end >= nyTodayKey.value) return 'under way'
  const span = e.date_end ? `, until ${shortDate(e.date_end)}` : ''
  if (days === 0) return `today${span}`
  if (days === 1) return `tomorrow${span}`
  return `in ${days} days${span}`
}
function electionShortDate(e: any): string {
  return e.precision === 'day' ? shortDate(e.date) : electionMonth(e)
}
const ELECTION_TYPES: Record<string, { label: string; cls: string }> = {
  general: { label: 'General', cls: 'ring-violet-200 text-violet-700 bg-violet-50' },
  presidential: { label: 'Presidential', cls: 'ring-accent-200 text-accent-700 bg-accent-50' },
  parliamentary: { label: 'Parliamentary', cls: 'ring-sky-200 text-sky-700 bg-sky-50' },
  referendum: { label: 'Referendum', cls: 'ring-amber-200 text-amber-800 bg-amber-50' },
  local: { label: 'Local', cls: 'ring-primary-200 text-primary-600 bg-primary-50' },
  executive: { label: 'Executive', cls: 'ring-primary-200 text-primary-600 bg-primary-50' },
}
const electionTypeLabel = (t: string) => ELECTION_TYPES[t]?.label || 'Election'
const electionTypeClass = (t: string) => ELECTION_TYPES[t]?.cls || 'ring-primary-200 text-primary-600 bg-primary-50'

// ---------- Security Council ----------
function shortDate(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function outcomeLabel(o: string) {
  if (/vetoed by/i.test(o)) return o.replace(/^Draft resolution\s*/i, 'Draft ').replace(/\s+(\d+-\d+-\d+)$/, ' ($1)')
  if (/not adopted/i.test(o)) return o.replace(/^Draft resolution\s*/i, 'Draft ')
  if (/S\/PRST/.test(o)) return `Presidential statement ${o.match(/S\/PRST\/\d+\/\d+/)?.[0]}`
  const m = o.match(/S\/RES\/(\d+)\s*\((\d{4})\)\s*(\d+-\d+-\d+)/)
  return m ? `Resolution ${m[1]} adopted ${m[3]}` : o
}
function outcomeClass(o: string) {
  if (/veto/i.test(o)) return 'bg-red-50 text-red-700 ring-1 ring-red-200'
  if (/not adopted/i.test(o)) return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
  return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
}

// ---------- AI brief ----------
const briefSections = computed(() => {
  const b = data.value?.briefing || {}
  return [
    { key: 'un', kicker: 'At the UN', accent: 'text-accent-700', title: 'What the UN is doing', body: b.atTheUN },
    { key: 'world', kicker: 'In the world', accent: 'text-emerald-700', title: 'Beyond the building', body: b.inTheWorld },
    { key: 'watch', kicker: 'Watch list', accent: 'text-amber-700', title: 'What to watch', body: b.watchList },
    { key: 'arc', kicker: 'This week', accent: 'text-primary-500', title: 'How today fits the week', body: b.weekArc, note: data.value?.weekRange ? `${data.value.weekRange.startKey} to ${data.value.weekRange.endKey}` : '' },
  ].filter(s => s.body)
})

const citations = computed<Record<string, { id: string; title: string; url: string; source: string }>>(() => data.value?.citations || {})

function renderCitations(text: string): string {
  if (!text) return ''
  return text.replace(/\[((?:[ns]\d+)(?:\s*,\s*[ns]\d+)*)\]/g, (_m, ids: string) => {
    const links = ids.split(',').map((s: string) => s.trim()).map((id: string) => {
      const c = citations.value[id]
      if (!c) return ''
      const title = escapeHtml(`${c.title} — ${c.source}`)
      return `<a href="${safeUrl(c.url)}" target="_blank" rel="noopener" title="${title}" class="cite-link">${escapeHtml(id.replace(/^[ns]/, ''))}</a>`
    }).filter(Boolean)
    return links.length ? `<sup class="cite">${links.join('')}</sup>` : ''
  })
}
// The brief uses "- Peace & security:" bullets as group labels; render them as subheadings
function promoteLabels(text: string): string {
  return text.replace(/^[-*]\s+\**([^\n]{2,60}?)\**:\s*$/gm, '#### $1')
    .replace(/^ {2,4}([-*] )/gm, '$1')
}
const md = (s: string) => (s ? (marked.parse(renderCitations(highlight(promoteLabels(s)))) as string) : '')
// the headline stays plain: highlights are too heavy at display size
const inline = (s: string) => (s ? (marked.parseInline(renderCitations(s)) as string) : '')

// ---------- sources ----------
const sourceTab = ref<'news' | 'statements'>('statements')
const sourceLimit = ref(12)
watch(sourceTab, () => { sourceLimit.value = 12 })
const sourceTabs = computed(() => [
  { key: 'statements' as const, label: 'Official statements', count: data.value?.evidence?.todayStatements?.length || 0 },
  { key: 'news' as const, label: 'News', count: data.value?.evidence?.todayNews?.length || 0 },
])
const sourceAll = computed<any[]>(() => (sourceTab.value === 'news' ? data.value?.evidence?.todayNews : data.value?.evidence?.todayStatements) || [])
const sourceItems = computed(() => sourceAll.value.slice(0, sourceLimit.value))
const sourceName = (id: string) => (id || '').replace(/-/g, ' ').replace(/\b(un|mfa|ohchr|ocha|icj|icc|pga|dppa|wto|asean)\b/gi, m => m.toUpperCase()).replace(/^\w/, c => c.toUpperCase())

const iso2Of = computed(() => new Map(((countries.value as any[]) || []).map((c: any) => [c.iso3, c.iso2])))
const flagFor = (iso3: string) => { const i2 = iso2Of.value.get(iso3); return i2 ? isoToFlag(i2) : '' }

// ---------- admin ----------
const regenerating = ref(false)
const adminMsg = ref('')
async function regenerate() {
  regenerating.value = true
  adminMsg.value = ''
  try {
    await $fetch('/api/today/briefing', { params: { force: 'true' } })
    await refresh()
    adminMsg.value = 'New brief ready'
  } catch (e: any) {
    adminMsg.value = 'Error: ' + (e.data?.statusMessage || e.message || 'failed')
  } finally {
    regenerating.value = false
  }
}

function timeAgo(iso: string): string {
  if (!iso) return ''
  const mins = Math.floor((now.value - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
</script>

<style scoped>
.chip {
  @apply inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ring-1 ring-primary-200 text-primary-600 hover:ring-primary-400 transition;
}
.chip-on {
  @apply bg-primary-900 text-white ring-primary-900;
}
.brief :deep(p),
.brief :deep(li) {
  @apply text-[15px] leading-7 text-primary-700;
}
.brief :deep(ul) {
  @apply pl-5;
}
.brief :deep(li::marker) {
  @apply text-primary-300;
}
.brief :deep(ul ul) {
  @apply mt-1;
}
.brief :deep(strong) {
  @apply text-primary-900;
}
.brief :deep(h4) {
  @apply text-xs font-semibold uppercase tracking-[0.12em] text-primary-500 mt-6 mb-2;
}
.brief :deep(h4:first-child) {
  @apply mt-0;
}
</style>

<style>
.today .cite {
  font-size: 0.68em;
  line-height: 0;
  margin-left: 3px;
  vertical-align: 0.45em;
}
.today .cite-link {
  display: inline-block;
  min-width: 1.35em;
  padding: 0 0.3em;
  margin-left: 1px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1e40af;
  text-align: center;
  text-decoration: none;
  font-weight: 600;
}
.today .cite-link:hover {
  background: #bfdbfe;
}
.today section.bg-primary-900 .cite-link {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}
</style>
