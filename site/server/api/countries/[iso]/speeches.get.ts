import { getRegistry } from '~/server/utils/wcg'
import { getCountrySpeeches } from '~/server/utils/speeches'

export default defineEventHandler((event) => {
  const iso = (getRouterParam(event, 'iso') || '').toUpperCase()
  const registry = getRegistry()

  let iso3 = iso
  if (iso.length === 2) {
    const membership = registry.getCountryMembership(iso)
    if (membership) iso3 = membership.iso3
  }

  const speeches = getCountrySpeeches(iso3)
  return {
    available: speeches.length > 0,
    speeches,
    total: speeches.length,
  }
})
