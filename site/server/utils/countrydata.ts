import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'country-stats.json')

// Fallback paths for different environments
const DATA_PATHS = [
  DATA_FILE,
  join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data', 'country-stats.json'),
]

export interface CountryData {
  name: string
  iso2: string
  iso3: string
  capital: string | null
  region: string | null
  subregion: string | null
  area_km2: number | null
  income_group: string | null
  gdp: number | null
  gdp_per_capita: number | null
  population: number | null
  co2: number | null
  life_expectancy: number | null
  hdi: number | null
  military_expenditure: number | null
  military_pct_gdp: number | null
  armed_forces_pct: number | null
  data_year: {
    gdp?: number | null
    population?: number | null
    co2?: number | null
    life_expectancy?: number | null
    hdi?: number | null
    military_expenditure?: number | null
  }
}

export interface DataMeta {
  updated_at: string | null
  sources: {
    worldbank?: string | null
    restcountries?: string | null
    undp?: string | null
  }
  country_count: number
}

export interface StatsResult {
  gdp: { total: number; count: number; coverage: string } | null
  population: { total: number; count: number; coverage: string } | null
  co2: { total: number; count: number; coverage: string } | null
}

let _data: Map<string, CountryData> | null = null
let _meta: DataMeta | null = null

function resolveDataPath(): string | null {
  for (const p of DATA_PATHS) {
    if (existsSync(p)) return p
  }
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolveDataPath()
  if (!filePath) {
    _data = new Map()
    _meta = null
    return
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
    _meta = raw._meta || null
    _data = new Map()
    for (const [key, val] of Object.entries(raw)) {
      if (key === '_meta') continue
      _data.set(key.toUpperCase(), val as CountryData)
    }
  } catch {
    _data = new Map()
    _meta = null
  }
}

export function reloadData(): void {
  _data = null
  _meta = null
  ensureLoaded()
}

export function getDataMeta(): DataMeta | null {
  ensureLoaded()
  return _meta
}

export function getCountryData(iso: string): CountryData | null {
  ensureLoaded()
  const upper = iso.toUpperCase()
  // Try ISO2 first
  const byIso2 = _data!.get(upper)
  if (byIso2) return byIso2
  // Fallback: look up by ISO3
  for (const d of _data!.values()) {
    if (d.iso3?.toUpperCase() === upper) return d
  }
  return null
}

export function getCountriesData(iso2Codes: string[]): Map<string, CountryData> {
  ensureLoaded()
  const result = new Map<string, CountryData>()
  for (const code of iso2Codes) {
    const upper = code.toUpperCase()
    const d = _data!.get(upper)
    if (d) result.set(upper, d)
  }
  return result
}

export function getAllCountryData(): Map<string, CountryData> {
  ensureLoaded()
  return new Map(_data!)
}

export function getGroupStats(iso2Codes: string[]): StatsResult {
  const countriesMap = getCountriesData(iso2Codes)
  const totalCountries = iso2Codes.filter(c => /^[A-Z]{2}$/.test(c.toUpperCase())).length

  function aggregate(field: 'gdp' | 'population' | 'co2'): StatsResult['gdp'] {
    let total = 0
    let count = 0
    for (const d of countriesMap.values()) {
      const val = d[field]
      if (val != null) {
        total += val
        count++
      }
    }
    if (count === 0) return null
    return { total, count, coverage: `${count} of ${totalCountries} countries` }
  }

  return {
    gdp: aggregate('gdp'),
    population: aggregate('population'),
    co2: aggregate('co2'),
  }
}

export function getCountryStatsResult(iso2: string): StatsResult {
  const d = getCountryData(iso2)
  if (!d) return { gdp: null, population: null, co2: null }
  return {
    gdp: d.gdp != null ? { total: d.gdp, count: 1, coverage: '1 of 1 countries' } : null,
    population: d.population != null ? { total: d.population, count: 1, coverage: '1 of 1 countries' } : null,
    co2: d.co2 != null ? { total: d.co2, count: 1, coverage: '1 of 1 countries' } : null,
  }
}
