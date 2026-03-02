import { getRegistry } from '~/server/utils/wcg'
import { fetchGroupStats, fetchCountryStats } from '~/server/utils/worldbank'
import type { StatsResult } from '~/server/utils/worldbank'

export default defineEventHandler(async (event) => {
  const iso = getRouterParam(event, 'iso')!
  const registry = getRegistry()
  const membership = registry.getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: `Country '${iso}' not found` })
  }

  const countryIso2 = membership.iso2

  // For each group, compute this country's stats, percentage, and rank
  const rankings = await Promise.all(
    membership.groups.map(async (groupSummary) => {
      const group = registry.getGroup(groupSummary.gid)!
      const iso2Codes = group.countries.map(c => c.iso2).filter(Boolean)

      // Fetch group totals and all country stats
      const [groupStats, ...countryStatsArr] = await Promise.all([
        fetchGroupStats(iso2Codes),
        ...iso2Codes.map(code => fetchCountryStats(code)),
      ])

      // Build per-country arrays for ranking
      const entries = iso2Codes.map((code, i) => ({
        iso2: code,
        gdp: countryStatsArr[i]?.gdp?.total ?? null,
        population: countryStatsArr[i]?.population?.total ?? null,
        co2: countryStatsArr[i]?.co2?.total ?? null,
      }))

      function getRankAndValue(
        entries: { iso2: string; gdp: number | null; population: number | null; co2: number | null }[],
        field: 'gdp' | 'population' | 'co2',
        targetIso2: string,
        total: number | null
      ) {
        const sorted = entries
          .filter(e => e[field] !== null)
          .sort((a, b) => (b[field] as number) - (a[field] as number))
        const idx = sorted.findIndex(e => e.iso2 === targetIso2)
        if (idx === -1) return { value: null, pct: null, rank: null, of: sorted.length }
        const value = sorted[idx][field] as number
        const pct = total && total > 0 ? Math.round((value / total) * 10000) / 100 : null
        return { value, pct, rank: idx + 1, of: sorted.length }
      }

      return {
        gid: groupSummary.gid,
        acronym: groupSummary.acronym,
        name: groupSummary.name,
        country_count: groupSummary.country_count,
        gdp: getRankAndValue(entries, 'gdp', countryIso2, groupStats.gdp?.total ?? null),
        population: getRankAndValue(entries, 'population', countryIso2, groupStats.population?.total ?? null),
        co2: getRankAndValue(entries, 'co2', countryIso2, groupStats.co2?.total ?? null),
      }
    })
  )

  return rankings
})
