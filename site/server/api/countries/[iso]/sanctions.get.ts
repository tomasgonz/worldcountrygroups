import { getRegistry } from '~/server/utils/wcg'
import { getCountrySanctions } from '~/server/utils/sanctions'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!.toUpperCase()
  const registry = getRegistry()

  const membership = registry.getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: 'Country not found' })
  }

  const iso3 = membership.iso3.toUpperCase()
  const regimes = getCountrySanctions(iso3)
  return {
    iso3,
    sanctioned: regimes.length > 0,
    regimes: regimes.map(r => ({
      id: r.id,
      name: r.name,
      resolution: r.resolution,
      established: r.established,
      measures: r.measures,
    })),
  }
})
