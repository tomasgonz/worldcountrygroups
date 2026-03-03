import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { Readable } from 'stream'
import { createInterface } from 'readline'
import { getRegistry } from '~/server/utils/wcg'
import { reloadData } from '~/server/utils/countrydata'
import { reloadUNVotes } from '~/server/utils/unvotes'
import { classify, ALL_THEMES } from '~/server/utils/classify'
import type { CountryData } from '~/server/utils/countrydata'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'country-stats.json')
const DATA_FILE_ALT = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data', 'country-stats.json')

function getDataFilePath(): string {
  // Use whichever path's directory exists
  if (existsSync(dirname(DATA_FILE))) return DATA_FILE
  return DATA_FILE_ALT
}

// Concurrency guard
let _refreshing = false
let _progress = ''
let _lastRefresh: string | null = null
let _lastError: string | null = null

export function getRefreshStatus() {
  return {
    refreshing: _refreshing,
    progress: _progress,
    last_refresh: _lastRefresh,
    last_error: _lastError,
  }
}

const WB_INDICATORS: Record<string, string> = {
  gdp: 'NY.GDP.MKTP.CD',
  gdp_per_capita: 'NY.GDP.PCAP.CD',
  population: 'SP.POP.TOTL',
  co2: 'EN.GHG.CO2.MT.CE.AR5',
  life_expectancy: 'SP.DYN.LE00.IN',
  military_expenditure: 'MS.MIL.XPND.CD',
  military_pct_gdp: 'MS.MIL.XPND.GD.ZS',
  armed_forces_pct: 'MS.MIL.XPND.ZS',
}

async function fetchWBBatch(
  codes: string[],
  indicator: string,
  results: Map<string, { value: number; year: number }>,
): Promise<boolean> {
  const joined = codes.join(';')
  const url = `https://api.worldbank.org/v2/country/${joined}/indicator/${indicator}?format=json&per_page=5000&date=2018:2024`
  try {
    const resp = await fetch(url)
    if (!resp.ok) return false
    const data = await resp.json()
    if (!Array.isArray(data) || data.length < 2 || !data[1]) return false

    const byCountry = new Map<string, { value: number; year: number }[]>()
    for (const entry of data[1]) {
      if (entry.value !== null && entry.country?.id) {
        const iso2 = entry.country.id as string
        if (!byCountry.has(iso2)) byCountry.set(iso2, [])
        byCountry.get(iso2)!.push({
          value: entry.value,
          year: parseInt(entry.date, 10),
        })
      }
    }

    for (const [iso2, entries] of byCountry) {
      entries.sort((a, b) => b.year - a.year)
      if (entries.length > 0 && !results.has(iso2)) {
        results.set(iso2, entries[0])
      }
    }
    return true
  } catch {
    return false
  }
}

async function fetchWorldBankIndicator(
  iso2Codes: string[],
  indicator: string,
): Promise<Map<string, { value: number; year: number }>> {
  const results = new Map<string, { value: number; year: number }>()

  for (let i = 0; i < iso2Codes.length; i += 30) {
    const batch = iso2Codes.slice(i, i + 30)
    const ok = await fetchWBBatch(batch, indicator, results)
    if (!ok) {
      // Batch failed (likely invalid country code) — retry individually
      for (const code of batch) {
        await fetchWBBatch([code], indicator, results)
      }
    }
  }

  return results
}

async function fetchWorldBankIncomeGroups(
  iso2Codes: string[],
): Promise<Map<string, string>> {
  const results = new Map<string, string>()

  for (let i = 0; i < iso2Codes.length; i += 30) {
    const batch = iso2Codes.slice(i, i + 30)
    const joined = batch.join(';')
    const url = `https://api.worldbank.org/v2/country/${joined}?format=json&per_page=100`

    try {
      const resp = await fetch(url)
      if (!resp.ok) continue
      const data = await resp.json()
      if (!Array.isArray(data) || data.length < 2 || !data[1]) continue

      for (const entry of data[1]) {
        if (entry.id && entry.incomeLevel?.value) {
          results.set(entry.id, entry.incomeLevel.value)
        }
      }
    } catch {
      // Skip
    }
  }

  return results
}

interface RestCountryInfo {
  capital: string | null
  region: string | null
  subregion: string | null
  area: number | null
  name: string
  iso3: string
}

async function fetchRestCountries(): Promise<Map<string, RestCountryInfo>> {
  const results = new Map<string, RestCountryInfo>()

  try {
    const resp = await fetch('https://restcountries.com/v3.1/all?fields=cca2,cca3,name,capital,region,subregion,area')
    if (!resp.ok) return results
    const data = await resp.json()

    for (const entry of data) {
      const iso2 = entry.cca2
      if (!iso2) continue
      results.set(iso2.toUpperCase(), {
        capital: Array.isArray(entry.capital) && entry.capital.length > 0 ? entry.capital[0] : null,
        region: entry.region || null,
        subregion: entry.subregion || null,
        area: entry.area || null,
        name: entry.name?.common || entry.name?.official || '',
        iso3: entry.cca3 || '',
      })
    }
  } catch {
    // REST Countries failed
  }

  return results
}

// Bundled HDI values — updated when new UNDP HDR is published
// Source: UNDP Human Development Report 2023-24
const HDI_VALUES: Record<string, number> = {
  CHE: 0.967, NOR: 0.966, ISL: 0.959, HKG: 0.956, DNK: 0.952,
  SWE: 0.952, IRL: 0.950, DEU: 0.950, SGP: 0.949, NLD: 0.946,
  AUS: 0.946, LIE: 0.945, BEL: 0.942, FIN: 0.942, GBR: 0.940,
  JPN: 0.920, KOR: 0.929, SVN: 0.926, LUX: 0.927, AUT: 0.926,
  ISR: 0.915, NZL: 0.939, CAN: 0.935, USA: 0.927, MLT: 0.918,
  CZE: 0.905, EST: 0.899, ARE: 0.937, CYP: 0.907, POL: 0.881,
  LTU: 0.879, GRC: 0.893, AND: 0.884, SAU: 0.875, HRV: 0.878,
  LVA: 0.879, CHL: 0.860, QAT: 0.875, PRT: 0.874, HUN: 0.849,
  BHR: 0.888, MNE: 0.844, SVK: 0.855, TTO: 0.814, ARG: 0.849,
  TUR: 0.855, URY: 0.830, BRN: 0.907, ROU: 0.827, PAN: 0.820,
  KWT: 0.847, KAZ: 0.802, RUS: 0.822, BLR: 0.808, OMN: 0.821,
  CRI: 0.806, MYS: 0.807, SRB: 0.805, GEO: 0.814, THA: 0.803,
  ALB: 0.789, CHN: 0.788, BGR: 0.795, ARM: 0.786, BRA: 0.760,
  MEX: 0.781, UKR: 0.734, ECU: 0.765, PER: 0.762, COL: 0.758,
  TUN: 0.732, MNG: 0.741, DZA: 0.745, EGY: 0.728, IDN: 0.713,
  VNM: 0.726, IRQ: 0.686, PHL: 0.710, ZAF: 0.717, BOL: 0.698,
  MAR: 0.698, KGZ: 0.701, GUY: 0.742, IND: 0.644, GHA: 0.602,
  BGD: 0.670, KHM: 0.600, KEN: 0.601, PAK: 0.540, NGA: 0.548,
  MMR: 0.585, CMR: 0.576, ETH: 0.492, COD: 0.479, MOZ: 0.461,
  MDG: 0.487, TZA: 0.532, UGA: 0.550, SEN: 0.517, BEN: 0.504,
  NER: 0.394, TCD: 0.394, MLI: 0.410, BFA: 0.449, CAF: 0.387,
  SSD: 0.381, SOM: 0.380, AFG: 0.462, HTI: 0.535, YEM: 0.424,
  LBY: 0.718, LBN: 0.723, JOR: 0.736, PRY: 0.717, SLV: 0.675,
  GTM: 0.629, HND: 0.621, NIC: 0.667, JAM: 0.706, DOM: 0.766,
  LKA: 0.782, NPL: 0.601, MWI: 0.508, ZMB: 0.565, ZWE: 0.550,
  RWA: 0.548, SLE: 0.477, LBR: 0.487, TGO: 0.539, GMB: 0.500,
  GNB: 0.483, GIN: 0.465, BDI: 0.426, MRT: 0.540, DJI: 0.509,
  ERI: 0.492, COM: 0.596, AGO: 0.586, NAM: 0.610, BWA: 0.693,
  GAB: 0.706, COG: 0.571, GNQ: 0.596, SWZ: 0.597, LSO: 0.514,
  CPV: 0.662, FJI: 0.729, TON: 0.745, WSM: 0.707, VUT: 0.604,
  SLB: 0.562, PNG: 0.558, TLS: 0.611, MUS: 0.796, SYC: 0.785,
  MDV: 0.762, BHS: 0.812, BRB: 0.809, ATG: 0.814, KNA: 0.855,
  GRD: 0.795, VCT: 0.733, LCA: 0.725, DMA: 0.720, SUR: 0.695,
  BLZ: 0.700, CUB: 0.764, TKM: 0.745, UZB: 0.727, TJK: 0.679,
  AZE: 0.760, MDA: 0.767, BIH: 0.779, MKD: 0.770, XKX: 0.750,
  PSE: 0.716, SYR: 0.577, IRN: 0.780, LAO: 0.620,
}

function getHdiForIso3(iso3: string): number | null {
  return HDI_VALUES[iso3.toUpperCase()] ?? null
}

export async function refreshAllData(): Promise<{
  ok: boolean
  updated_at: string
  countries_updated: number
  errors: string[]
}> {
  if (_refreshing) {
    return { ok: false, updated_at: '', countries_updated: 0, errors: ['Refresh already in progress'] }
  }

  _refreshing = true
  _progress = 'Starting refresh...'
  const errors: string[] = []

  try {
    const registry = getRegistry()
    const allIso2 = registry.getAllIso2Codes()

    // Build iso2 -> country name/iso3 lookup from registry
    const iso2Info = new Map<string, { name: string; iso3: string }>()
    for (const code of allIso2) {
      const membership = registry.getCountryMembership(code)
      if (membership) {
        iso2Info.set(code, { name: membership.name, iso3: membership.iso3 })
      }
    }

    // Fetch from all sources in parallel
    _progress = 'Fetching from World Bank API...'
    const [gdpData, gdpPcData, popData, co2Data, leData, milExpData, milPctData, armedPctData, incomeData, restData] = await Promise.all([
      fetchWorldBankIndicator(allIso2, WB_INDICATORS.gdp).catch(e => { errors.push(`GDP: ${e}`); return new Map() }),
      fetchWorldBankIndicator(allIso2, WB_INDICATORS.gdp_per_capita).catch(e => { errors.push(`GDP/cap: ${e}`); return new Map() }),
      fetchWorldBankIndicator(allIso2, WB_INDICATORS.population).catch(e => { errors.push(`Pop: ${e}`); return new Map() }),
      fetchWorldBankIndicator(allIso2, WB_INDICATORS.co2).catch(e => { errors.push(`CO2: ${e}`); return new Map() }),
      fetchWorldBankIndicator(allIso2, WB_INDICATORS.life_expectancy).catch(e => { errors.push(`LE: ${e}`); return new Map() }),
      fetchWorldBankIndicator(allIso2, WB_INDICATORS.military_expenditure).catch(e => { errors.push(`MilExp: ${e}`); return new Map() }),
      fetchWorldBankIndicator(allIso2, WB_INDICATORS.military_pct_gdp).catch(e => { errors.push(`MilPct: ${e}`); return new Map() }),
      fetchWorldBankIndicator(allIso2, WB_INDICATORS.armed_forces_pct).catch(e => { errors.push(`Armed: ${e}`); return new Map() }),
      fetchWorldBankIncomeGroups(allIso2).catch(e => { errors.push(`Income: ${e}`); return new Map() }),
      fetchRestCountries().catch(e => { errors.push(`RestCountries: ${e}`); return new Map() }),
    ]) as [
      Map<string, { value: number; year: number }>,
      Map<string, { value: number; year: number }>,
      Map<string, { value: number; year: number }>,
      Map<string, { value: number; year: number }>,
      Map<string, { value: number; year: number }>,
      Map<string, { value: number; year: number }>,
      Map<string, { value: number; year: number }>,
      Map<string, { value: number; year: number }>,
      Map<string, string>,
      Map<string, RestCountryInfo>,
    ]

    _progress = 'Merging data...'

    const now = new Date().toISOString()
    const result: Record<string, any> = {
      _meta: {
        updated_at: now,
        sources: {
          worldbank: now,
          restcountries: restData.size > 0 ? now : null,
          undp: now, // bundled HDI values
        },
        country_count: 0,
      },
    }

    let count = 0
    for (const iso2 of allIso2) {
      const info = iso2Info.get(iso2)
      if (!info) continue

      const rest = restData.get(iso2)
      const gdp = gdpData.get(iso2)
      const gdpPc = gdpPcData.get(iso2)
      const pop = popData.get(iso2)
      const co2 = co2Data.get(iso2)
      const le = leData.get(iso2)
      const milExp = milExpData.get(iso2)
      const milPct = milPctData.get(iso2)
      const armedPct = armedPctData.get(iso2)
      const hdi = getHdiForIso3(info.iso3)

      const entry: CountryData = {
        name: rest?.name || info.name,
        iso2,
        iso3: rest?.iso3 || info.iso3,
        capital: rest?.capital ?? null,
        region: rest?.region ?? null,
        subregion: rest?.subregion ?? null,
        area_km2: rest?.area ?? null,
        income_group: incomeData.get(iso2) ?? null,
        gdp: gdp?.value ?? null,
        gdp_per_capita: gdpPc?.value ?? null,
        population: pop?.value ?? null,
        co2: co2?.value ?? null,
        life_expectancy: le?.value ?? null,
        hdi,
        military_expenditure: milExp?.value ?? null,
        military_pct_gdp: milPct?.value ?? null,
        armed_forces_pct: armedPct?.value ?? null,
        data_year: {
          gdp: gdp?.year ?? null,
          population: pop?.year ?? null,
          co2: co2?.year ?? null,
          life_expectancy: le?.year ?? null,
          hdi: hdi != null ? 2022 : null,
          military_expenditure: milExp?.year ?? null,
        },
      }

      result[iso2] = entry
      count++
    }

    result._meta.country_count = count

    // Atomic write: write to temp file, then rename
    _progress = 'Writing data file...'
    const filePath = getDataFilePath()
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const tmpFile = filePath + '.tmp'
    writeFileSync(tmpFile, JSON.stringify(result, null, 2), 'utf-8')
    renameSync(tmpFile, filePath)

    // Reload in-memory data
    reloadData()

    _lastRefresh = now
    _lastError = errors.length > 0 ? errors.join('; ') : null
    _progress = 'Done'

    return { ok: true, updated_at: now, countries_updated: count, errors }
  } catch (e: any) {
    const msg = e?.message || String(e)
    _lastError = msg
    errors.push(msg)
    return { ok: false, updated_at: '', countries_updated: 0, errors }
  } finally {
    _refreshing = false
  }
}

// --- UN General Assembly Voting Data ---

const UN_CSV_URL = 'https://digitallibrary.un.org/record/4060887/files/2026_02_06_ga_voting.csv'

const UN_SUMMARY_FILE = join(process.cwd(), 'server', 'data', 'un-votes-summary.json')
const UN_RESOLUTIONS_FILE = join(process.cwd(), 'server', 'data', 'un-votes-resolutions.json')
const UN_SUMMARY_FILE_ALT = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data', 'un-votes-summary.json')
const UN_RESOLUTIONS_FILE_ALT = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data', 'un-votes-resolutions.json')

function getUNFilePath(primary: string, alt: string): string {
  if (existsSync(dirname(primary))) return primary
  return alt
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

let _unRefreshing = false
let _unProgress = ''
let _unLastRefresh: string | null = null
let _unLastError: string | null = null

export function getUNRefreshStatus() {
  return {
    refreshing: _unRefreshing,
    progress: _unProgress,
    last_refresh: _unLastRefresh,
    last_error: _unLastError,
  }
}

export async function refreshUNVotingData(): Promise<{
  ok: boolean
  updated_at: string
  resolutions_processed: number
  countries_found: number
  errors: string[]
}> {
  if (_unRefreshing) {
    return { ok: false, updated_at: '', resolutions_processed: 0, countries_found: 0, errors: ['UN voting refresh already in progress'] }
  }

  _unRefreshing = true
  _unProgress = 'Downloading UN voting CSV...'
  const errors: string[] = []

  try {
    const resp = await fetch(UN_CSV_URL)
    if (!resp.ok || !resp.body) {
      throw new Error(`Failed to download UN CSV: ${resp.status} ${resp.statusText}`)
    }

    _unProgress = 'Processing CSV stream...'

    // Stream-parse the CSV line by line
    const countrySummary: Record<string, { sessions: Record<string, { yes: number; no: number; abstain: number; non_voting: number; total: number }> }> = {}
    const resolutionMap = new Map<string, { id: string; s: number; d: string; t: string; v: Record<string, string> }>()

    const nodeStream = Readable.fromWeb(resp.body as any)
    const rl = createInterface({ input: nodeStream, crlfDelay: Infinity })

    let headers: string[] = []
    let lineCount = 0
    let headerMap: Record<string, number> = {}

    for await (const line of rl) {
      if (lineCount === 0) {
        headers = parseCSVLine(line)
        for (let i = 0; i < headers.length; i++) {
          headerMap[headers[i]] = i
        }
        lineCount++
        continue
      }

      const fields = parseCSVLine(line)
      const undlId = fields[headerMap['undl_id']] || ''
      const msCode = fields[headerMap['ms_code']] || ''
      const msVote = fields[headerMap['ms_vote']] || ''
      const date = fields[headerMap['date']] || ''
      const session = fields[headerMap['session']] || ''
      const title = fields[headerMap['title']] || ''

      if (!msCode || !session || !undlId) {
        lineCount++
        continue
      }

      // Update country summary
      if (!countrySummary[msCode]) {
        countrySummary[msCode] = { sessions: {} }
      }
      if (!countrySummary[msCode].sessions[session]) {
        countrySummary[msCode].sessions[session] = { yes: 0, no: 0, abstain: 0, non_voting: 0, total: 0 }
      }
      const tally = countrySummary[msCode].sessions[session]
      tally.total++
      if (msVote === 'Y') tally.yes++
      else if (msVote === 'N') tally.no++
      else if (msVote === 'A') tally.abstain++
      else tally.non_voting++

      // Build resolution-level data
      if (!resolutionMap.has(undlId)) {
        resolutionMap.set(undlId, {
          id: undlId,
          s: parseInt(session, 10) || 0,
          d: date,
          t: title.length > 120 ? title.substring(0, 120) + '...' : title,
          v: {},
        })
      }
      resolutionMap.get(undlId)!.v[msCode] = msVote

      lineCount++
      if (lineCount % 100000 === 0) {
        _unProgress = `Processing CSV... ${(lineCount / 1000).toFixed(0)}K rows`
      }
    }

    _unProgress = 'Writing summary file...'
    const now = new Date().toISOString()
    const sessions = new Set<number>()
    for (const r of resolutionMap.values()) sessions.add(r.s)

    // Write summary file
    const summaryResult: Record<string, any> = {
      _meta: {
        updated_at: now,
        source_file: '2026_02_06_ga_voting.csv',
        total_resolutions: resolutionMap.size,
        sessions: [...sessions].sort((a, b) => a - b),
        country_count: Object.keys(countrySummary).length,
      },
      ...countrySummary,
    }

    const summaryPath = getUNFilePath(UN_SUMMARY_FILE, UN_SUMMARY_FILE_ALT)
    const summaryDir = dirname(summaryPath)
    if (!existsSync(summaryDir)) mkdirSync(summaryDir, { recursive: true })
    const tmpSummary = summaryPath + '.tmp'
    writeFileSync(tmpSummary, JSON.stringify(summaryResult), 'utf-8')
    renameSync(tmpSummary, summaryPath)

    // Write resolutions file
    _unProgress = 'Writing resolutions file...'
    const resolutions = [...resolutionMap.values()].sort((a, b) => a.s - b.s || a.d.localeCompare(b.d))
    const resResult = {
      _meta: { updated_at: now, sessions: [...sessions].sort((a, b) => a - b), resolution_count: resolutions.length },
      resolutions,
    }

    const resPath = getUNFilePath(UN_RESOLUTIONS_FILE, UN_RESOLUTIONS_FILE_ALT)
    const tmpRes = resPath + '.tmp'
    writeFileSync(tmpRes, JSON.stringify(resResult), 'utf-8')
    renameSync(tmpRes, resPath)

    // Reload cache
    reloadUNVotes()

    _unLastRefresh = now
    _unLastError = errors.length > 0 ? errors.join('; ') : null
    _unProgress = 'Done'

    return {
      ok: true,
      updated_at: now,
      resolutions_processed: resolutionMap.size,
      countries_found: Object.keys(countrySummary).length,
      errors,
    }
  } catch (e: any) {
    const msg = e?.message || String(e)
    _unLastError = msg
    errors.push(msg)
    return { ok: false, updated_at: '', resolutions_processed: 0, countries_found: 0, errors }
  } finally {
    _unRefreshing = false
  }
}

// --- Theme Classification Refresh ---

const THEMES_FILE = join(process.cwd(), 'server', 'data', 'resolution-themes.json')
const THEMES_FILE_ALT = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data', 'resolution-themes.json')
const RESOLUTIONS_INPUT = join(process.cwd(), 'server', 'data', 'un-votes-resolutions.json')
const RESOLUTIONS_INPUT_ALT = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data', 'un-votes-resolutions.json')

let _themeRefreshing = false
let _themeProgress = ''
let _themeLastRefresh: string | null = null
let _themeLastError: string | null = null

export function getThemeRefreshStatus() {
  return {
    refreshing: _themeRefreshing,
    progress: _themeProgress,
    last_refresh: _themeLastRefresh,
    last_error: _themeLastError,
  }
}

export async function refreshThemeClassification(): Promise<{
  ok: boolean
  updated_at: string
  resolutions_classified: number
  themes_found: number
  errors: string[]
}> {
  if (_themeRefreshing) {
    return { ok: false, updated_at: '', resolutions_classified: 0, themes_found: 0, errors: ['Theme classification already in progress'] }
  }

  _themeRefreshing = true
  _themeProgress = 'Loading resolutions...'
  const errors: string[] = []

  try {
    // Find resolutions file
    const resPath = existsSync(RESOLUTIONS_INPUT) ? RESOLUTIONS_INPUT
      : existsSync(RESOLUTIONS_INPUT_ALT) ? RESOLUTIONS_INPUT_ALT
      : null

    if (!resPath) {
      throw new Error('Resolutions file not found. Run UN voting data refresh first.')
    }

    const raw = JSON.parse(readFileSync(resPath, 'utf-8'))
    const resolutions: { id: string; s: number; d: string; t: string; v: Record<string, string> }[] = raw.resolutions || []

    _themeProgress = `Classifying ${resolutions.length} resolutions...`

    const map: Record<string, string[]> = {}
    const themeCounts: Record<string, number> = {}
    for (const t of ALL_THEMES) themeCounts[t] = 0

    for (const r of resolutions) {
      const themes = classify(r.t)
      map[r.id] = themes
      for (const t of themes) {
        themeCounts[t] = (themeCounts[t] || 0) + 1
      }
    }

    const now = new Date().toISOString()
    const output = {
      _meta: {
        generated_at: now,
        total_resolutions: resolutions.length,
        theme_counts: themeCounts,
      },
      themes: ALL_THEMES.filter(t => themeCounts[t] > 0),
      map,
    }

    // Atomic write
    _themeProgress = 'Writing themes file...'
    const themesPath = existsSync(dirname(THEMES_FILE)) ? THEMES_FILE : THEMES_FILE_ALT
    const dir = dirname(themesPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const tmpFile = themesPath + '.tmp'
    writeFileSync(tmpFile, JSON.stringify(output, null, 2), 'utf-8')
    renameSync(tmpFile, themesPath)

    // Reload in-memory data
    reloadUNVotes()

    _themeLastRefresh = now
    _themeLastError = errors.length > 0 ? errors.join('; ') : null
    _themeProgress = 'Done'

    return {
      ok: true,
      updated_at: now,
      resolutions_classified: resolutions.length,
      themes_found: output.themes.length,
      errors,
    }
  } catch (e: any) {
    const msg = e?.message || String(e)
    _themeLastError = msg
    errors.push(msg)
    return { ok: false, updated_at: '', resolutions_classified: 0, themes_found: 0, errors }
  } finally {
    _themeRefreshing = false
  }
}
