import { getDataMeta, getAllCountryData } from '~/server/utils/countrydata'

export default defineEventHandler(() => {
  const meta = getDataMeta()
  const allData = getAllCountryData()

  const indicators = ['gdp', 'population', 'co2', 'gdp_per_capita', 'life_expectancy', 'hdi', 'capital', 'area_km2'] as const
  const names: Record<string, string> = {
    gdp: 'GDP',
    population: 'Population',
    co2: 'CO2 Emissions',
    gdp_per_capita: 'GDP per Capita',
    life_expectancy: 'Life Expectancy',
    hdi: 'HDI',
    capital: 'Capital',
    area_km2: 'Area',
  }

  const total = allData.size
  const coverage = indicators.map(ind => {
    let count = 0
    for (const d of allData.values()) {
      if ((d as any)[ind] != null) count++
    }
    return {
      name: names[ind] || ind,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }
  })

  return {
    updated_at: meta?.updated_at ?? null,
    sources: meta?.sources ?? null,
    country_count: meta?.country_count ?? total,
    coverage,
  }
})
