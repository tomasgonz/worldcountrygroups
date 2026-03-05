import { requireAuth } from '~/server/utils/auth'
import { updateUser } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  const body = await readBody(event)

  const displayName = (body.displayName ?? '').trim()
  const email = (body.email ?? '').trim()

  if (!displayName || displayName.length > 50) {
    throw createError({ statusCode: 400, statusMessage: 'Display name must be 1-50 characters' })
  }

  const updated = updateUser(user.id, { displayName, email })
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return {
    id: updated.id,
    username: updated.username,
    displayName: updated.displayName,
    email: updated.email,
    role: updated.role,
    status: updated.status,
    createdAt: updated.createdAt,
  }
})
