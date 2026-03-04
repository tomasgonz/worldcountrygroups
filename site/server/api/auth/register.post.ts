import { getUserByUsername, addUser, hashPassword } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password, displayName, email } = body || {}

  if (!username || typeof username !== 'string' || username.length < 3 || username.length > 30) {
    throw createError({ statusCode: 400, statusMessage: 'Username must be 3-30 characters' })
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw createError({ statusCode: 400, statusMessage: 'Username can only contain letters, numbers, hyphens, and underscores' })
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

  if (email && typeof email === 'string' && !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email address' })
  }

  const existing = getUserByUsername(username)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Username already taken' })
  }

  const { hash, salt } = hashPassword(password)

  addUser({
    username,
    displayName: displayName || username,
    email: email || '',
    passwordHash: hash,
    salt,
    role: 'user',
    status: 'pending',
  })

  return { ok: true, message: 'Registration successful. Your account is pending admin approval.' }
})
