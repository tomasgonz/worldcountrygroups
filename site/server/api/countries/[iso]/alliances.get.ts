import { getRegistry } from '~/server/utils/wcg'
import { getCountryAlliances } from '~/server/utils/alliances'

export default defineEventHandler((event) => {
  const iso = (getRouterParam(event, 'iso') || '').toUpperCase()
  const registry = getRegistry()

  // Resolve to iso3
  let iso3 = iso
  if (iso.length === 2) {
    const membership = registry.getCountryMembership(iso)
    if (membership) iso3 = membership.iso3
  }

  return getCountryAlliances(iso3)
})
