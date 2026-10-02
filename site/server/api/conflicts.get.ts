import { getCountryData } from '../utils/countrydata'
import { getAllConflicts } from '../utils/conflict'

export default defineEventHandler(() => {
  const raw = getAllConflicts()

  if (!raw?.countries) {
    return { countries: [], meta: raw?._meta ?? null, global: null }
  }

  const countries = Object.entries(raw.countries).map(([iso3, data]) => {
    const cd = getCountryData(iso3)
    return {
      iso3,
      iso2: cd?.iso2 || null,
      name: cd?.name || iso3,
      ...data,
    }
  })

  countries.sort((a, b) => b.total_fatalities - a.total_fatalities)

  return {
    countries,
    meta: raw._meta || null,
    global: raw.global ?? null,
  }
})
