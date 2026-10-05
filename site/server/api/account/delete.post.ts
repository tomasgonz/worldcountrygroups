import { requireAuth, clearSessionCookie } from '~/server/utils/auth'
import { getUserById, verifyPassword } from '~/server/utils/users'
import { eraseUser, isLastAdmin } from '~/server/utils/user-data'

/** Delete your own account and its data. Requires your password. */
export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const { password } = (await readBody(event)) || {}
  const user = getUserById(userId)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (!password || !verifyPassword(String(password), user.passwordHash, user.salt)) {
    throw createError({ statusCode: 403, statusMessage: 'Password is incorrect' })
  }
  if (isLastAdmin(userId)) throw createError({ statusCode: 400, statusMessage: 'You are the only administrator; make another administrator first' })
  const r = eraseUser(userId)
  clearSessionCookie(event)
  return { ok: true, ...r }
})
