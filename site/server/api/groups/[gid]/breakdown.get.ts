import { getRegistry } from '~/server/utils/wcg'
import { getCountriesData, getGroupStats } from '~/server/utils/countrydata'
import type { CountryData } from '~/server/utils/countrydata'

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
  gdp_per_capita: number | null
  area_km2: number | null
  life_expectancy: number | null
  capital: string | null
  region: string | null
  income_group: string | null
  hdi: number | null
  military_expenditure: number | null
  military_pct_gdp: number | null
  has_data: boolean
}

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const iso2Codes = group.countries.map(c => c.iso2).filter(Boolean)
  const groupStats = getGroupStats(iso2Codes)
  const countriesMap = getCountriesData(iso2Codes)

  const gdpTotal = groupStats.gdp?.total || 0
  const popTotal = groupStats.population?.total || 0
  const co2Total = groupStats.co2?.total || 0

  const entries: BreakdownEntry[] = group.countries.map((country) => {
    const d: CountryData | undefined = country.iso2 ? countriesMap.get(country.iso2.toUpperCase()) : undefined

    const gdpVal = d?.gdp ?? null
    const popVal = d?.population ?? null
    const co2Val = d?.co2 ?? null

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
      gdp_per_capita: d?.gdp_per_capita ?? null,
      area_km2: d?.area_km2 ?? null,
      life_expectancy: d?.life_expectancy ?? null,
      capital: d?.capital ?? null,
      region: d?.region ?? null,
      income_group: d?.income_group ?? null,
      hdi: d?.hdi ?? null,
      military_expenditure: d?.military_expenditure ?? null,
      military_pct_gdp: d?.military_pct_gdp ?? null,
      has_data: (gdpVal !== null || popVal !== null),
    }
  })

  // Sort by GDP descending (countries with data first)
  entries.sort((a, b) => (b.gdp ?? -1) - (a.gdp ?? -1))

  return {
    totals: groupStats,
    countries: entries,
  }
})
