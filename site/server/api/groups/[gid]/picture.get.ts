import { groupPicture } from '~/server/utils/group-picture'

/** The group at a glance: aid, trade, elections, Security Council seats, voting cohesion, news. */
export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const p = groupPicture({ gid })
  if (!p) throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  return p
})
