import { getRegistry } from '~/server/utils/wcg'
import { getGroupAllianceOverview } from '~/server/utils/alliances'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const iso3Codes = group.countries.map((c: any) => c.iso3).filter(Boolean)
  return getGroupAllianceOverview(iso3Codes)
})
