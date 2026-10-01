import { getRegistry } from '~/server/utils/wcg'
import { getSayVsVote } from '~/server/utils/say-vs-vote'

export default defineEventHandler((event) => {
  const iso = (getRouterParam(event, 'iso') || '').toUpperCase()
  const registry = getRegistry()

  let iso3 = iso
  if (iso.length === 2) {
    const membership = registry.getCountryMembership(iso)
    if (membership) iso3 = membership.iso3
  }

  const nameOf = (code: string) => {
    for (const c of registry.getAllIso2Codes()) {
      const m = registry.getCountryMembership(c)
      if (m && m.iso3.toUpperCase() === code) return m.name
    }
    return code
  }
  return getSayVsVote(iso3, nameOf)
})
