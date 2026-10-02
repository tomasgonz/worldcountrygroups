import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'conflict-events.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'conflict-events.json')

export interface ConflictByType {
  events: number
  fatalities: number
}

export interface ConflictTrend {
  year: number
  events: number
  fatalities: number
  /** Year not yet complete in the data (through = last event date) */
  partial?: boolean
  through?: string
  /** Year covered only by UCDP candidate (provisional) events */
  provisional?: boolean
}

export interface ConflictMonth {
  month: string // YYYY-MM
  events: number
  fatalities: number
}

export interface ConflictActor {
  id: string
  name: string
  type: ConflictViolenceType | string
  events: number
  fatalities: number
  latest_event: string
}

/** UCDP type_of_violence: 1 state-based, 2 non-state, 3 one-sided */
export type ConflictViolenceType = 'state_based' | 'non_state' | 'one_sided'

export interface CountryConflict {
  total_events: number
  total_fatalities: number
  /** UCDP types (state_based / non_state / one_sided); older files used ACLED categories */
  by_type: Partial<Record<ConflictViolenceType, ConflictByType>> & Record<string, ConflictByType>
  trend: ConflictTrend[]
  conflict_intensity: 'high' | 'medium' | 'low' | 'none'
  // Added with the UCDP-based data (optional so older files still type-check)
  fatalities_low?: number
  fatalities_high?: number
  civilian_deaths?: number
  monthly?: ConflictMonth[]
  last_12_months?: { events: number; fatalities: number }
  top_conflicts?: ConflictActor[]
  top_dyads?: ConflictActor[]
  latest_event_date?: string
  provisional_events?: number
}

export interface ConflictMeta {
  last_updated: string
  source: string
  period: string
  source_url?: string
  period_start?: string
  period_end?: string
  ged_version?: string
  ged_through?: string
  candidate_files?: string[]
  candidate_from?: string | null
  types?: Record<string, string>
  intensity_rule?: string
  notes?: string
  citation?: string
}

export interface ConflictGlobal {
  total_events: number
  total_fatalities: number
  civilian_deaths?: number
  by_type: Record<string, ConflictByType>
  trend: ConflictTrend[]
  monthly: ConflictMonth[]
  last_12_months?: { events: number; fatalities: number }
  latest_event_date?: string
}

export interface ConflictData {
  _meta: ConflictMeta
  global?: ConflictGlobal
  countries: Record<string, CountryConflict>
}

export const CONFLICT_TYPE_LABELS: Record<string, string> = {
  state_based: 'State-based conflict',
  non_state: 'Non-state conflict',
  one_sided: 'One-sided violence',
}

let _data: ConflictData | null = null

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
    if (_data === null) _data = { _meta: { last_updated: '', source: '', period: '' }, countries: {} }
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
    if (_data === null) _data = { _meta: { last_updated: '', source: '', period: '' }, countries: {} }
  }
}

export function getCountryConflict(iso3: string): CountryConflict | null {
  ensureLoaded()
  return _data!.countries[iso3.toUpperCase()] ?? null
}

export function getGroupConflictOverview(iso3Codes: string[]): {
  has_data: boolean
  total_events: number
  total_fatalities: number
  affected_members: Array<{
    iso3: string
    total_events: number
    total_fatalities: number
    conflict_intensity: string
  }>
} {
  ensureLoaded()
  let totalEvents = 0
  let totalFatalities = 0
  const affected: Array<{
    iso3: string
    total_events: number
    total_fatalities: number
    conflict_intensity: string
  }> = []

  for (const code of iso3Codes) {
    const conflict = _data!.countries[code.toUpperCase()]
    if (!conflict) continue
    totalEvents += conflict.total_events
    totalFatalities += conflict.total_fatalities
    affected.push({
      iso3: code.toUpperCase(),
      total_events: conflict.total_events,
      total_fatalities: conflict.total_fatalities,
      conflict_intensity: conflict.conflict_intensity,
    })
  }

  affected.sort((a, b) => b.total_fatalities - a.total_fatalities)

  return {
    has_data: affected.length > 0,
    total_events: totalEvents,
    total_fatalities: totalFatalities,
    affected_members: affected,
  }
}

export function getConflictHotspots(): Array<{ iso3: string } & CountryConflict> {
  ensureLoaded()
  return Object.entries(_data!.countries)
    .map(([iso3, data]) => ({ iso3, ...data }))
    .sort((a, b) => b.total_fatalities - a.total_fatalities)
    .slice(0, 20)
}

export function getConflictMeta() {
  ensureLoaded()
  return _data!._meta
}

/** Worldwide totals, yearly trend and monthly series (null for older data files). */
export function getConflictGlobal(): ConflictGlobal | null {
  ensureLoaded()
  return _data!.global ?? null
}

/** Full dataset (meta, global, countries) for the conflicts API. */
export function getAllConflicts(): ConflictData {
  ensureLoaded()
  return _data!
}
