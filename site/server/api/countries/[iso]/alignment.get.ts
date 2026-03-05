import { getRegistry } from '~/server/utils/wcg'
import { getCountryAlignmentScores } from '~/server/utils/unvotes'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!.toUpperCase()
  const registry = getRegistry()

  const membership = registry.getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: 'Country not found' })
  }

  const iso3 = membership.iso3.toUpperCase()
  const query = getQuery(event)
  const sessions = query.sessions ? parseInt(query.sessions as string, 10) : 10
  const limit = query.limit ? parseInt(query.limit as string, 10) : 20

  const result = getCountryAlignmentScores(iso3, { sessions, limit })

  // Resolve country names
  const addNames = (list: { iso3: string; agreement: number }[]) =>
    list.map(a => ({
      ...a,
      name: registry.getCountryMembership(a.iso3)?.name || a.iso3,
    }))

  return {
    iso3,
    sessionsUsed: result.sessionsUsed,
    mostAligned: addNames(result.mostAligned),
    leastAligned: addNames(result.leastAligned),
  }
})
