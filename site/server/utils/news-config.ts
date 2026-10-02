import { readFileSync, writeFileSync, existsSync, mkdirSync , statSync} from 'fs'
import { join } from 'path'

export interface NewsSource {
  id: string
  name: string
  url: string
  type: 'rss' | 'atom' | 'json-api'
  enabled: boolean
  category: 'government' | 'wire' | 'institutional' | 'regional' | 'lldc-sids'
  lastFetch?: string | null
  lastError?: string | null
  articleCount?: number
}

export interface NewsConfig {
  sources: NewsSource[]
  maxArticles: number
}

const DATA_DIR = process.env.WCG_SITE_DATA
  || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const DATA_PATH = join(DATA_DIR, 'news-config.json')

const DEFAULT_SOURCES: NewsSource[] = [
  // Existing sources
  { id: 'un-news', name: 'UN News', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', type: 'rss', enabled: true, category: 'institutional' },
  { id: 'passblue', name: 'PassBlue', url: 'https://www.passblue.com/feed/', type: 'rss', enabled: true, category: 'wire' },
  { id: 'gdelt', name: 'GDELT', url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=(diplomacy+OR+%22united+nations%22+OR+sanctions+OR+treaty)&mode=ArtList&maxrecords=50&format=json&timespan=24h', type: 'json-api', enabled: true, category: 'wire' },

  // Government / major international
  { id: 'uk-fcdo', name: 'UK FCDO', url: 'https://www.gov.uk/government/organisations/foreign-commonwealth-development-office.atom', type: 'atom', enabled: true, category: 'government' },
  { id: 'france24', name: 'France 24', url: 'https://www.france24.com/en/rss', type: 'rss', enabled: true, category: 'wire' },
  { id: 'dw-news', name: 'DW News', url: 'https://rss.dw.com/rdf/rss-en-all', type: 'rss', enabled: true, category: 'wire' },
  { id: 'google-news-diplomacy', name: 'Google News (Diplomacy)', url: 'https://news.google.com/rss/search?q=diplomacy+foreign+affairs+sanctions&hl=en-US&gl=US&ceid=US:en', type: 'rss', enabled: true, category: 'wire' },

  // Wire / diplomatic outlets
  { id: 'al-jazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', type: 'rss', enabled: true, category: 'wire' },
  { id: 'the-diplomat', name: 'The Diplomat', url: 'https://thediplomat.com/feed/', type: 'rss', enabled: true, category: 'wire' },

  // Institutional / crisis
  { id: 'crisis-group', name: 'Crisis Group', url: 'https://www.crisisgroup.org/rss', type: 'rss', enabled: true, category: 'institutional' },
  { id: 'un-sdg', name: 'UN Sustainable Development', url: 'https://www.un.org/sustainabledevelopment/feed/', type: 'rss', enabled: true, category: 'institutional' },

  // LLDC / SIDS / developing-world
  { id: 'global-voices', name: 'Global Voices', url: 'https://globalvoices.org/feed/', type: 'rss', enabled: true, category: 'lldc-sids' },
  { id: 'africanews', name: 'Africanews', url: 'https://www.africanews.com/feed/rss', type: 'rss', enabled: true, category: 'lldc-sids' },
  { id: 'islands-business', name: 'Islands Business', url: 'https://islandsbusiness.com/category/islands-business/news-break/feed/gn', type: 'rss', enabled: true, category: 'lldc-sids' },
  { id: 'adb-news', name: 'ADB News', url: 'http://feeds.feedburner.com/adb_news', type: 'rss', enabled: true, category: 'lldc-sids' },
]

let cache: NewsConfig | null = null
let cacheMtime = 0 // the fetch scripts also write this file; reload when it changes

function loadData(): NewsConfig {
  try {
    if (existsSync(DATA_PATH)) {
      const mtime = statSync(DATA_PATH).mtimeMs
      if (cache && mtime === cacheMtime) return cache
      cache = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
      cacheMtime = mtime
      return cache!
    }
  } catch {}
  const data: NewsConfig = { sources: [...DEFAULT_SOURCES], maxArticles: 500 }
  saveData(data)
  return data
}

function saveData(data: NewsConfig) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
  cache = data
  try { cacheMtime = statSync(DATA_PATH).mtimeMs } catch {}
}

export function getNewsConfig(): NewsConfig {
  return loadData()
}

export function getNewsSources(): NewsSource[] {
  return loadData().sources
}

export function addNewsSource(source: NewsSource) {
  const config = loadData()
  if (config.sources.find(s => s.id === source.id)) {
    throw new Error(`Source '${source.id}' already exists`)
  }
  config.sources.push(source)
  saveData(config)
}

export function updateNewsSource(id: string, partial: Partial<NewsSource>) {
  const config = loadData()
  const idx = config.sources.findIndex(s => s.id === id)
  if (idx === -1) throw new Error(`Source '${id}' not found`)
  config.sources[idx] = { ...config.sources[idx], ...partial, id }
  saveData(config)
}

export function removeNewsSource(id: string) {
  const config = loadData()
  config.sources = config.sources.filter(s => s.id !== id)
  saveData(config)
}

export function setNewsSourceEnabled(id: string, enabled: boolean) {
  const config = loadData()
  const source = config.sources.find(s => s.id === id)
  if (!source) throw new Error(`Source '${id}' not found`)
  source.enabled = enabled
  saveData(config)
}
