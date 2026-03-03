import { defineEventHandler } from 'h3'
import { getRegistry } from '../../utils/wcg'
import { getCountryData } from '../../utils/countrydata'

export default defineEventHandler(() => {
  const registry = getRegistry()
  const iso2Codes = registry.getAllIso2Codes()
  const countries: { iso2: string; iso3: string; name: string; region: string | null; groupCount: number }[] = []

  for (const iso2 of iso2Codes) {
    const membership = registry.getCountryMembership(iso2)
    if (membership) {
      const data = getCountryData(iso2)
      countries.push({
        iso2: membership.iso2,
        iso3: membership.iso3,
        name: membership.name,
        region: data?.region ?? null,
        groupCount: membership.groups.length,
      })
    }
  }

  // Sort by name
  countries.sort((a, b) => a.name.localeCompare(b.name))

  return countries
})
