import { getRegistry } from '~/server/utils/wcg'
import { fetchGroupStats } from '~/server/utils/worldbank'

export default defineEventHandler(async (event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }
  const iso2Codes = group.countries.map(c => c.iso2).filter(Boolean)
  return await fetchGroupStats(iso2Codes)
})
