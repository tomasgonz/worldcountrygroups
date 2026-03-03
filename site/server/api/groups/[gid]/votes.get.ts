import { getRegistry } from '~/server/utils/wcg'
import { getGroupVotingData, getUNVotesMeta } from '~/server/utils/unvotes'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const meta = getUNVotesMeta()
  if (!meta) {
    return { available: false, message: 'UN voting data not yet loaded. Trigger a data refresh.' }
  }

  const query = getQuery(event)
  const sessionFrom = query.from ? parseInt(query.from as string, 10) : undefined
  const sessionTo = query.to ? parseInt(query.to as string, 10) : undefined

  const iso3Codes = group.countries.map(c => c.iso3).filter(Boolean)
  const data = getGroupVotingData(iso3Codes, sessionFrom, sessionTo)

  return {
    available: true,
    group: gid,
    meta: {
      updated_at: meta.updated_at,
      total_resolutions: meta.total_resolutions,
    },
    ...data,
  }
})
