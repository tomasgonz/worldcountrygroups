import { getRegistry } from '~/server/utils/wcg'
import { getCountryStatsResult } from '~/server/utils/countrydata'
import type { StatsResult } from '~/server/utils/countrydata'

export interface CountryStatsEntry {
  name: string
  iso2: string
  iso3: string
  stats: StatsResult
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
  const results: CountryStatsEntry[] = []

  for (const code of codes) {
    const membership = registry.getCountryMembership(code)
    if (!membership) continue

    const stats = getCountryStatsResult(membership.iso2)
    results.push({
      name: membership.name,
      iso2: membership.iso2,
      iso3: membership.iso3,
      stats,
    })
  }

  results.sort((a, b) => a.name.localeCompare(b.name))
  return results
})
