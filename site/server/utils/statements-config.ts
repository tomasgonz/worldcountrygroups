import { readFileSync, writeFileSync, existsSync, mkdirSync , statSync} from 'fs'
import { join } from 'path'

export interface ScrapeConfig {
  listSelector: string
  titleSelector: string
  linkSelector: string
  dateSelector?: string
  excerptSelector?: string
  baseUrl?: string
}

export interface StatementSource {
  id: string
  name: string
  url: string
  type: 'rss' | 'atom' | 'html-scrape'
  country: string
  category: 'p5-mission' | 'major-mission' | 'un-official'
  enabled: boolean
  scrapeConfig?: ScrapeConfig
  lastFetch?: string | null
  lastError?: string | null
  statementCount?: number
}

export interface StatementsConfig {
  sources: StatementSource[]
  maxStatements: number
}

const DATA_DIR = process.env.WCG_SITE_DATA
  || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const DATA_PATH = join(DATA_DIR, 'statements-config.json')

const DEFAULT_SOURCES: StatementSource[] = [
  // P5 Missions — verified working feeds
  { id: 'usa-un-mission', name: 'US Mission to the UN', url: 'https://usun.usmission.gov/feed/', type: 'rss', country: 'USA', category: 'p5-mission', enabled: true },
  { id: 'uk-un-mission', name: 'UK Mission to the UN', url: 'https://www.gov.uk/search/news-and-communications.atom?world_locations%5B%5D=uk-mission-to-the-united-nations-new-york', type: 'atom', country: 'GBR', category: 'p5-mission', enabled: true },
  { id: 'france-un-mission', name: 'France Mission to the UN', url: 'https://onu.delegfrance.org/spip.php?page=backend&id_rubrique=2', type: 'rss', country: 'FRA', category: 'p5-mission', enabled: true },
  { id: 'russia-un-mission', name: 'Russia Mission to the UN', url: 'https://russiaun.ru/en/', type: 'html-scrape', country: 'RUS', category: 'p5-mission', enabled: true, scrapeConfig: { listSelector: '.news-text__item', titleSelector: '.news-text__item__headline a', linkSelector: '.news-text__item__headline a', dateSelector: '.news-text__item__meta-date', baseUrl: 'https://russiaun.ru' } },
  { id: 'china-mfa', name: 'China MFA Spokesperson', url: 'https://www.fmprc.gov.cn/eng/xw/fyrbt/', type: 'html-scrape', country: 'CHN', category: 'p5-mission', enabled: true, scrapeConfig: { listSelector: '.list_box', titleSelector: 'a', linkSelector: 'a', baseUrl: 'https://www.fmprc.gov.cn/eng/xw/fyrbt' } },

  // Major Missions — RSS where available, html-scrape as fallback
  { id: 'germany-foreign-office', name: 'German Foreign Office', url: 'https://www.auswaertiges-amt.de/static/includes/rss_en/RSS_Pressemitteilungen_Reden.xml', type: 'rss', country: 'DEU', category: 'major-mission', enabled: true },
  { id: 'france-mfa', name: 'French MFA (English)', url: 'https://www.diplomatie.gouv.fr/spip.php?page=backend-fd&lang=en', type: 'rss', country: 'FRA', category: 'major-mission', enabled: true },
  { id: 'india-un-mission', name: 'India Mission to the UN', url: 'https://www.pminewyork.gov.in/', type: 'html-scrape', country: 'IND', category: 'major-mission', enabled: false, scrapeConfig: { listSelector: '.views-row', titleSelector: 'a', linkSelector: 'a', baseUrl: 'https://www.pminewyork.gov.in' } },
  { id: 'brazil-un-mission', name: 'Brazil Mission to the UN', url: 'https://www.un.int/brazil/rss.xml', type: 'rss', country: 'BRA', category: 'major-mission', enabled: false },
  { id: 'south-africa-un-mission', name: 'South Africa Mission', url: 'https://www.southafrica-newyork.net/pmun-statements/', type: 'html-scrape', country: 'ZAF', category: 'major-mission', enabled: false, scrapeConfig: { listSelector: 'article', titleSelector: 'a', linkSelector: 'a', baseUrl: 'https://www.southafrica-newyork.net' } },
  { id: 'kenya-un-mission', name: 'Kenya Mission to the UN', url: 'https://www.un.int/kenya/rss.xml', type: 'rss', country: 'KEN', category: 'major-mission', enabled: false },

  // UN Official — UN Geneva feeds (verified working)
  { id: 'ungeneva-press', name: 'UN Geneva Press Releases', url: 'https://www.ungeneva.org/en/news-media/press-releases-list/rss.xml', type: 'rss', country: '', category: 'un-official', enabled: true },
  { id: 'ungeneva-meetings', name: 'UN Geneva Meeting Summaries', url: 'https://www.ungeneva.org/en/news-media/meeting-summaries-list/rss.xml', type: 'rss', country: '', category: 'un-official', enabled: true },
  { id: 'un-press-releases', name: 'UN Press Releases (NY)', url: 'https://press.un.org/en/rss.xml', type: 'rss', country: '', category: 'un-official', enabled: false },
]

let cache: StatementsConfig | null = null
let cacheMtime = 0 // the fetch scripts also write this file; reload when it changes

function loadData(): StatementsConfig {
  try {
    if (existsSync(DATA_PATH)) {
      const mtime = statSync(DATA_PATH).mtimeMs
      if (cache && mtime === cacheMtime) return cache
      cache = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
      cacheMtime = mtime
      return cache!
    }
  } catch {}
  const data: StatementsConfig = { sources: [...DEFAULT_SOURCES], maxStatements: 1000 }
  saveData(data)
  return data
}

function saveData(data: StatementsConfig) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
  cache = data
  try { cacheMtime = statSync(DATA_PATH).mtimeMs } catch {}
}

export function getStatementsConfig(): StatementsConfig {
  return loadData()
}

export function getStatementSources(): StatementSource[] {
  return loadData().sources
}

export function addStatementSource(source: StatementSource) {
  const config = loadData()
  if (config.sources.find(s => s.id === source.id)) {
    throw new Error(`Source '${source.id}' already exists`)
  }
  config.sources.push(source)
  saveData(config)
}

export function updateStatementSource(id: string, partial: Partial<StatementSource>) {
  const config = loadData()
  const idx = config.sources.findIndex(s => s.id === id)
  if (idx === -1) throw new Error(`Source '${id}' not found`)
  config.sources[idx] = { ...config.sources[idx], ...partial, id }
  saveData(config)
}

export function removeStatementSource(id: string) {
  const config = loadData()
  config.sources = config.sources.filter(s => s.id !== id)
  saveData(config)
}

export function setStatementSourceEnabled(id: string, enabled: boolean) {
  const config = loadData()
  const source = config.sources.find(s => s.id === id)
  if (!source) throw new Error(`Source '${id}' not found`)
  source.enabled = enabled
  saveData(config)
}
