import { getRegistry } from '~/server/utils/wcg'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const countries = getRegistry().getCountries(gid)
  if (!countries) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }
  return countries
})
