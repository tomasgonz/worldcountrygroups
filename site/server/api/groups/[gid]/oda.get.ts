import { getRegistry } from '~/server/utils/wcg'
import { getGroupODAOverview } from '~/server/utils/oda'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const iso3Codes = group.countries.map(c => c.iso3).filter(Boolean)
  return getGroupODAOverview(iso3Codes)
})
