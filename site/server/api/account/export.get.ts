import { requireAuth } from '~/server/utils/auth'
import { exportUserData } from '~/server/utils/user-data'

/** Download a copy of everything held about your account (JSON). */
export default defineEventHandler((event) => {
  const { userId } = requireAuth(event)
  const data = exportUserData(userId)
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="world-country-groups-my-data-${new Date().toISOString().slice(0, 10)}.json"`)
  return JSON.stringify(data, null, 2)
})
