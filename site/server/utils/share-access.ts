import { appendFileSync, existsSync, readFileSync, writeFileSync, renameSync, statSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import type { H3Event } from 'h3'

/**
 * Access log for share links: every open (or refused attempt), link previews made by
 * messaging apps, and the pages a visitor then views. One JSON object per line in
 * share-access.jsonl; entries older than a year are dropped.
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'share-access.jsonl')
const KEEP_DAYS = 365
export const VISITOR_COOKIE = 'wcg_sv'

export interface AccessEntry {
  t: string
  event: 'open' | 'refused' | 'preview' | 'view'
  linkId: string | null
  label?: string
  reason?: string          // for refused: missing, expired, revoked, used up
  path?: string
  visitor: string | null   // random id kept in a cookie on the visitor's browser
  ip: string | null
  forwardedFor: string | null
  ua: string
  device: string
  lang: string | null
  referer: string | null
}

/** Client IP: exe.dev appends the address it sees, then nginx appends the proxy's; take the one exe.dev added. */
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
  const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? 'iPad' : 'iPhone') : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'unknown device'
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'browser'
  return { bot: null, device: `${br} on ${os}` }
}

export function visitorId(event: H3Event, create: boolean): string | null {
  let v = getCookie(event, VISITOR_COOKIE) || null
  if (!v && create) {
    v = randomBytes(9).toString('base64url')
    setCookie(event, VISITOR_COOKIE, v, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 })
  }
  return v
}

let writes = 0
export function logAccess(event: H3Event, e: Omit<AccessEntry, 't' | 'ip' | 'forwardedFor' | 'ua' | 'device' | 'lang' | 'referer'> & { device?: string }) {
  try {
    const ua = String(getHeader(event, 'user-agent') || '').slice(0, 300)
    const { ip, xff } = clientIp(event)
    const entry: AccessEntry = {
      t: new Date().toISOString(), ...e,
      ip, forwardedFor: xff, ua, device: e.device || describeAgent(ua).device,
      lang: (getHeader(event, 'accept-language') || '').split(',')[0] || null,
      referer: getHeader(event, 'referer') || null,
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
      if (e.ip) (ips[e.linkId] ||= new Set()).add(e.ip)
    } else if (e.event === 'preview') r.previews++
    else if (e.event === 'refused') r.refused++
    else if (e.event === 'view') r.views++
  }
  for (const id of Object.keys(s)) { s[id].visitors = vis[id]?.size || 0; s[id].ips = ips[id]?.size || 0 }
  return s
}
