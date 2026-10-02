import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { requireAdmin } from '~/server/utils/auth'
import { getUsageData, costOf, type UsageRow } from '~/server/utils/ai-usage'
import { AI_TASKS, getAIConfig } from '~/server/utils/ai-config'
import { listAsks } from '~/server/utils/ask-runner'

const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const EXTRA_TASKS: Record<string, string> = {
  search: 'Full-text search (query embeddings)', 'search-index': 'Search index (passage embeddings)',
  'speech-analysis': 'Speech analysis (General Debate)', other: 'Other / untagged',
}

/** AI usage and estimated cost for the last N days, by task, model and day. */
export default defineEventHandler((event) => {
  requireAdmin(event)
  const days = Math.min(400, Math.max(1, Number(getQuery(event).days) || 30))
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10)
  const site = getUsageData()
  let batch: { days: Record<string, Record<string, UsageRow>> } = { days: {} }
  try {
    const p = join(DATA_DIR, 'ai-usage-batch.json')
    if (existsSync(p)) batch = JSON.parse(readFileSync(p, 'utf-8'))
  } catch {}
  const prices = site.prices
  const empty = () => ({ calls: 0, input: 0, output: 0, cached: 0, errors: 0, cost: 0, unpriced: 0 })
  const byTask: Record<string, ReturnType<typeof empty>> = {}
  const byModel: Record<string, ReturnType<typeof empty> & { provider: string }> = {}
  const byDay: Record<string, ReturnType<typeof empty>> = {}
  const total = empty()
  for (const src of [site.days, batch.days || {}]) {
    for (const [day, rows] of Object.entries(src)) {
      if (day < since) continue
      for (const [key, r] of Object.entries(rows)) {
        const [task, provider, model] = key.split('|')
        const c = costOf(model, r, prices)
        for (const agg of [byTask[task] ||= empty(), byModel[model] ||= { ...empty(), provider }, byDay[day] ||= empty(), total]) {
          agg.calls += r.calls; agg.input += r.input; agg.output += r.output; agg.cached += r.cached || 0; agg.errors += r.errors || 0
          if (c === null) agg.unpriced += r.input + r.output
          else agg.cost += c
        }
      }
    }
  }
  const taskLabel = (id: string) => (AI_TASKS as readonly any[]).find(t => t.id === id)?.label || EXTRA_TASKS[id] || id

  // per-question cost of the Ask desk
  const asks = listAsks().filter(a => a.createdAt.slice(0, 10) >= since && a.usage)
  const askCosts = asks.map(a => ({ id: a.id, question: a.question, mode: a.mode, model: a.model || '', createdAt: a.createdAt, input: a.usage!.input, output: a.usage!.output, cost: costOf(a.model || '', a.usage!, prices) }))
  const priced = askCosts.filter(a => a.cost !== null)

  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    series.push({ day: d, ...(byDay[d] || empty()) })
  }
  const configured = getAIConfig().providers.map(p => p.model)
  return {
    days, since, total,
    byTask: Object.entries(byTask).map(([id, v]) => ({ id, label: taskLabel(id), ...v })).sort((a, b) => b.cost - a.cost || b.input + b.output - (a.input + a.output)),
    byModel: Object.entries(byModel).map(([model, v]) => ({ model, ...v, price: prices[model] || null })).sort((a, b) => b.input + b.output - (a.input + a.output)),
    series,
    asks: {
      count: askCosts.length,
      avgCost: priced.length ? priced.reduce((s, a) => s + (a.cost || 0), 0) / priced.length : null,
      avgTokens: askCosts.length ? Math.round(askCosts.reduce((s, a) => s + a.input + a.output, 0) / askCosts.length) : 0,
      priciest: [...askCosts].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0) || b.input + b.output - (a.input + a.output)).slice(0, 5),
    },
    prices,
    models: [...new Set([...configured, ...Object.keys(byModel), ...Object.keys(prices)])].filter(Boolean),
  }
})
