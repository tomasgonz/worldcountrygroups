import { getRegistry } from '~/server/utils/wcg'
import { getCountryConflict } from '~/server/utils/conflict'

export default defineEventHandler((event) => {
  const iso = (getRouterParam(event, 'iso') || '').toUpperCase()
  const registry = getRegistry()

  // Resolve to iso3
  let iso3 = iso
  if (iso.length === 2) {
    const membership = registry.getCountryMembership(iso)
    if (membership) iso3 = membership.iso3
  }

  const data = getCountryConflict(iso3)
  if (!data) {
    return { has_data: false, iso3 }
  }

  return { has_data: true, iso3, ...data }
})
