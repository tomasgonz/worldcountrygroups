import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'conflict-events.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'conflict-events.json')

interface ConflictByType {
  events: number
  fatalities: number
}

interface ConflictTrend {
  year: number
  events: number
  fatalities: number
}

interface CountryConflict {
  total_events: number
  total_fatalities: number
  by_type: {
    battles: ConflictByType
    explosions_remote_violence: ConflictByType
    violence_against_civilians: ConflictByType
    protests: ConflictByType
    riots: ConflictByType
    strategic_developments: ConflictByType
  }
  trend: ConflictTrend[]
  conflict_intensity: 'high' | 'medium' | 'low' | 'none'
}

interface ConflictData {
  _meta: { last_updated: string; source: string; period: string }
  countries: Record<string, CountryConflict>
}

let _data: ConflictData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { _meta: { last_updated: '', source: '', period: '' }, countries: {} }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { _meta: { last_updated: '', source: '', period: '' }, countries: {} }
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
