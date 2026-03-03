import { getRegistry } from '~/server/utils/wcg'
import { getCountryRecognitionStance } from '~/server/utils/recognition'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!.toUpperCase()
  const registry = getRegistry()

  const membership = registry.getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: 'Country not found' })
  }

  const iso3 = membership.iso3.toUpperCase()
  const stances = getCountryRecognitionStance(iso3)
  return { iso3, entities: stances }
})
