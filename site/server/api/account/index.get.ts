import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler((event) => {
  const { user } = requireAuth(event)
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  }
})
