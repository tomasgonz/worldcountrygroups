import { createSessionToken, setSessionCookie } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const password = body?.password

  if (!password || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Password required' })
  }

  const token = createSessionToken(password)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid password' })
  }

  setSessionCookie(event, token)
  return { ok: true }
})
