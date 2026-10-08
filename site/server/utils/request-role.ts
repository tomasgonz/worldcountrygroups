import type { H3Event } from 'h3'
import { getSession } from './auth'

/** True when the request comes from a signed-in admin (used to allow costly options such as ?force=true). */
export function isAdminRequest(event: H3Event): boolean {
  try { return getSession(event)?.role === 'admin' } catch { return false }
}
