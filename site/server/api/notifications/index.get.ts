import { requireAuth } from '~/server/utils/auth'
import { getNotifications } from '~/server/utils/notifications'

export default defineEventHandler((event) => {
  const { userId } = requireAuth(event)
  const list = getNotifications(userId)
  return { unread: list.filter(n => !n.read).length, items: list.slice(0, 30) }
})
