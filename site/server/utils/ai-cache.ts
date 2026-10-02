import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface CachedAnalysis {
  content: string
  generatedAt: string
  provider: string
  model: string
}

interface AIAnalysisCache {
  maxAgeHours: number
  entries: Record<string, CachedAnalysis>
}

const DATA_DIR = process.env.WCG_SITE_DATA
  || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const CACHE_PATH = join(DATA_DIR, 'ai-analysis-cache.json')

let cache: AIAnalysisCache | null = null

function loadCache(): AIAnalysisCache {
  if (cache) return cache
  try {
    if (existsSync(CACHE_PATH)) {
      cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
      return cache!
    }
  } catch {}
  const data: AIAnalysisCache = { maxAgeHours: 168, entries: {} }
  saveCache(data)
  return data
}

function saveCache(data: AIAnalysisCache) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2))
  cache = data
}

function isExpired(entry: CachedAnalysis, maxAgeHours: number): boolean {
  const age = Date.now() - new Date(entry.generatedAt).getTime()
  return age > maxAgeHours * 60 * 60 * 1000
}

export function getCachedAnalysis(key: string): CachedAnalysis | null {
  const data = loadCache()
  const entry = data.entries[key]
  if (!entry) return null
  if (isExpired(entry, data.maxAgeHours)) return null
  return entry
}

export function setCachedAnalysis(key: string, content: string, provider: string, model: string) {
  const data = loadCache()
  data.entries[key] = {
    content,
    generatedAt: new Date().toISOString(),
    provider,
    model,
  }
  saveCache(data)
}

export function clearAnalysisCache(key?: string) {
  const data = loadCache()
  if (key) {
    delete data.entries[key]
  } else {
    data.entries = {}
  }
  saveCache(data)
}

/** Remove entries older than the maximum age; returns how many were removed. */
export function clearExpiredAnalysisCache(): number {
  const data = loadCache()
  let n = 0
  for (const [k, e] of Object.entries(data.entries)) {
    if (isExpired(e, data.maxAgeHours)) { delete data.entries[k]; n++ }
  }
  if (n) saveCache(data)
  return n
}

export function getAnalysisCacheStats() {
  const data = loadCache()
  const entries = Object.entries(data.entries).map(([key, entry]) => ({
    key,
    generatedAt: entry.generatedAt,
    provider: entry.provider,
    model: entry.model,
    expired: isExpired(entry, data.maxAgeHours),
  }))
  return {
    totalEntries: entries.length,
    maxAgeHours: data.maxAgeHours,
    entries,
  }
}

export function setAnalysisCacheMaxAge(hours: number) {
  const data = loadCache()
  data.maxAgeHours = hours
  saveCache(data)
}
