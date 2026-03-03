import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'sanctions.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'sanctions.json')

interface SanctionsRegime {
  id: string
  name: string
  resolution: string
  established: string
  measures: string[]
  target_countries: string[]
}

interface SanctionsData {
  _meta: { last_updated: string; regime_count: number }
  regimes: SanctionsRegime[]
}

let _data: SanctionsData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { _meta: { last_updated: '', regime_count: 0 }, regimes: [] }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { _meta: { last_updated: '', regime_count: 0 }, regimes: [] }
  }
}

export function getAllSanctions(): SanctionsData {
  ensureLoaded()
  return _data!
}

export function getCountrySanctions(iso3: string): SanctionsRegime[] {
  ensureLoaded()
  const code = iso3.toUpperCase()
  return _data!.regimes.filter(r => r.target_countries.includes(code))
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
      .filter(r => r.target_countries.includes(code))
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
