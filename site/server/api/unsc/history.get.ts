import { getUNSCHistory, getUNSCStats } from '~/server/utils/unsc'
import { getRegistry } from '~/server/utils/wcg'

export default defineEventHandler(() => {
  const history = getUNSCHistory()
  const stats = getUNSCStats()
  const registry = getRegistry()

  // Enrich terms with country names
  const enrichedTerms: {
    iso3: string
    name: string
    terms: number[][]
    totalTerms: number
  }[] = []

  for (const [iso3, terms] of Object.entries(history.terms)) {
    if (terms.length === 0) continue
    const membership = registry.getCountryMembership(iso3)
    enrichedTerms.push({
      iso3,
      name: membership?.name ?? iso3,
      terms,
      totalTerms: terms.length,
    })
  }

  // Sort by total terms descending
  enrichedTerms.sort((a, b) => b.totalTerms - a.totalTerms)

  return {
    permanent: history.permanent,
    members: enrichedTerms,
    stats,
    lastUpdated: history._meta.last_updated,
  }
})
