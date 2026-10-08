import type { H3Event } from 'h3'

/** Failed logins per network and per username: at most 8 in 15 minutes, then a pause. */
const WINDOW = 15 * 60_000
const MAX = 8
const fails = new Map<string, number[]>()

function keys(event: H3Event, username: string) {
  const ip = (getRequestHeader(event, 'x-forwarded-for') || event.node.req.socket.remoteAddress || '').split(',')[0].trim()
  return [`ip:${ip}`, `user:${String(username || '').toLowerCase()}`]
}

export function checkLoginAllowed(event: H3Event, username: string) {
  const now = Date.now()
  for (const k of keys(event, username)) {
    const list = (fails.get(k) || []).filter(t => now - t < WINDOW)
    fails.set(k, list)
    if (list.length >= MAX) throw createError({ statusCode: 429, statusMessage: 'Too many failed attempts. Try again in 15 minutes.' })
  }
}

export function recordLoginFailure(event: H3Event, username: string) {
  for (const k of keys(event, username)) fails.set(k, [...(fails.get(k) || []), Date.now()])
}
