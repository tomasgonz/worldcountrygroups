<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div v-if="error" class="text-center py-20">
      <h1 class="font-serif text-2xl font-bold text-primary-400 mb-2">Country not found</h1>
      <NuxtLink to="/groups" class="text-primary-400 hover:text-primary-900 transition-colors">Browse groups &rarr;</NuxtLink>
    </div>

    <template v-else-if="country">
      <SectionNav
        :sections="visibleSections"
        :active-section="activeSection"
        @navigate="sectionScrollTo"
      />

      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-primary-400 mb-8">
        <NuxtLink to="/groups" class="hover:text-primary-900 transition-colors">Groups</NuxtLink>
        <span class="text-primary-300">/</span>
        <span class="text-primary-600">{{ (country as any).name }}</span>
      </nav>

      <!-- Header -->
      <div class="mb-10">
        <div class="flex items-center gap-4">
          <span v-if="(country as any).iso2" class="text-5xl">{{ isoToFlag((country as any).iso2) }}</span>
          <div>
            <h1 class="font-serif text-3xl sm:text-4xl font-bold text-primary-900">{{ (country as any).name }}</h1>
            <p class="text-primary-500 mt-1 text-sm">
              <span v-if="(country as any).iso2">ISO alpha-2: <strong>{{ (country as any).iso2 }}</strong></span>
              <span v-if="(country as any).iso2 && (country as any).iso3"> &middot; </span>
              <span v-if="(country as any).iso3">alpha-3: <strong>{{ (country as any).iso3 }}</strong></span>
            </p>
          </div>
        </div>
        <CountryNextElection v-if="(country as any).iso3" :iso3="(country as any).iso3" />
        <div v-if="(country as any).iso3" class="mt-4 flex flex-wrap gap-2 text-sm">
          <NuxtLink :to="`/countries/${iso}/news`" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ring-1 ring-primary-200 text-primary-800 hover:bg-primary-50">News &amp; statements &rarr;</NuxtLink>
          <NuxtLink :to="`/countries/${iso}/speeches`" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ring-1 ring-primary-200 text-primary-800 hover:bg-primary-50">UN speeches &rarr;</NuxtLink>
          <NuxtLink :to="`/countries/${iso}/votes`" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ring-1 ring-primary-200 text-primary-800 hover:bg-primary-50">Voting record &rarr;</NuxtLink>
        </div>
        <AskButtons v-if="(country as any).iso3" kind="country" :name="(country as any).name" :iso3="(country as any).iso3" class="mt-4" />
      </div>

      <!-- Country Info Card -->
      <CountryInfoCard v-if="countryInfo" :info="countryInfo" />

      <!-- Leaders and officials (people profiles) -->
      <CountryLeaders v-if="(country as any).iso3" :iso3="(country as any).iso3" />

      <!-- ==================== Category 1: Overview ==================== -->
      <div id="cat-overview" class="mb-16 scroll-mt-24">
        <div class="flex items-center gap-4 mb-8">
          <h2 class="font-serif text-2xl font-bold text-primary-900 whitespace-nowrap">Overview</h2>
          <div class="flex-1 h-px bg-primary-200"></div>
        </div>

        <!-- Zone A: Speech Summary Banner -->
        <div v-if="latestSpeech" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-xs font-medium uppercase tracking-wider text-primary-400">Latest UN Address</span>
            <span :class="sentimentBadgeClass(latestSpeech.analysis?.sentiment?.overall)">
              {{ latestSpeech.analysis?.sentiment?.overall || 'N/A' }}
            </span>
            <span class="text-xs text-primary-300 ml-auto">Session {{ latestSpeech.session }} &middot; {{ latestSpeech.year }}</span>
          </div>
          <p class="text-sm text-primary-700 leading-relaxed">{{ latestSpeech.analysis?.summary }}</p>
          <p class="text-xs text-primary-400 mt-2">&mdash; {{ latestSpeech.speaker }}, {{ latestSpeech.speaker_title }}</p>
        </div>

        <!-- Zone B: Indicator Grid -->
        <template v-if="statsPending || alignmentPending">
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div v-for="i in 4" :key="i" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="skeleton h-3 w-24 rounded mb-4" />
              <div v-for="j in 3" :key="j" class="skeleton h-6 rounded mb-2" />
            </div>
          </div>
        </template>
        <template v-else>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <!-- Society & Development -->
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-3">Society &amp; Development</div>
              <div v-for="ind in briefingSociety" :key="ind.label" class="flex items-center gap-2.5 py-2">
                <span class="w-2 h-2 rounded-full shrink-0" :class="ind.color"></span>
                <span class="text-xs text-primary-500 flex-1">{{ ind.label }}</span>
                <span class="text-sm font-semibold text-primary-800 tabular-nums">{{ ind.value }}</span>
              </div>
            </div>

            <!-- Security & Stability -->
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-3">Security &amp; Stability</div>
              <div v-for="ind in briefingSecurity" :key="ind.label" class="flex items-center gap-2.5 py-2">
                <span class="w-2 h-2 rounded-full shrink-0" :class="ind.color"></span>
                <span class="text-xs text-primary-500 flex-1">{{ ind.label }}</span>
                <span class="text-sm font-semibold text-primary-800 tabular-nums">{{ ind.value }}</span>
              </div>
            </div>

            <!-- Global Standing -->
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-3">Global Standing</div>
              <div v-for="ind in briefingGlobal" :key="ind.label" class="flex items-center gap-2.5 py-2">
                <span class="w-2 h-2 rounded-full shrink-0" :class="ind.color"></span>
                <span class="text-xs text-primary-500 flex-1">{{ ind.label }}</span>
                <span class="text-sm font-semibold text-primary-800 tabular-nums">{{ ind.value }}</span>
              </div>
            </div>

            <!-- Diplomacy & Engagement -->
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs font-medium uppercase tracking-wider text-primary-400 mb-3">Diplomacy &amp; Engagement</div>
              <div v-for="ind in briefingDiplomacy" :key="ind.label" class="flex items-center gap-2.5 py-2">
                <span class="w-2 h-2 rounded-full shrink-0" :class="ind.color"></span>
                <span class="text-xs text-primary-500 flex-1">{{ ind.label }}</span>
                <span class="text-sm font-semibold text-primary-800 tabular-nums">{{ ind.value }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Zone C: Statistics (existing) -->
        <div id="sec-statistics" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Statistics</h3>

          <template v-if="statsPending">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div class="skeleton h-24 rounded-xl" />
              <div class="skeleton h-24 rounded-xl" />
              <div class="skeleton h-24 rounded-xl" />
            </div>
          </template>

          <template v-else-if="hasAnyStats">
            <GroupStats :stats="baseStats" :pending="false" />

            <!-- Extended stats -->
            <div v-if="hasExtendedStats" class="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5">
              <div v-if="extendedStats?.gdp_per_capita" class="bg-white rounded-2xl border border-primary-100 p-6">
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">GDP per Capita</div>
                <div class="text-2xl font-serif font-bold text-primary-900">{{ formatGdpPerCapita(extendedStats.gdp_per_capita) }}</div>
              </div>
              <div v-if="extendedStats?.life_expectancy" class="bg-white rounded-2xl border border-primary-100 p-6">
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Life Expectancy</div>
                <div class="text-2xl font-serif font-bold text-primary-900">{{ formatLifeExpectancy(extendedStats.life_expectancy) }}</div>
              </div>
              <div v-if="extendedStats?.hdi" class="bg-white rounded-2xl border border-primary-100 p-6">
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">HDI</div>
                <div class="text-2xl font-serif font-bold text-primary-900">{{ formatHDI(extendedStats.hdi) }}</div>
              </div>
            </div>

            <!-- Defense Spending -->
            <div v-if="hasDefenseSpending" class="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5">
              <div v-if="extendedStats?.military_expenditure" class="bg-white rounded-2xl border border-primary-100 p-6">
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Defense Spending</div>
                <div class="text-2xl font-serif font-bold text-primary-900">{{ formatDefenseBudget(extendedStats.military_expenditure) }}</div>
                <div class="text-xs text-primary-400 mt-1">SIPRI / World Bank</div>
              </div>
              <div v-if="extendedStats?.military_pct_gdp" class="bg-white rounded-2xl border border-primary-100 p-6">
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Defense % of GDP</div>
                <div class="text-2xl font-serif font-bold text-primary-900">{{ extendedStats.military_pct_gdp.toFixed(2) }}%</div>
              </div>
              <div v-if="extendedStats?.armed_forces_pct" class="bg-white rounded-2xl border border-primary-100 p-6">
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Armed Forces % Labor</div>
                <div class="text-2xl font-serif font-bold text-primary-900">{{ extendedStats.armed_forces_pct.toFixed(2) }}%</div>
              </div>
            </div>
          </template>

          <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-8 text-center">
            <p class="text-primary-400">No statistical data available for this country.</p>
          </div>
        </div>
      </div>

      <!-- ==================== Category 2: United Nations ==================== -->
      <div id="cat-united-nations" class="mb-16 scroll-mt-24">
        <div class="flex items-center gap-4 mb-8">
          <h2 class="font-serif text-2xl font-bold text-primary-900 whitespace-nowrap">United Nations</h2>
          <div class="flex-1 h-px bg-primary-200"></div>
        </div>

        <!-- UN Voting Record -->
        <div id="sec-un-voting" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">UN Voting Record</h3>

          <template v-if="countryVotesPending">
            <div class="space-y-3">
              <div v-for="i in 3" :key="i" class="skeleton h-8 rounded-lg" />
            </div>
          </template>

          <template v-else-if="countryVotesData?.available && lastSession">
            <div class="bg-white rounded-2xl border border-primary-100 p-6">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-4">Session {{ lastSession.session }} (Latest)</div>

              <!-- Last session bar -->
              <div class="flex items-center gap-3 mb-4">
                <div class="flex-1 flex h-6 rounded-full overflow-hidden bg-gray-100">
                  <div
                    v-if="lastSession.yes > 0"
                    class="bg-emerald-400 transition-all"
                    :style="{ width: lastSession.yesPct + '%' }"
                    :title="`Yes: ${lastSession.yes} (${lastSession.yesPct}%)`"
                  />
                  <div
                    v-if="lastSession.no > 0"
                    class="bg-red-400 transition-all"
                    :style="{ width: lastSession.noPct + '%' }"
                    :title="`No: ${lastSession.no} (${lastSession.noPct}%)`"
                  />
                  <div
                    v-if="lastSession.abstain > 0"
                    class="bg-amber-400 transition-all"
                    :style="{ width: lastSession.abstainPct + '%' }"
                    :title="`Abstain: ${lastSession.abstain} (${lastSession.abstainPct}%)`"
                  />
                  <div
                    v-if="lastSession.nv > 0"
                    class="bg-gray-300 transition-all"
                    :style="{ width: lastSession.nvPct + '%' }"
                    :title="`Non-voting: ${lastSession.nv} (${lastSession.nvPct}%)`"
                  />
                </div>
                <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ lastSession.total }} votes</span>
              </div>

              <!-- Summary stats -->
              <div class="grid grid-cols-4 gap-3 mb-4">
                <div class="text-center">
                  <div class="text-lg font-serif font-bold text-emerald-600">{{ lastSession.yes }}</div>
                  <div class="text-[10px] text-primary-400 uppercase">Yes</div>
                </div>
                <div class="text-center">
                  <div class="text-lg font-serif font-bold text-red-600">{{ lastSession.no }}</div>
                  <div class="text-[10px] text-primary-400 uppercase">No</div>
                </div>
                <div class="text-center">
                  <div class="text-lg font-serif font-bold text-amber-600">{{ lastSession.abstain }}</div>
                  <div class="text-[10px] text-primary-400 uppercase">Abstain</div>
                </div>
                <div class="text-center">
                  <div class="text-lg font-serif font-bold text-gray-400">{{ lastSession.nv }}</div>
                  <div class="text-[10px] text-primary-400 uppercase">Non-voting</div>
                </div>
              </div>

              <!-- Legend -->
              <div class="flex flex-wrap gap-4 text-xs text-primary-500">
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-emerald-400"></span> Yes</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-red-400"></span> No</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-amber-400"></span> Abstain</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-gray-300"></span> Non-voting</span>
              </div>
            </div>

            <!-- Recent Votes -->
            <div class="mt-6">
              <h3 class="font-serif text-lg font-bold text-primary-900 mb-3">Recent Votes</h3>
              <div v-if="recentResPending" class="space-y-3">
                <div v-for="i in 5" :key="i" class="skeleton h-10 rounded-lg" />
              </div>
              <div v-else-if="recentResolutions.length" class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
                <div class="divide-y divide-primary-50">
                  <div v-for="r in recentResolutions" :key="r.id">
                    <button
                      class="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
                      @click="toggleRecentRes(r.id)"
                    >
                      <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ r.date }}</span>
                      <span
                        class="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        :class="countryVoteBadgeClass(r.vote)"
                      >{{ countryVoteLabel(r.vote) }}</span>
                      <span class="text-sm text-primary-700 flex-1 min-w-0">
                        <span class="truncate block">{{ r.title }}</span>
                        <span v-if="r.themes?.length" class="flex flex-wrap gap-1 mt-0.5">
                          <span
                            v-for="theme in r.themes"
                            :key="theme"
                            class="inline-block text-[10px] leading-tight px-1.5 py-0.5 rounded-full font-medium"
                            :class="themeBadgeClass(theme)"
                          >{{ theme }}</span>
                        </span>
                      </span>
                      <span class="flex items-center gap-1.5 text-xs tabular-nums whitespace-nowrap">
                        <span class="text-emerald-600">Y:{{ r.globalTally.yes }}</span>
                        <span class="text-red-600">N:{{ r.globalTally.no }}</span>
                        <span class="text-amber-600">A:{{ r.globalTally.abstain }}</span>
                      </span>
                      <svg class="w-4 h-4 text-primary-300 transition-transform" :class="expandedRecentRes === r.id ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
                    </button>
                    <div v-if="expandedRecentRes === r.id" class="px-5 pb-4">
                      <p class="text-sm text-primary-600">{{ r.title }}</p>
                      <p class="text-xs text-primary-400 mt-1">Session {{ r.session }} &middot; Resolution {{ r.id }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-6 text-center">
                <p class="text-primary-400 text-sm">No recent resolution data available.</p>
              </div>
            </div>

            <!-- View Full Record Button -->
            <div class="mt-6 text-center">
              <NuxtLink
                :to="`/countries/${iso}/votes`"
                class="inline-flex items-center gap-2 px-6 py-3 bg-primary-900 text-white rounded-xl font-medium text-sm hover:bg-primary-800 transition-colors"
              >
                View full voting record
                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd" /></svg>
              </NuxtLink>
            </div>
          </template>

          <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-8 text-center">
            <p class="text-primary-400">No UN voting data available for this country.</p>
          </div>
        </div>

        <!-- UNSC Membership -->
        <div v-if="unscData && (unscData.isPermanent || unscData.totalTerms > 0)" id="sec-unsc-membership" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">UN Security Council</h3>
          <div class="bg-white rounded-2xl border border-primary-100 p-6">
            <template v-if="unscData.isPermanent">
              <div class="flex items-center gap-3">
                <span class="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Permanent Member (P5)
                </span>
                <span class="text-sm text-primary-500">Veto power since 1945</span>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center gap-3 mb-4">
                <span class="text-sm text-primary-500">
                  Served <strong class="text-primary-800">{{ unscData.totalTerms }}</strong> {{ unscData.totalTerms === 1 ? 'term' : 'terms' }}
                  ({{ unscData.totalYears }} {{ unscData.totalYears === 1 ? 'year' : 'years' }} total)
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="(term, i) in unscData.terms"
                  :key="i"
                  class="inline-block text-xs px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 tabular-nums"
                >{{ term[0] }}&ndash;{{ term[1] }}</span>
              </div>
            </template>
          </div>
        </div>

        <!-- UNSC Vetoes (P5 only) -->
        <div v-if="vetoesData?.applicable" id="sec-unsc-vetoes" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">
            UNSC Vetoes
            <span class="text-base font-normal text-primary-400">({{ vetoesData.total }})</span>
          </h3>
          <div v-if="vetoesData.vetoes?.length" class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
            <div class="divide-y divide-primary-50">
              <div v-for="v in vetoesData.vetoes.slice(0, showAllVetoes ? undefined : 10)" :key="v.draft" class="px-5 py-3 flex items-center gap-3">
                <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ v.date }}</span>
                <span class="text-sm text-primary-700 flex-1 min-w-0 truncate">{{ v.subject }}</span>
                <span class="text-xs text-primary-400 whitespace-nowrap">{{ v.draft }}</span>
                <span v-if="v.vetoed_by.length > 1" class="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 whitespace-nowrap">Joint</span>
              </div>
            </div>
            <button
              v-if="vetoesData.vetoes.length > 10"
              class="w-full px-5 py-3 text-sm text-primary-500 hover:text-primary-700 border-t border-primary-100 transition-colors"
              @click="showAllVetoes = !showAllVetoes"
            >{{ showAllVetoes ? 'Show less' : `Show all ${vetoesData.total} vetoes` }}</button>
          </div>
        </div>

        <!-- UNSC Votes (SC Voting Record) -->
        <div v-if="unscVotesData?.available" id="sec-unsc-voting-record" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">
            Security Council Voting Record
            <span class="text-base font-normal text-primary-400">({{ unscVotesData.stats?.total }} resolutions)</span>
          </h3>
          <div class="grid grid-cols-3 gap-4 mb-4">
            <div class="bg-white rounded-2xl border border-primary-100 p-4 text-center">
              <div class="text-xl font-serif font-bold text-emerald-600">{{ unscVotesData.stats?.yes }}</div>
              <div class="text-xs text-primary-400 uppercase tracking-wider mt-1">Yes</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-4 text-center">
              <div class="text-xl font-serif font-bold text-red-600">{{ unscVotesData.stats?.no }}</div>
              <div class="text-xs text-primary-400 uppercase tracking-wider mt-1">No</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-4 text-center">
              <div class="text-xl font-serif font-bold text-amber-600">{{ unscVotesData.stats?.abstain }}</div>
              <div class="text-xs text-primary-400 uppercase tracking-wider mt-1">Abstain</div>
            </div>
          </div>
          <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
            <div class="divide-y divide-primary-50">
              <div v-for="r in unscVotesData.resolutions?.slice(0, 15)" :key="r.id" class="px-5 py-3 flex items-center gap-3">
                <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ r.date }}</span>
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                  :class="countryVoteBadgeClass(r.country_vote)"
                >{{ countryVoteLabel(r.country_vote) }}</span>
                <span class="text-sm text-primary-700 flex-1 min-w-0 truncate">{{ r.title }}</span>
                <span v-if="r.vetoed" class="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 whitespace-nowrap">Vetoed</span>
                <span v-else-if="r.adopted" class="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 whitespace-nowrap">Adopted</span>
              </div>
            </div>
          </div>
        </div>

        <!-- UN General Debate Speeches (MOVED here from near bottom) -->
        <div id="sec-speeches" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">UN General Debate Speeches</h3>

          <template v-if="speechesPending">
            <div class="skeleton h-28 rounded-xl" />
          </template>

          <template v-else-if="speechesData?.available && speechesData.speeches.length">
            <div class="bg-white rounded-2xl border border-primary-100 p-6">
              <div class="flex items-center justify-between mb-4">
                <div class="text-sm text-primary-500">
                  {{ speechesData.total }} speech{{ speechesData.total !== 1 ? 'es' : '' }}
                  <span v-if="speechesData.speeches.length >= 2" class="text-primary-400">
                    &middot; {{ speechesData.speeches[speechesData.speeches.length - 1].year }}&ndash;{{ speechesData.speeches[0].year }}
                  </span>
                </div>
                <NuxtLink
                  :to="`/countries/${iso}/speeches`"
                  class="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-900 text-white hover:bg-primary-800 transition-colors"
                >View all speeches &rarr;</NuxtLink>
              </div>

              <!-- Recent speeches (clickable) -->
              <div class="border-t border-primary-100 pt-4 space-y-3">
                <NuxtLink
                  v-for="speech in speechesData.speeches.slice(0, 3)"
                  :key="speech.session"
                  :to="`/countries/${iso}/speeches?session=${speech.session}`"
                  class="block rounded-xl p-3 -mx-1 hover:bg-primary-50/70 transition-colors cursor-pointer"
                >
                  <div class="flex items-start gap-3">
                    <span class="text-lg font-serif font-bold text-primary-900">{{ speech.year }}</span>
                    <div class="flex-1 min-w-0">
                      <div v-if="speech.speaker" class="text-sm text-primary-700 font-medium">
                        {{ speech.speaker }}
                        <span v-if="speech.speaker_title" class="text-primary-400 font-normal"> &middot; {{ speech.speaker_title }}</span>
                      </div>
                      <!-- Analysis preview -->
                      <div v-if="speech.analysis" class="mt-1.5">
                        <div class="flex items-center gap-2 mb-1.5">
                          <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                            :class="speech.analysis.sentiment?.overall === 'positive' ? 'bg-emerald-100 text-emerald-800' : speech.analysis.sentiment?.overall === 'negative' ? 'bg-red-100 text-red-800' : speech.analysis.sentiment?.overall === 'mixed' ? 'bg-amber-100 text-amber-800' : 'bg-primary-100 text-primary-600'"
                          >{{ speech.analysis.sentiment?.overall }}</span>
                          <span v-for="desc in speech.analysis.sentiment?.tone_descriptors?.slice(0, 2)" :key="desc" class="text-xs text-primary-400">{{ desc }}</span>
                        </div>
                        <p class="text-xs text-primary-600 leading-relaxed line-clamp-2">{{ speech.analysis.summary }}</p>
                      </div>
                      <div v-else class="flex flex-wrap gap-1 mt-1.5">
                        <span
                          v-for="kw in speech.keywords.slice(0, 8)"
                          :key="kw"
                          class="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                        >{{ kw }}</span>
                      </div>
                    </div>
                    <svg class="w-4 h-4 text-primary-300 mt-1.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                    </svg>
                  </div>
                </NuxtLink>
              </div>
            </div>
          </template>

          <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-8 text-center">
            <p class="text-primary-400">No UN General Debate speech data available for this country.</p>
          </div>
        </div>
      </div>

      <!-- ==================== Category 3: Governance ==================== -->
      <div v-if="hasGovernance" id="cat-governance" class="mb-16 scroll-mt-24">
        <div class="flex items-center gap-4 mb-8">
          <h2 class="font-serif text-2xl font-bold text-primary-900 whitespace-nowrap">Governance</h2>
          <div class="flex-1 h-px bg-primary-200"></div>
        </div>

        <!-- Democracy (V-Dem) -->
        <div v-if="democracyData?.has_data" id="sec-democracy" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Democracy Indices</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <div v-if="democracyData.latest?.v2x_polyarchy != null" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Electoral Democracy</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ democracyData.latest.v2x_polyarchy.toFixed(2) }}</div>
            </div>
            <div v-if="democracyData.latest?.v2x_libdem != null" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Liberal Democracy</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ democracyData.latest.v2x_libdem.toFixed(2) }}</div>
            </div>
            <div v-if="democracyData.latest?.v2x_partipdem != null" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Participatory</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ democracyData.latest.v2x_partipdem.toFixed(2) }}</div>
            </div>
            <div v-if="democracyData.latest?.v2x_egaldem != null" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Egalitarian</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ democracyData.latest.v2x_egaldem.toFixed(2) }}</div>
            </div>
            <div v-if="democracyData.latest?.v2x_rule != null" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Rule of Law</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ democracyData.latest.v2x_rule.toFixed(2) }}</div>
            </div>
            <div v-if="democracyData.latest?.v2x_civlib != null" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Civil Liberties</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ democracyData.latest.v2x_civlib.toFixed(2) }}</div>
            </div>
            <div v-if="democracyData.latest?.v2x_freexp_altinf != null" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Press Freedom</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ democracyData.latest.v2x_freexp_altinf.toFixed(2) }}</div>
            </div>
            <div v-if="democracyData.latest?.v2x_corr != null" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Corruption</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ democracyData.latest.v2x_corr.toFixed(2) }}</div>
            </div>
          </div>
          <p class="text-xs text-primary-300 mt-3">Source: V-Dem {{ democracyData.latest?.year ? `(${democracyData.latest.year})` : '' }} &mdash; Scale 0-1</p>
        </div>

        <!-- Diplomatic Recognition -->
        <div v-if="recognitionData?.entities?.length" id="sec-recognition" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Diplomatic Recognition</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              v-for="e in recognitionData.entities"
              :key="e.entity.id"
              class="bg-white rounded-2xl border p-5"
              :class="{
                'border-emerald-200': e.stance === 'recognizes',
                'border-amber-200': e.stance === 'withdrawn',
                'border-primary-100': e.stance === 'does_not_recognize',
              }"
            >
              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="text-sm font-medium text-primary-800">{{ e.entity.name }}</span>
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                  :class="{
                    'bg-emerald-100 text-emerald-700': e.stance === 'recognizes',
                    'bg-amber-100 text-amber-700': e.stance === 'withdrawn',
                    'bg-gray-100 text-gray-500': e.stance === 'does_not_recognize',
                  }"
                >{{ e.stance === 'recognizes' ? 'Recognizes' : e.stance === 'withdrawn' ? 'Withdrawn' : 'Does Not Recognize' }}</span>
              </div>
              <div class="text-xs text-primary-400">
                Declared {{ e.entity.declared }} &middot; {{ e.entity.total_recognizers }} countries recognize &middot; {{ e.entity.un_status.replace(/-/g, ' ') }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== Category 4: Security & Defense ==================== -->
      <div id="cat-security" class="mb-16 scroll-mt-24">
        <div class="flex items-center gap-4 mb-8">
          <h2 class="font-serif text-2xl font-bold text-primary-900 whitespace-nowrap">Security &amp; Defense</h2>
          <div class="flex-1 h-px bg-primary-200"></div>
        </div>

        <!-- Military & Defense -->
        <div id="sec-military" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Military &amp; Defense</h3>

          <!-- Military Capabilities (Global Firepower) -->
          <div class="mb-8">
            <h3 class="font-serif text-lg font-bold text-primary-900 mb-3">Military Capabilities</h3>
            <template v-if="militaryPending">
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div v-for="i in 6" :key="i" class="skeleton h-24 rounded-xl" />
              </div>
            </template>
            <template v-else-if="militaryData?.has_data">
              <div class="mb-4">
                <span class="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full bg-primary-100 text-primary-800">
                  Power Index Rank: #{{ militaryData.rank }} of 145
                </span>
                <span class="ml-2 text-sm text-primary-500">Score: {{ militaryData.power_index.toFixed(4) }}</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div class="bg-white rounded-2xl border border-primary-100 p-5">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Active Personnel</div>
                  <div class="text-xl font-serif font-bold text-primary-900">{{ formatMilitary(militaryData.active_military) }}</div>
                </div>
                <div class="bg-white rounded-2xl border border-primary-100 p-5">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Reserve</div>
                  <div class="text-xl font-serif font-bold text-primary-900">{{ formatMilitary(militaryData.reserve_military) }}</div>
                </div>
                <div class="bg-white rounded-2xl border border-primary-100 p-5">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Aircraft</div>
                  <div class="text-xl font-serif font-bold text-primary-900">{{ formatMilitary(militaryData.aircraft_total) }}</div>
                  <div class="text-xs text-primary-400 mt-1">{{ militaryData.fighter_aircraft }} fighters</div>
                </div>
                <div class="bg-white rounded-2xl border border-primary-100 p-5">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Tanks</div>
                  <div class="text-xl font-serif font-bold text-primary-900">{{ formatMilitary(militaryData.tank_strength) }}</div>
                </div>
                <div class="bg-white rounded-2xl border border-primary-100 p-5">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Naval Vessels</div>
                  <div class="text-xl font-serif font-bold text-primary-900">{{ formatMilitary(militaryData.naval_total) }}</div>
                  <div v-if="militaryData.submarines > 0" class="text-xs text-primary-400 mt-1">{{ militaryData.submarines }} submarines</div>
                </div>
                <div class="bg-white rounded-2xl border border-primary-100 p-5">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Defense Budget</div>
                  <div class="text-xl font-serif font-bold text-primary-900">{{ formatDefenseBudget(militaryData.defense_budget) }}</div>
                </div>
              </div>
            </template>
            <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-6 text-center">
              <p class="text-primary-400 text-sm">No military capabilities data available for this country.</p>
            </div>
          </div>

          <!-- Conflict Events (UCDP) -->
          <div>
            <h3 class="font-serif text-lg font-bold text-primary-900 mb-3">
              Conflict Events<template v-if="conflictData?.meta?.period_start && conflictData?.meta?.period_end"> ({{ conflictData.meta.period_start.slice(0, 4) }} to {{ conflictData.meta.period_end }})</template>
            </h3>
            <template v-if="conflictPending">
              <div class="skeleton h-32 rounded-xl" />
            </template>
            <template v-else-if="conflictData?.has_data">
              <div class="bg-white rounded-2xl border border-primary-100 p-6">
                <div class="flex items-center gap-3 mb-4">
                  <span
                    class="text-xs font-semibold px-3 py-1 rounded-full"
                    :class="intensityBadgeClass(conflictData.conflict_intensity)"
                  >{{ conflictData.conflict_intensity.toUpperCase() }} intensity</span>
                  <span class="text-sm text-primary-500">
                    {{ conflictData.total_events.toLocaleString() }} events &middot;
                    {{ conflictData.total_fatalities.toLocaleString() }} fatalities
                  </span>
                </div>

                <!-- By type breakdown -->
                <div class="space-y-2 mb-5">
                  <div v-for="(typeData, typeKey) in conflictData.by_type" :key="typeKey" class="flex items-center gap-3">
                    <span class="text-xs text-primary-500 w-40 truncate">{{ formatConflictType(typeKey) }}</span>
                    <div class="flex-1 h-4 bg-primary-50 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full"
                        :class="conflictBarClass(typeKey)"
                        :style="{ width: Math.max((typeData.events / conflictData.total_events) * 100, 1) + '%' }"
                      />
                    </div>
                    <span class="text-xs text-primary-400 tabular-nums w-20 text-right">{{ typeData.events.toLocaleString() }}</span>
                  </div>
                </div>

                <!-- Year trend -->
                <div class="border-t border-primary-100 pt-4">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Year-over-Year Trend</div>
                  <div class="flex items-end gap-2 h-16">
                    <div v-for="t in conflictData.trend" :key="t.year" class="flex-1 flex flex-col items-center gap-1">
                      <div
                        class="w-full bg-red-200 rounded-t"
                        :style="{ height: Math.max((t.fatalities / maxTrendFatalities) * 48, 4) + 'px' }"
                        :title="`${t.fatalities.toLocaleString()} fatalities`"
                      />
                      <span class="text-[10px] text-primary-400">{{ t.year }}<template v-if="t.partial">*</template></span>
                    </div>
                  </div>
                </div>

                <!-- Last 12 months + deadliest conflicts -->
                <div v-if="conflictData.last_12_months || conflictData.top_conflicts?.length" class="border-t border-primary-100 pt-4 mt-4">
                  <div v-if="conflictData.last_12_months" class="text-xs text-primary-500 mb-2">
                    Last 12 months: {{ conflictData.last_12_months.events.toLocaleString() }} events,
                    {{ conflictData.last_12_months.fatalities.toLocaleString() }} fatalities<template v-if="conflictData.latest_event_date">; latest event {{ conflictData.latest_event_date }}</template>
                  </div>
                  <div v-for="tc in (conflictData.top_conflicts || []).slice(0, 3)" :key="tc.id" class="flex items-baseline gap-2 text-xs py-0.5">
                    <span class="w-2 h-2 rounded-sm shrink-0" :class="conflictBarClass(tc.type)"></span>
                    <span class="text-primary-700 flex-1 min-w-0 truncate" :title="tc.name">{{ tc.name }}</span>
                    <span class="text-red-500 tabular-nums shrink-0">{{ tc.fatalities.toLocaleString() }} killed</span>
                  </div>
                </div>
                <p class="text-[11px] text-primary-400 mt-3">
                  Source: {{ conflictData.meta?.source || 'UCDP' }}. Best-estimate fatalities<template v-if="conflictData.meta?.candidate_from">; data from {{ conflictData.meta.candidate_from.slice(0, 7) }} is provisional</template>.
                  <NuxtLink to="/conflicts" class="underline hover:text-primary-600">All countries</NuxtLink>
                </p>
              </div>
            </template>
            <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-6 text-center">
              <p class="text-primary-400 text-sm">No organised violence recorded by UCDP<template v-if="conflictData?.meta?.period"> ({{ conflictData.meta.period }})</template>.</p>
            </div>
          </div>
        </div>

        <!-- Arms Trade (SIPRI) -->
        <div v-if="armsTradeData?.has_data" id="sec-arms-trade" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Arms Trade</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Total Exports</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ formatTIV(armsTradeData.total_exports) }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Total Imports</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ formatTIV(armsTradeData.total_imports) }}</div>
            </div>
            <div v-if="armsTradeData.export_rank" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Export Rank</div>
              <div class="text-xl font-serif font-bold text-primary-900">#{{ armsTradeData.export_rank }}</div>
            </div>
            <div v-if="armsTradeData.import_rank" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Import Rank</div>
              <div class="text-xl font-serif font-bold text-primary-900">#{{ armsTradeData.import_rank }}</div>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div v-if="armsTradeData.top_recipients?.length">
              <h3 class="text-sm font-semibold text-primary-700 mb-3">Top Recipients</h3>
              <div class="space-y-2">
                <div v-for="p in armsTradeData.top_recipients.slice(0, 5)" :key="p.iso3" class="flex justify-between text-sm">
                  <span class="text-primary-600">{{ countryLookup.get(p.iso3)?.name || p.iso3 }}</span>
                  <span class="text-primary-400 tabular-nums">{{ formatTIV(p.tiv ?? p.total) }}</span>
                </div>
              </div>
            </div>
            <div v-if="armsTradeData.top_suppliers?.length">
              <h3 class="text-sm font-semibold text-primary-700 mb-3">Top Suppliers</h3>
              <div class="space-y-2">
                <div v-for="p in armsTradeData.top_suppliers.slice(0, 5)" :key="p.iso3" class="flex justify-between text-sm">
                  <span class="text-primary-600">{{ countryLookup.get(p.iso3)?.name || p.iso3 }}</span>
                  <span class="text-primary-400 tabular-nums">{{ formatTIV(p.tiv ?? p.total) }}</span>
                </div>
              </div>
            </div>
          </div>
          <p class="text-xs text-primary-300 mt-3">Source: SIPRI Arms Transfers Database, deliveries 2015&ndash;2025 (TIV = Trend Indicator Values)</p>
        </div>

        <!-- Alliances (COW) - MOVED here from after Visa -->
        <div v-if="alliancesData?.has_data" id="sec-alliances" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Military Alliances</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Total Alliances</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ alliancesData.total_alliances }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Active</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ alliancesData.active_alliances }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Defense Pacts</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ alliancesData.defense_pacts }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Current Allies</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ alliancesData.allies?.length || 0 }}</div>
            </div>
          </div>
          <div v-if="alliancesData.alliances?.length" class="space-y-2">
            <h3 class="text-sm font-semibold text-primary-700 mb-2">Active Alliances</h3>
            <div v-for="a in alliancesData.alliances?.filter((x: any) => !x.end_year).slice(0, 10)" :key="a.id" class="bg-white rounded-xl border border-primary-100 px-4 py-3 flex items-center justify-between">
              <div>
                <span class="text-sm font-medium text-primary-800">{{ a.name || `Alliance #${a.id}` }}</span>
                <span class="text-xs text-primary-400 ml-2">{{ a.type }} &middot; since {{ a.start_year }}</span>
              </div>
              <span class="text-xs text-primary-400">{{ a.members?.length || 0 }} members</span>
            </div>
          </div>
          <p class="text-xs text-primary-300 mt-3">Source: Correlates of War Formal Alliances v4.1. Data ends in 2012, so later treaties and accessions (e.g. NATO enlargement since 2004) are not shown.</p>
        </div>
      </div>

      <!-- ==================== Category 5: Diplomacy ==================== -->
      <div v-if="hasDiplomacy" id="cat-diplomacy" class="mb-16 scroll-mt-24">
        <div class="flex items-center gap-4 mb-8">
          <h2 class="font-serif text-2xl font-bold text-primary-900 whitespace-nowrap">Diplomacy</h2>
          <div class="flex-1 h-px bg-primary-200"></div>
        </div>

        <!-- Treaty Status -->
        <div v-if="treatiesData?.treaties?.length" id="sec-treaties" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Treaty Status</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="t in treatiesData.treaties"
              :key="t.treaty.id"
              class="bg-white rounded-2xl border p-5"
              :class="{
                'border-emerald-200': t.status === 'party',
                'border-amber-200': t.status === 'signatory',
                'border-red-200': t.status === 'withdrawn',
                'border-primary-100': t.status === 'none',
              }"
            >
              <div class="flex items-start justify-between gap-2 mb-2">
                <span class="text-sm font-medium text-primary-800">{{ t.treaty.short_name }}</span>
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                  :class="{
                    'bg-emerald-100 text-emerald-700': t.status === 'party',
                    'bg-amber-100 text-amber-700': t.status === 'signatory',
                    'bg-red-100 text-red-700': t.status === 'withdrawn',
                    'bg-gray-100 text-gray-500': t.status === 'none',
                  }"
                >{{ t.status === 'party' ? 'Party' : t.status === 'signatory' ? 'Signatory Only' : t.status === 'withdrawn' ? 'Withdrawn' : 'Not Party' }}</span>
              </div>
              <div class="text-xs text-primary-400">{{ t.treaty.category }} &middot; {{ t.treaty.adopted }}</div>
            </div>
          </div>
        </div>

        <!-- Sanctions -->
        <div v-if="sanctionsData" id="sec-sanctions" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Sanctions</h3>
          <div v-if="sanctionsData.sanctioned" class="space-y-3">
            <div
              v-for="r in sanctionsData.regimes"
              :key="r.id"
              class="bg-white rounded-2xl border border-red-200 p-5"
            >
              <div class="flex items-center gap-3 mb-2">
                <span class="text-sm font-medium text-primary-800">{{ r.name }}</span>
                <span class="text-xs text-primary-400">{{ r.resolution }}</span>
              </div>
              <div class="text-xs text-primary-400 mb-2">
                Established {{ r.established }}
                <template v-if="r.listed_individuals != null">
                  &middot; {{ r.listed_individuals }} individuals and {{ r.listed_entities }} entities listed
                </template>
                <template v-if="r.latest_listing">&middot; latest listing {{ r.latest_listing }}</template>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="m in r.measures"
                  :key="m"
                  class="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600"
                >{{ m.replace(/_/g, ' ') }}</span>
              </div>
              <p v-if="r.note" class="text-xs text-primary-400 mt-2">{{ r.note }}</p>
              <div v-if="r.recent_listings?.length" class="mt-3 border-t border-red-100 pt-2">
                <div class="text-[10px] text-primary-400 font-medium uppercase tracking-wider mb-1">Most recent listings</div>
                <div v-for="l in r.recent_listings" :key="l.reference" class="flex items-baseline gap-2 text-xs py-0.5">
                  <span class="text-primary-400 tabular-nums w-20 shrink-0">{{ l.listed_on }}</span>
                  <span class="text-primary-700 flex-1 min-w-0 truncate">{{ l.name }}</span>
                  <span class="text-primary-400 shrink-0">{{ l.reference }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-6 text-center">
            <p class="text-primary-400 text-sm">No active UN sanctions against this country.</p>
          </div>
          <div
            v-if="sanctionsData.listings && (sanctionsData.listings.individuals || sanctionsData.listings.entities)"
            class="mt-3 bg-white rounded-2xl border border-primary-100 p-5"
          >
            <div class="text-sm text-primary-700">
              On the UN Security Council Consolidated List:
              <strong>{{ sanctionsData.listings.individuals }}</strong> individuals with this nationality
              and <strong>{{ sanctionsData.listings.entities }}</strong> entities located here.
            </div>
            <div class="flex flex-wrap gap-1.5 mt-2">
              <span
                v-for="b in sanctionsData.listings.by_regime"
                :key="b.id"
                class="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600"
              >{{ b.name }}: {{ b.count }}</span>
            </div>
            <div v-if="sanctionsData.listings.recent?.length" class="mt-3 border-t border-primary-100 pt-2">
              <div class="text-[10px] text-primary-400 font-medium uppercase tracking-wider mb-1">Recently listed</div>
              <div v-for="l in sanctionsData.listings.recent.slice(0, 5)" :key="l.reference" class="flex items-baseline gap-2 text-xs py-0.5">
                <span class="text-primary-400 tabular-nums w-20 shrink-0">{{ l.listed_on }}</span>
                <span class="text-primary-700 flex-1 min-w-0 truncate">{{ l.name }}</span>
                <span class="text-primary-400 shrink-0">{{ l.reference }}</span>
              </div>
            </div>
          </div>
          <p v-if="sanctionsData.source?.list_generated" class="text-[11px] text-primary-400 mt-2">
            Source: <a :href="sanctionsData.source.url || 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list'" target="_blank" rel="noopener" class="underline hover:text-primary-600">UN Security Council Consolidated List</a>,
            generated {{ sanctionsData.source.list_generated.slice(0, 10) }}.
          </p>
        </div>

        <!-- Visa / Passport - MOVED here from after Alliances -->
        <div v-if="visaData?.has_data" id="sec-visa" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Passport &amp; Visa</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Mobility Score</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ visaData.mobility_score }}</div>
              <div v-if="visaData.mobility_rank" class="text-xs text-primary-400 mt-1">Rank #{{ visaData.mobility_rank }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Visa Free</div>
              <div class="text-2xl font-serif font-bold text-green-600">{{ visaData.visa_free }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Visa on Arrival</div>
              <div class="text-2xl font-serif font-bold text-blue-600">{{ visaData.visa_on_arrival }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Visa Required</div>
              <div class="text-2xl font-serif font-bold text-amber-600">{{ visaData.visa_required }}</div>
            </div>
          </div>
          <p class="text-xs text-primary-300 mt-3">Source: Passport Index Dataset</p>
        </div>
      </div>

      <!-- ==================== Partners: trade and aid ==================== -->
      <div v-if="(country as any).iso3" id="cat-partners" class="mb-16 scroll-mt-24">
        <div class="flex items-center gap-4 mb-8">
          <h2 class="font-serif text-2xl font-bold text-primary-900 whitespace-nowrap">Trade and aid partners</h2>
          <div class="flex-1 h-px bg-primary-200"></div>
        </div>
        <div id="sec-trade-partners" class="mb-10 scroll-mt-24">
          <div class="flex items-baseline justify-between gap-2 mb-4">
            <h3 class="font-serif text-lg font-bold text-primary-800">Trade with emerging economies</h3>
            <NuxtLink :to="`/partners/trade?country=${(country as any).iso3}`" class="text-xs text-accent-600 hover:underline">Trade tracker &rarr;</NuxtLink>
          </div>
          <CountryTradePartners :iso3="(country as any).iso3" />
        </div>
        <div id="sec-aid-profile" class="mb-10 scroll-mt-24">
          <div class="flex items-baseline justify-between gap-2 mb-4">
            <h3 class="font-serif text-lg font-bold text-primary-800">Development aid</h3>
            <NuxtLink :to="`/partners/donors?donor=${(country as any).iso3}`" class="text-xs text-accent-600 hover:underline">Donor tracker &rarr;</NuxtLink>
          </div>
          <CountryAidProfile :iso3="(country as any).iso3" :tip="false" />
        </div>
      </div>

      <!-- ==================== Category 6: Development & Connectivity ==================== -->
      <div v-if="hasEconomyInfra" id="cat-economy" class="mb-16 scroll-mt-24">
        <div class="flex items-center gap-4 mb-8">
          <h2 class="font-serif text-2xl font-bold text-primary-900 whitespace-nowrap">Development &amp; Connectivity</h2>
          <div class="flex-1 h-px bg-primary-200"></div>
        </div>

        <!-- Foreign Aid (ODA) -->
        <div v-if="odaData?.has_data" id="sec-oda" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Foreign Aid (ODA)</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div v-if="odaData.is_donor" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Total Given</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ formatODA(odaData.total_given) }}</div>
            </div>
            <div v-if="odaData.total_received > 0" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Total Received</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ formatODA(odaData.total_received) }}</div>
            </div>
            <div v-if="odaData.oda_gni_ratio" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">ODA/GNI Ratio</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ odaData.oda_gni_ratio.toFixed(2) }}%<span v-if="odaData.oda_gni_year" class="text-xs font-sans font-normal text-primary-400 ml-1">({{ odaData.oda_gni_year }})</span></div>
            </div>
            <div v-if="odaData.donor_rank" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Donor Rank</div>
              <div class="text-xl font-serif font-bold text-primary-900">#{{ odaData.donor_rank }}</div>
            </div>
            <div v-if="odaData.recipient_rank" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Recipient Rank</div>
              <div class="text-xl font-serif font-bold text-primary-900">#{{ odaData.recipient_rank }}</div>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div v-if="odaData.top_recipients?.length">
              <h3 class="text-sm font-semibold text-primary-700 mb-3">Top Recipients</h3>
              <div class="space-y-2">
                <div v-for="p in odaData.top_recipients.slice(0, 5)" :key="p.iso3" class="flex justify-between text-sm">
                  <span class="text-primary-600">{{ countryLookup.get(p.iso3)?.name || p.iso3 }}</span>
                  <span class="text-primary-400 tabular-nums">{{ formatODA(p.total) }}</span>
                </div>
              </div>
            </div>
            <div v-if="odaData.top_donors?.length">
              <h3 class="text-sm font-semibold text-primary-700 mb-3">Top Donors</h3>
              <div class="space-y-2">
                <div v-for="p in odaData.top_donors.slice(0, 5)" :key="p.iso3" class="flex justify-between text-sm">
                  <span class="text-primary-600">{{ countryLookup.get(p.iso3)?.name || p.iso3 }}</span>
                  <span class="text-primary-400 tabular-nums">{{ formatODA(p.total) }}</span>
                </div>
              </div>
            </div>
          </div>
          <p class="text-xs text-primary-300 mt-3">Source: OECD DAC, net ODA 2020&ndash;2024 in current USD</p>
        </div>

        <!-- Submarine Cables -->
        <div v-if="cablesData?.has_data" id="sec-cables" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">Submarine Cables</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Cables</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ cablesData.cable_count }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Landing Points</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ cablesData.landing_points }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Connected Countries</div>
              <div class="text-2xl font-serif font-bold text-primary-900">{{ cablesData.connected_countries?.length || 0 }}</div>
            </div>
            <div v-if="cablesData.connectivity_rank" class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Connectivity Rank</div>
              <div class="text-2xl font-serif font-bold text-primary-900">#{{ cablesData.connectivity_rank }}</div>
            </div>
          </div>
          <div v-if="cablesData.cables?.length" class="space-y-2">
            <h3 class="text-sm font-semibold text-primary-700 mb-2">Notable Cables</h3>
            <div v-for="c in cablesData.cables.slice(0, 8)" :key="c.id" class="bg-white rounded-xl border border-primary-100 px-4 py-2.5 flex items-center justify-between text-sm">
              <span class="text-primary-700 font-medium">{{ c.name }}</span>
              <div class="flex items-center gap-3 text-xs text-primary-400">
                <span v-if="c.rfs_year">{{ c.rfs_year }}</span>
                <span v-if="c.length_km">{{ (c.length_km / 1000).toFixed(0) }}K km</span>
                <span>{{ c.landing_countries?.length || 0 }} countries</span>
              </div>
            </div>
          </div>
          <p class="text-xs text-primary-300 mt-3">Source: TeleGeography Submarine Cable Map</p>
        </div>
      </div>

      <!-- ==================== Category 7: Media & Events ==================== -->
      <div id="cat-media" class="mb-16 scroll-mt-24">
        <div class="flex items-center gap-4 mb-8">
          <h2 class="font-serif text-2xl font-bold text-primary-900 whitespace-nowrap">Media &amp; Events</h2>
          <div class="flex-1 h-px bg-primary-200"></div>
        </div>

        <!-- GDELT Events & Tone -->
        <div id="sec-gdelt" class="mb-10 scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">GDELT Events &amp; Media Tone</h3>

          <template v-if="gdeltPending">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="skeleton h-24 rounded-xl" />
              <div class="skeleton h-24 rounded-xl" />
              <div class="skeleton h-24 rounded-xl" />
            </div>
          </template>

          <template v-else-if="gdeltData?.has_data">
            <!-- Media Tone -->
            <div class="mb-6">
              <h3 class="font-serif text-lg font-bold text-primary-900 mb-3">Media Tone &amp; Coverage</h3>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div class="bg-white rounded-2xl border border-primary-100 p-5">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Average Tone</div>
                  <div
                    class="text-2xl font-serif font-bold"
                    :class="gdeltData.media.avg_tone >= 0 ? 'text-emerald-600' : 'text-red-600'"
                  >{{ gdeltData.media.avg_tone.toFixed(2) }}</div>
                  <div class="text-xs text-primary-400 mt-1">{{ gdeltData.media.avg_tone >= 0 ? 'Positive' : 'Negative' }} sentiment</div>
                </div>
                <div class="bg-white rounded-2xl border border-primary-100 p-5">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Article Volume</div>
                  <div class="text-2xl font-serif font-bold text-primary-900">{{ formatGdeltVolume(gdeltData.media.article_volume) }}</div>
                  <div class="text-xs text-primary-400 mt-1">{{ gdeltData.media.volume_period || 'Last 12 months' }}</div>
                </div>
                <div class="bg-white rounded-2xl border border-primary-100 p-5">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Cooperation Ratio</div>
                  <div class="text-2xl font-serif font-bold text-primary-900">{{ (gdeltData.events.cooperation_ratio * 100).toFixed(1) }}%</div>
                  <div class="text-xs text-primary-400 mt-1">Of cooperative + conflictual</div>
                </div>
              </div>

              <!-- Monthly Sparkline -->
              <div v-if="gdeltData.media.monthly_trend?.length" class="bg-white rounded-2xl border border-primary-100 p-5">
                <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Monthly Article Volume</div>
                <div class="flex items-end gap-1 h-16">
                  <div
                    v-for="(vol, i) in gdeltData.media.monthly_trend"
                    :key="i"
                    class="flex-1 bg-indigo-200 rounded-t hover:bg-indigo-400 transition-colors"
                    :style="{ height: Math.max((vol / maxMonthlyVolume) * 56, 4) + 'px' }"
                    :title="`Month ${i + 1}: ${vol.toLocaleString()} articles`"
                  />
                </div>
                <div class="flex justify-between text-[10px] text-primary-400 mt-1">
                  <span>12 months ago</span>
                  <span>Now</span>
                </div>
              </div>
            </div>

            <!-- Event Breakdown -->
            <div class="mb-6">
              <h3 class="font-serif text-lg font-bold text-primary-900 mb-3">Event Breakdown</h3>
              <div class="bg-white rounded-2xl border border-primary-100 p-5">
                <!-- Cooperation vs Conflict split bar -->
                <div class="mb-4">
                  <div class="flex items-center gap-3 mb-2">
                    <div class="flex-1 flex h-6 rounded-full overflow-hidden bg-gray-100">
                      <div
                        class="bg-emerald-400 transition-all"
                        :style="{ width: (gdeltData.events.cooperation_ratio * 100) + '%' }"
                        :title="`Cooperative: ${gdeltData.events.cooperative.toLocaleString()}`"
                      />
                      <div
                        class="bg-red-400 transition-all"
                        :style="{ width: ((1 - gdeltData.events.cooperation_ratio) * 100) + '%' }"
                        :title="`Conflictual: ${gdeltData.events.conflictual.toLocaleString()}`"
                      />
                    </div>
                  </div>
                  <div class="flex gap-4 text-xs text-primary-500">
                    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-emerald-400"></span> Cooperative ({{ gdeltData.events.cooperative.toLocaleString() }})</span>
                    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-red-400"></span> Conflictual ({{ gdeltData.events.conflictual.toLocaleString() }})</span>
                  </div>
                </div>

                <!-- Stat cards -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div class="text-center p-3 bg-primary-50 rounded-xl">
                    <div class="text-lg font-serif font-bold text-primary-900">{{ gdeltData.events.total.toLocaleString() }}</div>
                    <div class="text-[10px] text-primary-400 uppercase">Total Events</div>
                  </div>
                  <div class="text-center p-3 bg-primary-50 rounded-xl">
                    <div class="text-lg font-serif font-bold text-emerald-600">{{ gdeltData.events.cooperative.toLocaleString() }}</div>
                    <div class="text-[10px] text-primary-400 uppercase">Cooperative</div>
                  </div>
                  <div class="text-center p-3 bg-primary-50 rounded-xl">
                    <div class="text-lg font-serif font-bold text-red-600">{{ gdeltData.events.conflictual.toLocaleString() }}</div>
                    <div class="text-[10px] text-primary-400 uppercase">Conflictual</div>
                  </div>
                  <div class="text-center p-3 bg-primary-50 rounded-xl">
                    <div class="text-lg font-serif font-bold text-primary-900">{{ gdeltData.events.goldstein_avg.toFixed(1) }}</div>
                    <div class="text-[10px] text-primary-400 uppercase">Avg Goldstein</div>
                  </div>
                </div>

                <!-- CAMEO root code bars -->
                <div v-if="topCameoCodes.length" class="border-t border-primary-100 pt-4">
                  <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">CAMEO Event Types (Top 10)</div>
                  <div class="space-y-2">
                    <div v-for="c in topCameoCodes" :key="c.code" class="flex items-center gap-3">
                      <span class="text-xs text-primary-500 w-36 truncate">{{ cameoLabel(c.code) }}</span>
                      <div class="flex-1 h-4 bg-primary-50 rounded-full overflow-hidden">
                        <div
                          class="h-full rounded-full"
                          :class="parseInt(c.code) <= 10 ? 'bg-emerald-300' : 'bg-red-300'"
                          :style="{ width: Math.max((c.count / topCameoCodes[0].count) * 100, 2) + '%' }"
                        />
                      </div>
                      <span class="text-xs text-primary-400 tabular-nums w-16 text-right">{{ c.count.toLocaleString() }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Most Co-mentioned Countries -->
            <div v-if="gdeltData.bilateral?.length">
              <h3 class="font-serif text-lg font-bold text-primary-900 mb-1">Most Co-mentioned Countries</h3>
              <p class="text-xs text-primary-400 mb-3">Countries that appear most often alongside this one in GDELT-coded news events. Reflects media attention, not formal diplomatic ties.</p>
              <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
                <div class="divide-y divide-primary-50">
                  <NuxtLink
                    v-for="bp in gdeltData.bilateral.slice(0, 5)"
                    :key="bp.partner"
                    :to="`/countries/${bp.partner}`"
                    class="px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
                  >
                    <span v-if="partnerIso2(bp.partner)" class="text-base">{{ isoToFlag(partnerIso2(bp.partner)) }}</span>
                    <span class="text-sm text-primary-800 flex-1">{{ partnerName(bp.partner) }}</span>
                    <div class="flex items-center gap-2">
                      <div class="w-16 h-3 rounded-full overflow-hidden bg-gray-100 hidden sm:block">
                        <div
                          class="h-full rounded-full bg-emerald-400"
                          :style="{ width: (bp.cooperation_ratio * 100) + '%' }"
                        />
                      </div>
                      <span class="text-xs tabular-nums" :class="bp.avg_tone >= 0 ? 'text-emerald-600' : 'text-red-600'">
                        {{ bp.avg_tone >= 0 ? '+' : '' }}{{ bp.avg_tone.toFixed(1) }}
                      </span>
                      <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ bp.events.toLocaleString() }} events</span>
                    </div>
                  </NuxtLink>
                </div>
              </div>
            </div>
          </template>

          <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-8 text-center">
            <p class="text-primary-400">No GDELT event data available for this country.</p>
          </div>
        </div>
      </div>

      <!-- ==================== Category 8: Memberships ==================== -->
      <div id="cat-memberships" class="mb-16 scroll-mt-24">
        <div class="flex items-center gap-4 mb-8">
          <h2 class="font-serif text-2xl font-bold text-primary-900 whitespace-nowrap">Memberships</h2>
          <div class="flex-1 h-px bg-primary-200"></div>
        </div>

        <div id="sec-memberships" class="scroll-mt-24">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-4">
            Group Memberships
            <span class="text-base font-normal text-primary-400">({{ (country as any).groups.length }})</span>
          </h3>

          <!-- Rankings table -->
          <div v-if="rankings && !rankingsPending" class="bg-white rounded-2xl border border-primary-100 overflow-hidden mb-8">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-primary-100 text-left">
                    <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Group</th>
                    <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">GDP</th>
                    <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">GDP %</th>
                    <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Population</th>
                    <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Pop %</th>
                    <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right hidden sm:table-cell">CO2</th>
                    <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right hidden sm:table-cell">CO2 %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="r in (rankings as any[])"
                    :key="r.gid"
                    class="border-b border-primary-50 last:border-0 hover:bg-primary-50/50 transition-colors"
                  >
                    <td class="px-5 py-3">
                      <NuxtLink :to="`/groups/${r.gid}`" class="font-medium text-primary-800 hover:text-primary-600 transition-colors">
                        {{ r.acronym }}
                      </NuxtLink>
                      <span class="text-primary-300 text-xs ml-1">({{ r.country_count }})</span>
                    </td>
                    <td class="px-5 py-3 text-right tabular-nums">
                      <template v-if="r.gdp.value !== null">
                        <span class="text-primary-700">{{ formatNumber(r.gdp.value) }}</span>
                        <span class="text-primary-400 text-xs ml-1">#{{ r.gdp.rank }}</span>
                      </template>
                      <span v-else class="text-primary-200">-</span>
                    </td>
                    <td class="px-5 py-3 text-right tabular-nums">
                      <template v-if="r.gdp.pct !== null">
                        <div class="flex items-center justify-end gap-2">
                          <div class="w-12 h-1 bg-primary-100 rounded-full overflow-hidden">
                            <div class="h-full bg-primary-300 rounded-full" :style="{ width: Math.min(r.gdp.pct, 100) + '%' }"></div>
                          </div>
                          <span class="text-primary-500 text-xs w-12 text-right">{{ r.gdp.pct }}%</span>
                        </div>
                      </template>
                      <span v-else class="text-primary-200">-</span>
                    </td>
                    <td class="px-5 py-3 text-right tabular-nums">
                      <template v-if="r.population.value !== null">
                        <span class="text-primary-700">{{ formatPopulation(r.population.value) }}</span>
                        <span class="text-primary-400 text-xs ml-1">#{{ r.population.rank }}</span>
                      </template>
                      <span v-else class="text-primary-200">-</span>
                    </td>
                    <td class="px-5 py-3 text-right tabular-nums">
                      <template v-if="r.population.pct !== null">
                        <div class="flex items-center justify-end gap-2">
                          <div class="w-12 h-1 bg-primary-100 rounded-full overflow-hidden">
                            <div class="h-full bg-primary-300 rounded-full" :style="{ width: Math.min(r.population.pct, 100) + '%' }"></div>
                          </div>
                          <span class="text-primary-500 text-xs w-12 text-right">{{ r.population.pct }}%</span>
                        </div>
                      </template>
                      <span v-else class="text-primary-200">-</span>
                    </td>
                    <td class="px-5 py-3 text-right tabular-nums hidden sm:table-cell">
                      <template v-if="r.co2.value !== null">
                        <span class="text-primary-700">{{ formatCO2(r.co2.value) }}</span>
                        <span class="text-primary-400 text-xs ml-1">#{{ r.co2.rank }}</span>
                      </template>
                      <span v-else class="text-primary-200">-</span>
                    </td>
                    <td class="px-5 py-3 text-right tabular-nums hidden sm:table-cell">
                      <template v-if="r.co2.pct !== null">
                        <div class="flex items-center justify-end gap-2">
                          <div class="w-12 h-1 bg-primary-100 rounded-full overflow-hidden">
                            <div class="h-full bg-primary-300 rounded-full" :style="{ width: Math.min(r.co2.pct, 100) + '%' }"></div>
                          </div>
                          <span class="text-primary-500 text-xs w-12 text-right">{{ r.co2.pct }}%</span>
                        </div>
                      </template>
                      <span v-else class="text-primary-200">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Loading skeleton for rankings -->
          <div v-else-if="rankingsPending" class="space-y-2 mb-8">
            <div v-for="i in 4" :key="i" class="skeleton h-12 rounded-lg" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <GroupCard v-for="g in (country as any).groups" :key="g.gid" :group="g" />
          </div>
        </div>
      </div>
    </template>

    <div v-else class="space-y-6">
      <div class="skeleton h-10 w-64" />
      <div class="skeleton h-6 w-96" />
      <div class="grid grid-cols-3 gap-4">
        <div class="skeleton h-24 rounded-xl" />
        <div class="skeleton h-24 rounded-xl" />
        <div class="skeleton h-24 rounded-xl" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const iso = route.params.iso as string

const { country, error } = useCountry(iso)
const { stats, pending: statsPending } = useCountryStats(iso)
const { data: rankings, pending: rankingsPending } = useFetch(`/api/countries/${iso}/rankings`, { lazy: true })
const { data: unscRaw } = useFetch(`/api/countries/${iso}/unsc`, { lazy: true })
const unscData = computed(() => unscRaw.value as any)

// New data features
const { vetoes: vetoesRaw } = useCountryVetoes(iso)
const vetoesData = computed(() => vetoesRaw.value as any)
const showAllVetoes = ref(false)

const { treaties: treatiesRaw } = useCountryTreaties(iso)
const treatiesData = computed(() => treatiesRaw.value as any)

const { sanctions: sanctionsRaw } = useCountrySanctions(iso)
const sanctionsData = computed(() => sanctionsRaw.value as any)

const { recognition: recognitionRaw } = useCountryRecognition(iso)
const recognitionData = computed(() => recognitionRaw.value as any)

const { unscVotes: unscVotesRaw } = useCountryUNSCVotes(iso)
const unscVotesData = computed(() => unscVotesRaw.value as any)

// Military & Defense
const { military: militaryRaw, pending: militaryPending } = useCountryMilitary(iso)
const militaryData = computed(() => militaryRaw.value as any)
const { conflict: conflictRaw, pending: conflictPending } = useCountryConflict(iso)
const conflictData = computed(() => conflictRaw.value as any)

// GDELT Events & Tone
const { gdelt: gdeltRaw, pending: gdeltPending } = useCountryGDELT(iso)
const gdeltData = computed(() => gdeltRaw.value as any)

// New intelligence datasets
const { armsTrade: armsTradeRaw, pending: armsTradePending } = useCountryArmsTrade(iso)
const armsTradeData = computed(() => armsTradeRaw.value as any)

const { democracy: democracyRaw, pending: democracyPending } = useCountryDemocracy(iso)
const democracyData = computed(() => democracyRaw.value as any)

const { oda: odaRaw, pending: odaPending } = useCountryODA(iso)
const odaData = computed(() => odaRaw.value as any)

const { cables: cablesRaw, pending: cablesPending } = useCountryCables(iso)
const cablesData = computed(() => cablesRaw.value as any)

const { visa: visaRaw, pending: visaPending } = useCountryVisa(iso)
const visaData = computed(() => visaRaw.value as any)

const { alliances: alliancesRaw, pending: alliancesPending } = useCountryAlliances(iso)
const alliancesData = computed(() => alliancesRaw.value as any)

// UN General Debate Speeches
const { speeches: speechesRaw, pending: speechesPending } = useCountrySpeeches(iso)
const speechesData = computed(() => speechesRaw.value as any)

// P5 Alignment
const { alignment: alignmentRaw, pending: alignmentPending } = useCountryAlignment(iso)
const alignmentData = computed(() => alignmentRaw.value as any)

// --- Executive Briefing computed properties ---
const latestSpeech = computed(() => {
  const list = speechesData.value?.speeches
  return list?.length ? list[0] : null
})

const p5MaxAlignment = computed(() => {
  const most = alignmentData.value?.mostAligned
  if (!most?.length) return null
  const p5 = ['USA', 'GBR', 'FRA', 'RUS', 'CHN']
  const p5Scores = most.filter((a: any) => p5.includes(a.iso3))
  // agreement is 0-1 decimal, convert to percentage
  const entry = p5Scores.length ? p5Scores[0] : most[0]
  return entry ? { ...entry, agreement_pct: entry.agreement * 100 } : null
})

const briefingSociety = computed(() => [
  {
    label: 'HDI',
    value: extendedStats.value?.hdi?.toFixed(3) ?? '—',
    color: !extendedStats.value?.hdi ? 'bg-gray-300'
      : extendedStats.value.hdi >= 0.80 ? 'bg-emerald-500'
      : extendedStats.value.hdi >= 0.55 ? 'bg-amber-500' : 'bg-red-500',
  },
  {
    label: 'Democracy',
    value: democracyData.value?.latest?.v2x_polyarchy != null
      ? (democracyData.value.latest.v2x_polyarchy).toFixed(2) : '—',
    color: !democracyData.value?.latest?.v2x_polyarchy && democracyData.value?.latest?.v2x_polyarchy !== 0 ? 'bg-gray-300'
      : democracyData.value.latest.v2x_polyarchy >= 0.60 ? 'bg-emerald-500'
      : democracyData.value.latest.v2x_polyarchy >= 0.30 ? 'bg-amber-500' : 'bg-red-500',
  },
  {
    label: 'Life Exp.',
    value: extendedStats.value?.life_expectancy
      ? `${extendedStats.value.life_expectancy.toFixed(1)}y` : '—',
    color: !extendedStats.value?.life_expectancy ? 'bg-gray-300'
      : extendedStats.value.life_expectancy >= 70 ? 'bg-emerald-500'
      : extendedStats.value.life_expectancy >= 55 ? 'bg-amber-500' : 'bg-red-500',
  },
])

const briefingSecurity = computed(() => [
  {
    label: 'Military Rank',
    value: militaryData.value?.rank ? `#${militaryData.value.rank}` : '—',
    color: !militaryData.value?.rank ? 'bg-gray-300'
      : militaryData.value.rank <= 15 ? 'bg-emerald-500'
      : militaryData.value.rank <= 50 ? 'bg-amber-500' : 'bg-red-500',
  },
  {
    label: 'Conflict',
    value: conflictData.value?.conflict_intensity
      ? conflictData.value.conflict_intensity.charAt(0).toUpperCase() + conflictData.value.conflict_intensity.slice(1)
      : 'None',
    color: !conflictData.value?.conflict_intensity || conflictData.value.conflict_intensity === 'none' || conflictData.value.conflict_intensity === 'low' ? 'bg-emerald-500'
      : conflictData.value.conflict_intensity === 'medium' ? 'bg-amber-500' : 'bg-red-500',
  },
  {
    label: 'Sanctions',
    value: sanctionsData.value?.sanctioned ? 'Active' : 'None',
    color: sanctionsData.value?.sanctioned ? 'bg-red-500' : 'bg-emerald-500',
  },
])

const briefingGlobal = computed(() => {
  // GDP rank from rankings data
  const rkgs = rankings.value as any[] | null
  const gdpRank = rkgs?.length ? rkgs.reduce((best: number | null, r: any) => {
    const rank = r?.gdp?.rank
    if (rank == null) return best
    return best == null || rank < best ? rank : best
  }, null as number | null) : null

  return [
    {
      label: 'GDP Rank',
      value: gdpRank ? `#${gdpRank}` : '—',
      color: gdpRank == null ? 'bg-gray-300'
        : gdpRank <= 20 ? 'bg-emerald-500'
        : gdpRank <= 60 ? 'bg-amber-500' : 'bg-red-500',
    },
    {
      label: 'Passport Mobility',
      value: visaData.value?.mobility_rank ? `#${visaData.value.mobility_rank}` : '—',
      color: !visaData.value?.mobility_rank ? 'bg-gray-300'
        : visaData.value.mobility_rank <= 30 ? 'bg-emerald-500'
        : visaData.value.mobility_rank <= 80 ? 'bg-amber-500' : 'bg-red-500',
    },
    {
      label: 'Media Tone',
      value: gdeltData.value?.media?.avg_tone != null
        ? (gdeltData.value.media.avg_tone >= 0 ? '+' : '') + gdeltData.value.media.avg_tone.toFixed(1)
        : '—',
      color: gdeltData.value?.media?.avg_tone == null ? 'bg-gray-300'
        : gdeltData.value.media.avg_tone >= 1.0 ? 'bg-emerald-500'
        : gdeltData.value.media.avg_tone >= -1.0 ? 'bg-amber-500' : 'bg-red-500',
    },
  ]
})

const briefingDiplomacy = computed(() => {
  const maxPct = p5MaxAlignment.value?.agreement_pct
  const speechSentiment = latestSpeech.value?.analysis?.sentiment?.overall

  return [
    {
      label: 'P5 Alignment',
      value: maxPct != null ? `${maxPct.toFixed(0)}%` : '—',
      color: maxPct == null ? 'bg-gray-300'
        : maxPct >= 60 ? 'bg-emerald-500'
        : maxPct >= 40 ? 'bg-amber-500' : 'bg-red-500',
    },
    {
      label: 'Treaties',
      value: treatiesData.value?.treaties?.length != null ? String(treatiesData.value.treaties.length) : '—',
      color: !treatiesData.value?.treaties?.length && treatiesData.value?.treaties?.length !== 0 ? 'bg-gray-300'
        : treatiesData.value.treaties.length >= 10 ? 'bg-emerald-500'
        : treatiesData.value.treaties.length >= 5 ? 'bg-amber-500' : 'bg-red-500',
    },
    {
      label: 'Speech Tone',
      value: speechSentiment ? speechSentiment.charAt(0).toUpperCase() + speechSentiment.slice(1) : '—',
      color: !speechSentiment ? 'bg-gray-300'
        : speechSentiment === 'positive' ? 'bg-emerald-500'
        : speechSentiment === 'negative' ? 'bg-red-500' : 'bg-amber-500',
    },
  ]
})

function sentimentBadgeClass(sentiment: string | null | undefined): string {
  switch (sentiment?.toLowerCase()) {
    case 'positive': return 'px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700'
    case 'negative': return 'px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700'
    default: return 'px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700'
  }
}

const maxMonthlyVolume = computed(() => {
  const trend = gdeltData.value?.media?.monthly_trend
  if (!trend?.length) return 1
  return Math.max(...trend, 1)
})

const CAMEO_LABELS: Record<string, string> = {
  '01': 'Make Statement', '02': 'Appeal', '03': 'Express Intent to Cooperate',
  '04': 'Consult', '05': 'Diplomatic Cooperation', '06': 'Material Cooperation',
  '07': 'Provide Aid', '08': 'Yield', '09': 'Investigate', '10': 'Demand',
  '11': 'Disapprove', '12': 'Reject', '13': 'Threaten', '14': 'Protest',
  '15': 'Exhibit Force Posture', '16': 'Reduce Relations', '17': 'Coerce',
  '18': 'Assault', '19': 'Fight', '20': 'Unconventional Mass Violence',
}

function cameoLabel(code: string): string {
  return CAMEO_LABELS[code] || `Code ${code}`
}

const topCameoCodes = computed(() => {
  const byCameo = gdeltData.value?.events?.by_cameo
  if (!byCameo) return []
  return Object.entries(byCameo)
    .map(([code, count]) => ({ code, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
})

function formatGdeltVolume(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}

// Country lookup for bilateral partners
const { data: allCountriesRaw } = useFetch('/api/countries', { lazy: true })
const countryLookup = computed(() => {
  const m = new Map<string, { iso2: string; name: string }>()
  const list = allCountriesRaw.value as any[]
  if (!list) return m
  for (const c of list) {
    if (c.iso3) m.set(c.iso3, { iso2: c.iso2, name: c.name })
  }
  return m
})

function partnerIso2(iso3: string): string {
  return countryLookup.value.get(iso3.toUpperCase())?.iso2 ?? ''
}

function partnerName(iso3: string): string {
  return countryLookup.value.get(iso3.toUpperCase())?.name ?? iso3
}

const maxTrendFatalities = computed(() => {
  const trend = conflictData.value?.trend
  if (!trend?.length) return 1
  return Math.max(...trend.map((t: any) => t.fatalities), 1)
})

function intensityBadgeClass(intensity: string): string {
  switch (intensity) {
    case 'high': return 'bg-red-100 text-red-700'
    case 'medium': return 'bg-amber-100 text-amber-700'
    case 'low': return 'bg-emerald-100 text-emerald-700'
    default: return 'bg-gray-100 text-gray-500'
  }
}

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  state_based: 'State-based conflict',
  non_state: 'Non-state conflict',
  one_sided: 'One-sided violence',
}

function formatConflictType(key: string): string {
  return CONFLICT_TYPE_LABELS[key] || key.replace(/_/g, ' ')
}

function conflictBarClass(typeKey: string): string {
  switch (typeKey) {
    case 'state_based': return 'bg-red-400'
    case 'non_state': return 'bg-orange-400'
    case 'one_sided': return 'bg-rose-400'
    default: return 'bg-gray-400'
  }
}
const { votes: countryVotesRaw, pending: countryVotesPending } = useCountryVotes(iso)
const countryVotesData = computed(() => countryVotesRaw.value as any)

// Recent votes (first page, no search filter)
const recentResPage = ref(1)
const recentResSearch = ref('')
const { resolutions: recentResRaw, pending: recentResPending } = useCountryResolutions(iso, {
  page: recentResPage,
  search: recentResSearch,
})
const recentResData = computed(() => recentResRaw.value as any)
const recentResolutions = computed(() => {
  const data = recentResData.value
  if (!data?.resolutions) return []
  return data.resolutions.slice(0, 10)
})
const expandedRecentRes = ref<string | null>(null)
function toggleRecentRes(id: string) {
  expandedRecentRes.value = expandedRecentRes.value === id ? null : id
}


function countryVoteBadgeClass(vote: string): string {
  switch (vote) {
    case 'Y': return 'bg-emerald-100 text-emerald-700'
    case 'N': return 'bg-red-100 text-red-700'
    case 'A': return 'bg-amber-100 text-amber-700'
    default: return 'bg-gray-100 text-gray-400'
  }
}

function countryVoteLabel(vote: string): string {
  switch (vote) {
    case 'Y': return 'Yes'
    case 'N': return 'No'
    case 'A': return 'Abstain'
    default: return 'NV'
  }
}

const lastSession = computed(() => {
  const sessions = countryVotesData.value?.sessions
  if (!sessions) return null
  const entries = Object.entries(sessions)
    .map(([key, val]: [string, any]) => {
      const session = parseInt(key)
      if (isNaN(session)) return null
      const total = val.yes + val.no + val.abstain + val.non_voting
      if (total === 0) return null
      return {
        session,
        yes: val.yes,
        no: val.no,
        abstain: val.abstain,
        nv: val.non_voting,
        total,
        yesPct: Math.round((val.yes / total) * 100),
        noPct: Math.round((val.no / total) * 100),
        abstainPct: Math.round((val.abstain / total) * 100),
        nvPct: Math.round((val.non_voting / total) * 100),
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.session - a.session)
  return entries.length ? entries[0] : null
})

const countryInfo = computed(() => {
  const s = stats.value as any
  return s?.country_info ?? null
})

const extendedStats = computed(() => {
  const s = stats.value as any
  return s?.extended ?? null
})

const baseStats = computed(() => {
  const s = stats.value as any
  if (!s) return null
  return {
    gdp: s.gdp,
    population: s.population,
    co2: s.co2,
  }
})

const hasAnyStats = computed(() => {
  const s = stats.value as any
  if (!s) return false
  return s.gdp || s.population || s.co2 || s.extended?.gdp_per_capita || s.extended?.life_expectancy || s.extended?.hdi
})

const hasExtendedStats = computed(() => {
  const ext = extendedStats.value
  if (!ext) return false
  return ext.gdp_per_capita || ext.life_expectancy || ext.hdi
})

const hasDefenseSpending = computed(() => {
  const ext = extendedStats.value
  if (!ext) return false
  return ext.military_expenditure || ext.military_pct_gdp || ext.armed_forces_pct
})

useHead({
  title: computed(() => {
    const c = country.value as any
    return c ? `${c.name} — World Country Groups` : 'Loading...'
  }),
})

const hasGovernance = computed(() =>
  democracyData.value?.has_data || recognitionData.value?.entities?.length
)
const hasDiplomacy = computed(() =>
  treatiesData.value?.treaties?.length || sanctionsData.value || visaData.value?.has_data
)
const hasEconomyInfra = computed(() =>
  odaData.value?.has_data || cablesData.value?.has_data
)

// Section navigation
const countrySections = [
  { id: 'cat-overview', label: 'Overview' },
  { id: 'cat-united-nations', label: 'United Nations' },
  { id: 'cat-governance', label: 'Governance' },
  { id: 'cat-security', label: 'Security & Defense' },
  { id: 'cat-diplomacy', label: 'Diplomacy' },
  { id: 'cat-partners', label: 'Trade & Aid Partners' },
  { id: 'cat-economy', label: 'Development & Connectivity' },
  { id: 'cat-media', label: 'Media & Events' },
  { id: 'cat-memberships', label: 'Memberships' },
]
const { visibleSections, activeSection, scrollTo: sectionScrollTo } = useSectionNav(countrySections)
</script>
