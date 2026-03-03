import { getRegistry } from '~/server/utils/wcg'
import { getGroupTreatyCoverage } from '~/server/utils/treaties'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const iso3Codes = group.countries.map((c: any) => c.iso3).filter(Boolean)
  const coverage = getGroupTreatyCoverage(iso3Codes)
  return { group: gid, treaties: coverage }
})
