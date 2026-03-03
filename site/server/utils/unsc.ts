import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const HISTORY_FILE = join(process.cwd(), 'server', 'data', 'unsc-history.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const HISTORY_FILE_ALT = join(ALT_DIR, 'unsc-history.json')

interface UNSCHistory {
  _meta: { description: string; last_updated: string }
  permanent: string[]
  terms: Record<string, number[][]>
}

let _history: UNSCHistory | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_history !== null) return

  const filePath = resolve(HISTORY_FILE, HISTORY_FILE_ALT)
  if (!filePath) {
    _history = { _meta: { description: '', last_updated: '' }, permanent: [], terms: {} }
    return
  }

  try {
    _history = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _history = { _meta: { description: '', last_updated: '' }, permanent: [], terms: {} }
  }
}

export function getUNSCHistory(): UNSCHistory {
  ensureLoaded()
  return _history!
}

export function getCountryUNSCTerms(iso3: string): number[][] {
  ensureLoaded()
  return _history!.terms[iso3.toUpperCase()] ?? []
}

export function isPermanentMember(iso3: string): boolean {
  ensureLoaded()
  return _history!.permanent.includes(iso3.toUpperCase())
}

export function getUNSCStats(): {
  totalCountriesServed: number
  totalTerms: number
  permanentMembers: number
} {
  ensureLoaded()
  let totalTerms = 0
  for (const terms of Object.values(_history!.terms)) {
    totalTerms += terms.length
  }
  return {
    totalCountriesServed: Object.keys(_history!.terms).length,
    totalTerms,
    permanentMembers: _history!.permanent.length,
  }
}
