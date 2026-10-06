import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

/** In-site notifications (the bell in the header): alerts and finished scheduled briefings. */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'notifications.json')
const KEEP = 100      // per user
const KEEP_DAYS = 90

export interface Notification { id: string; t: string; kind: string; title: string; body?: string; url?: string; read: boolean }
type Store = Record<string, Notification[]>

function load(): Store { try { return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf-8')) : {} } catch { return {} } }
function save(s: Store) { writeFileSync(FILE + '.tmp', JSON.stringify(s)); renameSync(FILE + '.tmp', FILE) }

export function addNotifications(userId: string, items: Omit<Notification, 'id' | 't' | 'read'>[]) {
  if (!items.length) return
  const s = load()
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString()
  const now = new Date().toISOString()
  s[userId] = [...items.map(i => ({ ...i, id: randomBytes(6).toString('hex'), t: now, read: false })), ...(s[userId] || [])]
    .filter(n => n.t >= cutoff).slice(0, KEEP)
  save(s)
}
export function getNotifications(userId: string): Notification[] { return load()[userId] || [] }
export function markRead(userId: string, ids: string[] | 'all') {
  const s = load()
  for (const n of s[userId] || []) if (ids === 'all' || ids.includes(n.id)) n.read = true
  save(s)
}
export function clearUser(userId: string) { const s = load(); delete s[userId]; save(s) }
