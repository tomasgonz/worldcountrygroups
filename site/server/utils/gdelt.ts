import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'gdelt-data.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'gdelt-data.json')

interface MonthlyTrend extends Array<number> {}

interface CountryMedia {
  avg_tone: number
  article_volume: number
  monthly_trend: MonthlyTrend
}

interface CountryEvents {
  total: number
  cooperative: number
  neutral: number
  conflictual: number
  goldstein_avg: number
  cooperation_ratio: number
  by_cameo: Record<string, number>
}

interface BilateralPartner {
  partner: string
  events: number
  cooperative: number
  conflictual: number
  avg_tone: number
  cooperation_ratio: number
}

interface CountryGDELT {
  media: CountryMedia
  events: CountryEvents
  bilateral: BilateralPartner[]
}

interface GDELTData {
  _meta: { last_updated: string; source: string; period: string; country_count: number }
  countries: Record<string, CountryGDELT>
}

let _data: GDELTData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { _meta: { last_updated: '', source: '', period: '', country_count: 0 }, countries: {} }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { _meta: { last_updated: '', source: '', period: '', country_count: 0 }, countries: {} }
  }
}

export function getCountryGDELT(iso3: string): CountryGDELT | null {
  ensureLoaded()
  return _data!.countries[iso3.toUpperCase()] ?? null
}

export function getGroupGDELTOverview(iso3Codes: string[]): {
  has_data: boolean
  avg_tone: number
  total_events: number
  cooperation_ratio: number
  most_covered: Array<{ iso3: string; article_volume: number }>
  most_conflictual: Array<{ iso3: string; cooperation_ratio: number; conflictual: number }>
  intra_group_pairs: Array<{ source: string; target: string; events: number; cooperation_ratio: number; avg_tone: number }>
} {
  ensureLoaded()
  const codeSet = new Set(iso3Codes.map(c => c.toUpperCase()))
  let totalTone = 0
  let totalVolume = 0
  let totalEvents = 0
  let totalCooperative = 0
  let totalConflictual = 0
  const coverageList: Array<{ iso3: string; article_volume: number }> = []
  const conflictualList: Array<{ iso3: string; cooperation_ratio: number; conflictual: number }> = []
  const intraPairs: Array<{ source: string; target: string; events: number; cooperation_ratio: number; avg_tone: number }> = []

  for (const code of codeSet) {
    const d = _data!.countries[code]
    if (!d) continue
    totalTone += d.media.avg_tone * d.media.article_volume
    totalVolume += d.media.article_volume
    totalEvents += d.events.total
    totalCooperative += d.events.cooperative
    totalConflictual += d.events.conflictual
    coverageList.push({ iso3: code, article_volume: d.media.article_volume })
    conflictualList.push({ iso3: code, cooperation_ratio: d.events.cooperation_ratio, conflictual: d.events.conflictual })

    // Find intra-group bilateral pairs
    for (const bp of d.bilateral) {
      if (codeSet.has(bp.partner) && code < bp.partner) {
        intraPairs.push({
          source: code,
          target: bp.partner,
          events: bp.events,
          cooperation_ratio: bp.cooperation_ratio,
          avg_tone: bp.avg_tone,
        })
      }
    }
  }

  if (coverageList.length === 0) {
    return {
      has_data: false,
      avg_tone: 0,
      total_events: 0,
      cooperation_ratio: 0,
      most_covered: [],
      most_conflictual: [],
      intra_group_pairs: [],
    }
  }

  coverageList.sort((a, b) => b.article_volume - a.article_volume)
  conflictualList.sort((a, b) => a.cooperation_ratio - b.cooperation_ratio)
  intraPairs.sort((a, b) => b.events - a.events)

  const totalAll = totalCooperative + totalConflictual
  return {
    has_data: true,
    avg_tone: totalVolume > 0 ? totalTone / totalVolume : 0,
    total_events: totalEvents,
    cooperation_ratio: totalAll > 0 ? totalCooperative / totalAll : 0,
    most_covered: coverageList.slice(0, 5),
    most_conflictual: conflictualList.slice(0, 5),
    intra_group_pairs: intraPairs.slice(0, 10),
  }
}

export function getGDELTMeta() {
  ensureLoaded()
  return _data!._meta
}

export function reloadGDELT(): void {
  _data = null
  ensureLoaded()
}
