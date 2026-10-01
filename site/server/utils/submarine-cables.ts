import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'submarine-cables.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'submarine-cables.json')

// ISO3 to ISO2 mapping for the most common countries
// Cables data uses ISO2; the rest of the app uses ISO3
const ISO3_TO_ISO2: Record<string, string> = {
  AFG: 'AF', ALB: 'AL', DZA: 'DZ', ASM: 'AS', AGO: 'AO', AIA: 'AI', ATG: 'AG', ARG: 'AR',
  ABW: 'AW', AUS: 'AU', AZE: 'AZ', BHS: 'BS', BHR: 'BH', BGD: 'BD', BRB: 'BB', BEL: 'BE',
  BLZ: 'BZ', BEN: 'BJ', BMU: 'BM', BES: 'BQ', BRA: 'BR', VGB: 'VG', BRN: 'BN', BGR: 'BG',
  CPV: 'CV', KHM: 'KH', CMR: 'CM', CAN: 'CA', CYM: 'KY', CHL: 'CL', CHN: 'CN', COL: 'CO',
  COM: 'KM', COG: 'CG', COD: 'CD', CRI: 'CR', HRV: 'HR', CUB: 'CU', CUW: 'CW', CYP: 'CY',
  DNK: 'DK', DJI: 'DJ', DMA: 'DM', DOM: 'DO', TLS: 'TL', ECU: 'EC', EGY: 'EG', SLV: 'SV',
  GNQ: 'GQ', ERI: 'ER', EST: 'EE', ETH: 'ET', FLK: 'FK', FRO: 'FO', FJI: 'FJ', FIN: 'FI',
  FRA: 'FR', GUF: 'GF', PYF: 'PF', GAB: 'GA', GMB: 'GM', GEO: 'GE', DEU: 'DE', GHA: 'GH',
  GIB: 'GI', GRC: 'GR', GRL: 'GL', GRD: 'GD', GLP: 'GP', GUM: 'GU', GTM: 'GT', GIN: 'GN',
  GNB: 'GW', GUY: 'GY', HTI: 'HT', HND: 'HN', HKG: 'HK', HUN: 'HU', ISL: 'IS', IND: 'IN',
  IDN: 'ID', IRN: 'IR', IRQ: 'IQ', IRL: 'IE', ISR: 'IL', ITA: 'IT', CIV: 'CI', JAM: 'JM',
  JPN: 'JP', JOR: 'JO', KAZ: 'KZ', KEN: 'KE', KIR: 'KI', KWT: 'KW', LAO: 'LA', LVA: 'LV',
  LBN: 'LB', LBR: 'LR', LBY: 'LY', LTU: 'LT', MAC: 'MO', MDG: 'MG', MYS: 'MY', MDV: 'MV',
  MLT: 'MT', MHL: 'MH', MTQ: 'MQ', MRT: 'MR', MUS: 'MU', MYT: 'YT', MEX: 'MX', FSM: 'FM',
  MNE: 'ME', MSR: 'MS', MAR: 'MA', MOZ: 'MZ', MMR: 'MM', NAM: 'NA', NRU: 'NR', NLD: 'NL',
  NCL: 'NC', NZL: 'NZ', NIC: 'NI', NGA: 'NG', NER: 'NE', PRK: 'KP', MNP: 'MP', NOR: 'NO',
  OMN: 'OM', PAK: 'PK', PLW: 'PW', PSE: 'PS', PAN: 'PA', PNG: 'PG', PER: 'PE', PHL: 'PH',
  POL: 'PL', PRT: 'PT', PRI: 'PR', QAT: 'QA', REU: 'RE', ROU: 'RO', RUS: 'RU', RWA: 'RW',
  SHN: 'SH', KNA: 'KN', LCA: 'LC', VCT: 'VC', WSM: 'WS', STP: 'ST', SAU: 'SA', SEN: 'SN',
  SRB: 'RS', SYC: 'SC', SLE: 'SL', SGP: 'SG', SXM: 'SX', SVN: 'SI', SLB: 'SB', SOM: 'SO',
  ZAF: 'ZA', KOR: 'KR', ESP: 'ES', LKA: 'LK', SDN: 'SD', SUR: 'SR', SWE: 'SE', CHE: 'CH',
  SYR: 'SY', TWN: 'TW', TZA: 'TZ', THA: 'TH', TGO: 'TG', TON: 'TO', TTO: 'TT', TUN: 'TN',
  TUR: 'TR', TKM: 'TM', TCA: 'TC', TUV: 'TV', VIR: 'VI', UGA: 'UG', UKR: 'UA', ARE: 'AE',
  GBR: 'GB', USA: 'US', URY: 'UY', VUT: 'VU', VEN: 'VE', VNM: 'VN', WLF: 'WF', YEM: 'YE',
  ZMB: 'ZM', ZWE: 'ZW',
}

// Build reverse mapping
const ISO2_TO_ISO3: Record<string, string> = {}
for (const [iso3, iso2] of Object.entries(ISO3_TO_ISO2)) {
  ISO2_TO_ISO3[iso2] = iso3
}

interface CableEntry {
  id: string
  name: string
  rfs_year?: number
  length_km?: number
  owners?: string[]
  landing_countries: string[]  // ISO2 codes
}

interface CountryEntry {
  cable_count: number
  landing_points: number
  connected_countries: string[]  // ISO2 codes
  connectivity_rank: number
}

interface CablesData {
  _meta: { updated_at: string; source: string; total_cables: number; total_countries: number }
  cables: CableEntry[]
  countries: Record<string, CountryEntry>
}

const DEFAULT_DATA: CablesData = {
  _meta: { updated_at: '', source: '', total_cables: 0, total_countries: 0 },
  cables: [],
  countries: {},
}

let _data: CablesData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { ...DEFAULT_DATA }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { ...DEFAULT_DATA }
  }
}

function toIso2(iso: string): string {
  const upper = iso.toUpperCase()
  if (upper.length === 2) return upper
  return ISO3_TO_ISO2[upper] || upper.slice(0, 2)
}

function toIso3(iso2: string): string {
  return ISO2_TO_ISO3[iso2.toUpperCase()] || iso2.toUpperCase()
}

export function getCountryCables(iso: string): {
  has_data: boolean
  iso2: string
  iso3: string
  cable_count: number
  landing_points: number
  connectivity_rank: number
  connected_countries: Array<{ iso2: string; iso3: string }>
  cables: Array<{ id: string; name: string; rfs_year?: number; length_km?: number; owners?: string[]; landing_countries: string[] }>
} | null {
  ensureLoaded()
  const iso2 = toIso2(iso)
  const countryData = _data!.countries[iso2]
  if (!countryData) return null

  // Find all cables that land in this country
  const countryCables = _data!.cables
    .filter(c => c.landing_countries.includes(iso2))
    .map(c => ({
      id: c.id,
      name: c.name,
      rfs_year: c.rfs_year,
      length_km: c.length_km,
      owners: c.owners,
      landing_countries: c.landing_countries,
    }))

  const connectedCountries = countryData.connected_countries.map(c => ({
    iso2: c,
    iso3: toIso3(c),
  }))

  return {
    has_data: true,
    iso2,
    iso3: toIso3(iso2),
    cable_count: countryData.cable_count,
    landing_points: countryData.landing_points,
    connectivity_rank: countryData.connectivity_rank,
    connected_countries: connectedCountries,
    cables: countryCables,
  }
}

export function getGroupCablesOverview(iso3Codes: string[]): {
  has_data: boolean
  total_cables: number
  total_landing_points: number
  avg_cables_per_country: number
  intra_group_connections: number
  external_connections: number
  hub_countries: Array<{ iso2: string; iso3: string; cable_count: number; connectivity_rank: number }>
  shared_cables: Array<{ id: string; name: string; member_countries: string[] }>
  least_connected: Array<{ iso2: string; iso3: string; cable_count: number }>
  connectivity_distribution: { high: number; medium: number; low: number; none: number }
} {
  ensureLoaded()

  const iso2Set = new Set(iso3Codes.map(c => toIso2(c)))
  const memberStats: Array<{ iso2: string; iso3: string; cable_count: number; connectivity_rank: number }> = []
  let totalCables = 0
  let totalLandingPoints = 0
  let intraGroupConns = 0
  let externalConns = 0
  const allCableIds = new Set<string>()
  const sharedCables: Array<{ id: string; name: string; member_countries: string[] }> = []

  // Connectivity distribution buckets
  let high = 0 // 10+ cables
  let medium = 0 // 3-9 cables
  let low = 0 // 1-2 cables
  let none = 0 // 0 cables

  for (const iso2 of iso2Set) {
    const countryData = _data!.countries[iso2]
    if (!countryData) {
      none++
      continue
    }

    const cableCount = countryData.cable_count
    totalCables += cableCount
    totalLandingPoints += countryData.landing_points

    if (cableCount >= 10) high++
    else if (cableCount >= 3) medium++
    else if (cableCount >= 1) low++
    else none++

    memberStats.push({
      iso2,
      iso3: toIso3(iso2),
      cable_count: cableCount,
      connectivity_rank: countryData.connectivity_rank,
    })

    // Count intra-group vs external connections
    for (const connected of countryData.connected_countries) {
      if (iso2Set.has(connected)) {
        intraGroupConns++
      } else {
        externalConns++
      }
    }

    // Track cables for this country
    for (const cable of _data!.cables) {
      if (cable.landing_countries.includes(iso2)) {
        allCableIds.add(cable.id)
      }
    }
  }

  // Intra-group connections are double-counted (A->B and B->A), halve them
  intraGroupConns = Math.floor(intraGroupConns / 2)

  // Find cables shared by multiple group members
  for (const cable of _data!.cables) {
    const memberCountriesOnCable = cable.landing_countries.filter(c => iso2Set.has(c))
    if (memberCountriesOnCable.length >= 2) {
      sharedCables.push({
        id: cable.id,
        name: cable.name,
        member_countries: memberCountriesOnCable.map(c => toIso3(c)),
      })
    }
  }

  // Sort hub countries by cable count descending
  memberStats.sort((a, b) => b.cable_count - a.cable_count)

  // Sort shared cables by number of member countries on them
  sharedCables.sort((a, b) => b.member_countries.length - a.member_countries.length)

  // Least connected members (with data)
  const withData = memberStats.filter(m => m.cable_count > 0)
  const leastConnected = [...withData].sort((a, b) => a.cable_count - b.cable_count).slice(0, 5)

  const memberCount = iso2Set.size

  return {
    has_data: memberStats.length > 0,
    total_cables: allCableIds.size,
    total_landing_points: totalLandingPoints,
    avg_cables_per_country: memberCount > 0 ? Math.round((totalCables / memberCount) * 10) / 10 : 0,
    intra_group_connections: intraGroupConns,
    external_connections: externalConns,
    hub_countries: memberStats.slice(0, 5),
    shared_cables: sharedCables.slice(0, 10),
    least_connected: leastConnected,
    connectivity_distribution: { high, medium, low, none },
  }
}

export function getCablesMeta() {
  ensureLoaded()
  return _data!._meta
}

export function reloadCables(): void {
  _data = null
  ensureLoaded()
}
