import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'visa-restrictions.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'visa-restrictions.json')

interface CountryVisa {
  visa_free: number
  visa_on_arrival: number
  e_visa: number
  visa_required: number
  no_admission: number
  mobility_score: number
  mobility_rank: number
  open_to: {
    visa_free: number
    visa_on_arrival: number
    e_visa: number
    visa_required: number
  }
}

interface VisaMeta {
  updated_at: string
  source: string
  country_count: number
}

interface VisaData {
  _meta: VisaMeta
  countries: Record<string, CountryVisa>
  pairs: Record<string, string>
}

const DEFAULT_DATA: VisaData = {
  _meta: { updated_at: '', source: '', country_count: 0 },
  countries: {},
  pairs: {},
}

let _data: VisaData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = DEFAULT_DATA
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = DEFAULT_DATA
  }
}

export function getCountryVisa(iso3: string): CountryVisa | null {
  ensureLoaded()
  return _data!.countries[iso3.toUpperCase()] ?? null
}

export function getVisaPair(fromIso3: string, toIso3: string): string | null {
  ensureLoaded()
  const key = `${fromIso3.toUpperCase()}\u2192${toIso3.toUpperCase()}`
  return _data!.pairs[key] ?? null
}

export function getGroupVisaOverview(iso3Codes: string[]): {
  has_data: boolean
  total_countries: number
  countries_with_data: number
  avg_mobility_score: number
  avg_mobility_rank: number
  intra_group_visa_freedom_pct: number
  most_open: Array<{ iso3: string; mobility_score: number; mobility_rank: number }>
  least_open: Array<{ iso3: string; mobility_score: number; mobility_rank: number }>
  members: Array<{
    iso3: string
    visa_free: number
    visa_on_arrival: number
    e_visa: number
    visa_required: number
    mobility_score: number
    mobility_rank: number
  }>
} {
  ensureLoaded()
  const codes = iso3Codes.map(c => c.toUpperCase())
  const members: Array<{
    iso3: string
    visa_free: number
    visa_on_arrival: number
    e_visa: number
    visa_required: number
    mobility_score: number
    mobility_rank: number
  }> = []

  let totalMobility = 0
  let totalRank = 0

  for (const code of codes) {
    const cv = _data!.countries[code]
    if (!cv) continue
    members.push({
      iso3: code,
      visa_free: cv.visa_free,
      visa_on_arrival: cv.visa_on_arrival,
      e_visa: cv.e_visa,
      visa_required: cv.visa_required,
      mobility_score: cv.mobility_score,
      mobility_rank: cv.mobility_rank,
    })
    totalMobility += cv.mobility_score
    totalRank += cv.mobility_rank
  }

  // Calculate intra-group visa freedom percentage
  let intraFree = 0
  let intraPairs = 0
  const codeSet = new Set(codes)
  for (const from of codes) {
    if (!_data!.countries[from]) continue
    for (const to of codes) {
      if (from === to) continue
      if (!_data!.countries[to]) continue
      intraPairs++
      const key = `${from}\u2192${to}`
      const req = _data!.pairs[key]
      if (req && (req === 'visa free' || req.match(/^\d+ days$/))) {
        intraFree++
      }
    }
  }

  const intraFreedomPct = intraPairs > 0 ? Math.round((intraFree / intraPairs) * 1000) / 10 : 0

  // Sort by mobility for most/least open
  const sorted = [...members].sort((a, b) => b.mobility_score - a.mobility_score)
  const mostOpen = sorted.slice(0, 5).map(m => ({
    iso3: m.iso3,
    mobility_score: m.mobility_score,
    mobility_rank: m.mobility_rank,
  }))
  const leastOpen = sorted.slice(-5).reverse().map(m => ({
    iso3: m.iso3,
    mobility_score: m.mobility_score,
    mobility_rank: m.mobility_rank,
  }))

  // Sort members by mobility rank for display
  members.sort((a, b) => a.mobility_rank - b.mobility_rank)

  return {
    has_data: members.length > 0,
    total_countries: codes.length,
    countries_with_data: members.length,
    avg_mobility_score: members.length > 0 ? Math.round(totalMobility / members.length) : 0,
    avg_mobility_rank: members.length > 0 ? Math.round(totalRank / members.length) : 0,
    intra_group_visa_freedom_pct: intraFreedomPct,
    most_open: mostOpen,
    least_open: leastOpen,
    members,
  }
}

export function getVisaMeta(): VisaMeta {
  ensureLoaded()
  return _data!._meta
}

export function reloadVisa(): void {
  _data = null
  ensureLoaded()
}
