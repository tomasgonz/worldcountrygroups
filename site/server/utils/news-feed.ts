import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'news-feed.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'news-feed.json')

export interface NewsArticle {
  id: string
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
  countries: string[]
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

interface NewsFeedMeta {
  last_updated: string
  sources: string[]
  article_count: number
  country_coverage: number
}

interface NewsFeedData {
  _meta: NewsFeedMeta
  articles: NewsArticle[]
}

let _data: NewsFeedData | null = null
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
      _data = { _meta: { last_updated: '', sources: [], article_count: 0, country_coverage: 0 }, articles: [] }
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
      _data = { _meta: { last_updated: '', sources: [], article_count: 0, country_coverage: 0 }, articles: [] }
    }
  }
}

export function getRecentNews(limit = 20): NewsArticle[] {
  ensureLoaded()
  const cacheKey = `recent:${limit}`
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached
  const result = _data!.articles.slice(0, limit)
  setCachedResponse(cacheKey, result)
  return result
}

export function getCountryNews(iso3: string, limit = 10): NewsArticle[] {
  ensureLoaded()
  const code = iso3.toUpperCase()
  const cacheKey = `country:${code}:${limit}`
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached
  const result = _data!.articles
    .filter(a => a.countries.includes(code))
    .slice(0, limit)
  setCachedResponse(cacheKey, result)
  return result
}

export function getNewsFeedMeta(): NewsFeedMeta {
  ensureLoaded()
  return _data!._meta
}

export function getNewsFeedStats(): { articleCount: number; sourceCount: number; countryCoverage: number; sizeKB: number; lastUpdated: string } {
  ensureLoaded()
  const meta = _data!._meta
  // Get file size
  let sizeKB = 0
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (filePath) {
    try {
      sizeKB = Math.round(statSync(filePath).size / 1024)
    } catch {}
  }
  return {
    articleCount: meta.article_count,
    sourceCount: meta.sources.length,
    countryCoverage: meta.country_coverage,
    sizeKB,
    lastUpdated: meta.last_updated,
  }
}

export function reloadNewsFeed(): void {
  _data = null
  clearResponseCache()
  ensureLoaded()
}
