import { getCountryData, getCountryStatsResult } from '~/server/utils/countrydata'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!
  const stats = getCountryStatsResult(iso)
  const d = getCountryData(iso)

  return {
    ...stats,
    country_info: d ? {
      capital: d.capital,
      region: d.region,
      subregion: d.subregion,
      area_km2: d.area_km2,
      income_group: d.income_group,
    } : null,
    extended: d ? {
      gdp_per_capita: d.gdp_per_capita,
      life_expectancy: d.life_expectancy,
      hdi: d.hdi,
      military_expenditure: d.military_expenditure ?? null,
      military_pct_gdp: d.military_pct_gdp ?? null,
      armed_forces_pct: d.armed_forces_pct ?? null,
    } : null,
    data_years: d?.data_year ?? null,
  }
})
