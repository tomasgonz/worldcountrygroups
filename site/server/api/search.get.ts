import { getRegistry } from '~/server/utils/wcg'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const q = query.q as string | undefined
  const country = query.country as string | undefined
  const domain = query.domain as string | undefined

  const registry = getRegistry()

  // Group search (existing)
  const groups = registry.searchGroups({ q, country, domain })
    .map(g => registry.getSummary(g))

  // Country search (new) — only when free-text query is provided
  const countries: { iso2: string; iso3: string; name: string; groupCount: number }[] = []
  if (q) {
    const qLower = q.toLowerCase()
    const seen = new Set<string>()
    for (const iso2 of registry.getAllIso2Codes()) {
      const membership = registry.getCountryMembership(iso2)
      if (!membership) continue
      const { name, iso3 } = membership
      if (
        name.toLowerCase().includes(qLower) ||
        iso2.toLowerCase() === qLower ||
        iso3.toLowerCase() === qLower
      ) {
        if (!seen.has(iso2)) {
          seen.add(iso2)
          countries.push({
            iso2: membership.iso2,
            iso3: membership.iso3,
            name: membership.name,
            groupCount: membership.groups.length,
          })
        }
      }
    }
    countries.sort((a, b) => a.name.localeCompare(b.name))
  }

  return { groups, countries }
})
