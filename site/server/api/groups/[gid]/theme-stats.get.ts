import { getRegistry } from '~/server/utils/wcg'
import { getGroupThemeStats, getUNVotesMeta } from '~/server/utils/unvotes'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const meta = getUNVotesMeta()
  if (!meta) {
    return { available: false, stats: [] }
  }

  const iso3Codes = group.countries.map(c => c.iso3).filter(Boolean)
  const stats = getGroupThemeStats(iso3Codes)

  return { available: true, stats }
})
