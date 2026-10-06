import { recipientsView, aidGroups, compareGroups } from '~/server/utils/aid-recipients'

/** ?group=<gid> for one group; without it, all recipients. Includes the group list and comparison. */
export default defineEventHandler((event) => {
  const gid = String(getQuery(event).group || '') || null
  const view = recipientsView(gid)
  if (!view) throw createError({ statusCode: 404, statusMessage: 'Unknown group' })
  return { ...view, groups: aidGroups(), compare: gid ? undefined : compareGroups() }
})
