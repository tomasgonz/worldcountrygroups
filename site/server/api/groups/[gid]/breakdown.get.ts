import { getRegistry } from '~/server/utils/wcg'
import { fetchCountryStats, fetchGroupStats } from '~/server/utils/worldbank'
import type { StatsResult } from '~/server/utils/worldbank'

export interface BreakdownEntry {
  name: string
  iso2: string
  iso3: string
  gdp: number | null
  gdpPct: number | null
  population: number | null
  populationPct: number | null
  co2: number | null
  co2Pct: number | null
}

export default defineEventHandler(async (event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const iso2Codes = group.countries.map(c => c.iso2).filter(Boolean)

  // Fetch group totals and individual country stats in parallel
  const [groupStats, ...countryStatsArr] = await Promise.all([
    fetchGroupStats(iso2Codes),
    ...iso2Codes.map(iso2 => fetchCountryStats(iso2)),
  ])

  const gdpTotal = groupStats.gdp?.total || 0
  const popTotal = groupStats.population?.total || 0
  const co2Total = groupStats.co2?.total || 0

  const entries: BreakdownEntry[] = group.countries.map((country, idx) => {
    const stats: StatsResult = country.iso2 ? countryStatsArr[iso2Codes.indexOf(country.iso2)] : { gdp: null, population: null, co2: null }

    const gdpVal = stats?.gdp?.total ?? null
    const popVal = stats?.population?.total ?? null
    const co2Val = stats?.co2?.total ?? null

    return {
      name: country.name,
      iso2: country.iso2,
      iso3: country.iso3,
      gdp: gdpVal,
      gdpPct: gdpVal !== null && gdpTotal > 0 ? Math.round((gdpVal / gdpTotal) * 10000) / 100 : null,
      population: popVal,
      populationPct: popVal !== null && popTotal > 0 ? Math.round((popVal / popTotal) * 10000) / 100 : null,
      co2: co2Val,
      co2Pct: co2Val !== null && co2Total > 0 ? Math.round((co2Val / co2Total) * 10000) / 100 : null,
    }
  })

  // Sort by GDP descending (countries with data first)
  entries.sort((a, b) => (b.gdp ?? -1) - (a.gdp ?? -1))

  return {
    totals: groupStats,
    countries: entries,
  }
})
