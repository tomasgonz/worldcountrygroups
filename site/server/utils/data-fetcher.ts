import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { Readable } from 'stream'
import { createInterface } from 'readline'
import { inflateRawSync } from 'zlib'
import { getRegistry } from '~/server/utils/wcg'
import { reloadData } from '~/server/utils/countrydata'
import { reloadUNVotes } from '~/server/utils/unvotes'
import { reloadGDELT } from '~/server/utils/gdelt'
import { reloadSpeeches } from '~/server/utils/speeches'
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
    // The UN Digital Library now puts a human check in front of downloads, so a newer
    // file downloaded by hand into scripts/data/ (e.g. 2026_09_30_ga_voting.csv) wins.
    const { readdirSync, createReadStream } = await import('fs')
    const localDir = join(process.env.HOME || '/home/exedev', 'worldcountrygroups', 'scripts', 'data')
    const localCsv = existsSync(localDir)
      ? readdirSync(localDir).filter(f => /ga_voting.*\.csv$/i.test(f)).sort().pop()
      : undefined
    let sourceFile = UN_CSV_URL.split('/').pop()!
    let input: NodeJS.ReadableStream
    if (localCsv) {
      sourceFile = localCsv
      input = createReadStream(join(localDir, localCsv))
    } else {
      const resp = await fetch(UN_CSV_URL)
      if (!resp.ok || !resp.body) {
        throw new Error(`Failed to download UN CSV: ${resp.status} ${resp.statusText}`)
      }
      input = Readable.fromWeb(resp.body as any)
    }

    _unProgress = `Processing ${sourceFile}...`

    // Stream-parse the CSV line by line
    const countrySummary: Record<string, { sessions: Record<string, { yes: number; no: number; abstain: number; non_voting: number; total: number }> }> = {}
    const resolutionMap = new Map<string, { id: string; s: number; d: string; t: string; v: Record<string, string> }>()

    const rl = createInterface({ input, crlfDelay: Infinity })

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

    // Never replace the voting history with a smaller (partial or wrong) file
    try {
      const existingPath = getUNFilePath(UN_RESOLUTIONS_FILE, UN_RESOLUTIONS_FILE_ALT)
      if (existsSync(existingPath)) {
        const existing = JSON.parse(readFileSync(existingPath, 'utf-8'))?.resolutions?.length || 0
        if (existing && resolutionMap.size < existing * 0.95) {
          throw new Error(`${sourceFile} has ${resolutionMap.size} resolutions, fewer than the ${existing} already loaded; not replacing the data`)
        }
      }
    } catch (e: any) {
      if (String(e?.message || '').includes('not replacing')) throw e
    }

    _unProgress = 'Writing summary file...'
    const now = new Date().toISOString()
    const sessions = new Set<number>()
    for (const r of resolutionMap.values()) sessions.add(r.s)

    // Write summary file
    const summaryResult: Record<string, any> = {
      _meta: {
        updated_at: now,
        source_file: sourceFile,
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

// --- GDELT Data Refresh ---

// GDELT DOC API: documented limit is one request every 5 seconds
const GDELT_DOC_DELAY_MS = 6000

const GDELT_FILE = join(process.cwd(), 'server', 'data', 'gdelt-data.json')
const GDELT_FILE_ALT = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data', 'gdelt-data.json')

let _gdeltRefreshing = false
let _gdeltProgress = ''
let _gdeltLastRefresh: string | null = null
let _gdeltLastError: string | null = null

export function getGDELTRefreshStatus() {
  return {
    refreshing: _gdeltRefreshing,
    progress: _gdeltProgress,
    last_refresh: _gdeltLastRefresh,
    last_error: _gdeltLastError,
  }
}

// CAMEO actor country code → ISO3 exceptions
const CAMEO_TO_ISO3: Record<string, string> = {
  'USS': 'RUS', 'SUN': 'RUS', 'YUG': 'SRB', 'DDR': 'DEU', 'CSK': 'CZE',
  'ROM': 'ROU', 'ZAR': 'COD', 'BUR': 'MMR', 'TMP': 'TLS', 'SCG': 'SRB',
  'ANT': 'NLD', 'GBD': 'GBR', 'GBN': 'GBR', 'GBP': 'GBR', 'GBS': 'GBR',
  'HKG': 'CHN', 'MAC': 'CHN', 'TWN': 'TWN', 'PSE': 'PSE', 'XKX': 'XKX',
}

function resolveCAMEO(code: string): string | null {
  if (!code || code.length < 3) return null
  const upper = code.toUpperCase().substring(0, 3)
  if (CAMEO_TO_ISO3[upper]) return CAMEO_TO_ISO3[upper]
  // Most CAMEO country codes are already ISO3
  if (/^[A-Z]{3}$/.test(upper)) return upper
  return null
}

// CAMEO root codes: 01-10 are cooperative, 11-20 are conflictual
function isCooperative(rootCode: string): boolean {
  const n = parseInt(rootCode, 10)
  return n >= 1 && n <= 10
}

function isConflictual(rootCode: string): boolean {
  const n = parseInt(rootCode, 10)
  return n >= 11 && n <= 20
}

/**
 * Extract the first file of a PKZIP archive (GDELT daily exports contain exactly one CSV).
 * zlib's gzip/deflate streams cannot read .zip containers, so parse the central directory.
 */
function unzipSingleEntry(buf: Buffer): string | null {
  const EOCD = 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break }
  }
  if (eocd < 0) return null
  const cd = buf.readUInt32LE(eocd + 16)
  if (buf.readUInt32LE(cd) !== 0x02014b50) return null
  const method = buf.readUInt16LE(cd + 10)
  const compSize = buf.readUInt32LE(cd + 20)
  const lho = buf.readUInt32LE(cd + 42)
  if (buf.readUInt32LE(lho) !== 0x04034b50) return null
  const dataStart = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28)
  const data = buf.subarray(dataStart, dataStart + compSize)
  if (method === 0) return data.toString('utf-8')
  if (method === 8) return inflateRawSync(data).toString('utf-8')
  return null
}

async function fetchGDELTDailyCSV(dateStr: string): Promise<{
  perCountry: Map<string, {
    events: number; cooperative: number; conflictual: number; neutral: number
    goldsteinSum: number; toneSum: number; mentionsSum: number
    byCameo: Map<string, number>
  }>
  pairs: Map<string, {
    events: number; cooperative: number; conflictual: number; toneSum: number; mentionsSum: number
  }>
} | null> {
  const url = `https://data.gdeltproject.org/events/${dateStr}.export.CSV.zip`
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const csv = unzipSingleEntry(Buffer.from(await resp.arrayBuffer()))
    if (!csv) return null

    const perCountry = new Map<string, {
      events: number; cooperative: number; conflictual: number; neutral: number
      goldsteinSum: number; toneSum: number; mentionsSum: number
      byCameo: Map<string, number>
    }>()
    const pairs = new Map<string, {
      events: number; cooperative: number; conflictual: number; toneSum: number; mentionsSum: number
    }>()

    let start = 0
    while (start < csv.length) {
      let end = csv.indexOf('\n', start)
      if (end === -1) end = csv.length
      const line = csv.slice(start, end)
      start = end + 1
      const fields = line.split('\t')
      if (fields.length < 35) continue

      // GDELT 1.0 event columns: 7 Actor1CountryCode, 17 Actor2CountryCode, 28 EventRootCode,
      // 30 GoldsteinScale, 31 NumMentions, 34 AvgTone
      const actor1Code = fields[7] || ''
      const actor2Code = fields[17] || ''
      const eventRootCode = fields[28] || ''
      const goldstein = parseFloat(fields[30]) || 0
      const numMentions = parseInt(fields[31], 10) || 0
      const avgTone = parseFloat(fields[34]) || 0

      const iso1 = resolveCAMEO(actor1Code)
      const iso2 = resolveCAMEO(actor2Code)
      const rootCode = eventRootCode.substring(0, 2).padStart(2, '0')
      const coop = isCooperative(rootCode)
      const confl = isConflictual(rootCode)

      // Per-country aggregation
      for (const iso of [iso1, iso2]) {
        if (!iso) continue
        if (!perCountry.has(iso)) {
          perCountry.set(iso, {
            events: 0, cooperative: 0, conflictual: 0, neutral: 0,
            goldsteinSum: 0, toneSum: 0, mentionsSum: 0,
            byCameo: new Map(),
          })
        }
        const c = perCountry.get(iso)!
        c.events++
        if (coop) c.cooperative++
        else if (confl) c.conflictual++
        else c.neutral++
        c.goldsteinSum += goldstein
        c.toneSum += avgTone * numMentions
        c.mentionsSum += numMentions
        c.byCameo.set(rootCode, (c.byCameo.get(rootCode) || 0) + 1)
      }

      // Bilateral pair
      if (iso1 && iso2 && iso1 !== iso2) {
        const pairKey = iso1 < iso2 ? `${iso1}:${iso2}` : `${iso2}:${iso1}`
        if (!pairs.has(pairKey)) {
          pairs.set(pairKey, { events: 0, cooperative: 0, conflictual: 0, toneSum: 0, mentionsSum: 0 })
        }
        const p = pairs.get(pairKey)!
        p.events++
        if (coop) p.cooperative++
        else if (confl) p.conflictual++
        p.toneSum += avgTone * numMentions
        p.mentionsSum += numMentions
      }
    }

    return { perCountry, pairs }
  } catch {
    return null
  }
}

async function fetchGDELTDocSeries(countryName: string, mode: 'timelinetone' | 'timelinevolraw'): Promise<Array<[string, number]> | null> {
  const encodedName = encodeURIComponent(`"${countryName}"`)
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodedName}&mode=${mode}&timespan=12m&format=json`
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const resp = await fetch(url)
      const body = resp.ok ? await resp.text() : ''
      // Rate-limited requests get HTTP 429 or a plain-text notice instead of JSON
      if (body.trimStart().startsWith('{')) {
        const series = JSON.parse(body)?.timeline?.[0]?.data
        if (!Array.isArray(series)) return null
        return series.map((p: any) => [String(p.date || ''), Number(p.value) || 0] as [string, number])
      }
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, GDELT_DOC_DELAY_MS * (attempt + 2)))
  }
  return null
}

/**
 * 12-month media tone (volume-weighted) and article volume from the GDELT DOC API.
 * timelinetone returns the average tone per day; timelinevolraw the article count per day.
 */
async function fetchGDELTDocTone(countryName: string): Promise<{ avg_tone: number | null; volume: number | null; monthly: number[] | null } | null> {
  const tone = await fetchGDELTDocSeries(countryName, 'timelinetone')
  await new Promise(r => setTimeout(r, GDELT_DOC_DELAY_MS))
  const vol = await fetchGDELTDocSeries(countryName, 'timelinevolraw')
  if (!tone && !vol) return null

  const volByDate = new Map(vol || [])
  let toneSum = 0
  let weight = 0
  for (const [date, t] of tone || []) {
    const w = vol ? (volByDate.get(date) ?? 1) : 1
    toneSum += t * w
    weight += w
  }

  let monthly: number[] | null = null
  if (vol) {
    monthly = new Array(12).fill(0)
    const bucketSize = Math.max(1, Math.ceil(vol.length / 12))
    vol.forEach(([, v], i) => { monthly![Math.min(Math.floor(i / bucketSize), 11)] += v })
  }

  return {
    avg_tone: weight > 0 ? toneSum / weight : null,
    volume: vol ? vol.reduce((acc, [, v]) => acc + v, 0) : null,
    monthly,
  }
}

// Country name lookup for GDELT DOC API queries
const ISO3_TO_NAME: Record<string, string> = {
  USA: 'United States', CHN: 'China', RUS: 'Russia', GBR: 'United Kingdom',
  FRA: 'France', DEU: 'Germany', JPN: 'Japan', IND: 'India', BRA: 'Brazil',
  CAN: 'Canada', AUS: 'Australia', KOR: 'South Korea', ISR: 'Israel',
  IRN: 'Iran', SAU: 'Saudi Arabia', TUR: 'Turkey', UKR: 'Ukraine',
  PAK: 'Pakistan', EGY: 'Egypt', NGA: 'Nigeria', ZAF: 'South Africa',
  MEX: 'Mexico', IDN: 'Indonesia', ARG: 'Argentina', COL: 'Colombia',
  ITA: 'Italy', ESP: 'Spain', NLD: 'Netherlands', POL: 'Poland',
  SWE: 'Sweden', NOR: 'Norway', TWN: 'Taiwan', PRK: 'North Korea',
  IRQ: 'Iraq', SYR: 'Syria', AFG: 'Afghanistan', YEM: 'Yemen',
  LBY: 'Libya', SDN: 'Sudan', ETH: 'Ethiopia', MMR: 'Myanmar',
  VEN: 'Venezuela', CUB: 'Cuba', THA: 'Thailand', VNM: 'Vietnam',
  PHL: 'Philippines', MYS: 'Malaysia', SGP: 'Singapore', QAT: 'Qatar',
  ARE: 'United Arab Emirates', KWT: 'Kuwait', JOR: 'Jordan', LBN: 'Lebanon',
  GRC: 'Greece', BEL: 'Belgium', CHE: 'Switzerland', AUT: 'Austria',
  KEN: 'Kenya', DZA: 'Algeria', MAR: 'Morocco', PRT: 'Portugal',
  ROU: 'Romania', HUN: 'Hungary', CZE: 'Czech Republic', FIN: 'Finland',
  DNK: 'Denmark', IRL: 'Ireland', NZL: 'New Zealand', CHL: 'Chile',
  PER: 'Peru', ECU: 'Ecuador', BOL: 'Bolivia', URY: 'Uruguay',
  PRY: 'Paraguay', GEO: 'Georgia', ARM: 'Armenia', AZE: 'Azerbaijan',
  KAZ: 'Kazakhstan', UZB: 'Uzbekistan', TKM: 'Turkmenistan',
}

export async function refreshGDELTData(): Promise<{
  ok: boolean
  updated_at: string
  countries_processed: number
  errors: string[]
}> {
  if (_gdeltRefreshing) {
    return { ok: false, updated_at: '', countries_processed: 0, errors: ['GDELT refresh already in progress'] }
  }

  _gdeltRefreshing = true
  _gdeltProgress = 'Starting GDELT refresh...'
  const errors: string[] = []

  try {
    // Phase A: Download last 7 days of GDELT event CSVs
    _gdeltProgress = 'Phase A: Downloading GDELT daily event CSVs...'

    const mergedCountry = new Map<string, {
      events: number; cooperative: number; conflictual: number; neutral: number
      goldsteinSum: number; toneSum: number; mentionsSum: number
      byCameo: Map<string, number>
    }>()
    const mergedPairs = new Map<string, {
      events: number; cooperative: number; conflictual: number; toneSum: number; mentionsSum: number
    }>()

    const today = new Date()
    let daysProcessed = 0
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '')
      _gdeltProgress = `Phase A: Processing ${dateStr} (${i}/7)...`

      const result = await fetchGDELTDailyCSV(dateStr)
      if (!result) {
        errors.push(`Failed to fetch GDELT CSV for ${dateStr}`)
        continue
      }

      // Merge per-country data
      for (const [iso, data] of result.perCountry) {
        if (!mergedCountry.has(iso)) {
          mergedCountry.set(iso, {
            events: 0, cooperative: 0, conflictual: 0, neutral: 0,
            goldsteinSum: 0, toneSum: 0, mentionsSum: 0,
            byCameo: new Map(),
          })
        }
        const m = mergedCountry.get(iso)!
        m.events += data.events
        m.cooperative += data.cooperative
        m.conflictual += data.conflictual
        m.neutral += data.neutral
        m.goldsteinSum += data.goldsteinSum
        m.toneSum += data.toneSum
        m.mentionsSum += data.mentionsSum
        for (const [code, count] of data.byCameo) {
          m.byCameo.set(code, (m.byCameo.get(code) || 0) + count)
        }
      }

      // Merge pair data
      for (const [key, data] of result.pairs) {
        if (!mergedPairs.has(key)) {
          mergedPairs.set(key, { events: 0, cooperative: 0, conflictual: 0, toneSum: 0, mentionsSum: 0 })
        }
        const m = mergedPairs.get(key)!
        m.events += data.events
        m.cooperative += data.cooperative
        m.conflictual += data.conflictual
        m.toneSum += data.toneSum
        m.mentionsSum += data.mentionsSum
      }

      daysProcessed++
    }

    // Phase B (opt-in via GDELT_DOC_TONE=1): 12-month media tone/volume from the DOC API.
    // The API rate-limits aggressively, so by default media figures come from the event
    // exports, which measures every country over the same window.
    _gdeltProgress = 'Phase B: Fetching media tone from GDELT DOC API...'

    const sortedCountries = process.env.GDELT_DOC_TONE === '1'
      ? [...mergedCountry.entries()].sort((a, b) => b[1].events - a[1].events).slice(0, 80)
      : []

    const mediaTone = new Map<string, { avg_tone: number | null; volume: number | null; monthly: number[] | null }>()
    const CONCURRENCY = 1
    const DELAY_MS = GDELT_DOC_DELAY_MS

    for (let i = 0; i < sortedCountries.length; i += CONCURRENCY) {
      const batch = sortedCountries.slice(i, i + CONCURRENCY)
      _gdeltProgress = `Phase B: Media tone ${i + 1}/${sortedCountries.length}...`

      const results = await Promise.all(
        batch.map(async ([iso]) => {
          const name = ISO3_TO_NAME[iso]
          if (!name) return { iso, data: null }
          const data = await fetchGDELTDocTone(name)
          return { iso, data }
        })
      )

      for (const { iso, data } of results) {
        if (data) mediaTone.set(iso, data)
      }

      if (i + CONCURRENCY < sortedCountries.length) {
        await new Promise(r => setTimeout(r, DELAY_MS))
      }
    }

    // Build final output
    _gdeltProgress = 'Building output data...'

    const countries: Record<string, any> = {}

    for (const [iso, data] of mergedCountry) {
      const tone = mediaTone.get(iso)
      const byCameo: Record<string, number> = {}
      for (const [code, count] of data.byCameo) {
        byCameo[code] = count
      }

      // Build bilateral list for this country
      const bilateral: Array<{
        partner: string; events: number; cooperative: number; conflictual: number
        avg_tone: number; cooperation_ratio: number
      }> = []

      for (const [key, pData] of mergedPairs) {
        const [a, b] = key.split(':')
        let partner: string | null = null
        if (a === iso) partner = b
        else if (b === iso) partner = a
        if (!partner) continue

        const coopConfl = pData.cooperative + pData.conflictual
        bilateral.push({
          partner,
          events: pData.events,
          cooperative: pData.cooperative,
          conflictual: pData.conflictual,
          avg_tone: pData.mentionsSum > 0 ? pData.toneSum / pData.mentionsSum : 0,
          cooperation_ratio: coopConfl > 0 ? pData.cooperative / coopConfl : 0.5,
        })
      }

      bilateral.sort((a, b) => b.events - a.events)

      const coopConfl = data.cooperative + data.conflictual
      countries[iso] = {
        media: {
          avg_tone: tone?.avg_tone ?? (data.mentionsSum > 0 ? data.toneSum / data.mentionsSum : 0),
          article_volume: tone?.volume ?? data.mentionsSum,
          monthly_trend: tone?.monthly ?? [],
          volume_period: tone?.volume != null ? 'Last 12 months' : `Event mentions, last ${daysProcessed} days`,
        },
        events: {
          total: data.events,
          cooperative: data.cooperative,
          neutral: data.neutral,
          conflictual: data.conflictual,
          goldstein_avg: data.events > 0 ? data.goldsteinSum / data.events : 0,
          cooperation_ratio: coopConfl > 0 ? data.cooperative / coopConfl : 0.5,
          by_cameo: byCameo,
        },
        bilateral: bilateral.slice(0, 10),
      }
    }

    if (Object.keys(countries).length === 0) {
      throw new Error(`No GDELT events parsed (${errors.join('; ') || 'unknown error'}); existing data kept`)
    }

    // Atomic write
    _gdeltProgress = 'Writing GDELT data file...'
    const now = new Date().toISOString()
    const output = {
      _meta: {
        last_updated: now,
        source: 'GDELT Project',
        period: `${daysProcessed} days ending ${today.toISOString().slice(0, 10)}`,
        country_count: Object.keys(countries).length,
      },
      countries,
    }

    const filePath = existsSync(dirname(GDELT_FILE)) ? GDELT_FILE : GDELT_FILE_ALT
    const dir = dirname(filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const tmpFile = filePath + '.tmp'
    writeFileSync(tmpFile, JSON.stringify(output, null, 2), 'utf-8')
    renameSync(tmpFile, filePath)

    reloadGDELT()

    _gdeltLastRefresh = now
    _gdeltLastError = errors.length > 0 ? errors.join('; ') : null
    _gdeltProgress = 'Done'

    return {
      ok: true,
      updated_at: now,
      countries_processed: Object.keys(countries).length,
      errors,
    }
  } catch (e: any) {
    const msg = e?.message || String(e)
    _gdeltLastError = msg
    errors.push(msg)
    return { ok: false, updated_at: '', countries_processed: 0, errors }
  } finally {
    _gdeltRefreshing = false
  }
}

// --- UN General Debate Speeches ---


let _speechesRefreshing = false
let _speechesProgress = ''
let _speechesLastRefresh: string | null = null
let _speechesLastError: string | null = null

export function getSpeechesRefreshStatus() {
  return {
    refreshing: _speechesRefreshing,
    progress: _speechesProgress,
    last_refresh: _speechesLastRefresh,
    last_error: _speechesLastError,
  }
}

/**
 * Refresh General Debate speeches by running scripts/fetch_gadebate.py.
 *
 * The script merges the current (and previous) session into the existing index,
 * so historical sessions and stored analyses are never dropped. A failed or
 * blocked scrape leaves the index untouched.
 */
export async function refreshSpeechesData(): Promise<{
  ok: boolean
  updated_at: string
  speeches_processed: number
  errors: string[]
}> {
  if (_speechesRefreshing) {
    return { ok: false, updated_at: '', speeches_processed: 0, errors: ['Speeches refresh already in progress'] }
  }

  _speechesRefreshing = true
  const errors: string[] = []
  try {
    const { runPython } = await import('~/server/utils/run-python')
    const root = join(process.env.HOME || '/home/exedev', 'worldcountrygroups')
    const altRoot = join(process.cwd(), '..')
    const script = [join(root, 'scripts', 'fetch_gadebate.py'), join(altRoot, 'scripts', 'fetch_gadebate.py')]
      .find(p => existsSync(p))
    if (!script) throw new Error('scripts/fetch_gadebate.py not found')

    // The General Debate is held in late September; session N runs in year 1945 + N.
    const now = new Date()
    const latest = now.getUTCFullYear() - 1945 - (now.getUTCMonth() < 8 ? 1 : 0)
    const sessionArgs = [latest - 1, latest].flatMap(s => ['--session', String(s)])

    _speechesProgress = `Fetching sessions ${latest - 1}-${latest} from gadebate.un.org...`
    const { stdout } = await runPython(script, sessionArgs, {
      timeout: 60 * 60 * 1000,
      maxBuffer: 64 * 1024 * 1024,
    })
    const m = stdout.match(/Added (\d+), updated (\d+)/)
    const processed = m ? Number(m[1]) + Number(m[2]) : 0

    reloadSpeeches()
    const ts = new Date().toISOString()
    _speechesLastRefresh = ts
    _speechesLastError = null
    _speechesProgress = `Done: ${m ? m[0] : 'no changes'}`
    return { ok: true, updated_at: ts, speeches_processed: processed, errors }
  } catch (e: any) {
    const msg = e?.message || String(e)
    _speechesLastError = msg
    _speechesProgress = 'Failed'
    errors.push(msg)
    return { ok: false, updated_at: '', speeches_processed: 0, errors }
  } finally {
    _speechesRefreshing = false
  }
}
