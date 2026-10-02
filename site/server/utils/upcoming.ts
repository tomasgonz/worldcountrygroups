import { readDataFile, dataFileMtime } from '~/server/utils/data-file'

/**
 * Forward-looking data: the national elections calendar (Wikipedia, CC BY-SA) and the
 * UN Journal's official meetings programme. Both files are written by scheduled
 * fetchers (scripts/fetch_elections.py, scripts/fetch_un_journal.py).
 */

export interface Election {
  id: string
  date: string
  date_end: string | null
  precision: 'day' | 'month' | 'year'
  sort_date: string
  country: string
  iso3: string | null
  territory: boolean
  type: string
  types: string[]
  description: string
  indirect: boolean
  status: 'upcoming' | 'past'
  article_url: string | null
  source_url: string
}

export interface JournalMeeting {
  id: string
  location: string
  timezone: string
  date: string
  start: string | null
  end: string | null
  time: string | null
  time_to: string | null
  followed_by: boolean
  group: string | null
  organ: string
  organ_symbol: string | null
  session: string | null
  title: string | null
  note: string | null
  room: string | null
  closed: boolean
  cancelled: boolean
  webcast_url: string | null
  journal_url: string | null
  agenda: string[]
  documents: string[]
}

const ymd = (d: Date, tz = 'UTC') => d.toLocaleDateString('en-CA', { timeZone: tz })

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Recompute upcoming/past from today's date (the file may be a day or two old). */
function withStatus(e: Election, todayKey: string): Election {
  const end = e.date_end || e.date
  let status: 'upcoming' | 'past'
  if (e.precision === 'day') status = end < todayKey ? 'past' : 'upcoming'
  else if (e.precision === 'month') status = e.date < todayKey.slice(0, 7) ? 'past' : 'upcoming'
  else status = e.date < todayKey.slice(0, 4) ? 'past' : 'upcoming'
  return status === e.status ? e : { ...e, status }
}

export function getElectionsMeta() {
  const file = readDataFile<any>('elections.json')
  const meta = file?._meta || {}
  return {
    attribution: meta.attribution || 'Source: Wikipedia, CC BY-SA',
    license: meta.license || 'CC BY-SA 4.0',
    licenseUrl: meta.license_url || 'https://creativecommons.org/licenses/by-sa/4.0/',
    pages: (meta.pages || []) as { title: string; url: string }[],
    updated: meta.last_updated || dataFileMtime('elections.json'),
  }
}

export interface ElectionQuery {
  iso3?: string
  status?: 'upcoming' | 'past' | 'all'
  /** only elections whose date falls within the next N days (exact dates, or month-precision dates whose month starts in the window) */
  withinDays?: number
  includeIndirect?: boolean
  limit?: number
}

export function getElections(q: ElectionQuery = {}): Election[] {
  const file = readDataFile<any>('elections.json')
  const todayKey = ymd(new Date())
  let list: Election[] = ((file?.elections || []) as Election[]).map(e => withStatus(e, todayKey))
  if (q.iso3) {
    const iso = q.iso3.toUpperCase()
    list = list.filter(e => e.iso3 === iso)
  }
  const status = q.status || 'all'
  if (status !== 'all') list = list.filter(e => e.status === status)
  if (q.includeIndirect === false) list = list.filter(e => !e.indirect)
  if (q.withinDays != null) {
    const until = addDays(todayKey, q.withinDays)
    list = list.filter((e) => {
      if (e.precision === 'day') return (e.date_end || e.date) >= todayKey && e.date <= until
      if (e.precision === 'month') return e.date >= todayKey.slice(0, 7) && `${e.date}-01` <= until
      return false
    })
  }
  list = [...list].sort((a, b) => (status === 'past' ? b.sort_date.localeCompare(a.sort_date) : a.sort_date.localeCompare(b.sort_date)))
  return q.limit ? list.slice(0, q.limit) : list
}

/** The next scheduled (upcoming) national election for a country, preferring direct elections. */
export function getNextElection(iso3: string): Election | null {
  const up = getElections({ iso3, status: 'upcoming' })
  return up.find(e => !e.indirect) || up[0] || null
}

// ---------------------------------------------------------------------------
// UN Journal
// ---------------------------------------------------------------------------

export const JOURNAL_GROUP_ORDER = ['General Assembly', 'Security Council', 'Economic and Social Council',
  'Human Rights Council', 'Human Rights Treaty Bodies', 'Other bodies']

export function getJournalMeta() {
  const file = readDataFile<any>('un-journal.json')
  const meta = file?._meta || {}
  return {
    source: 'Journal of the United Nations',
    sourceUrl: meta.source_url || 'https://journal.un.org/',
    updated: meta.last_updated || dataFileMtime('un-journal.json'),
    issueDates: meta.issue_dates || {},
    days: (meta.days || []) as { location: string; date: string; ok: boolean; count: number; journal_url?: string }[],
    note: meta.note || '',
  }
}

export interface JournalQuery {
  location?: string // 'New York' (default) | 'Geneva' | 'all'
  days?: number // number of days from today (local to the duty station), default 8
  includeClosed?: boolean
}

export interface JournalDay {
  date: string
  location: string
  journalUrl: string | null
  count: number
  meetings: JournalMeeting[]
}

export function getJournalDays(q: JournalQuery = {}): JournalDay[] {
  const file = readDataFile<any>('un-journal.json')
  const meta = getJournalMeta()
  const location = q.location || 'New York'
  const days = Math.max(1, Math.min(q.days ?? 8, 14))
  let meetings = ((file?.meetings || []) as JournalMeeting[])
    .filter(m => location === 'all' || m.location.toLowerCase() === location.toLowerCase())
  if (q.includeClosed === false) meetings = meetings.filter(m => !m.closed)

  const out = new Map<string, JournalDay>()
  for (const m of meetings) {
    const todayKey = ymd(new Date(), m.timezone || 'America/New_York')
    if (m.date < todayKey || m.date > addDays(todayKey, days - 1)) continue
    const key = `${m.location}|${m.date}`
    if (!out.has(key)) {
      const dm = meta.days.find(d => d.location === m.location && d.date === m.date)
      out.set(key, { date: m.date, location: m.location, journalUrl: dm?.journal_url || null, count: 0, meetings: [] })
    }
    const day = out.get(key)!
    day.meetings.push(m)
    day.count++
  }
  const timeKey = (m: JournalMeeting) => m.start || `${m.date}T99`
  for (const d of out.values()) {
    d.meetings.sort((a, b) => timeKey(a).localeCompare(timeKey(b))
      || (JOURNAL_GROUP_ORDER.indexOf(a.group || '') + 100) % 100 - (JOURNAL_GROUP_ORDER.indexOf(b.group || '') + 100) % 100
      || a.organ.localeCompare(b.organ))
  }
  return [...out.values()].sort((a, b) => a.location.localeCompare(b.location) || a.date.localeCompare(b.date))
}
