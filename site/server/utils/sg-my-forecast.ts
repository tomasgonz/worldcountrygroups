import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { readDataFile } from './data-file'
import { getSgSelection, SG_FORECAST_FILE, SG_MARKETS_FILE, type SgForecast } from './sg-selection'

/**
 * Personal forecasts on the Secretary-General race, entered by admins on the SG tab. Each entry
 * belongs to the account that made it and is only ever returned to that account (not to other
 * admins). Kept in sg-my-forecast.json (gitignored). Once the Council recommends someone, each
 * person's forecasts are scored against the betting market and the model.
 */

const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'sg-my-forecast.json')
const OTHER = '_other'
const MAX_ENTRIES = 5000
const DAY = 86400_000

export interface MyForecast { at: string; userId: string; probs: Record<string, number>; other: number; note?: string }
interface Store { entries: MyForecast[] }
type Probs = Record<string, number>

function load(): Store {
  try { if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {}
  return { entries: [] }
}

function save(s: Store) {
  writeFileSync(FILE + '.tmp', JSON.stringify(s, null, 1))
  renameSync(FILE + '.tmp', FILE)
}

/** This account's forecasts, latest first. */
export function listMyForecasts(userId: string): MyForecast[] {
  return load().entries.filter(e => e.userId === userId).reverse()
}

/** Save a forecast: percent per official candidate (ids from the SG data); the rest is "someone else". */
export function addMyForecast(userId: string, percent: Record<string, unknown>, note?: unknown): MyForecast {
  const sg = getSgSelection()
  const ids = new Set((sg?.candidates || []).filter(c => c.status !== 'withdrawn').map(c => c.id))
  const probs: Probs = {}
  for (const [id, v] of Object.entries(percent || {})) {
    if (v === null || v === '' || v === undefined) continue
    if (!ids.has(id)) throw new Error(`Not an official candidate: ${id}`)
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Each chance must be between 0 and 100')
    if (n > 0) probs[id] = Math.round(n * 10) / 1000
  }
  const sum = Object.values(probs).reduce((a, b) => a + b, 0)
  if (sum > 1.005) throw new Error(`The chances add up to ${Math.round(sum * 100)}%, more than 100%`)
  const entry: MyForecast = {
    at: new Date().toISOString(), userId, probs, other: Math.max(0, Math.round((1 - sum) * 1000) / 1000),
    note: String(note || '').trim().slice(0, 1000) || undefined,
  }
  const s = load()
  s.entries = [...s.entries, entry].slice(-MAX_ENTRIES)
  save(s)
  return entry
}

export function deleteMyForecast(userId: string, at: string): boolean {
  const s = load()
  const n = s.entries.length
  s.entries = s.entries.filter(e => !(e.userId === userId && e.at === at))
  if (s.entries.length === n) return false
  save(s)
  return true
}

// ---------------------------------------------------------------------------- scoring

type Track = { at: number; probs: Probs }[]

/** Shares that add up to 1, with whatever is not on a named person in "someone else". */
function complete(p: Probs): Probs {
  const named = Object.entries(p).filter(([k]) => k !== OTHER)
  const sum = named.reduce((a, [, v]) => a + v, 0)
  if (sum >= 1) return Object.fromEntries([...named.map(([k, v]) => [k, v / sum]), [OTHER, 0]])
  return { ...Object.fromEntries(named), [OTHER]: 1 - sum }
}

function latest(track: Track, t: number): Probs | null {
  let hit: Probs | null = null
  for (const r of track) { if (r.at <= t) hit = r.probs; else break }
  return hit
}

/** Brier score on the forecaster's own list: a winner it did not name counts under "someone else". */
function brier(p: Probs, winner: string): { score: number; pWinner: number } {
  const hit = winner in p && winner !== OTHER ? winner : OTHER
  let score = 0
  for (const [k, v] of Object.entries(p)) score += (v - (k === hit ? 1 : 0)) ** 2
  return { score, pWinner: p[hit] || 0 }
}

export interface ForecastScore { who: 'market' | 'model' | 'you'; label: string; brier: number; p_winner: number }

/**
 * Once a candidate is "selected": each forecaster's Brier score (0 perfect, 2 worst) and average
 * chance given to the winner, read at the end of every day on which all of them had a forecast.
 */
export function scoreMyForecasts(userId: string) {
  const sg = getSgSelection()
  const winner = sg?.candidates.find(c => c.status === 'selected') || null
  const mine: Track = load().entries.filter(e => e.userId === userId)
    .map(e => ({ at: Date.parse(e.at), probs: complete({ ...e.probs, [OTHER]: e.other }) }))
  if (!winner) return { resolved: false as const, winner: null, entries: mine.length }

  const model = readDataFile<SgForecast>(SG_FORECAST_FILE)
  const markets = readDataFile<{ snapshots?: { at: string; prices: Record<string, [number, number | null, number | null]> }[] }>(SG_MARKETS_FILE)
  const modelTrack: Track = (model?.history || []).map(h => ({ at: Date.parse(h.at), probs: complete(h.probs) }))
  const marketTrack: Track = (markets?.snapshots || []).map(s => ({
    at: Date.parse(s.at), probs: complete(Object.fromEntries(Object.entries(s.prices).map(([k, v]) => [k, v[0]]))),
  }))
  const decided = modelTrack.find(h => (h.probs[winner.id] || 0) >= 0.999)?.at ?? Date.now()
  const tracks = ([['market', 'Betting market', marketTrack], ['model', 'Model', modelTrack], ['you', 'You', mine]] as const)
    .filter(([, , t]) => t.length && t[0].at < decided)
  if (!tracks.length) return { resolved: true as const, winner: { id: winner.id, name: winner.name }, from: null, to: null, days: 0, scores: [] }

  // days on which every forecaster had a forecast, up to the day before the decision
  const start = Math.max(...tracks.map(([, , t]) => t[0].at))
  const firstDay = Math.ceil((start + 1) / DAY) * DAY - 1
  const totals = tracks.map(() => ({ score: 0, pWinner: 0 }))
  let days = 0
  for (let t = firstDay; t < decided; t += DAY) {
    tracks.forEach(([, , track], i) => {
      const b = brier(latest(track, t)!, winner.id)
      totals[i].score += b.score
      totals[i].pWinner += b.pWinner
    })
    days++
  }
  const scores: ForecastScore[] = tracks.map(([who, label], i) => ({
    who, label, brier: days ? totals[i].score / days : NaN, p_winner: days ? totals[i].pWinner / days : NaN,
  }))
  return {
    resolved: true as const,
    winner: { id: winner.id, name: winner.name },
    from: days ? new Date(firstDay).toISOString().slice(0, 10) : null,
    to: new Date(decided).toISOString().slice(0, 10),
    days,
    scores: days ? scores.sort((a, b) => a.brier - b.brier) : [],
  }
}
