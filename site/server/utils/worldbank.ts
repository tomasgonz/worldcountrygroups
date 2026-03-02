interface CacheEntry {
  data: any
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const TTL = 24 * 60 * 60 * 1000 // 24 hours

function getCached(key: string): any | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() })
}

const INDICATORS = {
  gdp: 'NY.GDP.MKTP.CD',
  population: 'SP.POP.TOTL',
  co2: 'EN.ATM.CO2E.KT',
} as const

type IndicatorKey = keyof typeof INDICATORS

// Valid ISO2 codes are exactly 2 uppercase letters
function isValidIso2(code: string): boolean {
  return /^[A-Z]{2}$/.test(code)
}

async function fetchIndicator(iso2Codes: string[], indicator: string): Promise<Map<string, number>> {
  const results = new Map<string, number>()
  // Filter invalid codes
  const validCodes = iso2Codes.filter(isValidIso2)
  if (validCodes.length === 0) return results

  // Batch in groups of 50
  for (let i = 0; i < validCodes.length; i += 50) {
    const batch = validCodes.slice(i, i + 50)
    const joined = batch.join(';')
    const url = `https://api.worldbank.org/v2/country/${joined}/indicator/${indicator}?format=json&per_page=1000&date=2020:2023&source=2`

    try {
      const resp = await fetch(url)
      if (!resp.ok) continue
      const data = await resp.json()
      if (!Array.isArray(data) || data.length < 2) continue

      // Get most recent value for each country
      const entries = data[1] as any[]
      if (!entries) continue

      for (const entry of entries) {
        if (entry.value !== null && entry.countryiso3code) {
          const iso2 = entry.country?.id
          if (iso2 && !results.has(iso2)) {
            results.set(iso2, entry.value)
          }
        }
      }
    } catch {
      // Skip failed batches
    }
  }

  return results
}

export interface StatsResult {
  gdp: { total: number; count: number; coverage: string } | null
  population: { total: number; count: number; coverage: string } | null
  co2: { total: number; count: number; coverage: string } | null
}

export async function fetchGroupStats(iso2Codes: string[]): Promise<StatsResult> {
  const validCodes = iso2Codes.filter(isValidIso2)
  const totalCountries = validCodes.length
  const cacheKey = `group:${validCodes.sort().join(',')}`

  const cached = getCached(cacheKey)
  if (cached) return cached

  const [gdpMap, popMap, co2Map] = await Promise.all([
    fetchIndicator(validCodes, INDICATORS.gdp),
    fetchIndicator(validCodes, INDICATORS.population),
    fetchIndicator(validCodes, INDICATORS.co2),
  ])

  function aggregate(map: Map<string, number>): { total: number; count: number; coverage: string } | null {
    if (map.size === 0) return null
    let total = 0
    for (const v of map.values()) total += v
    return {
      total,
      count: map.size,
      coverage: `${map.size} of ${totalCountries} countries`,
    }
  }

  const result: StatsResult = {
    gdp: aggregate(gdpMap),
    population: aggregate(popMap),
    co2: aggregate(co2Map),
  }

  setCache(cacheKey, result)
  return result
}

export async function fetchCountryStats(iso2: string): Promise<StatsResult> {
  if (!isValidIso2(iso2.toUpperCase())) {
    return { gdp: null, population: null, co2: null }
  }

  const cacheKey = `country:${iso2.toUpperCase()}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const code = iso2.toUpperCase()
  const [gdpMap, popMap, co2Map] = await Promise.all([
    fetchIndicator([code], INDICATORS.gdp),
    fetchIndicator([code], INDICATORS.population),
    fetchIndicator([code], INDICATORS.co2),
  ])

  function single(map: Map<string, number>): { total: number; count: number; coverage: string } | null {
    if (map.size === 0) return null
    const value = [...map.values()][0]
    return { total: value, count: 1, coverage: '1 of 1 countries' }
  }

  const result: StatsResult = {
    gdp: single(gdpMap),
    population: single(popMap),
    co2: single(co2Map),
  }

  setCache(cacheKey, result)
  return result
}
