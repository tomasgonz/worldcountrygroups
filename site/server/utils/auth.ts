import { createHmac } from 'crypto'
import type { H3Event } from 'h3'
import { getSessionSecret, getUserById, type User } from './users'

const SESSION_TTL = 24 * 60 * 60 * 1000 // 24 hours
const COOKIE_NAME = 'wcg_session'

export function createSessionToken(userId: string, role: string): string {
  const secret = getSessionSecret()
  const timestamp = Date.now().toString()
  const payload = `${userId}.${role}.${timestamp}`
  const hmac = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${hmac}`
}

export function verifySessionToken(token: string): { userId: string; role: string; timestamp: number } | null {
  if (!token) return null
  const secret = getSessionSecret()

  const parts = token.split('.')
  if (parts.length !== 4) return null

  const [userId, role, timestampStr, hmac] = parts
  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp) || Date.now() - timestamp > SESSION_TTL) return null

  const payload = `${userId}.${role}.${timestampStr}`
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  if (hmac !== expected) return null

  return { userId, role, timestamp }
}

export function getSession(event: H3Event): { userId: string; role: string; timestamp: number; user: User } | null {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return null

  const session = verifySessionToken(token)
  if (!session) return null

  const user = getUserById(session.userId)
  if (!user) return null

  return { ...session, user }
}

export function requireAuth(event: H3Event): { userId: string; role: string; user: User } {
  const session = getSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  if (session.user.status !== 'approved') {
    throw createError({ statusCode: 403, statusMessage: 'Account not approved' })
  }
  return session
}

export function requireAdmin(event: H3Event): { userId: string; role: string; user: User } {
  const session = requireAuth(event)
  if (session.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }
  return session
}

export function isAuthenticated(event: H3Event): boolean {
  return getSession(event) !== null
}

export function setSessionCookie(event: H3Event, token: string): void {
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL / 1000,
    path: '/',
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}
