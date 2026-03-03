import { getRegistry } from '~/server/utils/wcg'
import { getCountryUNSCTerms, isPermanentMember } from '~/server/utils/unsc'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!.toUpperCase()
  const registry = getRegistry()

  const membership = registry.getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: 'Country not found' })
  }

  const iso3 = membership.iso3.toUpperCase()
  const permanent = isPermanentMember(iso3)
  const terms = getCountryUNSCTerms(iso3)

  const totalYears = terms.reduce((sum, [start, end]) => sum + (end - start + 1), 0)

  return {
    isPermanent: permanent,
    totalTerms: permanent ? null : terms.length,
    totalYears: permanent ? null : totalYears,
    terms: permanent ? [] : terms,
  }
})
