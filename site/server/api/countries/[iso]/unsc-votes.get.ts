import { getRegistry } from '~/server/utils/wcg'
import { getCountryUNSCVotes } from '~/server/utils/unsc-votes'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!.toUpperCase()
  const registry = getRegistry()

  const membership = registry.getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: 'Country not found' })
  }

  const iso3 = membership.iso3.toUpperCase()
  const data = getCountryUNSCVotes(iso3)

  return {
    iso3,
    available: data.resolutions.length > 0,
    stats: data.stats,
    resolutions: data.resolutions,
  }
})
