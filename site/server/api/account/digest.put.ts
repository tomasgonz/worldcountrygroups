import { requireAuth } from '~/server/utils/auth'
import { getUserPreferences, updateUserPreferences } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const { frequency } = (await readBody(event)) || {}
  if (!['off', 'daily', 'weekly'].includes(frequency)) {
    throw createError({ statusCode: 400, statusMessage: 'frequency must be off, daily or weekly' })
  }
  const prefs = getUserPreferences(userId)
  updateUserPreferences(userId, { ...prefs, emailDigest: frequency })
  return { ok: true, frequency }
})
