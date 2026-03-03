import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'unsc-vetoes.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'unsc-vetoes.json')

interface Veto {
  date: string
  draft: string
  vetoed_by: string[]
  subject: string
  meeting: string
}

interface VetoData {
  _meta: { last_updated: string; total_vetoes: number }
  vetoes: Veto[]
}

let _data: VetoData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { _meta: { last_updated: '', total_vetoes: 0 }, vetoes: [] }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { _meta: { last_updated: '', total_vetoes: 0 }, vetoes: [] }
  }
}

export function getAllVetoes(): VetoData {
  ensureLoaded()
  return _data!
}

export function getVetoesByCountry(iso3: string): Veto[] {
  ensureLoaded()
  const code = iso3.toUpperCase()
  return _data!.vetoes.filter(v => v.vetoed_by.includes(code))
}

export function getVetoStats(): {
  byCountry: Record<string, number>
  byDecade: Record<string, number>
  total: number
} {
  ensureLoaded()
  const byCountry: Record<string, number> = {}
  const byDecade: Record<string, number> = {}

  for (const v of _data!.vetoes) {
    for (const c of v.vetoed_by) {
      byCountry[c] = (byCountry[c] || 0) + 1
    }
    const year = parseInt(v.date.substring(0, 4))
    const decade = `${Math.floor(year / 10) * 10}s`
    byDecade[decade] = (byDecade[decade] || 0) + 1
  }

  return { byCountry, byDecade, total: _data!.vetoes.length }
}
