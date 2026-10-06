import { getUsers } from './users'

/** Plain-text email through the exe.dev email gateway (delivers only to allowed recipients). */
export async function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('http://169.254.169.254/gateway/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ to, subject: subject.slice(0, 200), body }),
    })
    const j: any = await res.json().catch(() => ({}))
    return j?.success === true ? { ok: true } : { ok: false, error: j?.error || `HTTP ${res.status}` }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) }
  }
}

export const SITE_URL = process.env.WCG_SITE_URL || 'https://www.worldcountrygroups.org'

export function userEmail(userId: string): string | null {
  const u = getUsers().find(x => x.id === userId)
  return u?.email && /@/.test(u.email) ? u.email : null
}
