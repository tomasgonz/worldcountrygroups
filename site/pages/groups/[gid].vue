<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div v-if="error" class="text-center py-20">
      <h1 class="font-serif text-2xl font-bold text-primary-300 mb-2">Group not found</h1>
      <NuxtLink to="/groups" class="text-primary-400 hover:text-primary-900 transition-colors">Browse all groups &rarr;</NuxtLink>
    </div>

    <template v-else-if="group">
      <SectionNav
        :sections="visibleSections"
        :active-section="activeSection"
        @navigate="sectionScrollTo"
      />

      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-primary-400 mb-8">
        <NuxtLink to="/groups" class="hover:text-primary-900 transition-colors">Groups</NuxtLink>
        <span class="text-primary-300">/</span>
        <span class="text-primary-600">{{ (group as any).acronym }}</span>
      </nav>

      <!-- Header -->
      <div class="mb-12">
        <h1 class="font-serif text-3xl sm:text-4xl font-bold text-primary-900 mb-3">{{ (group as any).name }}</h1>
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <DomainTag v-for="d in (group as any).domains" :key="d" :domain="d" size="md" />
          <span class="text-xs text-primary-400 bg-primary-50 px-2.5 py-1 rounded-md">
            {{ (group as any).classifier }}
          </span>
        </div>
        <p class="text-primary-400 leading-relaxed max-w-3xl">{{ (group as any).description }}</p>

        <!-- UNSC Historical Non-Permanent Members -->
        <div v-if="gid === 'unsc' && unscHistory && !unscHistoryPending" class="mt-8">
          <h3 class="font-serif text-lg font-bold text-primary-900 mb-4">
            Most Frequent Non-Permanent Members
            <span class="text-sm font-normal text-primary-400">({{ unscHistory.stats?.totalCountriesServed }} countries have served)</span>
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NuxtLink
              v-for="m in topHistoricalMembers"
              :key="m.iso3"
              :to="`/countries/${m.iso3}`"
              class="flex items-center justify-between bg-white rounded-xl border border-primary-100 px-4 py-3 hover:border-primary-300 transition-colors"
            >
              <span class="text-sm text-primary-800">{{ m.name }}</span>
              <span class="text-xs text-primary-400 tabular-nums">{{ m.totalTerms }} {{ m.totalTerms === 1 ? 'term' : 'terms' }}</span>
            </NuxtLink>
          </div>
        </div>

        <!-- Group metadata -->
        <div v-if="hasGroupMeta" class="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm text-primary-500">
          <span v-if="(group as any).founded">Est. {{ (group as any).founded }}</span>
          <span v-if="(group as any).headquarters">HQ: {{ (group as any).headquarters }}</span>
          <a v-if="(group as any).website" :href="(group as any).website" target="_blank" rel="noopener" class="text-accent-600 hover:text-accent-700 underline">Website</a>
          <span v-if="(group as any).official_languages?.length">Languages: {{ (group as any).official_languages.join(', ') }}</span>
        </div>
      </div>

      <!-- Dynamic Aggregate Stats -->
      <div id="sec-aggregate-stats" class="mb-16 scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Aggregate Statistics</h2>
        <div v-if="breakdownPending" class="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div v-for="i in 3" :key="i" class="skeleton h-24 rounded-xl" />
        </div>
        <div v-else-if="aggregateCards.length" class="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div v-for="card in aggregateCards" :key="card.key" class="bg-white rounded-2xl border border-primary-100 p-6">
            <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">{{ card.label }}</div>
            <div class="text-2xl font-serif font-bold text-primary-900">{{ card.formatted }}</div>
            <div class="text-xs text-primary-400 mt-1.5">{{ card.count }} of {{ card.total }} countries</div>
          </div>
        </div>
        <div v-else-if="hasNumericIndicators" class="bg-primary-50 rounded-2xl border border-primary-100 p-8 text-center">
          <p class="text-primary-400">No data available for the selected indicators.</p>
        </div>
      </div>

      <!-- Country Breakdown -->
      <div id="sec-country-breakdown" class="mb-16 scroll-mt-24">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 class="font-serif text-xl font-bold text-primary-900">Country Breakdown</h2>
          <div v-if="dataCoverage" class="text-xs text-primary-400 bg-primary-50 px-3 py-1.5 rounded-lg">
            Data available for {{ dataCoverage.with }} of {{ dataCoverage.total }} members
          </div>
        </div>

        <!-- Collection tabs -->
        <div class="flex flex-wrap gap-2 mb-3">
          <button
            v-for="col in collections"
            :key="col.id"
            @click="selectCollection(col.id)"
            class="text-sm px-4 py-2 rounded-full border transition-colors font-medium"
            :class="activeCollectionId === col.id
              ? 'bg-primary-900 text-white border-primary-900'
              : 'bg-white text-primary-600 border-primary-200 hover:border-primary-400'"
          >
            {{ col.label }}
          </button>
          <button
            v-if="isCustom"
            class="text-sm px-4 py-2 rounded-full border bg-primary-900 text-white border-primary-900 font-medium"
          >
            Custom
          </button>
        </div>

        <!-- Individual indicator toggles -->
        <div class="flex flex-wrap gap-1.5 mb-4">
          <button
            v-for="ind in allIndicators"
            :key="ind.key"
            @click="toggleIndicator(ind.key)"
            class="text-xs px-2.5 py-1 rounded-lg border transition-colors"
            :class="activeIndicators.includes(ind.key)
              ? 'bg-primary-700 text-white border-primary-700'
              : 'bg-white text-primary-500 border-primary-200 hover:border-primary-400'"
          >
            {{ ind.label }}
          </button>
        </div>

        <div v-if="breakdownPending" class="space-y-2">
          <div v-for="i in 8" :key="i" class="skeleton h-12 rounded-lg" />
        </div>

        <div v-else-if="breakdown" class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-primary-100 text-left">
                  <th
                    class="px-5 py-3.5 font-medium text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600 transition-colors"
                    :class="sortKey === 'name' ? 'text-primary-700' : 'text-primary-400'"
                    @click="setSortKey('name')"
                  >
                    Country
                    <span v-if="sortKey === 'name'" class="ml-0.5">{{ sortAsc ? '\u2191' : '\u2193' }}</span>
                  </th>
                  <template v-for="ind in visibleIndicators" :key="'h-'+ind.key">
                    <th
                      class="px-5 py-3.5 font-medium text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600 transition-colors"
                      :class="[
                        ind.type === 'text' ? 'text-left' : 'text-right',
                        sortKey === ind.valueKey ? 'text-primary-700' : 'text-primary-400',
                      ]"
                      @click="setSortKey(ind.valueKey)"
                    >
                      {{ ind.label }}
                      <span v-if="sortKey === ind.valueKey" class="ml-0.5">{{ sortAsc ? '\u2191' : '\u2193' }}</span>
                    </th>
                    <th v-if="ind.pctKey" class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right w-24">%</th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in sortedCountries"
                  :key="c.iso3 || c.name"
                  class="border-b border-primary-50 last:border-0 hover:bg-primary-50/50 transition-colors"
                  :class="{ 'opacity-40': !c.has_data }"
                >
                  <td class="px-5 py-3">
                    <NuxtLink :to="`/countries/${c.iso2 || c.iso3}`" class="flex items-center gap-2 hover:text-primary-600 transition-colors">
                      <span v-if="c.iso2" class="text-base">{{ isoToFlag(c.iso2) }}</span>
                      <span class="text-primary-800">{{ c.name }}</span>
                    </NuxtLink>
                  </td>
                  <template v-for="ind in visibleIndicators" :key="'d-'+ind.key">
                    <td
                      class="px-5 py-3 text-primary-600"
                      :class="ind.type === 'text' ? 'text-left' : 'text-right tabular-nums'"
                    >
                      {{ ind.format(c[ind.valueKey]) }}
                    </td>
                    <td v-if="ind.pctKey" class="px-5 py-3 text-right w-24">
                      <div v-if="getPctValue(c, ind.pctKey) !== null" class="flex items-center justify-end gap-2">
                        <div class="w-16 h-1 bg-primary-100 rounded-full overflow-hidden">
                          <div class="h-full bg-primary-300 rounded-full" :style="{ width: Math.min(getPctValue(c, ind.pctKey!) ?? 0, 100) + '%' }"></div>
                        </div>
                        <span class="text-primary-400 text-xs tabular-nums w-12 text-right">{{ getPctValue(c, ind.pctKey) }}%</span>
                      </div>
                      <span v-else class="text-primary-200">&mdash;</span>
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- UN Voting -->
      <div id="sec-unga-voting" class="mb-16 scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">UN General Assembly Voting</h2>

        <template v-if="votesPending">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            <div v-for="i in 3" :key="i" class="skeleton h-24 rounded-xl" />
          </div>
        </template>

        <template v-else-if="votesData?.available">
          <!-- Overview Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <!-- Cohesion -->
            <div class="bg-white rounded-2xl border border-primary-100 p-6">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Group Cohesion</div>
              <div class="text-3xl font-serif font-bold text-primary-900">
                {{ votesData.cohesion?.overall != null ? (votesData.cohesion.overall * 100).toFixed(1) + '%' : 'N/A' }}
              </div>
              <div v-if="recentCohesionTrend" class="text-xs text-primary-400 mt-1.5">
                Recent sessions: {{ recentCohesionTrend }}
              </div>
            </div>
            <!-- Most Aligned -->
            <div class="bg-white rounded-2xl border border-primary-100 p-6">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Most Aligned Pair</div>
              <template v-if="mostAligned">
                <div class="text-xl font-serif font-bold text-primary-900">{{ (mostAligned.agreement * 100).toFixed(1) }}%</div>
                <div class="text-sm text-primary-500 mt-1">{{ countryName(mostAligned.a) }} &harr; {{ countryName(mostAligned.b) }}</div>
              </template>
              <div v-else class="text-primary-300">N/A</div>
            </div>
            <!-- Least Aligned -->
            <div class="bg-white rounded-2xl border border-primary-100 p-6">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Least Aligned Pair</div>
              <template v-if="leastAligned">
                <div class="text-xl font-serif font-bold text-primary-900">{{ (leastAligned.agreement * 100).toFixed(1) }}%</div>
                <div class="text-sm text-primary-500 mt-1">{{ countryName(leastAligned.a) }} &harr; {{ countryName(leastAligned.b) }}</div>
              </template>
              <div v-else class="text-primary-300">N/A</div>
            </div>
          </div>

          <!-- Latest Votes -->
          <div class="mb-8">
            <h3 class="font-serif text-lg font-bold text-primary-900 mb-4">Latest Votes</h3>
            <div v-if="latestVotesPending" class="space-y-3">
              <div v-for="i in 5" :key="i" class="skeleton h-14 rounded-lg" />
            </div>
            <div v-else-if="latestVotes.length" class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
              <div class="divide-y divide-primary-50">
                <div v-for="r in latestVotes" :key="r.id" class="px-5 py-3">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ r.date }}</span>
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
                      <span class="text-emerald-600">Y:{{ r.groupVotes.yes }}</span>
                      <span class="text-red-600">N:{{ r.groupVotes.no }}</span>
                      <span class="text-amber-600">A:{{ r.groupVotes.abstain }}</span>
                    </span>
                    <span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap" :class="isConsensus(r) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'">
                      {{ isConsensus(r) ? 'Consensus' : 'Split' }}
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="(vote, code) in r.votes"
                      :key="code"
                      class="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded"
                      :class="voteDotClass(vote)"
                      :title="`${countryName(code as string)}: ${voteLabel(vote)}`"
                    >
                      <span v-if="countryIso2(code as string)" class="text-sm leading-none">{{ isoToFlag(countryIso2(code as string)!) }}</span>
                      <span class="w-2 h-2 rounded-full" :class="voteDotColor(vote)"></span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-6 text-center">
              <p class="text-primary-400 text-sm">No recent voting data available.</p>
            </div>
          </div>

          <!-- Resolution Browser -->
          <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
            <!-- Controls -->
            <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-primary-100">
              <select
                v-model="resSession"
                class="text-sm border border-primary-200 rounded-lg px-3 py-2 bg-white text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option :value="undefined">All sessions</option>
                <option v-for="s in availableSessions" :key="s" :value="s">{{ formatSession(s) }}</option>
              </select>
              <select
                v-model="resTheme"
                class="text-sm border border-primary-200 rounded-lg px-3 py-2 bg-white text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option :value="undefined">All themes</option>
                <option v-for="t in availableThemes" :key="t" :value="t">{{ t }}</option>
              </select>
              <input
                v-model="resSearchInput"
                type="text"
                placeholder="Search resolutions..."
                class="text-sm border border-primary-200 rounded-lg px-3 py-2 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <!-- Loading -->
            <div v-if="resPending" class="p-6 space-y-3">
              <div v-for="i in 5" :key="i" class="skeleton h-10 rounded-lg" />
            </div>

            <!-- Resolution list -->
            <template v-else-if="resData?.resolutions?.length">
              <div class="divide-y divide-primary-50">
                <div v-for="r in resData.resolutions" :key="r.id">
                  <!-- Collapsed row -->
                  <button
                    class="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-primary-50/50 transition-colors"
                    @click="toggleResolution(r.id)"
                  >
                    <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ r.date }}</span>
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
                      <span class="text-emerald-600">Y:{{ r.groupVotes.yes }}</span>
                      <span class="text-red-600">N:{{ r.groupVotes.no }}</span>
                      <span class="text-amber-600">A:{{ r.groupVotes.abstain }}</span>
                    </span>
                    <span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap" :class="isConsensus(r) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'">
                      {{ isConsensus(r) ? 'Consensus' : 'Split' }}
                    </span>
                    <svg class="w-4 h-4 text-primary-300 transition-transform" :class="expandedRes === r.id ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
                  </button>
                  <!-- Expanded detail -->
                  <div v-if="expandedRes === r.id" class="px-5 pb-4">
                    <div class="flex flex-wrap gap-2 pt-2">
                      <span
                        v-for="(vote, code) in r.votes"
                        :key="code"
                        class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                        :class="voteBadgeClass(vote)"
                      >
                        <span v-if="countryIso2(code as string)">{{ isoToFlag(countryIso2(code as string)!) }}</span>
                        <span>{{ countryName(code as string) }}</span>
                        <span class="font-semibold">{{ voteLabel(vote) }}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Pagination -->
              <div class="flex items-center justify-between px-5 py-3 border-t border-primary-100 text-sm text-primary-500">
                <span>Showing {{ ((resData.page - 1) * 20) + 1 }}&ndash;{{ Math.min(resData.page * 20, resData.total) }} of {{ resData.total }}</span>
                <div class="flex gap-2">
                  <button
                    :disabled="resData.page <= 1"
                    class="px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    @click="resPage--"
                  >Prev</button>
                  <button
                    :disabled="resData.page >= resData.pages"
                    class="px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    @click="resPage++"
                  >Next</button>
                </div>
              </div>
            </template>

            <!-- Empty state -->
            <div v-else class="p-8 text-center text-primary-400">
              No resolutions found for the current filters.
            </div>
          </div>
        </template>

        <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-8 text-center">
          <p class="text-primary-400">UN voting data is not available.</p>
        </div>

        <!-- Voting by Theme -->
        <template v-if="votesData?.available">
          <div class="mt-8">
            <h3 class="font-serif text-lg font-bold text-primary-900 mb-4">Voting by Theme</h3>
              <div v-if="themeStatsPending" class="space-y-3">
                <div v-for="i in 5" :key="i" class="skeleton h-10 rounded-lg" />
              </div>
              <div v-else-if="themeStatsData.length" class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
                <div class="divide-y divide-primary-50">
                  <div v-for="ts in themeStatsData" :key="ts.theme" class="px-5 py-3 flex items-center gap-4">
                    <span
                      class="inline-block text-xs leading-tight px-2 py-1 rounded-full font-medium whitespace-nowrap"
                      :class="themeBadgeClass(ts.theme)"
                    >{{ ts.theme }}</span>
                    <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ ts.resolutions }} resolutions</span>
                    <div class="flex-1 flex items-center gap-2">
                      <div class="flex-1 h-2 bg-primary-100 rounded-full overflow-hidden">
                        <div
                          class="h-full rounded-full transition-all"
                          :class="ts.cohesion >= 0.85 ? 'bg-emerald-400' : ts.cohesion >= 0.65 ? 'bg-amber-400' : 'bg-red-400'"
                          :style="{ width: (ts.cohesion * 100) + '%' }"
                        />
                      </div>
                      <span
                        class="text-xs font-semibold tabular-nums w-12 text-right"
                        :class="ts.cohesion >= 0.85 ? 'text-emerald-600' : ts.cohesion >= 0.65 ? 'text-amber-600' : 'text-red-600'"
                      >{{ (ts.cohesion * 100).toFixed(1) }}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-6 text-center">
                <p class="text-primary-400 text-sm">No theme stats available.</p>
              </div>
          </div>
        </template>

        <!-- Theme Voting Trends -->
        <template v-if="votesData?.available">
          <div class="mt-8">
            <h3 class="font-serif text-lg font-bold text-primary-900 mb-4">Theme Voting Trends</h3>
            <div v-if="groupThemeTrendsPending" class="space-y-3">
              <div v-for="i in 5" :key="i" class="skeleton h-8 rounded-lg" />
            </div>
            <div v-else-if="groupTrendsThemes.length" class="bg-white rounded-2xl border border-primary-100 p-6">
              <!-- Theme selector -->
              <div class="mb-5">
                <select
                  v-model="selectedGroupTrendTheme"
                  class="text-sm border border-primary-200 rounded-lg px-3 py-2 bg-white text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option v-for="t in groupTrendsThemes" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>

              <!-- Decade bars -->
              <div v-if="selectedGroupTrendData" class="space-y-3">
                <div class="text-xs text-primary-400 mb-1">Aggregate votes across all member countries per resolution</div>
                <div v-for="d in selectedGroupTrendData.decades" :key="d.decade" class="flex items-center gap-3">
                  <span class="text-xs text-primary-400 tabular-nums w-12 text-right font-medium">{{ d.decade }}</span>
                  <div
                    class="flex h-5 rounded-full overflow-hidden bg-gray-100"
                    :style="{ width: groupDecadeBarWidth(d.resolutions) + '%', minWidth: '40px' }"
                  >
                    <div
                      v-if="d.yes > 0"
                      class="bg-emerald-400 transition-all"
                      :style="{ width: (d.yes / (d.yes + d.no + d.abstain || 1) * 100) + '%' }"
                      :title="`Yes: ${d.yes}`"
                    />
                    <div
                      v-if="d.no > 0"
                      class="bg-red-400 transition-all"
                      :style="{ width: (d.no / (d.yes + d.no + d.abstain || 1) * 100) + '%' }"
                      :title="`No: ${d.no}`"
                    />
                    <div
                      v-if="d.abstain > 0"
                      class="bg-amber-400 transition-all"
                      :style="{ width: (d.abstain / (d.yes + d.no + d.abstain || 1) * 100) + '%' }"
                      :title="`Abstain: ${d.abstain}`"
                    />
                  </div>
                  <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">
                    {{ d.resolutions }} res &middot; {{ (d.yes + d.no + d.abstain) > 0 ? Math.round(d.yes / (d.yes + d.no + d.abstain) * 100) : 0 }}% Yes
                  </span>
                </div>

                <!-- Low-data warning -->
                <p v-if="selectedGroupTrendData.decades.some((d: any) => d.resolutions > 0 && d.resolutions < 5)" class="text-xs text-amber-600 mt-2">
                  * Some decades have fewer than 5 resolutions — trends may not be representative.
                </p>
              </div>

              <!-- Legend -->
              <div class="flex flex-wrap gap-4 mt-4 text-xs text-primary-500">
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-emerald-400"></span> Yes</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-red-400"></span> No</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-amber-400"></span> Abstain</span>
              </div>
            </div>
            <div v-else class="bg-primary-50 rounded-2xl border border-primary-100 p-6 text-center">
              <p class="text-primary-400 text-sm">No theme trend data available.</p>
            </div>
          </div>
        </template>
      </div>

      <!-- UNSC Veto History (unsc group only) -->
      <div v-if="gid === 'unsc' && vetoStatsData" id="sec-veto-history" class="mb-16 scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Veto History</h2>
        <div class="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
          <div v-for="(count, code) in vetoStatsData.stats?.byCountry" :key="code" class="bg-white rounded-2xl border border-primary-100 p-4 text-center">
            <div class="text-2xl font-serif font-bold text-primary-900">{{ count }}</div>
            <div class="text-xs text-primary-400 uppercase tracking-wider mt-1">{{ code }}</div>
          </div>
        </div>
        <div v-if="vetoStatsData.vetoes?.length" class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
          <div class="divide-y divide-primary-50">
            <div v-for="v in vetoStatsData.vetoes.slice(0, showAllGroupVetoes ? undefined : 10)" :key="v.draft" class="px-5 py-3 flex items-center gap-3">
              <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ v.date }}</span>
              <span class="flex gap-1">
                <span v-for="c in v.vetoed_by" :key="c" class="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-semibold">{{ c }}</span>
              </span>
              <span class="text-sm text-primary-700 flex-1 min-w-0 truncate">{{ v.subject }}</span>
            </div>
          </div>
          <button
            v-if="vetoStatsData.vetoes.length > 10"
            class="w-full px-5 py-3 text-sm text-primary-500 hover:text-primary-700 border-t border-primary-100 transition-colors"
            @click="showAllGroupVetoes = !showAllGroupVetoes"
          >{{ showAllGroupVetoes ? 'Show less' : `Show all ${vetoStatsData.total} vetoes` }}</button>
        </div>
      </div>

      <!-- UNSC Resolutions Browser (unsc group only) -->
      <div v-if="gid === 'unsc' && unscResData" id="sec-sc-resolutions" class="mb-16 scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Security Council Resolutions</h2>
        <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
          <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-primary-100">
            <label class="flex items-center gap-2 text-sm text-primary-600">
              <input type="checkbox" v-model="scVetoedOnly" class="rounded border-primary-300" />
              Vetoed only
            </label>
            <input
              v-model="scSearchInput"
              type="text"
              placeholder="Search SC resolutions..."
              class="text-sm border border-primary-200 rounded-lg px-3 py-2 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div v-if="scResPending" class="p-6 space-y-3">
            <div v-for="i in 5" :key="i" class="skeleton h-10 rounded-lg" />
          </div>
          <template v-else-if="unscResData?.resolutions?.length">
            <div class="divide-y divide-primary-50">
              <div v-for="r in unscResData.resolutions" :key="r.id">
                <button
                  class="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
                  @click="expandedScRes = expandedScRes === r.id ? null : r.id"
                >
                  <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ r.date }}</span>
                  <span class="text-xs font-mono text-primary-400 whitespace-nowrap">{{ r.id }}</span>
                  <span class="text-sm text-primary-700 flex-1 min-w-0 truncate">{{ r.title }}</span>
                  <span v-if="r.vetoed" class="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">Vetoed</span>
                  <span v-else-if="r.adopted" class="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Adopted</span>
                  <span class="flex items-center gap-1 text-xs tabular-nums">
                    <span class="text-emerald-600">Y:{{ r.tally.yes }}</span>
                    <span class="text-red-600">N:{{ r.tally.no }}</span>
                    <span class="text-amber-600">A:{{ r.tally.abstain }}</span>
                  </span>
                  <svg class="w-4 h-4 text-primary-300 transition-transform" :class="expandedScRes === r.id ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
                </button>
                <div v-if="expandedScRes === r.id" class="px-5 pb-4">
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="(vote, code) in r.votes"
                      :key="code"
                      class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      :class="voteBadgeClass(vote)"
                    >
                      <span>{{ code }}</span>
                      <span class="font-semibold">{{ voteLabel(vote) }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between px-5 py-3 border-t border-primary-100 text-sm text-primary-500">
              <span>{{ unscResData.total }} resolutions</span>
              <div class="flex gap-2">
                <button :disabled="scPage <= 1" class="px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" @click="scPage--">Prev</button>
                <button :disabled="scPage >= unscResData.pages" class="px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" @click="scPage++">Next</button>
              </div>
            </div>
          </template>
          <div v-else class="p-8 text-center text-primary-400">No resolutions found.</div>
        </div>
      </div>

      <!-- Treaty Coverage -->
      <div v-if="groupTreatiesData?.treaties?.length" id="sec-treaties" class="mb-16 scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Treaty Coverage</h2>
        <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-primary-100 text-left">
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Treaty</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-center">Category</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Parties</th>
                  <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right w-48">Coverage</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="t in sortedGroupTreaties"
                  :key="t.treaty.id"
                  class="border-b border-primary-50 last:border-0 hover:bg-primary-50/50 transition-colors"
                >
                  <td class="px-5 py-3 text-primary-800">{{ t.treaty.short_name }}</td>
                  <td class="px-5 py-3 text-center">
                    <span class="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-500">{{ t.treaty.category }}</span>
                  </td>
                  <td class="px-5 py-3 text-right tabular-nums text-primary-600">{{ t.parties }}/{{ t.total }}</td>
                  <td class="px-5 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <div class="w-24 h-2 bg-primary-100 rounded-full overflow-hidden">
                        <div
                          class="h-full rounded-full transition-all"
                          :class="t.coverage >= 80 ? 'bg-emerald-400' : t.coverage >= 50 ? 'bg-amber-400' : 'bg-red-400'"
                          :style="{ width: t.coverage + '%' }"
                        />
                      </div>
                      <span class="text-xs font-semibold tabular-nums w-12 text-right" :class="t.coverage >= 80 ? 'text-emerald-600' : t.coverage >= 50 ? 'text-amber-600' : 'text-red-600'">{{ t.coverage }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Group Sanctions -->
      <div v-if="groupSanctionsData?.totalSanctioned > 0" id="sec-sanctions" class="mb-16 scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">
          Sanctions
          <span class="text-base font-normal text-primary-400">({{ groupSanctionsData.totalSanctioned }} member{{ groupSanctionsData.totalSanctioned > 1 ? 's' : '' }} affected)</span>
        </h2>
        <div class="space-y-3">
          <div
            v-for="s in groupSanctionsData.sanctioned"
            :key="s.iso3"
            class="bg-white rounded-2xl border border-red-200 p-5"
          >
            <div class="flex items-center gap-3 mb-2">
              <NuxtLink :to="`/countries/${s.iso3}`" class="text-sm font-medium text-primary-800 hover:text-primary-600 transition-colors">{{ countryName(s.iso3) || s.iso3 }}</NuxtLink>
            </div>
            <div v-for="r in s.regimes" :key="r.id" class="mb-2 last:mb-0">
              <div class="text-xs text-primary-500">{{ r.name }} ({{ r.resolution }})</div>
              <div class="flex flex-wrap gap-1 mt-1">
                <span v-for="m in r.measures" :key="m" class="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">{{ m.replace(/_/g, ' ') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Group Recognition Profile -->
      <div v-if="groupRecognitionData?.entities?.length" id="sec-recognition" class="mb-16 scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Diplomatic Recognition</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-for="e in groupRecognitionData.entities" :key="e.entity.id" class="bg-white rounded-2xl border border-primary-100 p-5">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium text-primary-800">{{ e.entity.name }}</span>
              <span class="text-xs text-primary-400">{{ e.entity.total_recognizers }} globally</span>
            </div>
            <div class="flex h-4 rounded-full overflow-hidden bg-gray-100 mb-2">
              <div
                v-if="e.recognizers > 0"
                class="bg-emerald-400 transition-all"
                :style="{ width: (e.recognizers / e.total * 100) + '%' }"
                :title="`Recognizes: ${e.recognizers}`"
              />
              <div
                v-if="e.withdrawn > 0"
                class="bg-amber-400 transition-all"
                :style="{ width: (e.withdrawn / e.total * 100) + '%' }"
                :title="`Withdrawn: ${e.withdrawn}`"
              />
              <div
                v-if="e.non_recognizers > 0"
                class="bg-gray-300 transition-all"
                :style="{ width: (e.non_recognizers / e.total * 100) + '%' }"
                :title="`Does not recognize: ${e.non_recognizers}`"
              />
            </div>
            <div class="flex gap-4 text-xs text-primary-500">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-400"></span> {{ e.recognizers }} recognize</span>
              <span v-if="e.withdrawn > 0" class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400"></span> {{ e.withdrawn }} withdrawn</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-gray-300"></span> {{ e.non_recognizers }} don't</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Military & Defense -->
      <div v-if="groupMilitaryData?.has_data || groupConflictData?.has_data" id="sec-military" class="mb-16 scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Military &amp; Defense</h2>

        <!-- Military Capabilities -->
        <div v-if="groupMilitaryData?.has_data" class="mb-8">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-3">Combined Military Capabilities</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Active Personnel</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ formatMilitary(groupMilitaryData.aggregate.active_military) }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Reserve</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ formatMilitary(groupMilitaryData.aggregate.reserve_military) }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Aircraft</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ formatMilitary(groupMilitaryData.aggregate.aircraft_total) }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Tanks</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ formatMilitary(groupMilitaryData.aggregate.tank_strength) }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Naval Vessels</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ formatMilitary(groupMilitaryData.aggregate.naval_total) }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Defense Budget</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ formatDefenseBudget(groupMilitaryData.aggregate.defense_budget) }}</div>
            </div>
          </div>

          <!-- Top members by power index -->
          <div v-if="groupMilitaryData.members.length" class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
            <div class="px-5 py-3 border-b border-primary-100">
              <span class="text-xs text-primary-400 font-medium uppercase tracking-wider">Top Members by Power Index</span>
            </div>
            <div class="divide-y divide-primary-50">
              <NuxtLink
                v-for="(m, idx) in groupMilitaryData.members.slice(0, 5)"
                :key="m.iso3"
                :to="`/countries/${m.iso3}`"
                class="px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
              >
                <span class="text-xs text-primary-400 font-semibold w-6">#{{ idx + 1 }}</span>
                <span v-if="countryIso2(m.iso3)" class="text-base">{{ isoToFlag(countryIso2(m.iso3)!) }}</span>
                <span class="text-sm text-primary-800 flex-1">{{ countryName(m.iso3) || m.iso3 }}</span>
                <span class="text-xs text-primary-400 tabular-nums">GFP #{{ m.rank }}</span>
                <span class="text-xs text-primary-500 tabular-nums">{{ formatMilitary(m.active_military) }} active</span>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Conflict Events -->
        <div v-if="groupConflictData?.has_data">
          <h3 class="font-serif text-lg font-bold text-primary-800 mb-3">Conflict Events (2023&ndash;2025)</h3>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Total Events</div>
              <div class="text-xl font-serif font-bold text-primary-900">{{ groupConflictData.total_events.toLocaleString() }}</div>
            </div>
            <div class="bg-white rounded-2xl border border-primary-100 p-5">
              <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Total Fatalities</div>
              <div class="text-xl font-serif font-bold text-red-700">{{ groupConflictData.total_fatalities.toLocaleString() }}</div>
            </div>
          </div>
          <div v-if="groupConflictData.affected_members.length" class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
            <div class="px-5 py-3 border-b border-primary-100">
              <span class="text-xs text-primary-400 font-medium uppercase tracking-wider">Members with Active Conflict</span>
            </div>
            <div class="divide-y divide-primary-50">
              <NuxtLink
                v-for="m in groupConflictData.affected_members.slice(0, 10)"
                :key="m.iso3"
                :to="`/countries/${m.iso3}`"
                class="px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
              >
                <span v-if="countryIso2(m.iso3)" class="text-base">{{ isoToFlag(countryIso2(m.iso3)!) }}</span>
                <span class="text-sm text-primary-800 flex-1">{{ countryName(m.iso3) || m.iso3 }}</span>
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-red-100 text-red-700': m.conflict_intensity === 'high',
                    'bg-amber-100 text-amber-700': m.conflict_intensity === 'medium',
                    'bg-emerald-100 text-emerald-700': m.conflict_intensity === 'low',
                    'bg-gray-100 text-gray-500': m.conflict_intensity === 'none',
                  }"
                >{{ m.conflict_intensity }}</span>
                <span class="text-xs text-primary-400 tabular-nums">{{ m.total_fatalities.toLocaleString() }} fatalities</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- GDELT Events & Tone -->
      <div v-if="groupGdeltData?.has_data" id="sec-gdelt" class="mb-16 scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">GDELT Events &amp; Media Tone</h2>

        <!-- Group Overview cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div class="bg-white rounded-2xl border border-primary-100 p-5">
            <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Aggregate Tone</div>
            <div
              class="text-2xl font-serif font-bold"
              :class="groupGdeltData.avg_tone >= 0 ? 'text-emerald-600' : 'text-red-600'"
            >{{ groupGdeltData.avg_tone.toFixed(2) }}</div>
            <div class="text-xs text-primary-400 mt-1">Weighted by article volume</div>
          </div>
          <div class="bg-white rounded-2xl border border-primary-100 p-5">
            <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Total Events</div>
            <div class="text-2xl font-serif font-bold text-primary-900">{{ groupGdeltData.total_events.toLocaleString() }}</div>
            <div class="text-xs text-primary-400 mt-1">CAMEO-coded events</div>
          </div>
          <div class="bg-white rounded-2xl border border-primary-100 p-5">
            <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Cooperation Ratio</div>
            <div class="text-2xl font-serif font-bold text-primary-900">{{ (groupGdeltData.cooperation_ratio * 100).toFixed(1) }}%</div>
            <div class="text-xs text-primary-400 mt-1">Of cooperative + conflictual</div>
          </div>
        </div>

        <!-- Most Covered Members -->
        <div v-if="groupGdeltData.most_covered?.length" class="mb-6">
          <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
            <div class="px-5 py-3 border-b border-primary-100">
              <span class="text-xs text-primary-400 font-medium uppercase tracking-wider">Most Covered Members (by Article Volume)</span>
            </div>
            <div class="divide-y divide-primary-50">
              <NuxtLink
                v-for="(m, idx) in groupGdeltData.most_covered"
                :key="m.iso3"
                :to="`/countries/${m.iso3}`"
                class="px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
              >
                <span class="text-xs text-primary-400 font-semibold w-6">#{{ idx + 1 }}</span>
                <span v-if="countryIso2(m.iso3)" class="text-base">{{ isoToFlag(countryIso2(m.iso3)!) }}</span>
                <span class="text-sm text-primary-800 flex-1">{{ countryName(m.iso3) || m.iso3 }}</span>
                <span class="text-xs text-primary-400 tabular-nums">{{ formatGdeltVolume(m.article_volume) }} articles</span>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Most Conflictual Members -->
        <div v-if="groupGdeltData.most_conflictual?.length" class="mb-6">
          <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
            <div class="px-5 py-3 border-b border-primary-100">
              <span class="text-xs text-primary-400 font-medium uppercase tracking-wider">Members with Lowest Cooperation Ratio (most conflictual news coverage)</span>
            </div>
            <div class="divide-y divide-primary-50">
              <NuxtLink
                v-for="(m, idx) in groupGdeltData.most_conflictual"
                :key="m.iso3"
                :to="`/countries/${m.iso3}`"
                class="px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
              >
                <span class="text-xs text-primary-400 font-semibold w-6">#{{ idx + 1 }}</span>
                <span v-if="countryIso2(m.iso3)" class="text-base">{{ isoToFlag(countryIso2(m.iso3)!) }}</span>
                <span class="text-sm text-primary-800 flex-1">{{ countryName(m.iso3) || m.iso3 }}</span>
                <div class="flex items-center gap-2">
                  <div class="w-16 h-3 rounded-full overflow-hidden bg-gray-100 hidden sm:block">
                    <div
                      class="h-full rounded-full bg-emerald-400"
                      :style="{ width: (m.cooperation_ratio * 100) + '%' }"
                    />
                  </div>
                  <span class="text-xs text-primary-500 tabular-nums">{{ (m.cooperation_ratio * 100).toFixed(1) }}%</span>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Intra-Group Relations -->
        <div v-if="groupGdeltData.intra_group_pairs?.length">
          <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
            <div class="px-5 py-3 border-b border-primary-100">
              <span class="text-xs text-primary-400 font-medium uppercase tracking-wider">Intra-Group Co-mentions (news event pairs between members)</span>
            </div>
            <div class="divide-y divide-primary-50">
              <div
                v-for="p in groupGdeltData.intra_group_pairs.slice(0, 10)"
                :key="`${p.source}-${p.target}`"
                class="px-5 py-3 flex items-center gap-3"
              >
                <div class="flex items-center gap-1 flex-1 min-w-0">
                  <span v-if="countryIso2(p.source)" class="text-sm">{{ isoToFlag(countryIso2(p.source)!) }}</span>
                  <NuxtLink :to="`/countries/${p.source}`" class="text-sm text-primary-800 hover:text-primary-600 transition-colors">{{ countryName(p.source) || p.source }}</NuxtLink>
                  <span class="text-primary-300 mx-1">&harr;</span>
                  <span v-if="countryIso2(p.target)" class="text-sm">{{ isoToFlag(countryIso2(p.target)!) }}</span>
                  <NuxtLink :to="`/countries/${p.target}`" class="text-sm text-primary-800 hover:text-primary-600 transition-colors">{{ countryName(p.target) || p.target }}</NuxtLink>
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-16 h-3 rounded-full overflow-hidden bg-gray-100 hidden sm:block">
                    <div
                      class="h-full rounded-full bg-emerald-400"
                      :style="{ width: (p.cooperation_ratio * 100) + '%' }"
                    />
                  </div>
                  <span class="text-xs tabular-nums" :class="p.avg_tone >= 0 ? 'text-emerald-600' : 'text-red-600'">
                    {{ p.avg_tone >= 0 ? '+' : '' }}{{ p.avg_tone.toFixed(1) }}
                  </span>
                  <span class="text-xs text-primary-400 tabular-nums whitespace-nowrap">{{ p.events.toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Speeches -->
      <div v-if="groupSpeechesData?.available" id="sec-speeches" class="mb-16 scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">UN General Debate Speeches</h2>

        <!-- Overview row -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div class="bg-white rounded-2xl border border-primary-100 p-6">
            <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Total Speeches</div>
            <div class="text-2xl font-serif font-bold text-primary-900">{{ groupSpeechesData.totalSpeeches }}</div>
            <div class="text-xs text-primary-400 mt-1.5">{{ groupSpeechesData.membersWithSpeeches }} of {{ groupSpeechesData.totalMembers }} members</div>
          </div>
          <div class="bg-white rounded-2xl border border-primary-100 p-6">
            <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Sentiment</div>
            <div class="flex flex-wrap gap-1.5 mt-1">
              <span v-if="groupSpeechesData.sentiment.positive" class="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">positive {{ groupSpeechesData.sentiment.positive }}</span>
              <span v-if="groupSpeechesData.sentiment.negative" class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">negative {{ groupSpeechesData.sentiment.negative }}</span>
              <span v-if="groupSpeechesData.sentiment.mixed" class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">mixed {{ groupSpeechesData.sentiment.mixed }}</span>
              <span v-if="groupSpeechesData.sentiment.neutral" class="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-600 font-medium">neutral {{ groupSpeechesData.sentiment.neutral }}</span>
            </div>
          </div>
          <div class="bg-white rounded-2xl border border-primary-100 p-6">
            <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-3">Emerging Topics</div>
            <div class="flex flex-wrap gap-1.5 mt-1">
              <span v-for="t in groupSpeechesData.emergingTopics?.slice(0, 6)" :key="t.topic" class="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">{{ t.topic }} ({{ t.count }})</span>
              <span v-if="!groupSpeechesData.emergingTopics?.length" class="text-xs text-primary-400">None detected</span>
            </div>
          </div>
        </div>

        <!-- Theme bars -->
        <div v-if="speechThemeBars.length" class="bg-white rounded-2xl border border-primary-100 p-6 mb-8">
          <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-4">Theme Relevance (% of speeches rated high)</div>
          <div class="space-y-3">
            <div v-for="t in speechThemeBars" :key="t.theme" class="flex items-center gap-3">
              <span class="text-xs text-primary-600 w-40 truncate flex-shrink-0" :title="t.theme.replace(/_/g, ' ')">{{ t.theme.replace(/_/g, ' ') }}</span>
              <div class="flex-1 h-5 bg-primary-50 rounded-full overflow-hidden">
                <div class="h-full rounded-full bg-emerald-400 transition-all" :style="{ width: t.highPct + '%' }" />
              </div>
              <span class="text-xs text-primary-400 tabular-nums w-10 text-right flex-shrink-0">{{ t.highPct }}%</span>
              <span class="text-xs text-primary-300 tabular-nums w-14 text-right flex-shrink-0">({{ t.count }})</span>
            </div>
          </div>
        </div>

        <!-- Speech Trend Charts -->
        <div v-if="groupTrendsData?.sentimentTimeline?.length > 1" class="bg-white rounded-2xl border border-primary-100 p-6 mb-8">
          <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-4">Sentiment Over Time</div>
          <ChartsChartLine
            :data="groupSentimentLine"
            :series-names="['Positive', 'Negative', 'Mixed', 'Neutral']"
            :colors="['#10b981', '#ef4444', '#f59e0b', '#94a3b8']"
            :y-min="0"
            :show-area="false"
            :legend="true"
            :height="200"
          />
        </div>

        <div v-if="groupHeatmapData" class="bg-white rounded-2xl border border-primary-100 p-6 mb-8">
          <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-4">Theme Heatmap by Decade</div>
          <ChartsChartHeatmap
            :rows="groupHeatmapData.themes"
            :columns="groupHeatmapData.decades"
            :values="groupHeatmapData.values"
            :label-width="140"
            :cell-size="44"
          />
        </div>

        <!-- Country speech accordion -->
        <div v-if="groupSpeechesData.countries?.length" class="space-y-3">
          <div class="text-xs text-primary-400 font-medium uppercase tracking-wider mb-2">Speeches by Country</div>
          <div
            v-for="c in groupSpeechesData.countries"
            :key="c.iso3"
            class="bg-white rounded-2xl border border-primary-100 overflow-hidden"
          >
            <!-- Country header -->
            <button
              class="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-primary-50/50 transition-colors"
              @click="toggleSpeechCountry(c.iso3)"
            >
              <span v-if="c.iso2" class="text-lg">{{ isoToFlag(c.iso2) }}</span>
              <div class="flex-1 min-w-0">
                <span class="text-sm font-medium text-primary-800">{{ c.name }}</span>
                <span class="text-xs text-primary-400 ml-2">{{ c.speechCount }} {{ c.speechCount === 1 ? 'speech' : 'speeches' }}</span>
              </div>
              <svg
                class="w-5 h-5 text-primary-300 transition-transform flex-shrink-0"
                :class="expandedSpeechCountry === c.iso3 ? 'rotate-180' : ''"
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            </button>

            <!-- Expanded: list of speeches for this country -->
            <div v-if="expandedSpeechCountry === c.iso3" class="border-t border-primary-100">
              <div v-for="sp in c.speeches" :key="`${c.iso3}_${sp.session}`" class="border-b border-primary-50 last:border-b-0">
                <!-- Speech row -->
                <button
                  class="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-primary-50/30 transition-colors"
                  @click="toggleSpeechDetail(c.iso3, sp.session)"
                >
                  <span class="text-sm font-serif font-bold text-primary-900 w-12 flex-shrink-0">{{ sp.year }}</span>
                  <div class="flex-1 min-w-0">
                    <span v-if="sp.speaker" class="text-xs text-primary-600">{{ sp.speaker }}</span>
                    <span v-if="sp.speaker_title" class="text-xs text-primary-400"> &middot; {{ sp.speaker_title }}</span>
                  </div>
                  <span v-if="sp.analysis?.sentiment?.overall" class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0" :class="speechSentimentClass(sp.analysis.sentiment.overall)">
                    {{ sp.analysis.sentiment.overall }}
                  </span>
                  <svg
                    class="w-4 h-4 text-primary-300 transition-transform flex-shrink-0"
                    :class="expandedSpeechSession?.iso === c.iso3 && expandedSpeechSession?.session === sp.session ? 'rotate-180' : ''"
                    viewBox="0 0 20 20" fill="currentColor"
                  >
                    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                  </svg>
                </button>

                <!-- Expanded speech detail: AI analysis + text -->
                <div v-if="expandedSpeechSession?.iso === c.iso3 && expandedSpeechSession?.session === sp.session" class="border-t border-primary-100">
                  <!-- AI Analysis -->
                  <div v-if="sp.analysis" class="px-5 py-5 bg-gradient-to-b from-amber-50/40 to-transparent border-b border-primary-100">
                    <div class="flex items-center gap-2 mb-3">
                      <span class="text-xs font-semibold uppercase tracking-wider text-amber-700">AI Analysis</span>
                      <span v-if="sp.analysis._model" class="text-xs text-primary-300">{{ sp.analysis._model }}</span>
                    </div>
                    <p class="text-sm text-primary-700 leading-relaxed mb-4">{{ sp.analysis.summary }}</p>

                    <!-- Themes -->
                    <div v-if="sp.analysis.themes?.length" class="mb-4">
                      <span class="text-xs font-medium text-primary-500 block mb-1.5">Themes:</span>
                      <div class="flex flex-wrap gap-1.5">
                        <span v-for="t in sp.analysis.themes" :key="t.name"
                          class="text-xs px-2 py-0.5 rounded-full"
                          :class="t.relevance === 'high' ? 'bg-emerald-100 text-emerald-800 font-medium' : t.relevance === 'medium' ? 'bg-sky-50 text-sky-700' : 'bg-primary-50 text-primary-400'"
                        >{{ t.name.replace(/_/g, ' ') }}</span>
                      </div>
                    </div>

                    <!-- Key Quotes -->
                    <div v-if="sp.analysis.key_quotes?.length" class="mb-4">
                      <span class="text-xs font-medium text-primary-500 block mb-1.5">Key Quotes:</span>
                      <div class="space-y-2">
                        <blockquote v-for="(q, i) in sp.analysis.key_quotes" :key="i"
                          class="border-l-2 border-amber-300 pl-3 text-xs text-primary-600 italic leading-relaxed"
                        >"{{ q }}"</blockquote>
                      </div>
                    </div>

                    <!-- Policy Positions -->
                    <div v-if="sp.analysis.policy_positions?.length" class="mb-4">
                      <span class="text-xs font-medium text-primary-500 block mb-1.5">Policy Positions:</span>
                      <div class="space-y-1">
                        <div v-for="p in sp.analysis.policy_positions" :key="p.topic" class="text-xs text-primary-600">
                          <span class="font-medium">{{ p.topic }}:</span> {{ p.position }}
                        </div>
                      </div>
                    </div>

                    <!-- Conflicts -->
                    <div v-if="sp.analysis.mentioned_conflicts?.length" class="mb-4">
                      <span class="text-xs font-medium text-primary-500 block mb-1.5">Conflicts Referenced:</span>
                      <div class="space-y-1">
                        <div v-for="cf in sp.analysis.mentioned_conflicts" :key="cf.name" class="text-xs text-primary-600">
                          <span class="font-medium">{{ cf.name }}:</span> {{ cf.stance }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Speech text (on-demand) -->
                  <div class="px-5 py-5">
                    <div v-if="speechTextIso === c.iso3 && speechTextSession === sp.session && groupSpeechTextPending" class="space-y-2">
                      <div v-for="i in 5" :key="i" class="skeleton h-4 rounded" />
                    </div>
                    <div v-else-if="speechTextIso === c.iso3 && speechTextSession === sp.session && groupSpeechTextContent" class="prose prose-sm max-w-none text-primary-700 leading-relaxed whitespace-pre-wrap">{{ groupSpeechTextContent }}</div>
                    <div v-else class="text-sm text-primary-400">Speech text not available.</div>
                  </div>
                </div>
              </div>

              <!-- Link to full country speeches page -->
              <div class="px-5 py-3 bg-primary-50/50">
                <NuxtLink :to="`/countries/${c.iso3}/speeches`" class="text-xs text-accent-600 hover:text-accent-700 transition-colors">
                  View all {{ c.speechCount }} speeches for {{ c.name }} &rarr;
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Countries -->
      <div id="sec-member-countries" class="scroll-mt-24">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">
          Member Countries
          <span class="text-base font-normal text-primary-300">({{ (group as any).countries.length }})</span>
        </h2>
        <div class="flex flex-wrap gap-2">
          <CountryBadge v-for="c in (group as any).countries" :key="c.iso3 || c.name" :country="c" />
        </div>
      </div>
    </template>

    <div v-else class="space-y-6">
      <div class="skeleton h-10 w-64" />
      <div class="skeleton h-6 w-96" />
      <div class="grid grid-cols-3 gap-5">
        <div class="skeleton h-24 rounded-xl" />
        <div class="skeleton h-24 rounded-xl" />
        <div class="skeleton h-24 rounded-xl" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const gid = route.params.gid as string

const { group, error } = useGroup(gid)
const { data: breakdown, pending: breakdownPending } = useFetch(`/api/groups/${gid}/breakdown`)
const { votes: votesRaw, pending: votesPending } = useGroupVotes(gid)
const votesData = computed(() => votesRaw.value as any)

// UNSC historical members (only fetched for unsc group)
const { data: unscHistoryRaw, pending: unscHistoryPending } = useFetch('/api/unsc/history', {
  lazy: true,
  immediate: gid === 'unsc',
})
const unscHistory = computed(() => unscHistoryRaw.value as any)
const topHistoricalMembers = computed(() => {
  if (!unscHistory.value?.members) return []
  return unscHistory.value.members.slice(0, 15)
})

// --- New data features ---

// UNSC Vetoes (for unsc group)
const { data: vetoStatsRaw } = useFetch('/api/unsc/vetoes', { lazy: true, immediate: gid === 'unsc' })
const vetoStatsData = computed(() => vetoStatsRaw.value as any)
const showAllGroupVetoes = ref(false)

// UNSC SC Resolutions browser (for unsc group)
const scPage = ref(1)
const scSearchInput = ref('')
const scSearch = ref('')
const scVetoedOnly = ref(false)
const expandedScRes = ref<string | null>(null)

let scSearchTimer: ReturnType<typeof setTimeout> | null = null
watch(scSearchInput, (val) => {
  if (scSearchTimer) clearTimeout(scSearchTimer)
  scSearchTimer = setTimeout(() => {
    scSearch.value = val
    scPage.value = 1
  }, 300)
})
watch(scVetoedOnly, () => { scPage.value = 1 })

const { resolutions: scResRaw, pending: scResPending } = useUNSCResolutions({
  page: scPage,
  search: scSearch,
  vetoed_only: scVetoedOnly,
})
const unscResData = computed(() => scResRaw.value as any)

// Treaty coverage
const { treaties: groupTreatiesRaw } = useGroupTreaties(gid)
const groupTreatiesData = computed(() => groupTreatiesRaw.value as any)
const sortedGroupTreaties = computed(() => {
  const treaties = groupTreatiesData.value?.treaties
  if (!treaties) return []
  return [...treaties].sort((a: any, b: any) => b.coverage - a.coverage)
})

// Sanctions
const { sanctions: groupSanctionsRaw } = useGroupSanctions(gid)
const groupSanctionsData = computed(() => groupSanctionsRaw.value as any)

// Recognition
const { recognition: groupRecognitionRaw } = useGroupRecognition(gid)
const groupRecognitionData = computed(() => groupRecognitionRaw.value as any)

// Military & Defense
const { military: groupMilitaryRaw } = useGroupMilitary(gid)
const groupMilitaryData = computed(() => groupMilitaryRaw.value as any)
const { conflict: groupConflictRaw } = useGroupConflict(gid)
const groupConflictData = computed(() => groupConflictRaw.value as any)

// GDELT Events & Tone
const { gdelt: groupGdeltRaw } = useGroupGDELT(gid)
const groupGdeltData = computed(() => groupGdeltRaw.value as any)

// --- Group Speeches ---
const { speeches: groupSpeechesRaw } = useGroupSpeeches(gid)
const groupSpeechesData = computed(() => groupSpeechesRaw.value as any)

// Group speech trend charts
const { trends: groupTrendsRaw } = useGroupSpeechTrends(gid)
const groupTrendsData = computed(() => groupTrendsRaw.value as any)

const groupSentimentLine = computed(() => {
  if (!groupTrendsData.value?.sentimentTimeline) return []
  return groupTrendsData.value.sentimentTimeline.map((s: any) => ({
    x: s.year,
    values: [s.positive, s.negative, s.mixed, s.neutral],
    label: `Session ${s.session} (${s.year})`,
  }))
})

const groupHeatmapData = computed(() => {
  const hm = groupTrendsData.value?.themeHeatmap
  if (!hm?.themes?.length) return null
  return {
    themes: hm.themes.map((t: string) => t.replace(/_/g, ' ')),
    decades: hm.decades,
    values: hm.values,
  }
})

const speechThemeBars = computed(() => {
  const themes = groupSpeechesData.value?.themes
  if (!themes?.length) return []
  return themes.slice(0, 12)
})

const expandedSpeechCountry = ref<string | null>(null)
const expandedSpeechSession = ref<{ iso: string; session: number } | null>(null)
const speechTextIso = ref('')
const speechTextSession = ref<number | null>(null)

function toggleSpeechCountry(iso3: string) {
  expandedSpeechCountry.value = expandedSpeechCountry.value === iso3 ? null : iso3
  expandedSpeechSession.value = null
}

function toggleSpeechDetail(iso3: string, session: number) {
  if (expandedSpeechSession.value?.iso === iso3 && expandedSpeechSession.value?.session === session) {
    expandedSpeechSession.value = null
  } else {
    expandedSpeechSession.value = { iso: iso3, session }
    speechTextIso.value = iso3
    speechTextSession.value = session
  }
}

const { speechText: groupSpeechTextRaw, pending: groupSpeechTextPending } = useCountrySpeechText(speechTextIso, speechTextSession)
const groupSpeechTextContent = computed(() => {
  if (!groupSpeechTextRaw.value) return null
  return (groupSpeechTextRaw.value as any)?.text || null
})

function speechSentimentClass(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'bg-emerald-100 text-emerald-800'
    case 'negative': return 'bg-red-100 text-red-800'
    case 'mixed': return 'bg-amber-100 text-amber-800'
    default: return 'bg-primary-100 text-primary-600'
  }
}

function formatGdeltVolume(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}

// Resolution browser state
const resPage = ref(1)
const resSession = ref<number | undefined>(undefined)
const resTheme = ref<string | undefined>(undefined)
const resSearchInput = ref('')
const resSearch = ref('')
const expandedRes = ref<string | null>(null)

// Debounce search
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(resSearchInput, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    resSearch.value = val
    resPage.value = 1
  }, 300)
})

// Reset page when session or theme changes
watch(resSession, () => {
  resPage.value = 1
  expandedRes.value = null
})

watch(resTheme, () => {
  resPage.value = 1
  expandedRes.value = null
})

// Latest votes (first 10, no filters)
const latestPage = ref(1)
const latestSession = ref<number | undefined>(undefined)
const latestSearchEmpty = ref('')
const { resolutions: latestResRaw, pending: latestVotesPending } = useGroupResolutions(gid, {
  page: latestPage,
  session: latestSession,
  search: latestSearchEmpty,
})
const latestVotes = computed(() => {
  const data = latestResRaw.value as any
  if (!data?.resolutions) return []
  return data.resolutions.slice(0, 10)
})

const { resolutions: resRaw, pending: resPending } = useGroupResolutions(gid, {
  page: resPage,
  session: resSession,
  search: resSearch,
  theme: resTheme,
})
const resData = computed(() => resRaw.value as any)

const availableSessions = computed(() => resData.value?.sessions ?? [])
const availableThemes = computed(() => resData.value?.themes ?? [])

// Theme stats
const { themeStats: themeStatsRaw, pending: themeStatsPending } = useGroupThemeStats(gid)
const themeStatsData = computed(() => (themeStatsRaw.value as any)?.stats ?? [])

// Theme trends
const { themeTrends: groupThemeTrendsRaw, pending: groupThemeTrendsPending } = useGroupThemeTrends(gid)
const groupThemeTrendsData = computed(() => (groupThemeTrendsRaw.value as any)?.trends ?? [])
const groupTrendsThemes = computed(() => groupThemeTrendsData.value.map((t: any) => t.theme))
const selectedGroupTrendTheme = ref<string>('')
watch(groupTrendsThemes, (themes) => {
  if (themes.length && !selectedGroupTrendTheme.value) {
    selectedGroupTrendTheme.value = themes[0]
  }
}, { immediate: true })
const selectedGroupTrendData = computed(() => {
  if (!selectedGroupTrendTheme.value) return null
  return groupThemeTrendsData.value.find((t: any) => t.theme === selectedGroupTrendTheme.value) ?? null
})
function groupDecadeBarWidth(resolutions: number): number {
  if (!selectedGroupTrendData.value) return 0
  const maxRes = Math.max(...selectedGroupTrendData.value.decades.map((d: any) => d.resolutions))
  if (maxRes === 0) return 0
  return Math.max(15, Math.round((resolutions / maxRes) * 100))
}

// Helper: build country name lookup from group data
const countryMap = computed(() => {
  const m = new Map<string, { name: string; iso2: string; iso3: string }>()
  const g = group.value as any
  if (!g?.countries) return m
  for (const c of g.countries) {
    if (c.iso3) m.set(c.iso3, c)
    if (c.iso2) m.set(c.iso2, c)
  }
  return m
})

function countryName(code: string): string {
  return countryMap.value.get(code)?.name ?? code
}

function countryIso2(code: string): string | null {
  return countryMap.value.get(code)?.iso2 ?? null
}

// Voting data helpers
const mostAligned = computed(() => {
  const pw = votesData.value?.pairwise
  if (!pw?.length) return null
  return pw[0]
})

const leastAligned = computed(() => {
  const pw = votesData.value?.pairwise
  if (!pw?.length) return null
  return pw[pw.length - 1]
})

const recentCohesionTrend = computed(() => {
  const cohesion = votesData.value?.cohesion
  if (!cohesion) return null
  const sessionKeys = Object.keys(cohesion)
    .filter(k => k.startsWith('session_'))
    .sort((a, b) => {
      const na = parseInt(a.replace('session_', ''))
      const nb = parseInt(b.replace('session_', ''))
      return nb - na
    })
    .slice(0, 3)
  if (!sessionKeys.length) return null
  return sessionKeys.map(k => {
    const n = k.replace('session_', '')
    return `S${n}: ${(cohesion[k] * 100).toFixed(1)}%`
  }).join(', ')
})

function formatSession(s: number): string {
  const str = String(s)
  if (str.includes('emsp')) return `Emergency Special ${str.replace('emsp', '')}`
  if (str.includes('sp')) return `Special ${str.replace('sp', '')}`
  return `Session ${s}`
}

function isConsensus(r: any): boolean {
  const gv = r.groupVotes
  const total = gv.yes + gv.no + gv.abstain
  if (total === 0) return true
  const maxVote = Math.max(gv.yes, gv.no, gv.abstain)
  return maxVote / total >= 0.85
}

function toggleResolution(id: string) {
  expandedRes.value = expandedRes.value === id ? null : id
}

function voteBadgeClass(vote: string): string {
  switch (vote) {
    case 'Y': return 'bg-emerald-100 text-emerald-700'
    case 'N': return 'bg-red-100 text-red-700'
    case 'A': return 'bg-amber-100 text-amber-700'
    default: return 'bg-gray-100 text-gray-400'
  }
}

function voteLabel(vote: string): string {
  switch (vote) {
    case 'Y': return 'Yes'
    case 'N': return 'No'
    case 'A': return 'Abs'
    default: return 'NV'
  }
}

function voteDotClass(vote: string): string {
  switch (vote) {
    case 'Y': return 'bg-emerald-50'
    case 'N': return 'bg-red-50'
    case 'A': return 'bg-amber-50'
    default: return 'bg-gray-50'
  }
}

function voteDotColor(vote: string): string {
  switch (vote) {
    case 'Y': return 'bg-emerald-500'
    case 'N': return 'bg-red-500'
    case 'A': return 'bg-amber-500'
    default: return 'bg-gray-300'
  }
}

const { indicators: allIndicators, collections, getIndicators, computeAggregate } = useIndicators()

// Collection & indicator state
const activeCollectionId = ref('overview')
const activeIndicators = ref<string[]>([...collections[0].indicators])
const isCustom = ref(false)

// Sort state
const sortKey = ref('gdp')
const sortAsc = ref(false)

function setSortKey(key: string) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = key === 'name'
  }
}

function selectCollection(id: string) {
  const col = collections.find(c => c.id === id)
  if (!col) return
  activeCollectionId.value = id
  activeIndicators.value = [...col.indicators]
  isCustom.value = false
  // Sort by first numeric indicator in the collection
  const firstNumeric = getIndicators(col.indicators).find(i => i.type === 'numeric')
  if (firstNumeric) {
    sortKey.value = firstNumeric.valueKey
    sortAsc.value = false
  }
}

function toggleIndicator(key: string) {
  const idx = activeIndicators.value.indexOf(key)
  if (idx > -1) {
    if (activeIndicators.value.length > 1) {
      activeIndicators.value.splice(idx, 1)
    }
  } else {
    activeIndicators.value.push(key)
  }
  // Check if current selection still matches any collection
  const match = collections.find(c =>
    c.indicators.length === activeIndicators.value.length &&
    c.indicators.every(i => activeIndicators.value.includes(i))
  )
  if (match) {
    activeCollectionId.value = match.id
    isCustom.value = false
  } else {
    activeCollectionId.value = ''
    isCustom.value = true
  }
}

const visibleIndicators = computed(() => getIndicators(activeIndicators.value))

const hasNumericIndicators = computed(() =>
  visibleIndicators.value.some(i => i.type === 'numeric')
)

// Aggregate cards — computed from breakdown data for numeric indicators only
const aggregateCards = computed(() => {
  if (!breakdown.value) return []
  const countries = (breakdown.value as any).countries || []
  const cards: { key: string; label: string; formatted: string; count: number; total: number }[] = []

  for (const ind of visibleIndicators.value) {
    if (ind.type !== 'numeric' || !ind.aggregate) continue
    const agg = computeAggregate(countries, ind.valueKey, ind.aggregate)
    if (!agg) continue
    cards.push({
      key: ind.key,
      label: ind.aggregate === 'average' ? `Avg. ${ind.label}` : ind.label,
      formatted: ind.format(agg.value),
      count: agg.count,
      total: agg.total,
    })
  }
  return cards
})

// Sort countries by selected key
const sortedCountries = computed(() => {
  if (!breakdown.value) return []
  const countries = [...((breakdown.value as any).countries || [])]
  const key = sortKey.value
  const asc = sortAsc.value
  countries.sort((a: any, b: any) => {
    const av = a[key]
    const bv = b[key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string') {
      return asc ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return asc ? av - bv : bv - av
  })
  return countries
})

function getPctValue(row: any, key: string): number | null {
  const val = row[key]
  return val !== null && val !== undefined ? val : null
}

const hasGroupMeta = computed(() => {
  const g = group.value as any
  return g && (g.founded || g.headquarters || g.website || g.official_languages?.length)
})

const dataCoverage = computed(() => {
  if (!breakdown.value) return null
  const countries = (breakdown.value as any).countries || []
  const withData = countries.filter((c: any) => c.has_data).length
  return { with: withData, total: countries.length }
})

useHead({
  title: computed(() => {
    const g = group.value as any
    return g ? `${g.acronym} — ${g.name} — World Country Groups` : 'Loading...'
  }),
})

// Section navigation
const groupSections = [
  { id: 'sec-aggregate-stats', label: 'Statistics' },
  { id: 'sec-country-breakdown', label: 'Country Breakdown' },
  { id: 'sec-unga-voting', label: 'UNGA Voting' },
  { id: 'sec-veto-history', label: 'Veto History' },
  { id: 'sec-sc-resolutions', label: 'SC Resolutions' },
  { id: 'sec-treaties', label: 'Treaties' },
  { id: 'sec-sanctions', label: 'Sanctions' },
  { id: 'sec-recognition', label: 'Recognition' },
  { id: 'sec-military', label: 'Military' },
  { id: 'sec-gdelt', label: 'GDELT' },
  { id: 'sec-speeches', label: 'Speeches' },
  { id: 'sec-member-countries', label: 'Members' },
]
const { visibleSections, activeSection, scrollTo: sectionScrollTo } = useSectionNav(groupSections)
</script>
