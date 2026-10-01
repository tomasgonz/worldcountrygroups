import { getRegistry } from '~/server/utils/wcg'
import { getGroupVDemOverview } from '~/server/utils/vdem'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const iso3Codes = group.countries.map(c => c.iso3).filter(Boolean)
  return getGroupVDemOverview(iso3Codes)
})
