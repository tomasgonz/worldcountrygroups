import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { getUserById } from './users'
import { getElections, getJournalDays, type Election, type JournalMeeting } from './upcoming'
import { getSgSelection } from './sg-selection'
import { getUnElections } from './un-elections'
import { getRegistry } from './wcg'

/**
 * Calendar subscriptions (iCalendar feeds, RFC 5545) for Outlook, Google Calendar and Apple
 * Calendar. Each user may have one feed, addressed by a secret random token (calendar apps
 * cannot log in, so the token in the URL is the authorisation). Settings live in
 * server/data/calendar-feeds.json; the feed itself is built on request from the data files.
 */

export type MeetingsChoice = 'none' | 'newyork' | 'geneva' | 'both'
export type ElectionsChoice = 'none' | 'followed' | 'all'

export interface CalendarFeedInclude {
  unMeetings: MeetingsChoice
  unMeetingsPublicOnly: boolean
  elections: ElectionsChoice
  /** Secretary-General selection milestones, straw polls, Security Council and PGA elections */
  unElections: boolean
}

export interface CalendarFeed {
  token: string
  include: CalendarFeedInclude
  createdAt: string
  updatedAt?: string
}

export const DEFAULT_INCLUDE: CalendarFeedInclude = {
  unMeetings: 'newyork',
  unMeetingsPublicOnly: true,
  elections: 'followed',
  unElections: true,
}

const DATA_DIR = process.env.WCG_SITE_DATA
  || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FEEDS_PATH = join(DATA_DIR, 'calendar-feeds.json')

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function load(): Record<string, CalendarFeed> {
  try {
    if (!existsSync(FEEDS_PATH)) return {}
    return JSON.parse(readFileSync(FEEDS_PATH, 'utf-8')) || {}
  } catch {
    return {}
  }
}

function save(data: Record<string, CalendarFeed>) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${FEEDS_PATH}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 })
  renameSync(tmp, FEEDS_PATH)
}

const newToken = () => randomBytes(24).toString('base64url') // 32 characters

function sanitizeInclude(raw: any, base: CalendarFeedInclude = DEFAULT_INCLUDE): CalendarFeedInclude {
  const r = raw || {}
  return {
    unMeetings: ['none', 'newyork', 'geneva', 'both'].includes(r.unMeetings) ? r.unMeetings : base.unMeetings,
    unMeetingsPublicOnly: typeof r.unMeetingsPublicOnly === 'boolean' ? r.unMeetingsPublicOnly : base.unMeetingsPublicOnly,
    elections: ['none', 'followed', 'all'].includes(r.elections) ? r.elections : base.elections,
    unElections: typeof r.unElections === 'boolean' ? r.unElections : base.unElections,
  }
}

export function getFeed(userId: string): CalendarFeed | null {
  const f = load()[userId]
  return f ? { ...f, include: sanitizeInclude(f.include) } : null
}

export function getOrCreateFeed(userId: string): CalendarFeed {
  const data = load()
  if (!data[userId]) {
    data[userId] = { token: newToken(), include: { ...DEFAULT_INCLUDE }, createdAt: new Date().toISOString() }
    save(data)
  }
  return getFeed(userId)!
}

/** Update the feed's options (creating the feed if needed). */
export function updateFeedSettings(userId: string, include: Partial<CalendarFeedInclude>): CalendarFeed {
  const data = load()
  const cur = data[userId]
  const now = new Date().toISOString()
  data[userId] = cur
    ? { ...cur, include: sanitizeInclude(include, sanitizeInclude(cur.include)), updatedAt: now }
    : { token: newToken(), include: sanitizeInclude(include), createdAt: now }
  save(data)
  return getFeed(userId)!
}

/** Issue a new secret token; the old feed URL stops working immediately. */
export function regenerateFeedToken(userId: string): CalendarFeed {
  const data = load()
  const now = new Date().toISOString()
  data[userId] = data[userId]
    ? { ...data[userId], token: newToken(), updatedAt: now }
    : { token: newToken(), include: { ...DEFAULT_INCLUDE }, createdAt: now }
  save(data)
  return getFeed(userId)!
}

/** Turn the calendar subscription off (also used when an account is deleted). */
export function deleteFeed(userId: string): boolean {
  const data = load()
  if (!data[userId]) return false
  delete data[userId]
  save(data)
  return true
}

/** Resolve a feed token to its (still approved) user. Constant-time comparison. */
export function findFeedByToken(token: string): { userId: string; feed: CalendarFeed } | null {
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token || '')) return null
  const want = Buffer.from(token)
  for (const [userId, feed] of Object.entries(load())) {
    const have = Buffer.from(feed.token || '')
    if (have.length === want.length && timingSafeEqual(have, want)) {
      const user = getUserById(userId)
      if (!user || user.status !== 'approved') return null
      return { userId, feed: { ...feed, include: sanitizeInclude(feed.include) } }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// iCalendar helpers
// ---------------------------------------------------------------------------

const UID_DOMAIN = 'worldcountrygroups'
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`

/** TEXT value escaping (RFC 5545 §3.3.11). */
export function icsEscape(s: string): string {
  return String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Fold a content line at 75 octets (UTF-8), never splitting a multi-byte character. */
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf-8') <= 75) return line
  const out: string[] = []
  let cur = ''
  let bytes = 0
  let limit = 75
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf-8')
    if (bytes + b > limit) {
      out.push(cur)
      cur = ' '
      bytes = 1
      limit = 75
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.join('\r\n')
}

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const dateValue = (ymd: string) => ymd.replace(/-/g, '')
const ymdUtc = (d: Date) => d.toISOString().slice(0, 10)
function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return ymdUtc(d)
}
const shortHash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 10)
const cleanUrl = (u: string | null | undefined) => (u && /^https?:\/\/\S+$/.test(u) ? u : null)

/** UTC instant for a wall-clock time in an IANA time zone. */
function zonedToUtc(ymd: string, h: number, m: number, tz: string): Date {
  const guess = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), h, m)
  const offsetAt = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(t)).map(x => [x.type, x.value]))
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t
  }
  return new Date(guess - offsetAt(guess - offsetAt(guess)))
}

interface IcsEvent {
  uid: string
  summary: string
  description?: string
  url?: string | null
  location?: string | null
  /** timed event (UTC) */
  start?: Date
  end?: Date
  /** all-day event: first day and last day (inclusive), YYYY-MM-DD */
  date?: string
  dateEnd?: string
  cancelled?: boolean
  tentative?: boolean
  categories?: string[]
}

function renderEvent(e: IcsEvent, stamp: string): string[] {
  const L: string[] = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`]
  if (e.date) {
    L.push(`DTSTART;VALUE=DATE:${dateValue(e.date)}`)
    L.push(`DTEND;VALUE=DATE:${dateValue(addDays(e.dateEnd || e.date, 1))}`)
    L.push('TRANSP:TRANSPARENT')
  } else if (e.start) {
    L.push(`DTSTART:${utcStamp(e.start)}`)
    L.push(`DTEND:${utcStamp(e.end && e.end > e.start ? e.end : new Date(e.start.getTime() + 3600_000))}`)
  }
  L.push(`SUMMARY:${icsEscape(e.summary)}`)
  if (e.description) L.push(`DESCRIPTION:${icsEscape(e.description)}`)
  if (e.location) L.push(`LOCATION:${icsEscape(e.location)}`)
  const url = cleanUrl(e.url)
  if (url) L.push(`URL:${url}`)
  if (e.categories?.length) L.push(`CATEGORIES:${e.categories.map(icsEscape).join(',')}`)
  L.push(`STATUS:${e.cancelled ? 'CANCELLED' : e.tentative ? 'TENTATIVE' : 'CONFIRMED'}`)
  if (e.cancelled) L.push('SEQUENCE:1')
  L.push('END:VEVENT')
  return L
}

// ---------------------------------------------------------------------------
// Event sources
// ---------------------------------------------------------------------------

const VENUE: Record<string, string> = {
  'New York': 'United Nations Headquarters, New York',
  Geneva: 'Palais des Nations, Geneva',
}

function meetingEvents(inc: CalendarFeedInclude): IcsEvent[] {
  if (inc.unMeetings === 'none') return []
  const location = inc.unMeetings === 'both' ? 'all' : inc.unMeetings === 'geneva' ? 'Geneva' : 'New York'
  const days = getJournalDays({ location, days: 8, includeClosed: !inc.unMeetingsPublicOnly })
  const out: IcsEvent[] = []
  for (const day of days) {
    for (const m of day.meetings as JournalMeeting[]) {
      const title = (m.title || '').trim()
      const summary = [m.organ, title && title.toLowerCase() !== m.organ.toLowerCase() ? title : ''].filter(Boolean).join(': ')
        + (m.closed ? ' (closed)' : '')
      const desc: string[] = []
      if (m.session) desc.push(m.session)
      if (m.note) desc.push(m.note)
      if (m.agenda?.length) desc.push('Agenda:\n' + m.agenda.map(a => `• ${a}`).join('\n'))
      if (m.closed) desc.push('Closed meeting.')
      if (m.followed_by) desc.push('Followed by another meeting; the end time is approximate.')
      else if (m.start && !m.end) desc.push('End time not given in the Journal.')
      if (m.cancelled) desc.push('CANCELLED.')
      if (cleanUrl(m.webcast_url)) desc.push(`Webcast: ${m.webcast_url}`)
      if (cleanUrl(m.journal_url) || cleanUrl(day.journalUrl)) desc.push(`UN Journal: ${m.journal_url || day.journalUrl}`)
      desc.push('Source: Journal of the United Nations, via World Country Groups.')
      const venue = VENUE[m.location] || m.location
      const ev: IcsEvent = {
        uid: `unj-${m.id}-${m.date}@${UID_DOMAIN}`,
        summary,
        description: desc.join('\n\n'),
        url: m.journal_url || day.journalUrl,
        location: m.room ? `${m.room}, ${venue}` : venue,
        cancelled: m.cancelled,
        categories: ['UN meeting', m.location],
      }
      if (m.start) {
        ev.start = new Date(m.start)
        ev.end = m.end ? new Date(m.end) : undefined
      } else {
        ev.date = m.date
      }
      out.push(ev)
    }
  }
  return out
}

function followedIso3(userId: string): Set<string> {
  const user = getUserById(userId)
  const codes = user?.preferences?.bookmarkedCountries || []
  const out = new Set<string>()
  for (const c of codes) {
    const up = String(c).toUpperCase()
    if (/^[A-Z]{3}$/.test(up)) { out.add(up); continue }
    try {
      const iso3 = getRegistry().getCountryMembership(up)?.iso3
      if (iso3) out.add(iso3.toUpperCase())
    } catch { /* registry unavailable */ }
  }
  return out
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function electionEvents(userId: string, inc: CalendarFeedInclude, base: string): IcsEvent[] {
  if (inc.elections === 'none') return []
  let list: Election[] = getElections({ status: 'upcoming', withinDays: 365, includeIndirect: true })
  if (inc.elections === 'followed') {
    const followed = followedIso3(userId)
    list = list.filter(e => e.iso3 && followed.has(e.iso3.toUpperCase()))
  }
  const seen = new Set<string>()
  const out: IcsEvent[] = []
  for (const e of list) {
    if (e.precision !== 'day' && e.precision !== 'month') continue
    // the id starts with the date, which sharpens over time (2027-03 → 2027-03-14): key on year + rest
    const rest = e.id.replace(/^\d{4}(-\d{2}){0,2}-?/, '') || shortHash(e.id)
    let uid = `election-${e.date.slice(0, 4)}-${rest}@${UID_DOMAIN}`
    if (seen.has(uid)) uid = `election-${e.date}-${rest}@${UID_DOMAIN}`
    seen.add(uid)
    const tbc = e.precision === 'month'
    const what = e.description || e.type
    const monthLabel = tbc ? `${MONTHS[+e.date.slice(5, 7) - 1]} ${e.date.slice(0, 4)}` : ''
    const desc = [
      `${e.country}: ${what}${e.indirect ? ' (indirect election)' : ''}.`,
      tbc ? `Expected in ${monthLabel}; the exact date is to be confirmed. Shown on the first of the month.` : '',
      e.date_end && e.date_end !== e.date ? `Voting from ${e.date} to ${e.date_end}.` : '',
      cleanUrl(e.article_url) ? `More: ${e.article_url}` : '',
      e.iso3 ? `Country profile: ${base}/countries/${e.iso3.toLowerCase()}` : '',
      'Source: Wikipedia national electoral calendar (CC BY-SA 4.0), via World Country Groups.',
    ].filter(Boolean).join('\n\n')
    out.push({
      uid,
      summary: `${e.country}: ${what}${e.indirect ? ' (indirect)' : ''}${tbc ? ` — date TBC (${monthLabel})` : ''}`,
      description: desc,
      url: e.article_url || e.source_url,
      date: tbc ? `${e.date.slice(0, 7)}-01` : e.date,
      dateEnd: tbc ? undefined : e.date_end || undefined,
      tentative: tbc,
      categories: ['Election'],
    })
  }
  return out
}

/** "June 2027" / "early June 2027" → 2027-06 */
function monthOf(text: string | null | undefined): string | null {
  const m = String(text || '').match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/)
  return m ? `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}` : null
}

function unElectionEvents(base: string, from: string, until: string): IcsEvent[] {
  const out: IcsEvent[] = []
  const inWindow = (d: string | null | undefined) => !!d && d >= from && d <= until

  // Secretary-General selection
  const sg = getSgSelection()
  if (sg) {
    const sgPage = `${base}/elections`
    const seen = new Set<string>()
    for (const t of sg.process.timeline || []) {
      if (!inWindow(t.date)) continue
      // stable across fetches: kind + date (+ candidate); sources and wording may change
      let uid = `sg-${t.kind}-${t.date}${t.candidate_id ? `-${t.candidate_id}` : ''}@${UID_DOMAIN}`
      if (seen.has(uid)) uid = uid.replace('@', `-${shortHash(t.title)}@`)
      seen.add(uid)
      const ev: IcsEvent = {
        uid,
        summary: `UN Secretary-General selection: ${t.title}`,
        description: [t.detail || '', cleanUrl(t.url) ? `Source: ${t.url}` : '', `Tracker: ${sgPage}`].filter(Boolean).join('\n\n'),
        url: t.url || sgPage,
        date: t.date,
        categories: ['UN elections', 'Secretary-General'],
      }
      // dialogues have a New York time ("10 a.m. (EDT)")
      if (t.kind === 'dialogue') {
        const d = sg.process.dialogues.find(x => x.date === t.date && x.candidate_id === t.candidate_id)
        const tm = d?.time?.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\b/i)
        if (tm) {
          const h = (+tm[1] % 12) + (tm[3].toLowerCase() === 'p' ? 12 : 0)
          ev.start = zonedToUtc(t.date, h, +(tm[2] || 0), 'America/New_York')
          ev.end = new Date(ev.start.getTime() + 2 * 3600_000)
          ev.date = undefined
          ev.location = 'General Assembly Hall, United Nations Headquarters, New York'
          if (cleanUrl(d?.webcast_url)) ev.description += `\n\nWebcast: ${d!.webcast_url}`
        }
      }
      out.push(ev)
    }
  }

  // Security Council and PGA elections
  const ue = getUnElections()
  if (ue) {
    const sc = ue.security_council
    for (const el of [sc.latest_election, sc.next_election]) {
      if (!el) continue
      const page = `${base}/elections?tab=council`
      const summaryBase = `UN Security Council elections (${el.term} term)`
      if (el.date && inWindow(el.date)) {
        out.push({
          uid: `unsc-election-${el.year}@${UID_DOMAIN}`, summary: summaryBase, date: el.date, url: page,
          location: 'General Assembly Hall, United Nations Headquarters, New York',
          description: `The General Assembly elects non-permanent members of the Security Council for ${el.term}.\n\nTracker: ${page}`,
          categories: ['UN elections', 'Security Council'],
        })
      } else if (!el.date && el.status !== 'held') {
        const ym = monthOf(el.date_note || el.date_text)
        if (ym && inWindow(`${ym}-01`)) {
          out.push({
            uid: `unsc-election-${el.year}@${UID_DOMAIN}`, summary: `${summaryBase} — date TBC`, date: `${ym}-01`, url: page, tentative: true,
            description: `Expected: ${el.date_note || el.date_text}. The exact date is to be confirmed; shown on the first of the month.\n\nTracker: ${page}`,
            categories: ['UN elections', 'Security Council'],
          })
        }
      }
    }

    const pga = ue.pga
    const page = `${base}/elections?tab=pga`
    if (pga.current?.elected_on && inWindow(pga.current.elected_on)) {
      out.push({
        uid: `pga-election-${pga.current.session ?? pga.current.year}@${UID_DOMAIN}`,
        summary: `Election of the President of the UN General Assembly (${pga.current.session ? `${ordinal(pga.current.session)} session` : pga.current.year})`,
        date: pga.current.elected_on, url: pga.current.election_url || page,
        description: `${pga.current.name} (${pga.current.country}) elected.\n\nTracker: ${page}`,
        categories: ['UN elections', 'President of the General Assembly'],
      })
    }
    if (pga.next) {
      const ym = monthOf(pga.next.election_expected)
      if (ym && inWindow(`${ym}-01`)) {
        const cands = pga.next.candidates?.length ? `Candidates: ${pga.next.candidates.map(c => `${c.name} (${c.country})`).join(', ')}.` : 'No candidates announced yet.'
        out.push({
          uid: `pga-election-${pga.next.session}@${UID_DOMAIN}`,
          summary: `Election of the President of the UN General Assembly (${ordinal(pga.next.session)} session) — date TBC`,
          date: `${ym}-01`, url: page, tentative: true,
          description: [`Expected: ${pga.next.election_expected}. The exact date is to be confirmed; shown on the first of the month.`,
            pga.next.group_label ? `It is the ${pga.next.group_label}'s turn.` : '', cands, `Tracker: ${page}`].filter(Boolean).join('\n\n'),
          categories: ['UN elections', 'President of the General Assembly'],
        })
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// The feed
// ---------------------------------------------------------------------------

export interface BuildIcsOptions {
  /** Site origin for links, e.g. https://worldcountrygroups.exe.xyz */
  baseUrl?: string
  now?: Date
  /** Use these options instead of the stored ones (for previews and tests). */
  include?: CalendarFeedInclude
}

export function buildIcs(userId: string, opts: BuildIcsOptions = {}): string {
  const include = opts.include || getFeed(userId)?.include || DEFAULT_INCLUDE
  const base = (opts.baseUrl || 'https://worldcountrygroups.exe.xyz').replace(/\/+$/, '')
  const now = opts.now || new Date()
  const today = ymdUtc(now)
  const events: IcsEvent[] = [
    ...meetingEvents(include),
    ...electionEvents(userId, include, base),
    ...(include.unElections ? unElectionEvents(base, addDays(today, -30), addDays(today, 365)) : []),
  ]
  const stamp = utcStamp(now)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//World Country Groups//Calendar feed 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'NAME:World Country Groups',
    'X-WR-CALNAME:World Country Groups',
    `X-WR-CALDESC:${icsEscape('UN meetings, elections and UN appointments from World Country Groups. Updated automatically.')}`,
    'X-WR-TIMEZONE:UTC',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    `URL:${base}/account`,
  ]
  for (const e of events) lines.push(...renderEvent(e, stamp))
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** Summary counts, for the account page. */
export function countFeedEvents(ics: string) {
  return (ics.match(/^BEGIN:VEVENT\r?$/gm) || []).length
}

export function feedUrls(token: string, origin: string) {
  const https = `${origin.replace(/\/+$/, '')}/calendar/${token}.ics`
  return { feedUrl: https, webcalUrl: https.replace(/^https?:\/\//, 'webcal://') }
}
