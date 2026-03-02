import { getRegistry } from '~/server/utils/wcg'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }
  return group
})
