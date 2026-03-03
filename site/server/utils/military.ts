import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'military-capabilities.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'military-capabilities.json')

interface MilitaryCapability {
  rank: number
  power_index: number
  active_military: number
  reserve_military: number
  paramilitary: number
  aircraft_total: number
  fighter_aircraft: number
  helicopters: number
  tank_strength: number
  armored_vehicles: number
  rocket_projectors: number
  naval_total: number
  aircraft_carriers: number
  submarines: number
  defense_budget: number
}

interface MilitaryData {
  _meta: { last_updated: string; source: string; country_count: number }
  countries: Record<string, MilitaryCapability>
}

let _data: MilitaryData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { _meta: { last_updated: '', source: '', country_count: 0 }, countries: {} }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { _meta: { last_updated: '', source: '', country_count: 0 }, countries: {} }
  }
}

export function getMilitaryCapabilities(iso3: string): MilitaryCapability | null {
  ensureLoaded()
  return _data!.countries[iso3.toUpperCase()] ?? null
}

export function getGroupMilitaryOverview(iso3Codes: string[]): {
  has_data: boolean
  total_countries: number
  countries_with_data: number
  aggregate: {
    active_military: number
    reserve_military: number
    aircraft_total: number
    tank_strength: number
    naval_total: number
    defense_budget: number
  }
  members: Array<{
    iso3: string
    rank: number
    power_index: number
    active_military: number
    defense_budget: number
  }>
} {
  ensureLoaded()
  const members: Array<{
    iso3: string
    rank: number
    power_index: number
    active_military: number
    defense_budget: number
  }> = []

  let totalActive = 0
  let totalReserve = 0
  let totalAircraft = 0
  let totalTanks = 0
  let totalNaval = 0
  let totalBudget = 0

  for (const code of iso3Codes) {
    const cap = _data!.countries[code.toUpperCase()]
    if (!cap) continue
    members.push({
      iso3: code.toUpperCase(),
      rank: cap.rank,
      power_index: cap.power_index,
      active_military: cap.active_military,
      defense_budget: cap.defense_budget,
    })
    totalActive += cap.active_military
    totalReserve += cap.reserve_military
    totalAircraft += cap.aircraft_total
    totalTanks += cap.tank_strength
    totalNaval += cap.naval_total
    totalBudget += cap.defense_budget
  }

  members.sort((a, b) => a.power_index - b.power_index)

  return {
    has_data: members.length > 0,
    total_countries: iso3Codes.length,
    countries_with_data: members.length,
    aggregate: {
      active_military: totalActive,
      reserve_military: totalReserve,
      aircraft_total: totalAircraft,
      tank_strength: totalTanks,
      naval_total: totalNaval,
      defense_budget: totalBudget,
    },
    members: members.slice(0, 10),
  }
}

export function getMilitaryRankings(): Array<{ iso3: string } & MilitaryCapability> {
  ensureLoaded()
  return Object.entries(_data!.countries)
    .map(([iso3, cap]) => ({ iso3, ...cap }))
    .sort((a, b) => a.rank - b.rank)
}

export function getMilitaryMeta() {
  ensureLoaded()
  return _data!._meta
}
