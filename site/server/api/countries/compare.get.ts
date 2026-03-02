import { getRegistry } from '~/server/utils/wcg'
import { fetchCountryStats } from '~/server/utils/worldbank'
import type { StatsResult } from '~/server/utils/worldbank'

export interface CountryStatsEntry {
  name: string
  iso2: string
  iso3: string
  stats: StatsResult
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const raw = (query.countries as string) || (query.country as string) || ''
  const codes = raw
    .split(',')
    .map(c => c.trim().toUpperCase())
    .filter(c => c.length === 2 || c.length === 3)
    .slice(0, 10) // Max 10 countries

  if (codes.length === 0) {
    return []
  }

  const registry = getRegistry()
  const results: CountryStatsEntry[] = []

  await Promise.all(
    codes.map(async (code) => {
      const membership = registry.getCountryMembership(code)
      if (!membership) return

      const stats = await fetchCountryStats(membership.iso2)
      results.push({
        name: membership.name,
        iso2: membership.iso2,
        iso3: membership.iso3,
        stats,
      })
    })
  )

  // Sort by name for consistent ordering
  results.sort((a, b) => a.name.localeCompare(b.name))
  return results
})
