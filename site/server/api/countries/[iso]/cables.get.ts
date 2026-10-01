import { getRegistry } from '~/server/utils/wcg'
import { getCountryCables } from '~/server/utils/submarine-cables'

export default defineEventHandler((event) => {
  const iso = (getRouterParam(event, 'iso') || '').toUpperCase()
  const registry = getRegistry()

  // Resolve to iso3 for registry lookup, but cables use iso2
  let iso3 = iso
  if (iso.length === 2) {
    const membership = registry.getCountryMembership(iso)
    if (membership) iso3 = membership.iso3
  }

  const data = getCountryCables(iso3)
  if (!data) {
    return { has_data: false, iso3 }
  }

  return data
})
