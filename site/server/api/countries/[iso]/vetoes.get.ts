import { getRegistry } from '~/server/utils/wcg'
import { isPermanentMember } from '~/server/utils/unsc'
import { getVetoesByCountry } from '~/server/utils/vetoes'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!.toUpperCase()
  const registry = getRegistry()

  const membership = registry.getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: 'Country not found' })
  }

  const iso3 = membership.iso3.toUpperCase()
  if (!isPermanentMember(iso3)) {
    return { applicable: false }
  }

  const vetoes = getVetoesByCountry(iso3)
  return {
    applicable: true,
    iso3,
    total: vetoes.length,
    vetoes: vetoes.sort((a, b) => b.date.localeCompare(a.date)),
  }
})
