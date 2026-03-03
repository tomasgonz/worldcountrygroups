import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'treaties.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'treaties.json')

interface Treaty {
  id: string
  name: string
  short_name: string
  adopted: string
  category: string
  parties: string[]
  signatories_only: string[]
  withdrawn: string[]
}

interface TreatyData {
  _meta: { last_updated: string; treaty_count: number }
  treaties: Treaty[]
}

let _data: TreatyData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { _meta: { last_updated: '', treaty_count: 0 }, treaties: [] }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { _meta: { last_updated: '', treaty_count: 0 }, treaties: [] }
  }
}

export function getAllTreaties(): TreatyData {
  ensureLoaded()
  return _data!
}

export function getCountryTreatyStatus(iso3: string): {
  treaty: { id: string; short_name: string; name: string; adopted: string; category: string }
  status: 'party' | 'signatory' | 'withdrawn' | 'none'
}[] {
  ensureLoaded()
  const code = iso3.toUpperCase()
  return _data!.treaties.map(t => {
    let status: 'party' | 'signatory' | 'withdrawn' | 'none' = 'none'
    if (t.withdrawn.includes(code)) status = 'withdrawn'
    else if (t.parties.includes(code)) status = 'party'
    else if (t.signatories_only.includes(code)) status = 'signatory'
    return {
      treaty: { id: t.id, short_name: t.short_name, name: t.name, adopted: t.adopted, category: t.category },
      status,
    }
  })
}

export function getGroupTreatyCoverage(iso3Codes: string[]): {
  treaty: { id: string; short_name: string; name: string; category: string }
  parties: number
  signatories: number
  withdrawn: number
  none: number
  total: number
  coverage: number
}[] {
  ensureLoaded()
  const codes = new Set(iso3Codes.map(c => c.toUpperCase()))
  const total = codes.size

  return _data!.treaties.map(t => {
    let parties = 0, signatories = 0, withdrawn = 0, none = 0
    for (const code of codes) {
      if (t.withdrawn.includes(code)) withdrawn++
      else if (t.parties.includes(code)) parties++
      else if (t.signatories_only.includes(code)) signatories++
      else none++
    }
    return {
      treaty: { id: t.id, short_name: t.short_name, name: t.name, category: t.category },
      parties,
      signatories,
      withdrawn,
      none,
      total,
      coverage: total > 0 ? Math.round((parties / total) * 1000) / 10 : 0,
    }
  })
}
