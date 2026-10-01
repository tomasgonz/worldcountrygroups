import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'vdem-data.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'vdem-data.json')

interface VDemScores {
  year: number
  v2x_polyarchy: number
  v2x_libdem: number
  v2x_partipdem: number
  v2x_delibdem: number
  v2x_egaldem: number
  v2x_freexp_altinf: number
  v2x_frassoc_thick: number
  v2x_suffr: number
  v2x_elecoff: number
  v2x_rule: number
  v2x_corr: number
  v2x_civlib: number
}

interface CountryVDem {
  latest: VDemScores
  trend: VDemScores[]
}

interface VDemMeta {
  updated_at: string
  source: string
  description: string
  years: string
  country_count: number
  indices: Record<string, string>
}

interface VDemData {
  _meta: VDemMeta
  countries: Record<string, CountryVDem>
}

let _data: VDemData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { _meta: { updated_at: '', source: '', description: '', years: '', country_count: 0, indices: {} }, countries: {} }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { _meta: { updated_at: '', source: '', description: '', years: '', country_count: 0, indices: {} }, countries: {} }
  }
}

// Index names for aggregation
const SCORE_KEYS: (keyof Omit<VDemScores, 'year'>)[] = [
  'v2x_polyarchy', 'v2x_libdem', 'v2x_partipdem', 'v2x_delibdem',
  'v2x_egaldem', 'v2x_freexp_altinf', 'v2x_frassoc_thick', 'v2x_suffr',
  'v2x_elecoff', 'v2x_rule', 'v2x_corr', 'v2x_civlib',
]

/**
 * Classify a country's regime type based on V-Dem polyarchy score.
 * Thresholds follow V-Dem's own classification scheme.
 */
function classifyRegime(polyarchy: number): string {
  if (polyarchy >= 0.7) return 'liberal_democracy'
  if (polyarchy >= 0.42) return 'electoral_democracy'
  if (polyarchy >= 0.25) return 'electoral_autocracy'
  return 'closed_autocracy'
}

export function classifyRegimeLabel(polyarchy: number): string {
  if (polyarchy >= 0.7) return 'Liberal Democracy'
  if (polyarchy >= 0.42) return 'Electoral Democracy'
  if (polyarchy >= 0.25) return 'Electoral Autocracy'
  return 'Closed Autocracy'
}

export function getCountryVDem(iso3: string): CountryVDem | null {
  ensureLoaded()
  return _data!.countries[iso3.toUpperCase()] ?? null
}

export function getGroupVDemOverview(iso3Codes: string[]): {
  has_data: boolean
  member_count: number
  data_count: number
  avg_scores: Record<string, number>
  distribution: {
    liberal_democracy: number
    electoral_democracy: number
    electoral_autocracy: number
    closed_autocracy: number
  }
  most_democratic: Array<{ iso3: string; polyarchy: number; libdem: number; regime: string }>
  least_democratic: Array<{ iso3: string; polyarchy: number; libdem: number; regime: string }>
  avg_trend: Array<{ year: number; v2x_polyarchy: number; v2x_libdem: number; v2x_civlib: number }>
} {
  ensureLoaded()
  const codeSet = new Set(iso3Codes.map(c => c.toUpperCase()))

  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const k of SCORE_KEYS) { sums[k] = 0; counts[k] = 0 }

  const distribution = {
    liberal_democracy: 0,
    electoral_democracy: 0,
    electoral_autocracy: 0,
    closed_autocracy: 0,
  }

  const memberScores: Array<{ iso3: string; polyarchy: number; libdem: number; regime: string }> = []

  // For trend aggregation: accumulate by year
  const yearSums: Record<number, { polyarchy: number; libdem: number; civlib: number; count: number }> = {}

  let count = 0

  for (const code of codeSet) {
    const d = _data!.countries[code]
    if (!d) continue
    count++

    const latest = d.latest
    for (const k of SCORE_KEYS) {
      const v = latest[k] as number | null
      if (v == null) continue
      sums[k] += v
      counts[k]++
    }

    const regime = classifyRegime(latest.v2x_polyarchy)
    distribution[regime as keyof typeof distribution]++

    memberScores.push({
      iso3: code,
      polyarchy: latest.v2x_polyarchy,
      libdem: latest.v2x_libdem,
      regime: classifyRegimeLabel(latest.v2x_polyarchy),
    })

    // Aggregate trend data
    for (const t of d.trend) {
      if (!yearSums[t.year]) {
        yearSums[t.year] = { polyarchy: 0, libdem: 0, civlib: 0, count: 0 }
      }
      yearSums[t.year].polyarchy += t.v2x_polyarchy || 0
      yearSums[t.year].libdem += t.v2x_libdem || 0
      yearSums[t.year].civlib += t.v2x_civlib || 0
      yearSums[t.year].count++
    }
  }

  if (count === 0) {
    return {
      has_data: false,
      member_count: codeSet.size,
      data_count: 0,
      avg_scores: {},
      distribution,
      most_democratic: [],
      least_democratic: [],
      avg_trend: [],
    }
  }

  // Compute averages
  const avg_scores: Record<string, number> = {}
  for (const k of SCORE_KEYS) {
    if (counts[k] === 0) continue // index not available in the current dataset
    avg_scores[k] = Math.round((sums[k] / counts[k]) * 1000) / 1000
  }

  // Sort for most/least democratic
  memberScores.sort((a, b) => b.polyarchy - a.polyarchy)

  // Build trend
  const avg_trend = Object.keys(yearSums)
    .map(Number)
    .sort()
    .map(year => {
      const ys = yearSums[year]
      return {
        year,
        v2x_polyarchy: Math.round((ys.polyarchy / ys.count) * 1000) / 1000,
        v2x_libdem: Math.round((ys.libdem / ys.count) * 1000) / 1000,
        v2x_civlib: Math.round((ys.civlib / ys.count) * 1000) / 1000,
      }
    })

  return {
    has_data: true,
    member_count: codeSet.size,
    data_count: count,
    avg_scores,
    distribution,
    most_democratic: memberScores.slice(0, 5),
    least_democratic: memberScores.slice(-5).reverse(),
    avg_trend,
  }
}

export function getVDemMeta(): VDemMeta {
  ensureLoaded()
  return _data!._meta
}

export function reloadVDem(): void {
  _data = null
  ensureLoaded()
}
