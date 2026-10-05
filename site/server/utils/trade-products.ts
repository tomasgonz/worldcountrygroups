import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, statSync } from 'fs'
import { join } from 'path'
import { getComtradeRefs, getTradeMeta } from './trade-partners'

/**
 * Top products (HS 2-digit chapters) traded between a country and one partner, from
 * the UN Comtrade public preview API (no key, few requests allowed). Fetched only on
 * demand, one pair at a time through a paced queue, and cached on disk for 30 days.
 */

const UA = 'WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)'
const API = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS'
const CACHE_DIR = join(process.env.HOME || '/home/exedev', '.cache', 'wcg', 'comtrade', 'products')
const TTL_MS = 30 * 86400_000
const GAP_MS = 2500
const MAX_QUEUE = 6

export interface ProductRow { code: string; name: string; short: string; value: number; share: number }
export interface PairProducts {
  iso3: string
  partner: string
  year: number | null
  exports: ProductRow[]
  imports: ProductRow[]
  source: string
  source_url: string
  fetched: string
  note?: string
}

let chain: Promise<unknown> = Promise.resolve()
let queued = 0
let lastCall = 0
const inflight = new Map<string, Promise<PairProducts>>()

function paced<T>(fn: () => Promise<T>): Promise<T> {
  if (queued >= MAX_QUEUE) return Promise.reject(createError({ statusCode: 429, statusMessage: 'Product lookups are busy, try again shortly' }))
  queued++
  const run = chain.then(async () => {
    const wait = lastCall + GAP_MS - Date.now()
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    try { return await fn() } finally { lastCall = Date.now() }
  })
  chain = run.catch(() => {}).finally(() => { queued-- })
  return run
}

async function comtrade(reporter: number, partner: number, year: number, flow: 'X' | 'M'): Promise<any[]> {
  const url = `${API}?reporterCode=${reporter}&period=${year}&partnerCode=${partner}&cmdCode=AG2&flowCode=${flow}`
  return paced(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
    if (res.status === 429) throw createError({ statusCode: 429, statusMessage: 'UN Comtrade rate limit reached, try again later' })
    if (!res.ok) throw createError({ statusCode: 502, statusMessage: `UN Comtrade error ${res.status}` })
    const j: any = await res.json()
    return Array.isArray(j?.data) ? j.data : []
  })
}

function top(rows: any[], hs2: Record<string, string>, n = 5): ProductRow[] {
  const clean = rows.filter(r => r && r.cmdCode && r.cmdCode !== 'TOTAL' && (r.partner2Code ?? 0) === 0 && (r.motCode ?? 0) === 0 && (r.customsCode ?? 'C00') === 'C00')
  const byCode = new Map<string, number>()
  for (const r of clean) byCode.set(r.cmdCode, (byCode.get(r.cmdCode) || 0) + (Number(r.primaryValue) || 0))
  const total = [...byCode.values()].reduce((a, b) => a + b, 0)
  return [...byCode.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([code, v]) => ({ code, name: hs2[code] || `HS ${code}`, short: (hs2[code] || `HS ${code}`).split(/[;,]/)[0].trim(), value: Math.round(v / 1e5) / 10, share: total ? Math.round((v / total) * 1000) / 10 : 0 }))
}

export async function getPairProducts(iso3: string, partnerIso3: string): Promise<PairProducts> {
  const a = String(iso3 || '').toUpperCase()
  const b = String(partnerIso3 || '').toUpperCase()
  const refs = getComtradeRefs()
  const ra = refs.m49[a]
  const rb = refs.m49[b]
  if (!ra || !rb || a === b) throw createError({ statusCode: 400, statusMessage: 'Products are available for country pairs only' })
  const key = `${a}-${b}`
  const file = join(CACHE_DIR, `${key}.json`)
  try {
    if (existsSync(file) && Date.now() - statSync(file).mtimeMs < TTL_MS) return JSON.parse(readFileSync(file, 'utf-8'))
  } catch { /* refetch */ }
  const pending = inflight.get(key)
  if (pending) return pending

  const job = (async () => {
    const latest = getTradeMeta()?.latest_year ?? new Date().getFullYear() - 1
    let year: number | null = null
    let x: any[] = []
    let m: any[] = []
    for (const y of [latest, latest - 1]) {
      x = await comtrade(ra, rb, y, 'X')
      if (!x.length) continue
      m = await comtrade(ra, rb, y, 'M')
      year = y
      break
    }
    const out: PairProducts = {
      iso3: a, partner: b, year,
      exports: top(x, refs.hs2), imports: top(m, refs.hs2),
      source: 'UN Comtrade (public preview), HS 2-digit chapters, as reported by ' + a,
      source_url: 'https://comtradeplus.un.org/',
      fetched: new Date().toISOString(),
      ...(year == null ? { note: 'The reporter has not published product detail for recent years.' } : {}),
    }
    try {
      mkdirSync(CACHE_DIR, { recursive: true })
      writeFileSync(file + '.tmp', JSON.stringify(out))
      renameSync(file + '.tmp', file)
    } catch { /* cache is best effort */ }
    return out
  })()
  inflight.set(key, job)
  try { return await job } finally { inflight.delete(key) }
}
