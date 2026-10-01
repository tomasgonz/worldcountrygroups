<template>
  <div v-if="data">
    <SectionNav :sections="sections" :active-section="activeSection" @navigate="scrollTo" />

    <!-- ============================================ -->
    <!-- Section 1: Current Briefing                  -->
    <!-- ============================================ -->
    <section id="un-briefing" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-serif text-xl font-bold text-primary-900">Current Briefing</h3>
        <span v-if="data.meta?.lastUpdated" class="text-[10px] text-primary-400">Updated {{ timeAgo(data.meta.lastUpdated) }}</span>
      </div>

      <!-- Headline -->
      <div v-if="data.briefing?.headline" class="bg-primary-900 text-white rounded-xl p-5 mb-5">
        <p class="text-xs font-medium text-primary-300 mb-1">Latest Security Council Action</p>
        <p class="text-lg font-serif font-semibold leading-snug">{{ data.briefing.headline }}</p>
        <p v-if="data.briefing.headlineDetail" class="text-sm text-primary-300 mt-2">{{ data.briefing.headlineDetail }}</p>
      </div>

      <!-- AI Narrative Briefing -->
      <div v-if="aiBriefing || aiBriefingLoading" class="mb-5">
        <div v-if="aiBriefingLoading" class="bg-primary-50 rounded-xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-3 h-3 bg-primary-300 rounded-full animate-pulse"></div>
            <span class="text-xs text-primary-500">Generating narrative briefing...</span>
          </div>
          <div class="space-y-2.5">
            <div class="h-3 bg-primary-200 rounded-full w-full animate-pulse"></div>
            <div class="h-3 bg-primary-200 rounded-full w-11/12 animate-pulse"></div>
            <div class="h-3 bg-primary-200 rounded-full w-4/5 animate-pulse"></div>
            <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
            <div class="h-3 bg-primary-100 rounded-full w-10/12 animate-pulse"></div>
            <div class="h-3 bg-primary-100 rounded-full w-9/12 animate-pulse"></div>
          </div>
        </div>
        <div v-else-if="aiBriefing" class="bg-primary-50 rounded-xl p-5">
          <div
            class="prose prose-sm prose-primary max-w-none prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3"
            v-html="renderedBriefing"
          ></div>
          <div class="mt-3 pt-2 border-t border-primary-200 flex items-center justify-between">
            <p class="text-[10px] text-primary-300">
              Generated {{ timeAgo(aiBriefing.generatedAt) }}
              <span v-if="aiBriefing.cached" class="ml-1">&middot; cached</span>
            </p>
            <button
              class="text-[10px] text-primary-400 hover:text-primary-600"
              @click="fetchAIBriefing(true)"
            >Regenerate</button>
          </div>
        </div>
      </div>
      <div v-else-if="aiConfigured === false" class="mb-5">
        <!-- No AI configured — show nothing, data sections below are the briefing -->
      </div>

      <!-- Key Stats -->
      <div class="grid grid-cols-3 gap-4 mb-5">
        <div class="bg-primary-50 rounded-xl p-3 text-center">
          <p class="text-xl font-bold text-primary-900">{{ data.briefing?.stats?.resolutionsConsidered || 0 }}</p>
          <p class="text-[10px] text-primary-500">Resolutions considered</p>
        </div>
        <div class="bg-green-50 rounded-xl p-3 text-center">
          <p class="text-xl font-bold text-green-700">{{ data.briefing?.stats?.adopted || 0 }}</p>
          <p class="text-[10px] text-green-600">Adopted</p>
        </div>
        <div class="bg-red-50 rounded-xl p-3 text-center">
          <p class="text-xl font-bold text-red-700">{{ data.briefing?.stats?.vetoed || 0 }}</p>
          <p class="text-[10px] text-red-600">Vetoed</p>
        </div>
      </div>

      <!-- Key Developments -->
      <div v-if="data.briefing?.keyDevelopments?.length" class="mb-5">
        <h4 class="text-xs font-medium text-primary-500 mb-3">Key Developments</h4>
        <div class="space-y-2">
          <div
            v-for="d in data.briefing.keyDevelopments"
            :key="d.id"
            class="flex items-start gap-3 p-3 rounded-xl"
            :class="d.vetoed ? 'bg-red-50' : d.adopted ? 'bg-green-50' : 'bg-primary-50'"
          >
            <div class="shrink-0 mt-0.5">
              <span
                class="inline-block w-2 h-2 rounded-full"
                :class="d.vetoed ? 'bg-red-500' : d.adopted ? 'bg-green-500' : 'bg-amber-500'"
              ></span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span
                  class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  :class="d.adopted ? 'bg-green-100 text-green-700' : d.vetoed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'"
                >{{ d.adopted ? 'ADOPTED' : d.vetoed ? 'VETOED' : 'NOT ADOPTED' }}</span>
                <span class="text-[10px] text-primary-400">{{ d.timeAgo }}</span>
                <span class="text-[10px] font-mono text-primary-400">{{ d.id }}</span>
              </div>
              <p class="text-sm font-medium text-primary-900 leading-snug">{{ d.title }}</p>
              <div v-if="d.vetoedBy?.length" class="flex items-center gap-1.5 mt-1">
                <span class="text-[10px] text-red-600">Vetoed by</span>
                <span v-for="v in d.vetoedBy" :key="v.iso3" class="text-xs">{{ isoToFlag(v.iso2) }} {{ v.name }}</span>
              </div>
              <p class="text-[10px] text-primary-500 mt-0.5">
                Vote: <span class="text-green-600">{{ d.tally?.yes || 0 }}Y</span> / <span class="text-red-600">{{ d.tally?.no || 0 }}N</span> / <span class="text-primary-400">{{ d.tally?.abstain || 0 }}A</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Latest Security Council meetings -->
      <div v-if="data.briefing?.scMeetings?.length" class="mb-5">
        <div class="flex items-baseline justify-between mb-3">
          <h4 class="text-xs font-medium text-primary-500">Latest Security Council Meetings</h4>
          <span v-if="data.briefing.scDataUpdated" class="text-[10px] text-primary-400">Official record, updated {{ data.briefing.scDataUpdated }}</span>
        </div>
        <ul class="divide-y divide-primary-50">
          <li v-for="m in data.briefing.scMeetings" :key="m.meeting" class="py-2 flex items-start gap-3 text-sm">
            <span class="shrink-0 w-20 text-[11px] text-primary-400 tabular-nums pt-0.5">{{ m.date }}</span>
            <div class="flex-1 min-w-0">
              <p class="text-primary-800 leading-snug">{{ m.topic }}</p>
              <p v-if="m.outcome" class="text-[11px] text-primary-500 mt-0.5">{{ m.outcome }}</p>
            </div>
            <div class="shrink-0 flex gap-2 text-[11px]">
              <a :href="m.record" target="_blank" rel="noopener" class="text-accent-600 hover:underline">Record</a>
              <a v-if="m.press_release" :href="m.press_release" target="_blank" rel="noopener" class="text-accent-600 hover:underline">Press</a>
            </div>
          </li>
        </ul>
      </div>

      <!-- Active topics -->
      <div v-if="data.briefing?.activeTopics?.length">
        <h4 class="text-xs font-medium text-primary-500 mb-2">Active Topics in Diplomatic Statements</h4>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="t in data.briefing.activeTopics"
            :key="t.topic"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
            :class="topicColor(t.topic)"
          >
            {{ t.topic.replace(/-/g, ' ') }}
            <span class="text-[10px] opacity-70">{{ t.count }}</span>
          </span>
        </div>
      </div>

      <!-- GA context note -->
      <div v-if="data.briefing?.gaContext" class="mt-4 pt-3 border-t border-primary-100">
        <p class="text-[10px] text-primary-400">
          GA Session {{ data.briefing.gaContext.session }} context:
          {{ data.briefing.gaContext.topThemes?.join(', ') }}
        </p>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- Section 2: UN News                           -->
    <!-- ============================================ -->
    <section v-if="data.news?.length" id="un-news" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">UN News &amp; Coverage</h3>

      <!-- Quick Recap — narrative -->
      <div class="bg-sky-50 border border-sky-100 rounded-xl p-5 mb-5">
        <h4 class="text-xs font-semibold text-sky-800 uppercase tracking-wide mb-3">Quick Recap</h4>
        <!-- AI digest if available -->
        <div v-if="renderedNewsDigest" class="prose prose-sm max-w-none prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3" v-html="renderedNewsDigest"></div>
        <div v-else-if="aiBriefingLoading" class="space-y-2">
          <div class="h-3 bg-sky-100 rounded-full w-full animate-pulse"></div>
          <div class="h-3 bg-sky-100 rounded-full w-11/12 animate-pulse"></div>
          <div class="h-3 bg-sky-100 rounded-full w-4/5 animate-pulse"></div>
        </div>
        <!-- Data-driven narrative fallback -->
        <p v-else class="text-sm text-primary-700 leading-relaxed" v-html="newsNarrative"></p>
      </div>

      <h4 class="text-xs font-medium text-primary-500 mb-3">All Coverage</h4>
      <div class="space-y-3">
        <a
          v-for="article in data.news"
          :key="article.id"
          :href="article.url"
          target="_blank"
          rel="noopener noreferrer"
          class="block p-3 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">{{ article.source }}</span>
            <span class="text-[10px] text-primary-400">{{ article.timeAgo }}</span>
          </div>
          <p class="text-sm font-medium text-primary-900 leading-snug">{{ article.title }}</p>
          <p v-if="article.description" class="text-xs text-primary-500 mt-1 line-clamp-2">{{ article.description }}</p>
          <div v-if="article.countries?.length" class="flex gap-1 mt-1.5">
            <span
              v-for="c in article.countries"
              :key="c"
              class="text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full"
            >{{ c }}</span>
          </div>
        </a>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- Section 3: P5 Watch                          -->
    <!-- ============================================ -->
    <section id="un-p5" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">P5 Watch</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          v-for="p in data.statements?.p5 || []"
          :key="p.iso3"
          class="bg-primary-50 rounded-xl p-4 text-left hover:bg-primary-100 transition-colors cursor-pointer"
          @click="$emit('view-country', p.iso3)"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="text-2xl">{{ isoToFlag(p.iso2) }}</span>
            <div>
              <p class="text-sm font-semibold text-primary-900">{{ p.name }}</p>
              <p class="text-xs text-primary-500">{{ p.count }} statement{{ p.count !== 1 ? 's' : '' }}</p>
            </div>
          </div>
          <div v-if="p.latest" class="mt-2 pt-2 border-t border-primary-200">
            <p class="text-xs text-primary-700 leading-snug line-clamp-2">{{ p.latest.title }}</p>
            <p class="text-[10px] text-primary-400 mt-1">{{ timeAgo(p.latest.date) }}</p>
          </div>
          <p v-else class="text-xs text-primary-400 italic mt-2">No recent statements</p>
        </button>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- Section 4: Diplomatic Statements             -->
    <!-- ============================================ -->
    <section id="un-feed" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Diplomatic Statements</h3>

      <!-- Quick Recap — narrative -->
      <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-5">
        <h4 class="text-xs font-semibold text-indigo-800 uppercase tracking-wide mb-3">Quick Recap</h4>
        <!-- AI digest if available -->
        <div v-if="renderedStatementsDigest" class="prose prose-sm max-w-none prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3" v-html="renderedStatementsDigest"></div>
        <div v-else-if="aiBriefingLoading" class="space-y-2">
          <div class="h-3 bg-indigo-100 rounded-full w-full animate-pulse"></div>
          <div class="h-3 bg-indigo-100 rounded-full w-11/12 animate-pulse"></div>
          <div class="h-3 bg-indigo-100 rounded-full w-4/5 animate-pulse"></div>
        </div>
        <!-- Data-driven narrative fallback -->
        <p v-else class="text-sm text-primary-700 leading-relaxed" v-html="statementsNarrative"></p>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3 mb-4">
        <select v-model="feedSourceFilter" class="text-xs bg-primary-50 border border-primary-200 rounded-lg px-3 py-1.5 text-primary-700">
          <option value="">All Sources</option>
          <option v-for="s in data.statements?.bySource || []" :key="s.source" :value="s.source">{{ s.source }} ({{ s.count }})</option>
        </select>
        <select v-model="feedTopicFilter" class="text-xs bg-primary-50 border border-primary-200 rounded-lg px-3 py-1.5 text-primary-700">
          <option value="">All Topics</option>
          <option v-for="t in data.statements?.byTopic?.slice(0, 20) || []" :key="t.topic" :value="t.topic">{{ t.topic }} ({{ t.count }})</option>
        </select>
        <button
          v-if="feedSourceFilter || feedTopicFilter"
          class="text-xs text-primary-500 hover:text-primary-700"
          @click="feedSourceFilter = ''; feedTopicFilter = ''"
        >Clear filters</button>
      </div>

      <!-- Statement list -->
      <div class="space-y-3">
        <a
          v-for="stmt in filteredStatements"
          :key="stmt.id"
          :href="stmt.url"
          target="_blank"
          rel="noopener noreferrer"
          class="block p-3 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-medium px-2 py-0.5 rounded-full" :class="stmtTypeBadge(stmt.type)">{{ stmt.type?.replace(/-/g, ' ') }}</span>
            <span class="text-xs text-primary-400">{{ timeAgo(stmt.publishedAt) }}</span>
            <span class="text-xs text-primary-400 ml-auto">{{ stmt.source }}</span>
          </div>
          <p class="text-sm font-medium text-primary-900 leading-snug">{{ stmt.title }}</p>
          <div class="flex items-center gap-2 mt-1.5">
            <span v-if="stmt.speaker" class="text-xs text-primary-500">{{ stmt.speaker }}</span>
            <span
              v-for="c in (stmt.countries || []).slice(0, 3)"
              :key="c"
              class="text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full"
            >{{ c }}</span>
          </div>
        </a>
      </div>

      <button
        v-if="!showAllStatements && filteredStatementsAll.length > 15"
        class="mt-4 text-xs text-primary-500 hover:text-primary-700 font-medium"
        @click="showAllStatements = true"
      >Show all {{ filteredStatementsAll.length }} statements</button>
    </section>

    <!-- ============================================ -->
    <!-- Section 5: Security Council                  -->
    <!-- ============================================ -->
    <section id="un-sc" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Security Council</h3>

      <!-- Current members -->
      <div class="mb-6">
        <h4 class="text-xs font-medium text-primary-500 mb-2">Permanent Members (P5)</h4>
        <div class="flex flex-wrap gap-3 mb-4">
          <div v-for="iso3 in data.securityCouncil?.permanent || []" :key="iso3" class="flex items-center gap-1.5 bg-primary-50 rounded-lg px-3 py-1.5">
            <span class="text-lg">{{ isoToFlag(p5Iso2(iso3)) }}</span>
            <span class="text-xs font-medium text-primary-700">{{ iso3 }}</span>
          </div>
        </div>

        <h4 class="text-xs font-medium text-primary-500 mb-2">Elected Members (E10) &mdash; {{ new Date().getFullYear() }}</h4>
        <div class="flex flex-wrap gap-2">
          <div v-for="m in data.securityCouncil?.elected || []" :key="m.iso3" class="flex items-center gap-1.5 bg-primary-50 rounded-lg px-2.5 py-1">
            <span>{{ isoToFlag(m.iso2) }}</span>
            <span class="text-xs text-primary-700">{{ m.name }}</span>
            <span class="text-[10px] text-primary-400">{{ m.start }}-{{ m.end }}</span>
          </div>
        </div>
      </div>

      <!-- Recent Resolutions -->
      <div v-if="data.securityCouncil?.recentResolutions?.length">
        <h4 class="text-xs font-medium text-primary-500 mb-2">Recent Resolutions &amp; Drafts</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-primary-100">
                <th class="text-left py-2 pr-3 text-primary-500 font-medium">ID</th>
                <th class="text-left py-2 pr-3 text-primary-500 font-medium">Date</th>
                <th class="text-left py-2 pr-3 text-primary-500 font-medium">Title</th>
                <th class="text-center py-2 pr-3 text-primary-500 font-medium">Status</th>
                <th class="text-center py-2 text-primary-500 font-medium">Vote</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in data.securityCouncil.recentResolutions"
                :key="r.id"
                class="border-b border-primary-50 hover:bg-primary-50 cursor-pointer"
                @click="expandedResolution = expandedResolution === r.id ? null : r.id"
              >
                <td class="py-2 pr-3 font-mono text-primary-600">{{ r.id }}</td>
                <td class="py-2 pr-3 text-primary-500 whitespace-nowrap">{{ r.date }}</td>
                <td class="py-2 pr-3 text-primary-800">{{ r.title }}</td>
                <td class="py-2 pr-3 text-center">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    :class="r.adopted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                  >{{ r.adopted ? 'Adopted' : r.vetoed ? 'Vetoed' : 'Not adopted' }}</span>
                </td>
                <td class="py-2 text-center text-primary-600 whitespace-nowrap">
                  <span class="text-green-600">{{ r.tally?.yes || 0 }}</span>-<span class="text-red-600">{{ r.tally?.no || 0 }}</span>-<span class="text-primary-400">{{ r.tally?.abstain || 0 }}</span>
                </td>
              </tr>
              <!-- Expanded vote detail row -->
              <tr v-if="expandedResolution" v-for="r in data.securityCouncil.recentResolutions.filter((x: any) => x.id === expandedResolution)" :key="'detail-' + r.id">
                <td colspan="5" class="py-3 px-2">
                  <div class="bg-primary-50 rounded-xl p-3">
                    <p class="text-[10px] font-medium text-primary-500 mb-2">Individual Votes</p>
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="(vote, iso3) in (r.votes || {})"
                        :key="iso3"
                        class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                        :class="vote === 'Y' ? 'bg-green-100 text-green-700' : vote === 'N' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'"
                      >
                        {{ isoToFlag(p5Iso2(iso3 as string) || getIso2FromElected(iso3 as string)) }}
                        {{ iso3 }}
                        {{ vote === 'Y' ? 'Yes' : vote === 'N' ? 'No' : 'Abstain' }}
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- Section 6: Hotspots                          -->
    <!-- ============================================ -->
    <section id="un-hotspots" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-1">Hotspots</h3>
      <p class="text-xs text-primary-400 mb-4">Countries most mentioned across current diplomatic statements</p>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          v-for="c in (data.statements?.mentionedCountries || []).slice(0, 10)"
          :key="c.iso3"
          class="bg-primary-50 rounded-xl p-3 text-left hover:bg-primary-100 transition-colors cursor-pointer"
          @click="$emit('view-country', c.iso3)"
        >
          <div class="flex items-center gap-2">
            <span class="text-xl">{{ isoToFlag(c.iso2) }}</span>
            <div>
              <p class="text-xs font-semibold text-primary-900">{{ c.name }}</p>
              <p class="text-[10px] text-primary-500">{{ c.count }} mention{{ c.count !== 1 ? 's' : '' }}</p>
            </div>
          </div>
        </button>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- Section 7: Archive                           -->
    <!-- ============================================ -->
    <section id="un-archive" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-1">Archive</h3>
      <p class="text-xs text-primary-400 mb-4">Historical Security Council resolutions and vetoes</p>

      <!-- Year selector -->
      <div class="flex flex-wrap gap-2 mb-5">
        <button
          v-for="y in archiveYears"
          :key="y"
          class="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          :class="selectedArchiveYear === y
            ? 'bg-primary-900 text-white'
            : 'bg-primary-50 text-primary-600 hover:bg-primary-100'"
          @click="selectedArchiveYear = y"
        >{{ y }}</button>
      </div>

      <!-- Selected year content -->
      <div v-if="selectedYearData">
        <div class="flex items-center gap-4 mb-4">
          <span class="text-sm font-bold text-primary-900">{{ selectedArchiveYear }}</span>
          <span class="text-xs text-primary-500">{{ selectedYearData.resolutions?.length || 0 }} resolutions</span>
          <span class="text-xs text-red-500">{{ selectedYearData.vetoes?.length || 0 }} vetoes</span>
        </div>

        <!-- Resolutions -->
        <div v-if="selectedYearData.resolutions?.length" class="mb-4">
          <div class="space-y-2">
            <div
              v-for="r in selectedYearData.resolutions"
              :key="r.id"
              class="flex items-start gap-3 p-3 rounded-xl"
              :class="r.adopted ? 'bg-green-50' : 'bg-red-50'"
            >
              <span
                class="shrink-0 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                :class="r.adopted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
              >{{ r.adopted ? 'ADOPTED' : r.vetoed ? 'VETOED' : 'NOT ADOPTED' }}</span>
              <div>
                <p class="text-sm text-primary-800">{{ r.title }}</p>
                <p class="text-[10px] text-primary-400 mt-0.5">{{ r.id }} &middot; {{ r.date }} &middot; {{ r.tally?.yes || 0 }}-{{ r.tally?.no || 0 }}-{{ r.tally?.abstain || 0 }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Vetoes for that year -->
        <div v-if="selectedYearData.vetoes?.length">
          <h4 class="text-xs font-medium text-red-500 mb-2">Vetoes in {{ selectedArchiveYear }}</h4>
          <div class="space-y-2">
            <div
              v-for="(v, i) in selectedYearData.vetoes"
              :key="i"
              class="flex items-start gap-3 p-3 bg-red-50 rounded-xl"
            >
              <div class="flex gap-1 shrink-0">
                <span v-for="by in v.vetoed_by" :key="by.iso3" class="text-sm">{{ by.name }}</span>
              </div>
              <div>
                <p class="text-sm text-primary-800">{{ v.subject }}</p>
                <p class="text-[10px] text-primary-400 mt-0.5">{{ v.draft }} &middot; {{ v.date }}</p>
              </div>
            </div>
          </div>
        </div>

        <p v-if="!selectedYearData.resolutions?.length && !selectedYearData.vetoes?.length" class="text-xs text-primary-400 italic">No recorded resolutions or vetoes for this year.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  data: any
  aiStatus?: { configured: boolean; provider: string | null } | null
}>()
defineEmits<{ 'view-country': [iso3: string] }>()

// AI narrative briefing
const aiBriefing = ref<any>(null)
const aiBriefingLoading = ref(false)
const aiConfigured = computed(() => props.aiStatus?.configured ?? null)

// Collect all known country names from data for auto-bolding
const knownCountryNames = computed(() => {
  const names = new Set<string>()
  const p5 = props.data?.statements?.p5 || []
  for (const p of p5) if (p.name) names.add(p.name)
  const mentioned = props.data?.statements?.mentionedCountries || []
  for (const m of mentioned) if (m.name) names.add(m.name)
  const elected = props.data?.securityCouncil?.elected || []
  for (const e of elected) if (e.name) names.add(e.name)
  // Add common P5 short names
  for (const n of ['China', 'France', 'Russia', 'United Kingdom', 'United States']) names.add(n)
  return [...names].sort((a, b) => b.length - a.length) // longest first to avoid partial matches
})

function boldCountries(html: string): string {
  let result = html
  for (const name of knownCountryNames.value) {
    // Only bold if not already inside a tag
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`(?<![<\\w/])\\b(${escaped})\\b(?![^<]*>)`, 'g'), '<strong>$1</strong>')
  }
  return result
}

function proseToHtml(text: string): string {
  if (!text) return ''
  const html = text
    .split(/\n\n+/)
    .filter((p: string) => p.trim())
    .map((p: string) => `<p>${p.replace(/\n/g, ' ').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`)
    .join('')
  return boldCountries(html)
}

const renderedBriefing = computed(() => proseToHtml(aiBriefing.value?.overview || aiBriefing.value?.content || ''))
const renderedNewsDigest = computed(() => proseToHtml(aiBriefing.value?.newsDigest || ''))
const renderedStatementsDigest = computed(() => proseToHtml(aiBriefing.value?.statementsDigest || ''))

async function fetchAIBriefing(force = false) {
  if (aiBriefingLoading.value) return
  if (!props.aiStatus?.configured) return
  aiBriefingLoading.value = true
  try {
    aiBriefing.value = await $fetch<any>(`/api/intelligence/ai/un-briefing${force ? '?force=true' : ''}`)
  } catch {
    // Silently fail — data briefing sections are still shown
  } finally {
    aiBriefingLoading.value = false
  }
}

// Auto-fetch AI briefing when data arrives and AI is configured
watch(() => [props.data, props.aiStatus], () => {
  if (props.data && props.aiStatus?.configured && !aiBriefing.value && !aiBriefingLoading.value) {
    fetchAIBriefing()
  }
}, { immediate: true })

const sections = [
  { id: 'un-briefing', label: 'Current Briefing' },
  { id: 'un-news', label: 'News' },
  { id: 'un-p5', label: 'P5 Watch' },
  { id: 'un-feed', label: 'Statements' },
  { id: 'un-sc', label: 'Security Council' },
  { id: 'un-hotspots', label: 'Hotspots' },
  { id: 'un-archive', label: 'Archive' },
]

const { activeSection, scrollTo } = useSectionNav(sections)

// Feed filters
const feedSourceFilter = ref('')
const feedTopicFilter = ref('')
const showAllStatements = ref(false)

// Resolution detail expand
const expandedResolution = ref<string | null>(null)

// Archive year
const archiveYears = computed(() => {
  return (props.data?.archive?.years || []).map((y: any) => y.year)
})
const selectedArchiveYear = ref<number | null>(null)

// Auto-select most recent year on data load
watch(() => props.data?.archive?.years, (years) => {
  if (years?.length && !selectedArchiveYear.value) {
    selectedArchiveYear.value = years[0].year
  }
}, { immediate: true })

const selectedYearData = computed(() => {
  if (!selectedArchiveYear.value) return null
  return (props.data?.archive?.years || []).find((y: any) => y.year === selectedArchiveYear.value) || null
})

// Data-driven narrative for news (fallback when AI not available)
const newsNarrative = computed(() => {
  const articles = props.data?.news || []
  if (!articles.length) return 'No recent UN-related news coverage available.'

  const sources = [...new Set(articles.map((a: any) => a.source))]
  const countriesRaw = articles.flatMap((a: any) => a.countries || [])
  const countryCounts = new Map<string, number>()
  for (const c of countriesRaw) countryCounts.set(c, (countryCounts.get(c) || 0) + 1)
  const topCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0])

  const parts: string[] = []
  parts.push(`Current coverage spans <strong>${articles.length}</strong> articles from ${sources.length} source${sources.length !== 1 ? 's' : ''}.`)

  // Lead with top headline
  const lead = articles[0]
  if (lead) parts.push(`Leading the coverage: <em>${lead.title}</em> (${lead.source}, ${lead.timeAgo}).`)

  // Countries in focus
  if (topCountries.length) {
    parts.push(`Countries in focus include <strong>${topCountries.join('</strong>, <strong>')}</strong>.`)
  }

  // Second headline for breadth
  if (articles.length > 2) {
    const second = articles[1]
    parts.push(`Also notable: <em>${second.title}</em>.`)
  }

  return parts.join(' ')
})

// Data-driven narrative for statements — describes what's on screen
const statementsNarrative = computed(() => {
  const stmts = props.data?.statements?.recent || []
  const p5 = props.data?.statements?.p5 || []
  const topics = props.data?.statements?.byTopic || []
  const bySource = props.data?.statements?.bySource || []
  const byType = props.data?.statements?.byType || []
  const mentioned = props.data?.statements?.mentionedCountries || []
  if (!stmts.length) return 'No recent diplomatic statements available.'

  const parts: string[] = []

  // Overview of volume and sources
  const sourceNames = bySource.slice(0, 4).map((s: any) => s.source)
  parts.push(`This section tracks <strong>${stmts.length}</strong> recent diplomatic statements from ${bySource.length} source${bySource.length !== 1 ? 's' : ''}, including ${sourceNames.join(', ')}.`)

  // Statement types breakdown
  if (byType.length) {
    const typeBits = byType.slice(0, 4).map((t: any) => `${t.count} ${t.type.replace(/-/g, ' ')}${t.count !== 1 ? 's' : ''}`)
    parts.push(`The feed includes ${typeBits.join(', ')}.`)
  }

  // Topics — what the statements are about
  if (topics.length) {
    const topTopics = topics.slice(0, 4).map((t: any) => `<strong>${t.topic.replace(/-/g, ' ')}</strong> (${t.count})`)
    parts.push(`The most discussed topics are ${topTopics.join(', ')} — use the topic filter below to drill into any of these.`)
  }

  // P5 focus — who is speaking
  const activeP5 = p5.filter((p: any) => p.count > 0).sort((a: any, b: any) => b.count - a.count)
  if (activeP5.length) {
    const mostActive = activeP5[0]
    const others = activeP5.slice(1, 3).map((p: any) => `<strong>${p.name}</strong>`)
    parts.push(`Among permanent Security Council members, <strong>${mostActive.name}</strong> leads with ${mostActive.count} statement${mostActive.count !== 1 ? 's' : ''}${others.length ? `, followed by ${others.join(' and ')}` : ''}.`)
  }

  // Countries most mentioned
  if (mentioned.length >= 3) {
    const topMentioned = mentioned.slice(0, 5).map((m: any) => `<strong>${m.name}</strong>`)
    parts.push(`The countries drawing the most diplomatic attention are ${topMentioned.join(', ')}.`)
  }

  return parts.join(' ')
})

const filteredStatementsAll = computed(() => {
  let stmts = props.data?.statements?.recent || []
  if (feedSourceFilter.value) {
    stmts = stmts.filter((s: any) => s.source === feedSourceFilter.value)
  }
  if (feedTopicFilter.value) {
    stmts = stmts.filter((s: any) => s.topics?.includes(feedTopicFilter.value))
  }
  return stmts
})

const filteredStatements = computed(() => {
  const all = filteredStatementsAll.value
  return showAllStatements.value ? all : all.slice(0, 15)
})

const P5_ISO2: Record<string, string> = { CHN: 'CN', FRA: 'FR', RUS: 'RU', GBR: 'GB', USA: 'US' }

function p5Iso2(iso3: string) {
  return P5_ISO2[iso3] || ''
}

function getIso2FromElected(iso3: string) {
  const m = (props.data?.securityCouncil?.elected || []).find((e: any) => e.iso3 === iso3)
  return m?.iso2 || ''
}

function timeAgo(dateStr: string) {
  if (!dateStr) return ''
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function stmtTypeBadge(type: string) {
  switch (type) {
    case 'press-release': return 'bg-blue-100 text-blue-700'
    case 'statement': return 'bg-indigo-100 text-indigo-700'
    case 'remarks': return 'bg-purple-100 text-purple-700'
    case 'vote-explanation': return 'bg-amber-100 text-amber-700'
    case 'letter': return 'bg-teal-100 text-teal-700'
    default: return 'bg-primary-100 text-primary-600'
  }
}

const TOPIC_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-rose-100 text-rose-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-cyan-100 text-cyan-700',
  'bg-emerald-100 text-emerald-700',
  'bg-lime-100 text-lime-700',
  'bg-sky-100 text-sky-700',
]

const topicColorMap = new Map<string, string>()
function topicColor(topic: string) {
  if (!topicColorMap.has(topic)) {
    topicColorMap.set(topic, TOPIC_COLORS[topicColorMap.size % TOPIC_COLORS.length])
  }
  return topicColorMap.get(topic)
}
</script>
