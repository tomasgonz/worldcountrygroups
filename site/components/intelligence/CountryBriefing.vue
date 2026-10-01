<template>
  <div v-if="data">
    <SectionNav :sections="sections" :active-section="activeSection" @navigate="scrollTo" />

    <!-- Situation Report (moved to top) -->
    <section v-if="data.recentNews?.length" id="intel-news" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Current Situation</h3>
      <div v-if="newsBriefingLoading" class="space-y-3">
        <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
        <div class="h-3 bg-primary-100 rounded-full w-11/12 animate-pulse"></div>
        <div class="h-3 bg-primary-100 rounded-full w-4/5 animate-pulse"></div>
        <div class="h-3 bg-primary-100 rounded-full w-10/12 animate-pulse"></div>
      </div>
      <div
        v-else-if="newsBriefingContent"
        class="prose prose-sm prose-primary max-w-none prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3"
        v-html="renderedNewsBriefing"
      ></div>
      <p v-else class="text-sm text-primary-500 italic">No briefing available — AI provider may not be configured.</p>
      <div v-if="newsBriefingContent || !newsBriefingLoading" class="mt-4 pt-3 border-t border-primary-100">
        <p class="text-[10px] text-primary-300">Based on {{ data.recentNews.length }} recent articles</p>
      </div>
    </section>

    <!-- Official Statements -->
    <section v-if="data.recentStatements?.length" id="intel-statements" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Official Statements</h3>
      <div class="space-y-3">
        <a
          v-for="stmt in data.recentStatements"
          :key="stmt.id"
          :href="stmt.url"
          target="_blank"
          rel="noopener noreferrer"
          class="block p-3 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-medium px-2 py-0.5 rounded-full" :class="stmtTypeBadge(stmt.type)">{{ stmt.type?.replace(/-/g, ' ') }}</span>
            <span class="text-xs text-primary-400">{{ stmtTimeAgo(stmt.publishedAt) }}</span>
          </div>
          <p class="text-sm font-medium text-primary-900 leading-snug">{{ stmt.title }}</p>
          <p v-if="stmt.speaker" class="text-xs text-primary-500 mt-0.5">{{ stmt.speaker }}</p>
        </a>
      </div>
    </section>

    <!-- Timeline -->
    <section id="intel-timeline" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Timeline</h3>
      <IntelligenceTimelineView :data="data" />
    </section>

    <!-- Executive Summary -->
    <section id="intel-summary" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Executive Summary</h3>
      <div class="flex items-center gap-3 mb-4">
        <span class="text-3xl">{{ isoToFlag(data.country.iso2) }}</span>
        <div>
          <h4 class="font-serif text-lg font-semibold text-primary-900">{{ data.country.name }}</h4>
          <p class="text-primary-400 text-xs">{{ data.country.region }} &middot; {{ data.country.subregion }} &middot; {{ data.country.income_group || 'N/A' }}</p>
        </div>
      </div>

      <template v-if="data.latestSpeech">
        <div class="bg-primary-50 rounded-xl p-4 mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-primary-500">Latest UN Address (Session {{ data.latestSpeech.session }}, {{ data.latestSpeech.year }})</span>
            <span
              class="px-2 py-0.5 rounded-full text-xs font-medium"
              :class="sentimentClass(data.latestSpeech.sentiment?.overall)"
            >{{ data.latestSpeech.sentiment?.overall || 'N/A' }}</span>
          </div>
          <p class="text-xs text-primary-500 mb-1">{{ data.latestSpeech.speaker }} &mdash; {{ data.latestSpeech.speaker_title }}</p>
          <p class="text-sm text-primary-700 leading-relaxed">{{ data.latestSpeech.summary }}</p>
        </div>

        <div v-if="data.latestSpeech.key_quotes?.length" class="mb-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">Key Quotes</h5>
          <div v-for="(q, i) in data.latestSpeech.key_quotes.slice(0, 3)" :key="i" class="border-l-2 border-primary-200 pl-3 mb-2">
            <p class="text-sm text-primary-600 italic">"{{ q }}"</p>
          </div>
        </div>

        <div v-if="data.latestSpeech.policy_positions?.length" class="mb-2">
          <h5 class="text-xs font-medium text-primary-500 mb-2">Policy Positions</h5>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div v-for="(p, i) in data.latestSpeech.policy_positions.slice(0, 6)" :key="i" class="bg-white border border-primary-50 rounded-lg p-2">
              <span class="text-xs font-medium text-primary-700">{{ p.topic }}</span>
              <p class="text-xs text-primary-500">{{ p.position }}</p>
            </div>
          </div>
        </div>

        <!-- Speech detailed analysis -->
        <div v-if="aiConfigured" class="mt-4">
          <button
            v-if="!speechAnalysisExpanded && !speechAnalysisContent"
            @click="fetchSpeechAnalysis"
            :disabled="speechAnalysisLoading"
            class="text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
          >
            {{ speechAnalysisLoading ? 'Analyzing...' : 'View detailed AI analysis of this speech' }}
          </button>
          <div v-if="speechAnalysisLoading" class="mt-3 space-y-2">
            <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
            <div class="h-3 bg-primary-100 rounded-full w-11/12 animate-pulse"></div>
            <div class="h-3 bg-primary-100 rounded-full w-4/5 animate-pulse"></div>
          </div>
          <div v-if="speechAnalysisContent" class="mt-3">
            <button @click="speechAnalysisExpanded = !speechAnalysisExpanded" class="text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium mb-2">
              {{ speechAnalysisExpanded ? 'Hide detailed analysis' : 'Show detailed analysis' }}
            </button>
            <div
              v-if="speechAnalysisExpanded"
              class="prose prose-sm prose-primary max-w-none prose-headings:font-serif prose-headings:text-primary-900 prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3 prose-ul:my-2 prose-li:text-primary-700 prose-li:my-0.5"
              v-html="renderedSpeechAnalysis"
            ></div>
          </div>
        </div>
      </template>
      <p v-else class="text-primary-400 text-sm">No speech data available.</p>
    </section>

    <!-- Theme Evolution -->
    <section id="intel-themes" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Theme Evolution</h3>
      <div v-if="data.themeTrends?.length">
        <div v-for="trend in data.themeTrends.slice(0, 8)" :key="trend.theme" class="mb-4">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium text-primary-700">{{ trend.theme }}</span>
            <span class="text-xs text-primary-400">{{ trend.total_resolutions }} resolutions</span>
          </div>
          <div class="flex gap-1">
            <div
              v-for="dec in trend.decades"
              :key="dec.decade"
              class="flex-1"
              :title="`${dec.decade}: ${dec.resolutions} res — Y:${dec.yes} N:${dec.no} A:${dec.abstain}`"
            >
              <div class="text-[10px] text-primary-400 text-center mb-0.5">{{ dec.decade }}</div>
              <div class="h-4 rounded-sm overflow-hidden flex bg-primary-50">
                <div class="bg-emerald-400" :style="{ width: pct(dec.yes, dec.yes + dec.no + dec.abstain) }" />
                <div class="bg-red-400" :style="{ width: pct(dec.no, dec.yes + dec.no + dec.abstain) }" />
                <div class="bg-amber-300" :style="{ width: pct(dec.abstain, dec.yes + dec.no + dec.abstain) }" />
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-4 text-[10px] text-primary-400 mt-2">
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-emerald-400 rounded-sm" /> Yes</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-red-400 rounded-sm" /> No</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-amber-300 rounded-sm" /> Abstain</span>
        </div>
      </div>
      <p v-else class="text-primary-400 text-sm">No voting theme data available.</p>
    </section>

    <!-- Voting Pattern -->
    <section id="intel-voting" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Voting Pattern</h3>

      <div v-if="data.votingAlignment.p5.length" class="mb-6">
        <h5 class="text-xs font-medium text-primary-500 mb-2">P5 Alignment</h5>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div v-for="p in sortedP5" :key="p.iso3" class="text-center p-3 bg-primary-50 rounded-lg">
            <span class="block text-lg font-bold" :class="p.agreement >= 0.7 ? 'text-emerald-600' : p.agreement >= 0.4 ? 'text-amber-600' : 'text-red-600'">
              {{ (p.agreement * 100).toFixed(0) }}%
            </span>
            <span class="text-xs text-primary-500">{{ p5Label(p.iso3) }}</span>
          </div>
        </div>
      </div>

      <div v-if="data.themeStats?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Voting by Theme</h5>
        <div class="space-y-2">
          <div v-for="t in data.themeStats.slice(0, 10)" :key="t.theme">
            <div class="flex items-center justify-between text-xs mb-0.5">
              <span class="text-primary-700">{{ t.theme }}</span>
              <span class="text-primary-400">{{ t.resolutions }} res</span>
            </div>
            <div class="h-3 rounded-sm overflow-hidden flex bg-primary-50">
              <div class="bg-emerald-400" :style="{ width: pct(t.yes, t.resolutions) }" />
              <div class="bg-red-400" :style="{ width: pct(t.no, t.resolutions) }" />
              <div class="bg-amber-300" :style="{ width: pct(t.abstain, t.resolutions) }" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="data.votingAlignment.mostAligned?.length" class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h5 class="text-xs font-medium text-primary-500 mb-2">Most Aligned</h5>
          <div v-for="a in data.votingAlignment.mostAligned" :key="a.iso3" class="flex items-center justify-between py-1 text-sm">
            <span class="text-primary-700">{{ a.name || a.iso3 }}</span>
            <span class="text-emerald-600 font-medium">{{ (a.agreement * 100).toFixed(0) }}%</span>
          </div>
        </div>
        <div>
          <h5 class="text-xs font-medium text-primary-500 mb-2">Least Aligned</h5>
          <div v-for="a in data.votingAlignment.leastAligned" :key="a.iso3" class="flex items-center justify-between py-1 text-sm">
            <span class="text-primary-700">{{ a.name || a.iso3 }}</span>
            <span class="text-red-600 font-medium">{{ (a.agreement * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Relationships -->
    <section id="intel-relationships" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Relationships</h3>

      <div v-if="data.speechMentions?.length" class="mb-6">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Most Referenced Countries (in speeches)</h5>
        <div class="space-y-2">
          <div v-for="m in data.speechMentions.slice(0, 10)" :key="m.iso3" class="flex items-center justify-between">
            <span class="text-sm text-primary-700">{{ m.name || m.iso3 }}</span>
            <span class="text-xs text-primary-400">{{ m.count }}x &mdash; {{ truncate(m.context, 60) }}</span>
          </div>
        </div>
      </div>

      <div v-if="data.gdelt?.topPartners?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">GDELT Bilateral Partners</h5>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-primary-400 border-b border-primary-50">
                <th class="text-left py-1 font-medium">Partner</th>
                <th class="text-right py-1 font-medium">Events</th>
                <th class="text-right py-1 font-medium">Coop%</th>
                <th class="text-right py-1 font-medium">Tone</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in data.gdelt.topPartners" :key="p.partner" class="border-b border-primary-50/50">
                <td class="py-1.5 text-primary-700">{{ p.partner }}</td>
                <td class="py-1.5 text-right text-primary-500">{{ p.events }}</td>
                <td class="py-1.5 text-right" :class="p.cooperation_ratio >= 0.5 ? 'text-emerald-600' : 'text-red-500'">
                  {{ (p.cooperation_ratio * 100).toFixed(0) }}%
                </td>
                <td class="py-1.5 text-right" :class="p.avg_tone >= 0 ? 'text-emerald-600' : 'text-red-500'">
                  {{ p.avg_tone.toFixed(1) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Risk Profile -->
    <section id="intel-risk" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Risk Profile</h3>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Conflict -->
        <div class="bg-primary-50 rounded-xl p-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">Conflict Status</h5>
          <template v-if="data.riskProfile.conflict">
            <span
              class="inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2"
              :class="intensityClass(data.riskProfile.conflict.conflict_intensity)"
            >{{ data.riskProfile.conflict.conflict_intensity }}</span>
            <p class="text-sm text-primary-700">{{ data.riskProfile.conflict.total_events.toLocaleString() }} events</p>
            <p class="text-xs text-primary-500">{{ data.riskProfile.conflict.total_fatalities.toLocaleString() }} fatalities</p>
          </template>
          <p v-else class="text-sm text-primary-400">No conflict data</p>
        </div>

        <!-- Sanctions -->
        <div class="bg-primary-50 rounded-xl p-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">Sanctions</h5>
          <template v-if="data.riskProfile.sanctions">
            <span class="text-lg font-bold text-red-600">{{ data.riskProfile.sanctions.length }}</span>
            <span class="text-xs text-primary-500 ml-1">active regime(s)</span>
            <div v-for="s in data.riskProfile.sanctions.slice(0, 3)" :key="s.id" class="mt-1">
              <p class="text-xs text-primary-700">{{ s.name }}</p>
            </div>
          </template>
          <p v-else class="text-sm text-emerald-600">No sanctions</p>
        </div>

        <!-- Military -->
        <div class="bg-primary-50 rounded-xl p-4">
          <h5 class="text-xs font-medium text-primary-500 mb-2">Military</h5>
          <template v-if="data.riskProfile.military">
            <p class="text-sm text-primary-700">Rank #{{ data.riskProfile.military.rank }}</p>
            <p class="text-xs text-primary-500">{{ formatMilitary(data.riskProfile.military.active_military) }} active</p>
            <p class="text-xs text-primary-500">{{ formatDefenseBudget(data.riskProfile.military.defense_budget) }} budget</p>
          </template>
          <p v-else class="text-sm text-primary-400">No military data</p>
        </div>
      </div>
    </section>

    <!-- Democracy Profile -->
    <section v-if="data.democracy" id="intel-democracy" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Democracy Profile</h3>
      <div class="flex items-center gap-3 mb-4">
        <span class="px-3 py-1 rounded-full text-xs font-medium" :class="regimeBadge(data.democracy.latest?.regime)">
          {{ data.democracy.latest?.regime || 'Unknown' }}
        </span>
        <span class="text-xs text-primary-400">Polyarchy: {{ data.democracy.latest?.v2x_polyarchy?.toFixed(3) }}</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <ChartsChartRadar :axes="democracyAxes" :size="260" fill-color="#6366f1" stroke-color="#6366f1" />
        </div>
        <div>
          <h5 class="text-xs font-medium text-primary-500 mb-2">Polyarchy Trend</h5>
          <div v-if="data.democracy.trend?.length" class="flex items-center gap-2">
            <ChartsChartSparkline :data="data.democracy.trend.map((t: any) => t.v2x_polyarchy)" :width="180" :height="40" color="#6366f1" />
            <span class="text-xs text-primary-400">{{ data.democracy.trend.length }} years</span>
          </div>
          <div class="mt-3 space-y-1.5">
            <div v-for="metric in democracyMetrics" :key="metric.label" class="flex items-center justify-between text-xs">
              <span class="text-primary-600">{{ metric.label }}</span>
              <span class="font-medium text-primary-800">{{ metric.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Arms Trade -->
    <section v-if="data.armsTrade" id="intel-arms" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Arms Trade</h3>
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="bg-primary-50 rounded-xl p-4 text-center">
          <span class="block text-lg font-bold text-primary-900">{{ formatTIV(data.armsTrade.total_exports) }}</span>
          <span class="text-xs text-primary-400">Exports (TIV)</span>
          <span v-if="data.armsTrade.export_rank" class="block text-xs text-primary-500 mt-1">Rank #{{ data.armsTrade.export_rank }}</span>
        </div>
        <div class="bg-primary-50 rounded-xl p-4 text-center">
          <span class="block text-lg font-bold text-primary-900">{{ formatTIV(data.armsTrade.total_imports) }}</span>
          <span class="text-xs text-primary-400">Imports (TIV)</span>
          <span v-if="data.armsTrade.import_rank" class="block text-xs text-primary-500 mt-1">Rank #{{ data.armsTrade.import_rank }}</span>
        </div>
      </div>
      <div v-if="data.armsTrade.top_recipients?.length" class="mb-4">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Top Recipients</h5>
        <ChartsChartBar :bars="data.armsTrade.top_recipients.slice(0, 5).map((r: any) => ({ label: r.iso3 || r.name, value: r.value || r.total }))" default-color="#3b82f6" :label-width="60" />
      </div>
      <div v-if="data.armsTrade.top_suppliers?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Top Suppliers</h5>
        <ChartsChartBar :bars="data.armsTrade.top_suppliers.slice(0, 5).map((r: any) => ({ label: r.iso3 || r.name, value: r.value || r.total }))" default-color="#f59e0b" :label-width="60" />
      </div>
    </section>

    <!-- Aid Profile -->
    <section v-if="data.aid" id="intel-aid" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Aid Profile</h3>
      <div class="flex items-center gap-3 mb-4">
        <span class="px-3 py-1 rounded-full text-xs font-medium" :class="data.aid.is_donor ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'">
          {{ data.aid.is_donor ? 'Donor' : 'Recipient' }}
        </span>
        <span v-if="data.aid.oda_gni_ratio" class="text-xs text-primary-500">ODA/GNI: {{ data.aid.oda_gni_ratio.toFixed(2) }}%</span>
      </div>
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="bg-primary-50 rounded-xl p-4 text-center">
          <span class="block text-lg font-bold text-primary-900">${{ formatNumber(data.aid.total_given) }}</span>
          <span class="text-xs text-primary-400">Given</span>
        </div>
        <div class="bg-primary-50 rounded-xl p-4 text-center">
          <span class="block text-lg font-bold text-primary-900">${{ formatNumber(data.aid.total_received) }}</span>
          <span class="text-xs text-primary-400">Received</span>
        </div>
      </div>
      <div v-if="data.aid.top_recipients?.length" class="mb-3">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Top Recipients</h5>
        <div v-for="r in data.aid.top_recipients.slice(0, 5)" :key="r.iso3" class="flex items-center justify-between text-xs py-1">
          <span class="text-primary-700">{{ r.iso3 || r.name }}</span>
          <span class="text-primary-500">${{ formatNumber(r.value || r.total) }}</span>
        </div>
      </div>
      <div v-if="data.aid.top_donors?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Top Donors</h5>
        <div v-for="r in data.aid.top_donors.slice(0, 5)" :key="r.iso3" class="flex items-center justify-between text-xs py-1">
          <span class="text-primary-700">{{ r.iso3 || r.name }}</span>
          <span class="text-primary-500">${{ formatNumber(r.value || r.total) }}</span>
        </div>
      </div>
    </section>

    <!-- Passport Mobility -->
    <section v-if="data.passport" id="intel-passport" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Passport Mobility</h3>
      <div class="flex items-center gap-4 mb-4">
        <div class="text-center">
          <span class="block text-3xl font-bold text-primary-900">#{{ data.passport.mobility_rank }}</span>
          <span class="text-xs text-primary-400">Global Rank</span>
        </div>
        <div class="text-center">
          <span class="block text-3xl font-bold text-primary-900">{{ data.passport.mobility_score }}</span>
          <span class="text-xs text-primary-400">Mobility Score</span>
        </div>
      </div>
      <div class="flex gap-1 h-8 rounded-lg overflow-hidden mb-2">
        <div class="bg-emerald-400" :style="{ width: visaPct(data.passport.visa_free) }" :title="`Visa-free: ${data.passport.visa_free}`" />
        <div class="bg-blue-400" :style="{ width: visaPct(data.passport.visa_on_arrival) }" :title="`On arrival: ${data.passport.visa_on_arrival}`" />
        <div class="bg-amber-400" :style="{ width: visaPct(data.passport.e_visa) }" :title="`e-Visa: ${data.passport.e_visa}`" />
        <div class="bg-red-300" :style="{ width: visaPct(data.passport.visa_required) }" :title="`Required: ${data.passport.visa_required}`" />
      </div>
      <div class="flex items-center gap-4 text-[10px] text-primary-400">
        <span class="flex items-center gap-1"><span class="w-2 h-2 bg-emerald-400 rounded-sm" /> Visa-free ({{ data.passport.visa_free }})</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 bg-blue-400 rounded-sm" /> On arrival ({{ data.passport.visa_on_arrival }})</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 bg-amber-400 rounded-sm" /> e-Visa ({{ data.passport.e_visa }})</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 bg-red-300 rounded-sm" /> Required ({{ data.passport.visa_required }})</span>
      </div>
    </section>

    <!-- Digital Connectivity -->
    <section v-if="data.connectivity?.has_data" id="intel-connectivity" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Digital Connectivity</h3>
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div class="bg-primary-50 rounded-xl p-4 text-center">
          <span class="block text-2xl font-bold text-primary-900">{{ data.connectivity.cable_count }}</span>
          <span class="text-xs text-primary-400">Submarine Cables</span>
        </div>
        <div class="bg-primary-50 rounded-xl p-4 text-center">
          <span class="block text-2xl font-bold text-primary-900">#{{ data.connectivity.connectivity_rank }}</span>
          <span class="text-xs text-primary-400">Connectivity Rank</span>
        </div>
        <div class="bg-primary-50 rounded-xl p-4 text-center">
          <span class="block text-2xl font-bold text-primary-900">{{ data.connectivity.connected_countries?.length || 0 }}</span>
          <span class="text-xs text-primary-400">Connected Countries</span>
        </div>
      </div>
      <div v-if="data.connectivity.cables?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Cables</h5>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <div v-for="c in data.connectivity.cables.slice(0, 10)" :key="c.name || c" class="text-xs text-primary-700 px-2 py-1 bg-primary-50 rounded">
            {{ c.name || c }}
          </div>
        </div>
      </div>
    </section>

    <!-- Alliance Network -->
    <section v-if="data.alliances?.has_data" id="intel-alliances" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Alliance Network</h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div class="bg-primary-50 rounded-xl p-3 text-center">
          <span class="block text-xl font-bold text-primary-900">{{ data.alliances.profile?.active_alliances || 0 }}</span>
          <span class="text-xs text-primary-400">Active Alliances</span>
        </div>
        <div class="bg-primary-50 rounded-xl p-3 text-center">
          <span class="block text-xl font-bold text-primary-900">{{ data.alliances.profile?.defense_pacts || 0 }}</span>
          <span class="text-xs text-primary-400">Defense Pacts</span>
        </div>
        <div class="bg-primary-50 rounded-xl p-3 text-center">
          <span class="block text-xl font-bold text-primary-900">{{ data.alliances.profile?.ententes || 0 }}</span>
          <span class="text-xs text-primary-400">Ententes</span>
        </div>
        <div class="bg-primary-50 rounded-xl p-3 text-center">
          <span class="block text-xl font-bold text-primary-900">{{ data.alliances.profile?.allies?.length || 0 }}</span>
          <span class="text-xs text-primary-400">Current Allies</span>
        </div>
      </div>
      <div v-if="data.alliances.alliances?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Alliances</h5>
        <div class="space-y-1.5">
          <div v-for="a in data.alliances.alliances.slice(0, 8)" :key="a.name" class="flex items-center justify-between p-2 bg-primary-50 rounded-lg">
            <span class="text-xs text-primary-700">{{ a.name }}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="allianceTypeBadge(a.type)">{{ a.type }}</span>
          </div>
        </div>
      </div>

      <!-- Alliance Network Graph toggle -->
      <div class="mt-4 pt-4 border-t border-primary-100">
        <button
          @click="showAllianceGraph = !showAllianceGraph"
          class="text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
        >{{ showAllianceGraph ? 'Hide Network Graph' : 'Show Network Graph' }}</button>
        <div v-if="showAllianceGraph" class="mt-3">
          <IntelligenceAllianceNetwork :iso="data.country.iso3" />
        </div>
      </div>
    </section>

    <!-- Diplomatic Cable -->
    <section v-if="aiConfigured" id="intel-cable" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-serif text-xl font-bold text-primary-900">SITREP Cable</h3>
        <div class="flex items-center gap-2">
          <button
            v-if="!cableContent"
            @click="fetchCable"
            :disabled="cableLoading"
            class="px-3 py-1.5 bg-primary-900 text-white text-xs font-medium rounded-lg hover:bg-primary-800 disabled:opacity-50 transition-colors"
          >{{ cableLoading ? 'Generating...' : 'Generate SITREP' }}</button>
          <a
            v-if="cableContent"
            :href="`/api/intelligence/ai/cable-doc?type=country&iso=${data.country.iso3}`"
            class="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >Download DOCX</a>
        </div>
      </div>
      <div v-if="cableLoading" class="space-y-2">
        <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
        <div class="h-3 bg-primary-100 rounded-full w-11/12 animate-pulse"></div>
        <div class="h-3 bg-primary-100 rounded-full w-4/5 animate-pulse"></div>
      </div>
      <div
        v-if="cableContent"
        class="prose prose-sm prose-primary max-w-none prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3 font-mono text-xs"
        v-html="renderedCable"
      ></div>
    </section>

    <!-- Treaties & Groups -->
    <section id="intel-treaties" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Treaties & Groups</h3>

      <div v-if="data.treaties?.length" class="mb-6">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Treaty Participation</h5>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div v-for="t in data.treaties.slice(0, 12)" :key="t.treaty?.id || t.treaty?.name" class="flex items-center justify-between p-2 bg-primary-50 rounded-lg">
            <span class="text-xs text-primary-700">{{ t.treaty?.short_name || t.treaty?.name }}</span>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-medium"
              :class="treatyStatusClass(t.status)"
            >{{ t.status }}</span>
          </div>
        </div>
      </div>

      <div v-if="data.groups?.length">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Group Memberships ({{ data.groups.length }})</h5>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="g in data.groups"
            :key="g.gid"
            :to="`/groups/${g.gid}`"
            class="px-2.5 py-1 bg-primary-50 border border-primary-100 rounded-lg text-xs text-primary-700 hover:bg-primary-100 transition-colors"
          >{{ g.acronym }}</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps<{ data: any; aiConfigured?: boolean }>()

// News briefing
const newsBriefingContent = ref('')
const newsBriefingLoading = ref(false)

// Speech detailed analysis
const speechAnalysisContent = ref('')
const speechAnalysisLoading = ref(false)
const speechAnalysisExpanded = ref(false)

// Alliance graph
const showAllianceGraph = ref(false)

// Diplomatic cable
const cableContent = ref('')
const cableLoading = ref(false)

const { highlight } = useBriefHighlight()
const renderedNewsBriefing = computed(() =>
  newsBriefingContent.value ? marked.parse(highlight(newsBriefingContent.value)) as string : ''
)

const renderedSpeechAnalysis = computed(() =>
  speechAnalysisContent.value ? marked.parse(highlight(speechAnalysisContent.value)) as string : ''
)

const renderedCable = computed(() =>
  cableContent.value ? marked.parse(highlight(cableContent.value)) as string : ''
)

async function fetchCable() {
  if (!props.data?.country?.iso3) return
  cableLoading.value = true
  try {
    const res = await $fetch<any>('/api/intelligence/ai/cable', {
      query: { type: 'country', iso: props.data.country.iso3 },
    })
    cableContent.value = res.content || ''
  } catch {}
  cableLoading.value = false
}

async function fetchSpeechAnalysis() {
  if (!props.data?.latestSpeech || !props.data?.country?.iso3) return
  speechAnalysisLoading.value = true
  try {
    const res = await $fetch<any>('/api/intelligence/ai/speech-summary', {
      query: { iso: props.data.country.iso3, session: props.data.latestSpeech.session },
    })
    speechAnalysisContent.value = res.content
    speechAnalysisExpanded.value = true
  } catch {}
  speechAnalysisLoading.value = false
}

async function fetchNewsBriefing() {
  if (!props.data?.recentNews?.length || !props.data?.country?.iso3 || !props.aiConfigured) return
  newsBriefingLoading.value = true
  try {
    const res = await $fetch<any>('/api/intelligence/ai/news-briefing', {
      query: { iso: props.data.country.iso3 },
    })
    newsBriefingContent.value = res.content || ''
  } catch {}
  newsBriefingLoading.value = false
}

onMounted(() => {
  fetchNewsBriefing()
})

// Reset on data change
watch(() => props.data?.country?.iso3, () => {
  speechAnalysisContent.value = ''
  speechAnalysisExpanded.value = false
  newsBriefingContent.value = ''
  cableContent.value = ''
  showAllianceGraph.value = false
  fetchNewsBriefing()
})

const sections = computed(() => {
  const base: { id: string; label: string }[] = []
  if (props.aiConfigured) base.push({ id: 'intel-overview', label: 'Overview' })
  if (props.data?.recentNews?.length) base.push({ id: 'intel-news', label: 'Situation' })
  if (props.data?.recentStatements?.length) base.push({ id: 'intel-statements', label: 'Statements' })
  base.push(
    { id: 'intel-timeline', label: 'Timeline' },
    { id: 'intel-summary', label: 'Summary' },
    { id: 'intel-themes', label: 'Themes' },
    { id: 'intel-voting', label: 'Voting' },
    { id: 'intel-relationships', label: 'Relations' },
    { id: 'intel-risk', label: 'Risk' },
  )
  if (props.data?.democracy) base.push({ id: 'intel-democracy', label: 'Democracy' })
  if (props.data?.armsTrade) base.push({ id: 'intel-arms', label: 'Arms' })
  if (props.data?.aid) base.push({ id: 'intel-aid', label: 'Aid' })
  if (props.data?.passport) base.push({ id: 'intel-passport', label: 'Passport' })
  if (props.data?.connectivity?.has_data) base.push({ id: 'intel-connectivity', label: 'Connectivity' })
  if (props.data?.alliances?.has_data) base.push({ id: 'intel-alliances', label: 'Alliances' })
  if (props.aiConfigured) base.push({ id: 'intel-cable', label: 'SITREP' })
  base.push({ id: 'intel-treaties', label: 'Treaties' })
  return base
})

const { activeSection, scrollTo } = useSectionNav(sections)

const p5Map: Record<string, string> = { USA: 'United States', GBR: 'United Kingdom', FRA: 'France', RUS: 'Russia', CHN: 'China' }
const p5Order = ['USA', 'GBR', 'FRA', 'RUS', 'CHN']

function p5Label(iso3: string) { return p5Map[iso3] || iso3 }

const sortedP5 = computed(() => {
  if (!props.data?.votingAlignment?.p5) return []
  return p5Order
    .map(code => props.data.votingAlignment.p5.find((p: any) => p.iso3 === code))
    .filter(Boolean)
})

function pct(val: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((val / total) * 100)}%`
}

function sentimentClass(s: string) {
  if (s === 'positive') return 'bg-emerald-100 text-emerald-700'
  if (s === 'negative') return 'bg-red-100 text-red-700'
  if (s === 'mixed') return 'bg-amber-100 text-amber-700'
  return 'bg-primary-100 text-primary-600'
}

function intensityClass(i: string) {
  if (i === 'high') return 'bg-red-100 text-red-700'
  if (i === 'medium') return 'bg-amber-100 text-amber-700'
  if (i === 'low') return 'bg-emerald-100 text-emerald-700'
  return 'bg-primary-100 text-primary-600'
}

function treatyStatusClass(s: string) {
  if (s === 'party') return 'bg-emerald-100 text-emerald-700'
  if (s === 'signatory') return 'bg-blue-100 text-blue-700'
  if (s === 'withdrawn') return 'bg-red-100 text-red-700'
  return 'bg-primary-100 text-primary-500'
}

function truncate(str: string, max: number) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '...' : str
}

function regimeBadge(regime: string) {
  if (regime === 'Liberal Democracy') return 'bg-emerald-100 text-emerald-700'
  if (regime === 'Electoral Democracy') return 'bg-blue-100 text-blue-700'
  if (regime === 'Electoral Autocracy') return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function allianceTypeBadge(type: string) {
  if (type === 'defense') return 'bg-red-100 text-red-700'
  if (type === 'entente') return 'bg-blue-100 text-blue-700'
  if (type === 'neutrality') return 'bg-emerald-100 text-emerald-700'
  return 'bg-primary-100 text-primary-600'
}

function visaPct(count: number) {
  const total = (props.data?.passport?.visa_free || 0) + (props.data?.passport?.visa_on_arrival || 0) + (props.data?.passport?.e_visa || 0) + (props.data?.passport?.visa_required || 0)
  if (!total) return '0%'
  return `${Math.round((count / total) * 100)}%`
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

function stmtTimeAgo(dateStr: string) {
  if (!dateStr) return ''
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const democracyAxes = computed(() => {
  const d = props.data?.democracy?.latest
  if (!d) return []
  return [
    { label: 'Polyarchy', value: d.v2x_polyarchy || 0, rawValue: d.v2x_polyarchy?.toFixed(3) },
    { label: 'Liberal Dem.', value: d.v2x_libdem || 0, rawValue: d.v2x_libdem?.toFixed(3) },
    { label: 'Participatory', value: d.v2x_partipdem || 0, rawValue: d.v2x_partipdem?.toFixed(3) },
    { label: 'Deliberative', value: d.v2x_delibdem || 0, rawValue: d.v2x_delibdem?.toFixed(3) },
    { label: 'Egalitarian', value: d.v2x_egaldem || 0, rawValue: d.v2x_egaldem?.toFixed(3) },
    { label: 'Free Expr.', value: d.v2x_freexp_altinf || 0, rawValue: d.v2x_freexp_altinf?.toFixed(3) },
    { label: 'Assoc.', value: d.v2x_frassoc_thick || 0, rawValue: d.v2x_frassoc_thick?.toFixed(3) },
    { label: 'Suffrage', value: d.v2x_suffr || 0, rawValue: d.v2x_suffr?.toFixed(3) },
    { label: 'Elected Off.', value: d.v2x_elecoff || 0, rawValue: d.v2x_elecoff?.toFixed(3) },
    { label: 'Rule of Law', value: d.v2x_rule || 0, rawValue: d.v2x_rule?.toFixed(3) },
    { label: 'Corruption', value: 1 - (d.v2x_corr || 0), rawValue: (1 - (d.v2x_corr || 0)).toFixed(3) },
    { label: 'Civil Lib.', value: d.v2x_civlib || 0, rawValue: d.v2x_civlib?.toFixed(3) },
  ].filter(m => m.rawValue != null)
})

const democracyMetrics = computed(() => {
  const d = props.data?.democracy?.latest
  if (!d) return []
  return [
    { label: 'Liberal Democracy', value: d.v2x_libdem?.toFixed(3) || 'N/A' },
    { label: 'Participatory Dem.', value: d.v2x_partipdem?.toFixed(3) || 'N/A' },
    { label: 'Deliberative Dem.', value: d.v2x_delibdem?.toFixed(3) || 'N/A' },
    { label: 'Egalitarian Dem.', value: d.v2x_egaldem?.toFixed(3) || 'N/A' },
    { label: 'Rule of Law', value: d.v2x_rule?.toFixed(3) || 'N/A' },
    { label: 'Civil Liberties', value: d.v2x_civlib?.toFixed(3) || 'N/A' },
  ]
})
</script>
