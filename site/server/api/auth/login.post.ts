import { getUserByUsername, verifyPassword } from '~/server/utils/users'
import { createSessionToken, setSessionCookie } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = body?.username
  const password = body?.password

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Username and password required' })
  }

  const user = getUserByUsername(username)
  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  if (user.status === 'rejected') {
    throw createError({ statusCode: 403, statusMessage: 'Account has been rejected' })
  }

  const token = createSessionToken(user.id, user.role)
  setSessionCookie(event, token)

  return {
    ok: true,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
  }
})
