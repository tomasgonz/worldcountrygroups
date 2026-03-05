import { requireAuth } from '~/server/utils/auth'
import { verifyPassword, hashPassword, updateUser } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  const body = await readBody(event)

  const { currentPassword, newPassword } = body || {}

  if (!currentPassword || !newPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Current and new passwords are required' })
  }

  if (newPassword.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'New password must be at least 6 characters' })
  }

  if (!verifyPassword(currentPassword, user.passwordHash, user.salt)) {
    throw createError({ statusCode: 400, statusMessage: 'Current password is incorrect' })
  }

  const { hash, salt } = hashPassword(newPassword)
  updateUser(user.id, { passwordHash: hash, salt })

  return { ok: true }
})
