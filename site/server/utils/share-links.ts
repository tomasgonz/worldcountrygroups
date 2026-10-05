import { existsSync, readFileSync, writeFileSync, renameSync, statSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import type { H3Event } from 'h3'

/**
 * Share links: an admin creates a link to one page; anyone with the link can view
 * that page (read-only) without an account. Stored in share-links.json.
 */
export interface ShareLink {
  id: string
  token: string
  path: string            // e.g. /elections?tab=council or /ask?id=abc
  label: string
  createdAt: string
  createdBy: string
  expiresAt: string | null
  maxViews: number | null
  views: number
  lastViewedAt: string | null
  revokedAt: string | null
}

export const SHARE_COOKIE = 'wcg_share'
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'share-links.json')
let cache: { mtime: number; links: ShareLink[] } | null = null

function load(): ShareLink[] {
  try {
    if (!existsSync(FILE)) return []
    const m = statSync(FILE).mtimeMs
    if (cache && cache.mtime === m) return cache.links
    const links = JSON.parse(readFileSync(FILE, 'utf-8')).links || []
    cache = { mtime: m, links }
    return links
  } catch { return cache?.links || [] }
}
function save(links: ShareLink[]) {
  writeFileSync(FILE + '.tmp', JSON.stringify({ links }, null, 2))
  renameSync(FILE + '.tmp', FILE)
  cache = { mtime: statSync(FILE).mtimeMs, links }
}

export function listShareLinks(): (ShareLink & { status: string })[] {
  return load().map(l => ({ ...l, status: linkStatus(l) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function linkStatus(l: ShareLink): 'active' | 'expired' | 'revoked' | 'used up' {
  if (l.revokedAt) return 'revoked'
  if (l.expiresAt && l.expiresAt < new Date().toISOString()) return 'expired'
  if (l.maxViews && l.views >= l.maxViews) return 'used up'
  return 'active'
}

/** Pages that may be shared: anything but admin, account and login pages. */
export function normalisePath(input: string): string | null {
  let p = String(input || '').trim()
  try { if (/^https?:\/\//i.test(p)) { const u = new URL(p); p = u.pathname + u.search } } catch { return null }
  if (!p.startsWith('/') || p.startsWith('//')) return null
  if (/^\/(admin|account|dashboard|login|register|pending|s\/|api\/)/.test(p)) return null
  if (p.length > 500 || /[\s<>"]/.test(p)) return null
  return p
}

export function createShareLink(o: { path: string; label?: string; expiresDays?: number | null; maxViews?: number | null; createdBy: string }): ShareLink {
  const path = normalisePath(o.path)
  if (!path) throw new Error('That page cannot be shared (admin, account and login pages are excluded)')
  const links = load().slice()
  const days = o.expiresDays && o.expiresDays > 0 ? Math.min(3650, o.expiresDays) : null
  const link: ShareLink = {
    id: randomBytes(6).toString('hex'),
    token: randomBytes(18).toString('base64url'),
    path, label: (o.label || '').trim().slice(0, 120) || path,
    createdAt: new Date().toISOString(), createdBy: o.createdBy,
    expiresAt: days ? new Date(Date.now() + days * 86400_000).toISOString() : null,
    maxViews: o.maxViews && o.maxViews > 0 ? Math.min(100000, Math.floor(o.maxViews)) : null,
    views: 0, lastViewedAt: null, revokedAt: null,
  }
  links.push(link)
  save(links)
  return link
}

export function updateShareLink(id: string, action: 'revoke' | 'restore' | 'delete' | 'extend', days?: number) {
  const links = load().slice()
  const i = links.findIndex(l => l.id === id)
  if (i < 0) throw new Error('Link not found')
  if (action === 'delete') { links.splice(i, 1); save(links); return null }
  const l = { ...links[i] }
  if (action === 'revoke') l.revokedAt = new Date().toISOString()
  if (action === 'restore') l.revokedAt = null
  if (action === 'extend') {
    const base = l.expiresAt && l.expiresAt > new Date().toISOString() ? new Date(l.expiresAt).getTime() : Date.now()
    l.expiresAt = days && days > 0 ? new Date(base + Math.min(3650, days) * 86400_000).toISOString() : null
  }
  links[i] = l
  save(links)
  return l
}

export function findByToken(token: string): ShareLink | null {
  if (!token || token.length < 16) return null
  return load().find(l => l.token === token) || null
}

export function recordView(id: string) {
  const links = load().slice()
  const i = links.findIndex(l => l.id === id)
  if (i < 0) return
  links[i] = { ...links[i], views: links[i].views + 1, lastViewedAt: new Date().toISOString() }
  save(links)
}

/** The share link carried by this request's cookie, if it is still valid. */
export function shareFromEvent(event: H3Event): ShareLink | null {
  const token = getCookie(event, SHARE_COOKIE)
  if (!token) return null
  const l = findByToken(token)
  return l && linkStatus(l) === 'active' ? l : (l && l.maxViews && l.views >= l.maxViews && !l.revokedAt && !(l.expiresAt && l.expiresAt < new Date().toISOString()) ? l : null)
}

/** The Ask answer id a link opens, if it is a link to an answer. */
export function sharedAskId(l: ShareLink | null): string | null {
  if (!l) return null
  const m = l.path.match(/^\/ask\?(?:.*&)?id=([a-z0-9]+)/)
  return m ? m[1] : null
}
