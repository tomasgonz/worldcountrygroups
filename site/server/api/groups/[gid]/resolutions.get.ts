import { getRegistry } from '~/server/utils/wcg'
import { getResolutionsForGroup, getUNVotesMeta } from '~/server/utils/unvotes'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const meta = getUNVotesMeta()
  if (!meta) {
    return { available: false, message: 'UN voting data not yet loaded.' }
  }

  const query = getQuery(event)
  const page = query.page ? parseInt(query.page as string, 10) : 1
  const limit = query.limit ? parseInt(query.limit as string, 10) : 20
  const session = query.session ? parseInt(query.session as string, 10) : undefined
  const search = (query.search as string) || undefined
  const theme = (query.theme as string) || undefined

  const iso3Codes = group.countries.map(c => c.iso3).filter(Boolean)
  const data = getResolutionsForGroup(iso3Codes, { page, limit, session, search, theme })

  return {
    available: true,
    group: gid,
    ...data,
  }
})
