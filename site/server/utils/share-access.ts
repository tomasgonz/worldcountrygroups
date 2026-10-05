import { appendFileSync, existsSync, readFileSync, writeFileSync, renameSync, statSync } from 'fs'
import { join } from 'path'
import { randomBytes, createHash } from 'crypto'
import type { H3Event } from 'h3'

/**
 * Minimal visit statistics for share links: opens (or refused attempts), link previews
 * made by messaging apps, and pages viewed. Deliberately limited: no full IP address
 * (shortened to the network), no browser fingerprint, no tracking cookie; visitors are
 * counted per day with a code that changes daily and cannot be linked across days.
 * One JSON object per line in share-access.jsonl; entries older than 90 days are dropped.
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'share-access.jsonl')
const KEEP_DAYS = 90
/** Set when a visitor objects to statistics; their visits are then not recorded. */
export const NOSTATS_COOKIE = 'wcg_nostats'

export interface AccessEntry {
  t: string
  event: 'open' | 'refused' | 'preview' | 'view'
  linkId: string | null
  label?: string
  reason?: string          // for refused: missing, expired, revoked, used up
  path?: string
  visitor: string | null   // daily code: same browser and network on the same day; changes every day
  network: string | null   // IP address shortened to its network (last part removed)
  device: string           // browser family and device type only
  lang: string | null      // main language code only
  referer: string | null   // referring site name only
}

/** Client IP: exe.dev appends the address it sees, then nginx appends the proxy's; take the one exe.dev added. */
/** Remove the host part: 203.0.113.57 -> 203.0.113.0, 2001:db8:1:2:… -> 2001:db8:1::. */
export function shortenIp(ip: string | null): string | null {
  if (!ip) return null
  const v4 = ip.replace(/^::ffff:/, '')
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split('.').slice(0, 3).join('.') + '.0'
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::'
  return null
}

let salt = { day: '', value: '' }
function dailySalt() {
  const day = new Date().toISOString().slice(0, 10)
  if (salt.day !== day) salt = { day, value: randomBytes(16).toString('hex') } // kept only in memory, never written
  return salt.value
}

/** A code for "this browser on this network today": not stored on the visitor's device, unlinkable across days. */
export function dailyVisitor(event: H3Event): string {
  const { ip } = clientIp(event)
  const ua = String(getHeader(event, 'user-agent') || '')
  return createHash('sha256').update(`${dailySalt()}|${ip}|${ua}`).digest('base64url').slice(0, 10)
}

export function clientIp(event: H3Event): { ip: string | null; xff: string | null } {
  const xff = getHeader(event, 'x-forwarded-for') || null
  const parts = (xff || '').split(',').map(s => s.trim()).filter(Boolean)
  const ip = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || getHeader(event, 'x-real-ip') || event.node.req.socket?.remoteAddress || null
  return { ip, xff }
}

const BOTS: [RegExp, string][] = [
  [/WhatsApp/i, 'WhatsApp preview'], [/Slackbot|Slack-ImgProxy/i, 'Slack preview'], [/facebookexternalhit|Facebot/i, 'Facebook preview'],
  [/Twitterbot/i, 'X/Twitter preview'], [/LinkedInBot/i, 'LinkedIn preview'], [/TelegramBot/i, 'Telegram preview'], [/Discordbot/i, 'Discord preview'],
  [/SkypeUriPreview|Teams|MicrosoftPreview/i, 'Microsoft Teams/Skype preview'], [/Google-?(Read-Aloud|InspectionTool)|Googlebot|bingbot|Applebot/i, 'search engine'],
  [/Signal|iMessage|com\.apple\.messages|Mail\.app/i, 'messaging preview'], [/Outlook|SafeLinks|Proofpoint|Mimecast|Barracuda/i, 'email link scanner'],
  [/curl|wget|python-requests|Go-http-client|HeadlessChrome/i, 'automated client'],
]

export function describeAgent(ua: string): { bot: string | null; device: string } {
  for (const [re, name] of BOTS) if (re.test(ua)) return { bot: name, device: name }
  const os = /iPad|Tablet/.test(ua) ? 'tablet' : /iPhone|Android.*Mobile|Mobile/.test(ua) ? 'phone' : 'computer'
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'browser'
  return { bot: null, device: `${br}, ${os}` }
}

let writes = 0
export function logAccess(event: H3Event, e: Omit<AccessEntry, 't' | 'network' | 'device' | 'lang' | 'referer' | 'visitor'> & { device?: string; visitor?: string | null }) {
  if (getCookie(event, NOSTATS_COOKIE) === '1') return // the visitor objected
  try {
    const ua = String(getHeader(event, 'user-agent') || '')
    const ref = getHeader(event, 'referer') || ''
    let refHost: string | null = null
    try { refHost = ref ? new URL(ref).hostname : null } catch {}
    const entry: AccessEntry = {
      t: new Date().toISOString(), ...e,
      visitor: e.visitor === undefined ? dailyVisitor(event) : e.visitor,
      network: shortenIp(clientIp(event).ip), device: e.device || describeAgent(ua).device,
      lang: ((getHeader(event, 'accept-language') || '').split(',')[0] || '').split('-')[0].toLowerCase() || null,
      referer: refHost,
    }
    appendFileSync(FILE, JSON.stringify(entry) + '\n')
    if (++writes % 200 === 0) prune()
  } catch {}
}

function prune() {
  if (!existsSync(FILE)) return
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString()
  const keep = readFileSync(FILE, 'utf-8').split('\n').filter(l => l && (JSON.parse(l).t || '') >= cutoff)
  writeFileSync(FILE + '.tmp', keep.join('\n') + (keep.length ? '\n' : ''))
  renameSync(FILE + '.tmp', FILE)
}

export function readAccess(linkId?: string): AccessEntry[] {
  if (!existsSync(FILE)) return []
  const out: AccessEntry[] = []
  for (const line of readFileSync(FILE, 'utf-8').split('\n')) {
    if (!line) continue
    try { const e = JSON.parse(line); if (!linkId || e.linkId === linkId) out.push(e) } catch {}
  }
  return out.reverse()
}

/** Per-link summary: real opens (not previews), distinct visitors and IPs, pages viewed. */
export function accessSummary(): Record<string, { opens: number; previews: number; refused: number; visitors: number; ips: number; views: number; lastOpen: string | null }> {
  const s: Record<string, any> = {}
  const vis: Record<string, Set<string>> = {}
  const ips: Record<string, Set<string>> = {}
  for (const e of readAccess()) {
    if (!e.linkId) continue
    const r = (s[e.linkId] ||= { opens: 0, previews: 0, refused: 0, visitors: 0, ips: 0, views: 0, lastOpen: null })
    if (e.event === 'open') {
      r.opens++
      if (!r.lastOpen || e.t > r.lastOpen) r.lastOpen = e.t
      if (e.visitor) (vis[e.linkId] ||= new Set()).add(e.visitor)
      if (e.network) (ips[e.linkId] ||= new Set()).add(e.network)
    } else if (e.event === 'preview') r.previews++
    else if (e.event === 'refused') r.refused++
    else if (e.event === 'view') r.views++
  }
  for (const id of Object.keys(s)) { s[id].visitors = vis[id]?.size || 0; s[id].ips = ips[id]?.size || 0 }
  return s
}
