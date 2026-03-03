import { getRegistry } from '~/server/utils/wcg'
import { getGroupStats } from '~/server/utils/countrydata'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }
  const iso2Codes = group.countries.map(c => c.iso2).filter(Boolean)
  return getGroupStats(iso2Codes)
})
