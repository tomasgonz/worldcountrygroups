import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'unsc-votes.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'unsc-votes.json')

interface UNSCResolution {
  id: string
  date: string
  title: string
  adopted: boolean
  votes: Record<string, string>
  tally: { yes: number; no: number; abstain: number }
  vetoed: boolean
}

interface UNSCVotesData {
  _meta: { last_updated: string; total_resolutions: number }
  resolutions: UNSCResolution[]
}

let _data: UNSCVotesData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { _meta: { last_updated: '', total_resolutions: 0 }, resolutions: [] }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { _meta: { last_updated: '', total_resolutions: 0 }, resolutions: [] }
  }
}

export function getUNSCResolutions(opts: {
  page?: number
  limit?: number
  search?: string
  vetoed_only?: boolean
}): {
  resolutions: UNSCResolution[]
  total: number
  page: number
  pages: number
} {
  ensureLoaded()
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20))

  let filtered = _data!.resolutions

  if (opts.search) {
    const q = opts.search.toLowerCase()
    filtered = filtered.filter(r => r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
  }

  if (opts.vetoed_only) {
    filtered = filtered.filter(r => r.vetoed)
  }

  // Sort by date descending
  filtered = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit
  const resolutions = filtered.slice(start, start + limit)

  return { resolutions, total, page, pages }
}

export function getCountryUNSCVotes(iso3: string): {
  resolutions: (UNSCResolution & { country_vote: string })[]
  stats: { yes: number; no: number; abstain: number; total: number }
} {
  ensureLoaded()
  const code = iso3.toUpperCase()

  const resolutions = _data!.resolutions
    .filter(r => r.votes[code] != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(r => ({ ...r, country_vote: r.votes[code] }))

  const stats = { yes: 0, no: 0, abstain: 0, total: resolutions.length }
  for (const r of resolutions) {
    if (r.country_vote === 'Y') stats.yes++
    else if (r.country_vote === 'N') stats.no++
    else if (r.country_vote === 'A') stats.abstain++
  }

  return { resolutions, stats }
}
