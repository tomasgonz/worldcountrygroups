import { checkLoginAllowed, recordLoginFailure } from '~/server/utils/login-throttle'
import { getUserByUsername, verifyPassword } from '~/server/utils/users'
import { createSessionToken, setSessionCookie } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = body?.username
  const password = body?.password

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Username and password required' })
  }

  checkLoginAllowed(event, username)

  const user = getUserByUsername(username)
  if (!user || user.role !== 'admin' || !verifyPassword(password, user.passwordHash, user.salt)) {
    recordLoginFailure(event, username)
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const token = createSessionToken(user.id, user.role)
  setSessionCookie(event, token)
  return { ok: true }
})
