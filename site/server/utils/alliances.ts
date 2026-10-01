import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'cow-alliances.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'cow-alliances.json')

interface Alliance {
  id: string
  name: string | null
  type: 'defense' | 'neutrality' | 'nonaggression' | 'entente'
  start_year: number
  end_year: number | null
  members: string[]
}

interface CountryAllianceProfile {
  total_alliances: number
  active_alliances: number
  defense_pacts: number
  ententes: number
  non_aggression: number
  neutrality: number
  allies: string[]
  historical_allies: string[]
}

interface AllianceData {
  _meta: { updated_at: string; source: string; total_alliances: number }
  alliances: Alliance[]
  countries: Record<string, CountryAllianceProfile>
}

const EMPTY: AllianceData = {
  _meta: { updated_at: '', source: '', total_alliances: 0 },
  alliances: [],
  countries: {},
}

let _data: AllianceData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { ...EMPTY }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { ...EMPTY }
  }
}

export function getCountryAlliances(iso3: string): {
  has_data: boolean
  iso3: string
  profile: CountryAllianceProfile | null
  alliances: Array<{
    id: string
    name: string | null
    type: string
    start_year: number
    end_year: number | null
    co_members: string[]
  }>
} {
  ensureLoaded()
  const code = iso3.toUpperCase()
  const profile = _data!.countries[code] ?? null

  if (!profile) {
    return { has_data: false, iso3: code, profile: null, alliances: [] }
  }

  // Find all alliances this country belongs to
  const countryAlliances = _data!.alliances
    .filter(a => a.members.includes(code))
    .map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      start_year: a.start_year,
      end_year: a.end_year,
      co_members: a.members.filter(m => m !== code),
    }))
    .sort((a, b) => b.start_year - a.start_year)

  return { has_data: true, iso3: code, profile, alliances: countryAlliances }
}

export function getGroupAllianceOverview(iso3Codes: string[]): {
  has_data: boolean
  total_countries: number
  countries_with_data: number
  intra_group: {
    alliance_density: number
    shared_defense_pacts: Array<{
      id: string
      name: string | null
      type: string
      start_year: number
      end_year: number | null
      group_members: string[]
    }>
    total_shared_alliances: number
  }
  external_partners: Array<{
    iso3: string
    shared_alliances: number
    alliance_types: string[]
  }>
  members: Array<{
    iso3: string
    total_alliances: number
    active_alliances: number
    defense_pacts: number
  }>
} {
  ensureLoaded()
  const codes = new Set(iso3Codes.map(c => c.toUpperCase()))
  const codesArr = Array.from(codes)

  const members: Array<{
    iso3: string
    total_alliances: number
    active_alliances: number
    defense_pacts: number
  }> = []

  for (const code of codesArr) {
    const profile = _data!.countries[code]
    if (!profile) continue
    members.push({
      iso3: code,
      total_alliances: profile.total_alliances,
      active_alliances: profile.active_alliances,
      defense_pacts: profile.defense_pacts,
    })
  }

  // Find alliances shared by 2+ group members (intra-group alliances)
  const sharedAlliances = _data!.alliances
    .map(a => {
      const groupMembers = a.members.filter(m => codes.has(m))
      return { alliance: a, groupMembers }
    })
    .filter(x => x.groupMembers.length >= 2)

  const sharedDefensePacts = sharedAlliances
    .map(x => ({
      id: x.alliance.id,
      name: x.alliance.name,
      type: x.alliance.type,
      start_year: x.alliance.start_year,
      end_year: x.alliance.end_year,
      group_members: x.groupMembers.sort(),
    }))
    .sort((a, b) => b.group_members.length - a.group_members.length)

  // Alliance density: proportion of possible pairs that share at least one alliance
  const totalPossiblePairs = codesArr.length > 1 ? (codesArr.length * (codesArr.length - 1)) / 2 : 0
  const connectedPairs = new Set<string>()
  for (const x of sharedAlliances) {
    for (let i = 0; i < x.groupMembers.length; i++) {
      for (let j = i + 1; j < x.groupMembers.length; j++) {
        const pair = [x.groupMembers[i], x.groupMembers[j]].sort().join('-')
        connectedPairs.add(pair)
      }
    }
  }
  const allianceDensity = totalPossiblePairs > 0
    ? Math.round((connectedPairs.size / totalPossiblePairs) * 1000) / 10
    : 0

  // External alliance partners: countries outside the group that share alliances with group members
  const externalPartnerMap: Record<string, { count: number; types: Set<string> }> = {}
  for (const a of _data!.alliances) {
    const groupMembers = a.members.filter(m => codes.has(m))
    if (groupMembers.length === 0) continue
    const externalMembers = a.members.filter(m => !codes.has(m))
    for (const ext of externalMembers) {
      if (!externalPartnerMap[ext]) {
        externalPartnerMap[ext] = { count: 0, types: new Set() }
      }
      externalPartnerMap[ext].count++
      externalPartnerMap[ext].types.add(a.type)
    }
  }

  const externalPartners = Object.entries(externalPartnerMap)
    .map(([iso3, info]) => ({
      iso3,
      shared_alliances: info.count,
      alliance_types: Array.from(info.types).sort(),
    }))
    .sort((a, b) => b.shared_alliances - a.shared_alliances)
    .slice(0, 20)

  members.sort((a, b) => b.active_alliances - a.active_alliances)

  return {
    has_data: members.length > 0,
    total_countries: codesArr.length,
    countries_with_data: members.length,
    intra_group: {
      alliance_density: allianceDensity,
      shared_defense_pacts: sharedDefensePacts.slice(0, 20),
      total_shared_alliances: sharedAlliances.length,
    },
    external_partners: externalPartners,
    members: members.slice(0, 15),
  }
}

export function getAllianceMeta() {
  ensureLoaded()
  return _data!._meta
}

export function reloadAlliances(): void {
  _data = null
  ensureLoaded()
}
