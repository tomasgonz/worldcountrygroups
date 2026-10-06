import { requireAuth } from '~/server/utils/auth'
import { getSettings } from '~/server/utils/alerts'

export default defineEventHandler((event) => {
  const { userId, user } = requireAuth(event)
  return { settings: getSettings(userId), hasEmail: !!user.email }
})
