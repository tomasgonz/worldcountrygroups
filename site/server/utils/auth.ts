import { createHmac } from 'crypto'
import type { H3Event } from 'h3'

const SESSION_TTL = 24 * 60 * 60 * 1000 // 24 hours
const COOKIE_NAME = 'admin_session'

function getAdminPassword(): string {
  return useRuntimeConfig().adminPassword as string
}

export function createSessionToken(password: string): string | null {
  const adminPassword = getAdminPassword()
  if (!adminPassword || password !== adminPassword) return null
  const timestamp = Date.now().toString()
  const hmac = createHmac('sha256', adminPassword).update(timestamp).digest('hex')
  return `${timestamp}.${hmac}`
}

export function verifySessionToken(token: string): boolean {
  const adminPassword = getAdminPassword()
  if (!adminPassword || !token) return false

  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) return false

  const timestamp = token.substring(0, dotIndex)
  const hmac = token.substring(dotIndex + 1)

  // Check TTL
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Date.now() - ts > SESSION_TTL) return false

  // Verify HMAC
  const expected = createHmac('sha256', adminPassword).update(timestamp).digest('hex')
  return hmac === expected
}

export function requireAdmin(event: H3Event): void {
  const adminPassword = getAdminPassword()
  if (!adminPassword) {
    throw createError({ statusCode: 503, statusMessage: 'Admin not configured' })
  }

  const token = getCookie(event, COOKIE_NAME)
  if (!token || !verifySessionToken(token)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
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

export function isAuthenticated(event: H3Event): boolean {
  const adminPassword = getAdminPassword()
  if (!adminPassword) return false
  const token = getCookie(event, COOKIE_NAME)
  return !!token && verifySessionToken(token)
}
