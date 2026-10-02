import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'sanctions.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'sanctions.json')

export interface SanctionsListing {
  name: string
  reference: string
  type: 'individual' | 'entity'
  listed_on: string
  nationality: string | null
  iso3: string | null
  regime?: string
}

export interface SanctionsRegime {
  id: string
  name: string
  resolution: string
  established: string
  measures: string[]
  target_countries: string[]
  // Added by scripts/fetch_sanctions.py from the UN consolidated list (optional for older files)
  list_type?: string
  status?: 'active' | 'terminated'
  terminated?: string
  note?: string
  curated?: boolean
  listed_individuals?: number
  listed_entities?: number
  listed_total?: number
  latest_listing?: string | null
  listed_last_12_months?: number
  recent_listings?: SanctionsListing[]
  individuals_by_nationality?: Record<string, number>
  entities_by_country?: Record<string, number>
}

export interface SanctionsCountryListings {
  individuals: number
  entities: number
  by_regime: Record<string, number>
}

interface SanctionsData {
  _meta: {
    last_updated: string
    regime_count: number
    source?: string
    source_url?: string
    list_generated?: string
    listed_individuals?: number
    listed_entities?: number
    latest_listing?: string | null
  }
  regimes: SanctionsRegime[]
  recent_listings?: SanctionsListing[]
  by_country?: Record<string, SanctionsCountryListings>
}

let _data: SanctionsData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

let _loadedPath: string | null = null
let _loadedMtime = 0
let _checkedAt = 0

// Reloads when the data file changes (the refresh job rewrites it), checked at most every 60 s
function ensureLoaded(): void {
  const now = Date.now()
  if (_data !== null && now - _checkedAt < 60_000) return
  _checkedAt = now
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    if (_data === null) _data = { _meta: { last_updated: '', regime_count: 0 }, regimes: [] }
    return
  }
  let mtime = 0
  try { mtime = statSync(filePath).mtimeMs } catch {}
  if (_data !== null && filePath === _loadedPath && mtime === _loadedMtime) return
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
    _loadedPath = filePath
    _loadedMtime = mtime
  } catch {
    if (_data === null) _data = { _meta: { last_updated: '', regime_count: 0 }, regimes: [] }
  }
}

export function getAllSanctions(): SanctionsData {
  ensureLoaded()
  return _data!
}

function isActive(r: SanctionsRegime): boolean {
  return r.status !== 'terminated'
}

/** Active regimes that target this country. */
export function getCountrySanctions(iso3: string): SanctionsRegime[] {
  ensureLoaded()
  const code = iso3.toUpperCase()
  return _data!.regimes.filter(r => isActive(r) && r.target_countries.includes(code))
}

/**
 * Listed individuals holding this nationality and listed entities located in this
 * country, across all regimes (not the same as the country being a target).
 */
export function getCountrySanctionsListings(iso3: string): {
  individuals: number
  entities: number
  by_regime: { id: string; name: string; count: number }[]
  recent: SanctionsListing[]
} {
  ensureLoaded()
  const code = iso3.toUpperCase()
  const entry = _data!.by_country?.[code]
  const names = new Map<string, string>(_data!.regimes.map(r => [r.id, r.name] as [string, string]))
  const recent: SanctionsListing[] = []
  for (const r of _data!.regimes) {
    for (const l of r.recent_listings || []) {
      if (l.iso3 === code) recent.push({ ...l, regime: r.id })
    }
  }
  recent.sort((a, b) => (b.listed_on || '').localeCompare(a.listed_on || ''))
  return {
    individuals: entry?.individuals ?? 0,
    entities: entry?.entities ?? 0,
    by_regime: Object.entries(entry?.by_regime || {}).map(([id, count]) => ({ id, name: names.get(id) || id, count })),
    recent: recent.slice(0, 10),
  }
}

export function getSanctionsMeta() {
  ensureLoaded()
  return _data!._meta
}

export function getGroupSanctionsOverlap(iso3Codes: string[]): {
  sanctioned: { iso3: string; regimes: { id: string; name: string; resolution: string; measures: string[] }[] }[]
  totalSanctioned: number
  totalMembers: number
} {
  ensureLoaded()
  const codes = iso3Codes.map(c => c.toUpperCase())
  const sanctioned: { iso3: string; regimes: { id: string; name: string; resolution: string; measures: string[] }[] }[] = []

  for (const code of codes) {
    const regimes = _data!.regimes
      .filter(r => isActive(r) && r.target_countries.includes(code))
      .map(r => ({ id: r.id, name: r.name, resolution: r.resolution, measures: r.measures }))
    if (regimes.length > 0) {
      sanctioned.push({ iso3: code, regimes })
    }
  }

  return {
    sanctioned,
    totalSanctioned: sanctioned.length,
    totalMembers: codes.length,
  }
}
