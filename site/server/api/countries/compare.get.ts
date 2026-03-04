import { getRegistry } from '~/server/utils/wcg'
import { getCountryStatsResult, getCountryData } from '~/server/utils/countrydata'
import type { StatsResult } from '~/server/utils/countrydata'

export interface CountryCompareEntry {
  name: string
  iso2: string
  iso3: string
  stats: StatsResult
  extended: {
    gdp_per_capita: number | null
    life_expectancy: number | null
    hdi: number | null
    area_km2: number | null
    income_group: string | null
    region: string | null
    defense_budget: number | null
  }
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const raw = (query.countries as string) || (query.country as string) || ''
  const codes = raw
    .split(',')
    .map(c => c.trim().toUpperCase())
    .filter(c => c.length === 2 || c.length === 3)
    .slice(0, 10)

  if (codes.length === 0) {
    return []
  }

  const registry = getRegistry()
  const results: CountryCompareEntry[] = []

  for (const code of codes) {
    const membership = registry.getCountryMembership(code)
    if (!membership) continue

    const stats = getCountryStatsResult(membership.iso2)
    const countryData = getCountryData(membership.iso2)

    results.push({
      name: membership.name,
      iso2: membership.iso2,
      iso3: membership.iso3,
      stats,
      extended: {
        gdp_per_capita: countryData?.gdp_per_capita ?? null,
        life_expectancy: countryData?.life_expectancy ?? null,
        hdi: countryData?.hdi ?? null,
        area_km2: countryData?.area_km2 ?? null,
        income_group: countryData?.income_group ?? null,
        region: countryData?.region ?? null,
        defense_budget: countryData?.military_expenditure ?? null,
      },
    })
  }

  results.sort((a, b) => a.name.localeCompare(b.name))
  return results
})
