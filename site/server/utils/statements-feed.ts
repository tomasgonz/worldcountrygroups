import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'statements-feed.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'statements-feed.json')

export interface Statement {
  id: string
  title: string
  url: string
  source: string
  country: string
  countries: string[]
  publishedAt: string
  speaker: string
  type: string
  excerpt: string
  topics: string[]
  // Phase 1 metadata
  language?: string
  sourceTier?: 1 | 2 | 3 | 4 | 5
  sourceType?: string
  unBodyTags?: string[]
  countryFlags?: string[]
  firstSeenAt?: string
  sourceUpdatedAt?: string
}

interface StatementsFeedMeta {
  last_updated: string
  sources: string[]
  statement_count: number
  country_coverage: number
}

interface StatementsFeedData {
  _meta: StatementsFeedMeta
  statements: Statement[]
}

let _data: StatementsFeedData | null = null
let _loadedMtimeMs = 0
const _responseCache = new Map<string, { data: any; ts: number }>()
const DEFAULT_TTL_MS = 5 * 60 * 1000

function getCachedResponse(key: string, ttlMs = DEFAULT_TTL_MS): any | null {
  const entry = _responseCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > ttlMs) {
    _responseCache.delete(key)
    return null
  }
  return entry.data
}

function setCachedResponse(key: string, data: any) {
  _responseCache.set(key, { data, ts: Date.now() })
}

function clearResponseCache() {
  _responseCache.clear()
}

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    if (_data === null) {
      _data = { _meta: { last_updated: '', sources: [], statement_count: 0, country_coverage: 0 }, statements: [] }
    }
    return
  }
  let mtimeMs = 0
  try {
    mtimeMs = statSync(filePath).mtimeMs
  } catch {}
  if (_data !== null && mtimeMs === _loadedMtimeMs) return
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
    _loadedMtimeMs = mtimeMs
    clearResponseCache()
  } catch {
    if (_data === null) {
      _data = { _meta: { last_updated: '', sources: [], statement_count: 0, country_coverage: 0 }, statements: [] }
    }
  }
}

export function getRecentStatements(limit = 20): Statement[] {
  ensureLoaded()
  const cacheKey = `stmt-recent:${limit}`
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached
  const result = _data!.statements.slice(0, limit)
  setCachedResponse(cacheKey, result)
  return result
}

export function getCountryStatements(iso3: string, limit = 10): Statement[] {
  ensureLoaded()
  const code = iso3.toUpperCase()
  const cacheKey = `stmt-country:${code}:${limit}`
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached
  const result = _data!.statements
    .filter(s => s.country === code || s.countries?.includes(code))
    .slice(0, limit)
  setCachedResponse(cacheKey, result)
  return result
}

export function getStatementsFeedMeta(): StatementsFeedMeta {
  ensureLoaded()
  return _data!._meta
}

export function getStatementsFeedStats(): { statementCount: number; sourceCount: number; countryCoverage: number; sizeKB: number; lastUpdated: string } {
  ensureLoaded()
  const meta = _data!._meta
  let sizeKB = 0
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (filePath) {
    try {
      sizeKB = Math.round(statSync(filePath).size / 1024)
    } catch {}
  }
  return {
    statementCount: meta.statement_count,
    sourceCount: meta.sources.length,
    countryCoverage: meta.country_coverage,
    sizeKB,
    lastUpdated: meta.last_updated,
  }
}

export function reloadStatementsFeed(): void {
  _data = null
  clearResponseCache()
  ensureLoaded()
}

export function getStatementsBySource(): { source: string; count: number }[] {
  ensureLoaded()
  const cacheKey = 'stmt-by-source'
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached
  const map = new Map<string, number>()
  for (const s of _data!.statements) {
    map.set(s.source, (map.get(s.source) || 0) + 1)
  }
  const result = [...map.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count)
  setCachedResponse(cacheKey, result)
  return result
}

export function getMostMentionedCountries(limit = 15): { iso3: string; count: number }[] {
  ensureLoaded()
  const cacheKey = `stmt-mentioned-countries:${limit}`
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached
  const map = new Map<string, number>()
  for (const s of _data!.statements) {
    if (s.countries) {
      for (const c of s.countries) {
        map.set(c, (map.get(c) || 0) + 1)
      }
    }
  }
  const result = [...map.entries()].map(([iso3, count]) => ({ iso3, count })).sort((a, b) => b.count - a.count).slice(0, limit)
  setCachedResponse(cacheKey, result)
  return result
}

export function getTopicDistribution(): { topic: string; count: number }[] {
  ensureLoaded()
  const cacheKey = 'stmt-topic-dist'
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached
  const map = new Map<string, number>()
  for (const s of _data!.statements) {
    if (s.topics) {
      for (const t of s.topics) {
        map.set(t, (map.get(t) || 0) + 1)
      }
    }
  }
  const result = [...map.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count)
  setCachedResponse(cacheKey, result)
  return result
}

const P5_CODES = ['CHN', 'FRA', 'RUS', 'GBR', 'USA']

export function getP5Activity(): { iso3: string; count: number; latest: { title: string; date: string; type: string } | null }[] {
  ensureLoaded()
  const cacheKey = 'stmt-p5-activity'
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached
  const result = P5_CODES.map(iso3 => {
    const stmts = _data!.statements.filter(s => s.country === iso3 || s.countries?.includes(iso3))
    const latest = stmts.length > 0 ? { title: stmts[0].title, date: stmts[0].publishedAt, type: stmts[0].type } : null
    return { iso3, count: stmts.length, latest }
  })
  setCachedResponse(cacheKey, result)
  return result
}

export function getStatementTypeBreakdown(): { type: string; count: number }[] {
  ensureLoaded()
  const cacheKey = 'stmt-type-breakdown'
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached
  const map = new Map<string, number>()
  for (const s of _data!.statements) {
    const t = s.type || 'unknown'
    map.set(t, (map.get(t) || 0) + 1)
  }
  const result = [...map.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
  setCachedResponse(cacheKey, result)
  return result
}
