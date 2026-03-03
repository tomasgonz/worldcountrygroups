import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getRegistry } from './wcg'

const SUMMARY_FILE = join(process.cwd(), 'server', 'data', 'un-votes-summary.json')
const RESOLUTIONS_FILE = join(process.cwd(), 'server', 'data', 'un-votes-resolutions.json')
const THEMES_FILE = join(process.cwd(), 'server', 'data', 'resolution-themes.json')

const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const SUMMARY_FILE_ALT = join(ALT_DIR, 'un-votes-summary.json')
const RESOLUTIONS_FILE_ALT = join(ALT_DIR, 'un-votes-resolutions.json')
const THEMES_FILE_ALT = join(ALT_DIR, 'resolution-themes.json')

export interface SessionVoteTally {
  yes: number
  no: number
  abstain: number
  non_voting: number
  total: number
}

export interface CountryVoteSummary {
  sessions: Record<string, SessionVoteTally>
}

export interface Resolution {
  id: string
  s: number      // session
  d: string      // date
  t: string      // title
  v: Record<string, string>  // votes: { ISO3: "Y"|"N"|"A"|"X" }
}

export interface UNVotesMeta {
  updated_at: string | null
  source_file: string | null
  total_resolutions: number
  sessions: number[]
  country_count: number
}

let _summary: Map<string, CountryVoteSummary> | null = null
let _resolutions: Resolution[] | null = null
let _meta: UNVotesMeta | null = null
let _themes: { themes: string[]; map: Record<string, string[]>; theme_counts: Record<string, number> } | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_summary !== null) return

  const summaryPath = resolve(SUMMARY_FILE, SUMMARY_FILE_ALT)
  if (!summaryPath) {
    _summary = new Map()
    _resolutions = []
    _meta = null
    return
  }

  try {
    const raw = JSON.parse(readFileSync(summaryPath, 'utf-8'))
    _meta = raw._meta || null
    _summary = new Map()
    for (const [key, val] of Object.entries(raw)) {
      if (key === '_meta') continue
      _summary.set(key, val as CountryVoteSummary)
    }
  } catch {
    _summary = new Map()
    _meta = null
  }

  const resPath = resolve(RESOLUTIONS_FILE, RESOLUTIONS_FILE_ALT)
  if (resPath) {
    try {
      const raw = JSON.parse(readFileSync(resPath, 'utf-8'))
      _resolutions = raw.resolutions || []
    } catch {
      _resolutions = []
    }
  } else {
    _resolutions = []
  }

  // Load resolution themes
  const themesPath = resolve(THEMES_FILE, THEMES_FILE_ALT)
  if (themesPath) {
    try {
      const raw = JSON.parse(readFileSync(themesPath, 'utf-8'))
      _themes = { themes: raw.themes || [], map: raw.map || {}, theme_counts: raw._meta?.theme_counts || {} }
    } catch {
      _themes = { themes: [], map: {}, theme_counts: {} }
    }
  } else {
    _themes = { themes: [], map: {}, theme_counts: {} }
  }
}

export function reloadUNVotes(): void {
  _summary = null
  _resolutions = null
  _meta = null
  _themes = null
  ensureLoaded()
}

export function getAvailableThemes(): string[] {
  ensureLoaded()
  return _themes?.themes ?? []
}

export function getResolutionThemes(id: string): string[] {
  ensureLoaded()
  return _themes?.map[id] ?? []
}

export function getUNVotesMeta(): UNVotesMeta | null {
  ensureLoaded()
  return _meta
}

export function getCountryVoteSummary(iso3: string): CountryVoteSummary | null {
  ensureLoaded()
  return _summary!.get(iso3.toUpperCase()) ?? null
}

export function getAvailableSessions(): number[] {
  ensureLoaded()
  if (!_resolutions || _resolutions.length === 0) return []
  const sessions = new Set<number>()
  for (const r of _resolutions) {
    sessions.add(r.s)
  }
  return [...sessions].sort((a, b) => b - a)
}

export function getResolutionsForGroup(
  iso3Codes: string[],
  opts: { page?: number; limit?: number; session?: number; search?: string; theme?: string } = {},
): {
  resolutions: {
    id: string
    session: number
    date: string
    title: string
    themes: string[]
    groupVotes: { yes: number; no: number; abstain: number; non_voting: number }
    votes: Record<string, string>
  }[]
  total: number
  page: number
  pages: number
  sessions: number[]
  themes: string[]
} {
  ensureLoaded()
  const codes = new Set(iso3Codes.map(c => c.toUpperCase()))
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20))

  let filtered = _resolutions!

  // Filter by session if specified
  if (opts.session != null) {
    filtered = filtered.filter(r => r.s === opts.session)
  }

  // Filter by search text
  if (opts.search) {
    const q = opts.search.toLowerCase()
    filtered = filtered.filter(r => r.t.toLowerCase().includes(q))
  }

  // Filter by theme
  if (opts.theme && _themes) {
    const theme = opts.theme
    filtered = filtered.filter(r => _themes!.map[r.id]?.includes(theme))
  }

  // Sort by date descending (newest first)
  filtered = [...filtered].sort((a, b) => {
    if (b.d !== a.d) return b.d.localeCompare(a.d)
    return b.s - a.s
  })

  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit
  const slice = filtered.slice(start, start + limit)

  const resolutions = slice.map(r => {
    const groupVotes = { yes: 0, no: 0, abstain: 0, non_voting: 0 }
    const votes: Record<string, string> = {}
    for (const code of codes) {
      const vote = r.v[code] || 'X'
      votes[code] = vote
      if (vote === 'Y') groupVotes.yes++
      else if (vote === 'N') groupVotes.no++
      else if (vote === 'A') groupVotes.abstain++
      else groupVotes.non_voting++
    }
    return {
      id: r.id,
      session: r.s,
      date: r.d,
      title: r.t,
      themes: _themes?.map[r.id] ?? [],
      groupVotes,
      votes,
    }
  })

  // Collect available sessions for this set of resolutions
  const sessionSet = new Set<number>()
  for (const r of _resolutions!) {
    sessionSet.add(r.s)
  }
  const sessions = [...sessionSet].sort((a, b) => b - a)

  return { resolutions, total, page, pages, sessions, themes: _themes?.themes ?? [] }
}

export function getResolutionsForCountry(
  iso3: string,
  opts: { page?: number; limit?: number; search?: string; theme?: string } = {},
): {
  resolutions: {
    id: string
    session: number
    date: string
    title: string
    themes: string[]
    vote: string
    globalTally: { yes: number; no: number; abstain: number }
  }[]
  total: number
  page: number
  pages: number
  themes: string[]
} {
  ensureLoaded()
  const code = iso3.toUpperCase()
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20))

  // Filter to resolutions where this country has a vote entry
  let filtered = _resolutions!.filter(r => r.v[code] != null)

  // Filter by search text
  if (opts.search) {
    const q = opts.search.toLowerCase()
    filtered = filtered.filter(r => r.t.toLowerCase().includes(q))
  }

  // Filter by theme
  if (opts.theme && _themes) {
    const theme = opts.theme
    filtered = filtered.filter(r => _themes!.map[r.id]?.includes(theme))
  }

  // Sort by date descending (newest first)
  filtered = [...filtered].sort((a, b) => {
    if (b.d !== a.d) return b.d.localeCompare(a.d)
    return b.s - a.s
  })

  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit
  const slice = filtered.slice(start, start + limit)

  const resolutions = slice.map(r => {
    const globalTally = { yes: 0, no: 0, abstain: 0 }
    for (const v of Object.values(r.v)) {
      if (v === 'Y') globalTally.yes++
      else if (v === 'N') globalTally.no++
      else if (v === 'A') globalTally.abstain++
    }
    return {
      id: r.id,
      session: r.s,
      date: r.d,
      title: r.t,
      themes: _themes?.map[r.id] ?? [],
      vote: r.v[code],
      globalTally,
    }
  })

  return { resolutions, total, page, pages, themes: _themes?.themes ?? [] }
}

export function searchResolutions(
  opts: {
    page?: number
    limit?: number
    session?: number
    search?: string
    theme?: string
    countries?: string[]
    groups?: string[]
  } = {},
): {
  resolutions: {
    id: string
    session: number
    date: string
    title: string
    globalTally: { yes: number; no: number; abstain: number }
    countryVotes?: Record<string, string>
    groupTallies?: Record<string, { yes: number; no: number; abstain: number; non_voting: number; total: number }>
  }[]
  total: number
  page: number
  pages: number
  sessions: number[]
  meta: { totalResolutions: number; totalSessions: number; totalCountries: number; lastSession: number | null; lastUpdated: string | null }
} {
  ensureLoaded()
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20))

  let filtered = _resolutions!

  if (opts.session != null) {
    filtered = filtered.filter(r => r.s === opts.session)
  }

  if (opts.search) {
    const q = opts.search.toLowerCase()
    filtered = filtered.filter(r => r.t.toLowerCase().includes(q))
  }

  if (opts.theme && _themes) {
    const theme = opts.theme
    filtered = filtered.filter(r => _themes!.map[r.id]?.includes(theme))
  }

  filtered = [...filtered].sort((a, b) => {
    if (b.d !== a.d) return b.d.localeCompare(a.d)
    return b.s - a.s
  })

  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit
  const slice = filtered.slice(start, start + limit)

  // Resolve group member codes if groups requested
  let groupMembers: Record<string, Set<string>> | null = null
  if (opts.groups?.length) {
    const registry = getRegistry()
    groupMembers = {}
    for (const gid of opts.groups) {
      const countries = registry.getCountries(gid)
      if (countries) {
        groupMembers[gid] = new Set(countries.map((c: any) => c.iso3.toUpperCase()))
      }
    }
  }

  const countryCodes = opts.countries?.map(c => c.toUpperCase()) ?? []

  const resolutions = slice.map(r => {
    const globalTally = { yes: 0, no: 0, abstain: 0 }
    for (const v of Object.values(r.v)) {
      if (v === 'Y') globalTally.yes++
      else if (v === 'N') globalTally.no++
      else if (v === 'A') globalTally.abstain++
    }

    const result: any = {
      id: r.id,
      session: r.s,
      date: r.d,
      title: r.t,
      themes: _themes?.map[r.id] ?? [],
      globalTally,
    }

    if (countryCodes.length) {
      const countryVotes: Record<string, string> = {}
      for (const code of countryCodes) {
        countryVotes[code] = r.v[code] || 'X'
      }
      result.countryVotes = countryVotes
    }

    if (groupMembers) {
      const groupTallies: Record<string, { yes: number; no: number; abstain: number; non_voting: number; total: number }> = {}
      for (const [gid, members] of Object.entries(groupMembers)) {
        const tally = { yes: 0, no: 0, abstain: 0, non_voting: 0, total: members.size }
        for (const code of members) {
          const vote = r.v[code] || 'X'
          if (vote === 'Y') tally.yes++
          else if (vote === 'N') tally.no++
          else if (vote === 'A') tally.abstain++
          else tally.non_voting++
        }
        groupTallies[gid] = tally
      }
      result.groupTallies = groupTallies
    }

    return result
  })

  // Sessions list
  const sessionSet = new Set<number>()
  for (const r of _resolutions!) {
    sessionSet.add(r.s)
  }
  const sessions = [...sessionSet].sort((a, b) => b - a)

  // Collect unique country codes
  const allCountryCodes = new Set<string>()
  for (const r of _resolutions!) {
    for (const code of Object.keys(r.v)) {
      allCountryCodes.add(code)
    }
  }

  const meta = {
    totalResolutions: _resolutions!.length,
    totalSessions: sessions.length,
    totalCountries: allCountryCodes.size,
    lastSession: sessions.length > 0 ? sessions[0] : null,
    lastUpdated: _meta?.updated_at ?? null,
  }

  return { resolutions, total, page, pages, sessions, meta }
}

export function getThemeCounts(): Record<string, number> {
  ensureLoaded()
  return _themes?.theme_counts ?? {}
}

export function getGroupThemeStats(
  iso3Codes: string[],
): { theme: string; resolutions: number; cohesion: number }[] {
  ensureLoaded()
  if (!_themes || !_resolutions) return []
  const codes = new Set(iso3Codes.map(c => c.toUpperCase()))
  const results: { theme: string; resolutions: number; cohesion: number }[] = []

  for (const theme of _themes.themes) {
    // Find resolutions that have this theme
    const themeResolutions = _resolutions.filter(r => _themes!.map[r.id]?.includes(theme))
    if (themeResolutions.length === 0) continue

    let cohesionSum = 0
    let cohesionCount = 0

    for (const r of themeResolutions) {
      const groupVotes: string[] = []
      for (const code of codes) {
        const vote = r.v[code]
        if (vote && vote !== 'X') groupVotes.push(vote)
      }
      if (groupVotes.length < 2) continue

      const counts: Record<string, number> = {}
      for (const v of groupVotes) {
        counts[v] = (counts[v] || 0) + 1
      }
      const maxCount = Math.max(...Object.values(counts))
      cohesionSum += maxCount / groupVotes.length
      cohesionCount++
    }

    results.push({
      theme,
      resolutions: themeResolutions.length,
      cohesion: cohesionCount > 0 ? Math.round((cohesionSum / cohesionCount) * 1000) / 1000 : 1,
    })
  }

  return results.sort((a, b) => b.resolutions - a.resolutions)
}

export function getCountryThemeStats(
  iso3: string,
): { theme: string; resolutions: number; yes: number; no: number; abstain: number }[] {
  ensureLoaded()
  if (!_themes || !_resolutions) return []
  const code = iso3.toUpperCase()
  const results: { theme: string; resolutions: number; yes: number; no: number; abstain: number }[] = []

  for (const theme of _themes.themes) {
    const themeResolutions = _resolutions.filter(r =>
      _themes!.map[r.id]?.includes(theme) && r.v[code] != null
    )
    if (themeResolutions.length === 0) continue

    let yes = 0, no = 0, abstain = 0
    for (const r of themeResolutions) {
      const vote = r.v[code]
      if (vote === 'Y') yes++
      else if (vote === 'N') no++
      else if (vote === 'A') abstain++
    }

    results.push({ theme, resolutions: themeResolutions.length, yes, no, abstain })
  }

  return results.sort((a, b) => b.resolutions - a.resolutions)
}

// Alignment cache: iso3 -> alignment result
const _alignmentCache = new Map<string, { mostAligned: { iso3: string; agreement: number }[]; leastAligned: { iso3: string; agreement: number }[]; sessionsUsed: number }>()

export function getCountryAlignmentScores(
  iso3: string,
  opts: { sessions?: number; limit?: number } = {},
): {
  mostAligned: { iso3: string; agreement: number }[]
  leastAligned: { iso3: string; agreement: number }[]
  sessionsUsed: number
} {
  ensureLoaded()
  const code = iso3.toUpperCase()
  const sessionsCount = opts.sessions ?? 10
  const limit = opts.limit ?? 20

  const cacheKey = `${code}_${sessionsCount}`
  if (_alignmentCache.has(cacheKey)) {
    const cached = _alignmentCache.get(cacheKey)!
    return {
      mostAligned: cached.mostAligned.slice(0, limit),
      leastAligned: cached.leastAligned.slice(0, limit),
      sessionsUsed: cached.sessionsUsed,
    }
  }

  if (!_resolutions || _resolutions.length === 0) {
    return { mostAligned: [], leastAligned: [], sessionsUsed: 0 }
  }

  // Get the last N sessions
  const allSessions = new Set<number>()
  for (const r of _resolutions) {
    allSessions.add(r.s)
  }
  const sortedSessions = [...allSessions].sort((a, b) => b - a)
  const targetSessions = new Set(sortedSessions.slice(0, sessionsCount))
  const sessionsUsed = targetSessions.size

  // Filter to these sessions
  const filtered = _resolutions.filter(r => targetSessions.has(r.s))

  // Collect all country codes that voted
  const allCodes = new Set<string>()
  for (const r of filtered) {
    for (const c of Object.keys(r.v)) {
      allCodes.add(c)
    }
  }
  allCodes.delete(code)

  // Compute pairwise agreement
  const scores: { iso3: string; agreement: number }[] = []
  for (const other of allCodes) {
    let agree = 0
    let compared = 0
    for (const r of filtered) {
      const va = r.v[code]
      const vb = r.v[other]
      if (!va || !vb || va === 'X' || vb === 'X') continue
      compared++
      if (va === vb) agree++
    }
    if (compared >= 10) {
      scores.push({ iso3: other, agreement: Math.round((agree / compared) * 1000) / 1000 })
    }
  }

  scores.sort((a, b) => b.agreement - a.agreement)
  const mostAligned = scores.slice(0, 50)
  const leastAligned = [...scores].sort((a, b) => a.agreement - b.agreement).slice(0, 50)

  _alignmentCache.set(cacheKey, { mostAligned, leastAligned, sessionsUsed })

  return {
    mostAligned: mostAligned.slice(0, limit),
    leastAligned: leastAligned.slice(0, limit),
    sessionsUsed,
  }
}

export function getGroupVotingData(
  iso3Codes: string[],
  sessionFrom?: number,
  sessionTo?: number,
): {
  cohesion: Record<string, number>
  countries: { iso3: string; recent: SessionVoteTally }[]
  pairwise: { a: string; b: string; agreement: number }[]
} {
  ensureLoaded()
  const codes = new Set(iso3Codes.map(c => c.toUpperCase()))

  // Filter resolutions by session range
  let resolutions = _resolutions!
  if (sessionFrom != null || sessionTo != null) {
    resolutions = resolutions.filter(r => {
      if (sessionFrom != null && r.s < sessionFrom) return false
      if (sessionTo != null && r.s > sessionTo) return false
      return true
    })
  }

  // Per-session cohesion
  const sessionResolutions = new Map<number, Resolution[]>()
  for (const r of resolutions) {
    if (!sessionResolutions.has(r.s)) sessionResolutions.set(r.s, [])
    sessionResolutions.get(r.s)!.push(r)
  }

  const cohesion: Record<string, number> = {}
  let totalCohesionSum = 0
  let totalCohesionCount = 0

  for (const [session, sResolutions] of sessionResolutions) {
    let sessionSum = 0
    let sessionCount = 0

    for (const r of sResolutions) {
      // Count votes from group members (excluding non-voting)
      const groupVotes: string[] = []
      for (const code of codes) {
        const vote = r.v[code]
        if (vote && vote !== 'X') groupVotes.push(vote)
      }
      if (groupVotes.length < 2) continue

      // Find majority vote
      const counts: Record<string, number> = {}
      for (const v of groupVotes) {
        counts[v] = (counts[v] || 0) + 1
      }
      const maxCount = Math.max(...Object.values(counts))
      const cohesionScore = maxCount / groupVotes.length

      sessionSum += cohesionScore
      sessionCount++
    }

    if (sessionCount > 0) {
      cohesion[`session_${session}`] = Math.round((sessionSum / sessionCount) * 1000) / 1000
      totalCohesionSum += sessionSum
      totalCohesionCount += sessionCount
    }
  }

  if (totalCohesionCount > 0) {
    cohesion.overall = Math.round((totalCohesionSum / totalCohesionCount) * 1000) / 1000
  }

  // Per-country recent vote tallies (last 5 sessions)
  const allSessions = [...sessionResolutions.keys()].sort((a, b) => a - b)
  const recentSessions = new Set(allSessions.slice(-5))
  const recentResolutions = resolutions.filter(r => recentSessions.has(r.s))

  const countryTallies = new Map<string, SessionVoteTally>()
  for (const code of codes) {
    countryTallies.set(code, { yes: 0, no: 0, abstain: 0, non_voting: 0, total: 0 })
  }

  for (const r of recentResolutions) {
    for (const code of codes) {
      const tally = countryTallies.get(code)!
      const vote = r.v[code]
      if (!vote) continue
      tally.total++
      if (vote === 'Y') tally.yes++
      else if (vote === 'N') tally.no++
      else if (vote === 'A') tally.abstain++
      else tally.non_voting++
    }
  }

  const countries = [...codes].map(iso3 => ({
    iso3,
    recent: countryTallies.get(iso3)!,
  }))

  // Pairwise agreement (on recent resolutions)
  const codeArray = [...codes]
  const pairwise: { a: string; b: string; agreement: number }[] = []

  for (let i = 0; i < codeArray.length; i++) {
    for (let j = i + 1; j < codeArray.length; j++) {
      const a = codeArray[i]
      const b = codeArray[j]
      let agree = 0
      let compared = 0

      for (const r of recentResolutions) {
        const va = r.v[a]
        const vb = r.v[b]
        if (!va || !vb || va === 'X' || vb === 'X') continue
        compared++
        if (va === vb) agree++
      }

      if (compared > 0) {
        pairwise.push({
          a,
          b,
          agreement: Math.round((agree / compared) * 1000) / 1000,
        })
      }
    }
  }

  // Sort by agreement descending
  pairwise.sort((a, b) => b.agreement - a.agreement)

  return { cohesion, countries, pairwise }
}
