import { existsSync, readFileSync, writeFileSync, renameSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Token usage per day, task and model, for the admin cost panel.
 * Kept as daily aggregates (not one line per call) so the file stays small.
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'ai-usage.json')
const KEEP_DAYS = 400

export interface UsageRow { calls: number; input: number; output: number; cached: number; errors: number }
export interface UsageFile {
  days: Record<string, Record<string, UsageRow>> // day -> "task|providerName|model" -> totals
  prices: Record<string, { input: number; output: number; cached?: number }> // model -> USD per 1M tokens
}
export interface Usage { input: number; output: number; cached?: number }

let data: UsageFile | null = null
let mtime = 0
let timer: ReturnType<typeof setTimeout> | null = null

function load(): UsageFile {
  try {
    if (existsSync(FILE)) {
      const m = statSync(FILE).mtimeMs
      if (!data || (m !== mtime && !timer)) {
        data = JSON.parse(readFileSync(FILE, 'utf-8'))
        mtime = m
      }
    }
  } catch {}
  if (!data) data = { days: {}, prices: {} }
  data.days ||= {}
  data.prices ||= {}
  return data
}

function flush() {
  timer = null
  if (!data) return
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10)
  for (const d of Object.keys(data.days)) if (d < cutoff) delete data.days[d]
  const tmp = FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(data))
  renameSync(tmp, FILE)
  mtime = statSync(FILE).mtimeMs
}

function schedule() { if (!timer) timer = setTimeout(flush, 5000) }

/** Record one AI call. Never throws: usage tracking must not break a request. */
export function recordUsage(task: string | undefined, provider: { name?: string; model?: string } | null | undefined, u: Usage | null, failed = false) {
  try {
    const d = load()
    const day = new Date().toISOString().slice(0, 10)
    const key = `${task || 'other'}|${provider?.name || 'unknown'}|${provider?.model || 'unknown'}`
    const row = ((d.days[day] ||= {})[key] ||= { calls: 0, input: 0, output: 0, cached: 0, errors: 0 })
    row.calls++
    if (failed) row.errors++
    if (u) {
      row.input += Math.max(0, u.input || 0)
      row.output += Math.max(0, u.output || 0)
      row.cached += Math.max(0, u.cached || 0)
    }
    schedule()
  } catch {}
}

/** Pull token counts out of any provider's response or final stream chunk. */
export function usageFrom(obj: any): Usage | null {
  const u = obj?.usage || obj?.x_groq?.usage
  if (!u) return null
  if (u.prompt_tokens !== undefined || u.completion_tokens !== undefined) {
    return { input: u.prompt_tokens || 0, output: u.completion_tokens || 0, cached: u.prompt_tokens_details?.cached_tokens || 0 }
  }
  return {
    input: u.input_tokens || 0,
    output: u.output_tokens || 0,
    cached: u.input_tokens_details?.cached_tokens || u.cache_read_input_tokens || 0,
  }
}

export function getUsageData(): UsageFile { return load() }

export function setPrices(prices: UsageFile['prices']) {
  const d = load()
  d.prices = {}
  for (const [model, p] of Object.entries(prices || {})) {
    const input = Number(p?.input), output = Number(p?.output), cached = Number(p?.cached)
    if (!model || !(input >= 0) || !(output >= 0)) continue
    d.prices[model.slice(0, 100)] = { input, output, ...(cached >= 0 && p?.cached !== undefined && p?.cached !== null && String(p.cached) !== '' ? { cached } : {}) }
  }
  if (timer) clearTimeout(timer)
  flush()
  return d.prices
}

/** Estimated USD for a usage row with the given model's price, or null if no price is set. */
export function costOf(model: string, u: { input: number; output: number; cached?: number }, prices = load().prices): number | null {
  const p = prices[model]
  if (!p) return null
  const cached = u.cached || 0
  const cachedPrice = p.cached ?? p.input
  return ((u.input - cached) * p.input + cached * cachedPrice + u.output * p.output) / 1e6
}
