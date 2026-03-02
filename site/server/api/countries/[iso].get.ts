import { getRegistry } from '~/server/utils/wcg'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!
  const membership = getRegistry().getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: `Country '${iso}' not found` })
  }
  return membership
})
