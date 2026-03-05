import { requireAuth } from '~/server/utils/auth'
import { getUserPreferences } from '~/server/utils/users'

export default defineEventHandler((event) => {
  const { userId } = requireAuth(event)
  return getUserPreferences(userId)
})
