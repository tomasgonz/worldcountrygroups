import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import { getUserById, deleteUser, getUsers } from './users'
import { listAsks } from './ask-runner'

/**
 * Everything the site holds about one user: for data access/portability requests and for
 * erasure (deleting an account removes their questions and digest records too).
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')

function readJson(name: string): any {
  try { return JSON.parse(readFileSync(join(DATA_DIR, name), 'utf-8')) } catch { return null }
}

export function exportUserData(id: string) {
  const u = getUserById(id)
  if (!u) return null
  const { passwordHash: _h, salt: _s, ...account } = u as any
  const digest = (readJson('digest-state.json')?.users || {})[id] || null
  const asks = listAsks().filter(a => a.userId === id)
  return {
    exportedAt: new Date().toISOString(),
    about: 'All personal data World Country Groups holds about this account. Passwords are stored only in hashed form and are not included.',
    account,
    emailDigestState: digest,
    questions: asks,
  }
}

/** Delete an account and the data linked to it. */
export function eraseUser(id: string): { questions: number } {
  let questions = 0
  for (const a of listAsks().filter(x => x.userId === id)) {
    const p = join(DATA_DIR, 'asks', `${a.id}.json`)
    if (existsSync(p)) { unlinkSync(p); questions++ }
  }
  const dp = join(DATA_DIR, 'digest-state.json')
  const d = readJson('digest-state.json')
  if (d?.users && d.users[id]) {
    delete d.users[id]
    writeFileSync(dp + '.tmp', JSON.stringify(d, null, 2))
    renameSync(dp + '.tmp', dp)
  }
  deleteUser(id)
  return { questions }
}

export function isLastAdmin(id: string) {
  const admins = getUsers().filter(u => u.role === 'admin' && u.status === 'approved')
  return admins.length === 1 && admins[0].id === id
}
