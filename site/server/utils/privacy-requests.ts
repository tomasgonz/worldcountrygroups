import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { getUsers } from './users'
import { getCronConfig } from './cron-config'

/** Data-protection requests sent through the form on the privacy page. */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'privacy-requests.json')
export const REQUEST_TYPES = ['access', 'correction', 'deletion', 'objection', 'restriction', 'portability', 'question'] as const

export interface PrivacyRequest {
  id: string; createdAt: string; type: string; email: string; name: string; message: string
  status: 'open' | 'done'; doneAt?: string; note?: string
}

const KEEP_CLOSED_DAYS = 3 * 365 // closed requests are deleted three years after they were closed

export function listRequests(): PrivacyRequest[] {
  let list: PrivacyRequest[] = []
  try { list = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf-8')).requests || [] : [] } catch { return [] }
  const cutoff = new Date(Date.now() - KEEP_CLOSED_DAYS * 86400_000).toISOString()
  const kept = list.filter(r => !(r.status === 'done' && r.doneAt && r.doneAt < cutoff))
  if (kept.length !== list.length) save(kept)
  return kept
}
function save(list: PrivacyRequest[]) {
  writeFileSync(FILE + '.tmp', JSON.stringify({ requests: list }, null, 2))
  renameSync(FILE + '.tmp', FILE)
}

export async function addRequest(r: { type: string; email: string; name: string; message: string }) {
  const req: PrivacyRequest = { id: randomBytes(6).toString('hex'), createdAt: new Date().toISOString(), status: 'open', ...r }
  save([req, ...listRequests()])
  // tell the administrators (exe.dev email gateway; delivers only to allowed recipients)
  const to = new Set<string>([...(getCronConfig().alertEmails || []), ...getUsers().filter(u => u.role === 'admin' && u.email).map(u => u.email)])
  for (const addr of to) {
    try {
      await fetch('http://169.254.169.254/gateway/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({ to: addr, subject: `World Country Groups: privacy request (${req.type})`, body: `A data-protection request was received on ${req.createdAt.slice(0, 10)}.\n\nType: ${req.type}\nFrom: ${req.name || '(no name)'} <${req.email}>\n\n${req.message}\n\nAnswer within one month. Manage it in Admin → Users and access.` }),
      })
    } catch {}
  }
  return req
}

export function updateRequest(id: string, action: 'done' | 'reopen' | 'delete', note?: string) {
  const list = listRequests()
  const i = list.findIndex(r => r.id === id)
  if (i < 0) throw new Error('Not found')
  if (action === 'delete') list.splice(i, 1)
  else if (action === 'done') list[i] = { ...list[i], status: 'done', doneAt: new Date().toISOString(), note: (note || '').slice(0, 1000) }
  else list[i] = { ...list[i], status: 'open', doneAt: undefined }
  save(list)
}
