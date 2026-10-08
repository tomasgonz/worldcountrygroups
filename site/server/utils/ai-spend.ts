import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { ownLikeFolder } from './own-file'
import { join } from 'path'
import { getUsageData, costOf } from './ai-usage'
import { getUsers } from './users'
import { addNotifications } from './notifications'
import { sendEmail } from './email'
import { getCronConfig } from './cron-config'

/**
 * AI spending: the amounts OpenAI actually billed (from its Costs API, which needs an
 * organisation Admin key), a monthly budget with alerts, and month-end projections.
 * When billed amounts aren't available, estimates from token counts × prices are used.
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'ai-spend.json')

interface SpendStore {
  budget: number | null                 // USD per calendar month
  adminKey: string | null               // OpenAI Admin key (sk-admin-…), used only for the Costs API
  billed: Record<string, { usd: number; items: Record<string, number> }>   // day -> billed
  lastFetch: string | null
  lastError: string | null
  alertsSent: Record<string, number[]>  // month -> thresholds already announced
}
const THRESHOLDS = [50, 80, 100]

function load(): SpendStore {
  try { if (existsSync(FILE)) return { budget: null, adminKey: null, billed: {}, lastFetch: null, lastError: null, alertsSent: {}, ...JSON.parse(readFileSync(FILE, 'utf-8')) } } catch {}
  return { budget: null, adminKey: null, billed: {}, lastFetch: null, lastError: null, alertsSent: {} }
}
function save(s: SpendStore) {
  const text = JSON.stringify(s, null, 2)
  writeFileSync(FILE + '.tmp', text, { mode: 0o600 })
  renameSync(FILE + '.tmp', FILE)
  ownLikeFolder(FILE)
}

export function spendSettings() {
  const s = load()
  return { budget: s.budget, hasAdminKey: !!s.adminKey, adminKeyHint: s.adminKey ? `${s.adminKey.slice(0, 9)}…${s.adminKey.slice(-4)}` : null, lastFetch: s.lastFetch, lastError: s.lastError }
}

export function saveSpendSettings(b: { budget?: any; adminKey?: any }) {
  const s = load()
  if (b.budget !== undefined) {
    const v = Number(b.budget)
    s.budget = b.budget === null || b.budget === '' || !(v > 0) ? null : Math.round(v * 100) / 100
  }
  if (b.adminKey !== undefined) {
    const k = String(b.adminKey || '').trim()
    if (k && !/^sk-[A-Za-z0-9_-]{20,}$/.test(k)) throw new Error('That does not look like an OpenAI key')
    s.adminKey = k || null
    if (!k) { s.billed = {}; s.lastFetch = null; s.lastError = null }
  }
  save(s)
  return spendSettings()
}

/** Fetch daily billed costs from OpenAI's organisation Costs API (last 90 days). */
export async function fetchBilled(): Promise<{ ok: boolean; days?: number; error?: string }> {
  const s = load()
  if (!s.adminKey) return { ok: false, error: 'No OpenAI Admin key set' }
  const start = Math.floor((Date.now() - 90 * 86400_000) / 86400_000) * 86400
  const billed: SpendStore['billed'] = {}
  let page: string | null = null
  try {
    for (let i = 0; i < 10; i++) {
      const url = `https://api.openai.com/v1/organization/costs?start_time=${start}&bucket_width=1d&limit=31&group_by=line_item${page ? `&page=${encodeURIComponent(page)}` : ''}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${s.adminKey}` }, signal: AbortSignal.timeout(30_000) })
      const j: any = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error?.message || `OpenAI answered ${res.status}`)
      for (const b of j.data || []) {
        const day = new Date((b.start_time || 0) * 1000).toISOString().slice(0, 10)
        const e = (billed[day] ||= { usd: 0, items: {} })
        for (const r of b.results || []) {
          const v = Number(r.amount?.value || 0)
          e.usd += v
          const k = r.line_item || 'other'
          e.items[k] = (e.items[k] || 0) + v
        }
      }
      if (!j.has_more || !j.next_page) break
      page = j.next_page
    }
    s.billed = billed; s.lastFetch = new Date().toISOString(); s.lastError = null
    save(s)
    return { ok: true, days: Object.keys(billed).length }
  } catch (e: any) {
    s.lastError = String(e?.message || e).slice(0, 300); s.lastFetch = new Date().toISOString()
    save(s)
    return { ok: false, error: s.lastError }
  }
}

/** Estimated cost per day from our own token counts × prices. */
function estimatedByDay(): Record<string, { usd: number; unpriced: number }> {
  const u = getUsageData()
  let batch: any = {}
  try { batch = JSON.parse(readFileSync(join(DATA_DIR, 'ai-usage-batch.json'), 'utf-8')) } catch {}
  const out: Record<string, { usd: number; unpriced: number }> = {}
  for (const src of [u.days, batch.days || {}]) {
    for (const [day, rows] of Object.entries<any>(src)) {
      const e = (out[day] ||= { usd: 0, unpriced: 0 })
      for (const [key, r] of Object.entries<any>(rows)) {
        const c = costOf(key.split('|')[2], r, u.prices)
        if (c === null) e.unpriced += (r.input || 0) + (r.output || 0)
        else e.usd += c
      }
    }
  }
  return out
}

/** Month-to-date, projection, budget and the last 12 months, billed where available. */
export function spendSummary() {
  const s = load()
  const est = estimatedByDay()
  const useBilled = !!s.adminKey && Object.keys(s.billed).length > 0
  const now = new Date()
  const month = now.toISOString().slice(0, 7)
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const dayOfMonth = now.getUTCDate()
  const sumMonth = (m: string, src: 'billed' | 'est') => Object.entries<any>(src === 'billed' ? s.billed : est).filter(([d]) => d.startsWith(m)).reduce((a, [, v]) => a + (v.usd || 0), 0)
  const mtdBilled = sumMonth(month, 'billed')
  const mtdEst = sumMonth(month, 'est')
  const mtd = useBilled ? mtdBilled : mtdEst
  // projection: recent daily rate (last 7 days) for the rest of the month
  const last7 = [...Array(7)].map((_, i) => new Date(now.getTime() - (i + 1) * 86400_000).toISOString().slice(0, 10))
  const rate = last7.reduce((a, d) => a + ((useBilled ? s.billed[d]?.usd : est[d]?.usd) || 0), 0) / 7
  const projected = mtd + rate * (daysInMonth - dayOfMonth + 1)
  const months: { month: string; billed: number | null; estimated: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const m = d.toISOString().slice(0, 7)
    months.push({ month: m, billed: useBilled ? Math.round(sumMonth(m, 'billed') * 100) / 100 : null, estimated: Math.round(sumMonth(m, 'est') * 1000) / 1000 })
  }
  const unpricedMonth = Object.entries(est).filter(([d]) => d.startsWith(month)).reduce((a, [, v]) => a + v.unpriced, 0)
  return {
    source: useBilled ? 'billed' : 'estimated',
    month, monthToDate: Math.round(mtd * 1000) / 1000, estimatedMonthToDate: Math.round(mtdEst * 1000) / 1000,
    billedMonthToDate: useBilled ? Math.round(mtdBilled * 100) / 100 : null,
    dailyRate: Math.round(rate * 1000) / 1000, projected: Math.round(projected * 100) / 100,
    budget: s.budget, budgetUsedPct: s.budget ? Math.round((mtd / s.budget) * 1000) / 10 : null,
    unpricedTokensThisMonth: unpricedMonth,
    months,
    billedLineItems: useBilled ? Object.entries(Object.entries<any>(s.billed).filter(([d]) => d.startsWith(month))
      .reduce((acc: Record<string, number>, [, v]) => { for (const [k, x] of Object.entries<number>(v.items)) acc[k] = (acc[k] || 0) + x; return acc }, {}))
      .map(([item, usd]) => ({ item, usd: Math.round(usd * 100) / 100 })).sort((a, b) => b.usd - a.usd) : [],
    settings: spendSettings(),
  }
}

/** Tell admins when month-to-date spend passes 50%, 80% and 100% of the budget. */
export async function checkBudget(): Promise<string[]> {
  const s = load()
  if (!s.budget) return []
  const sum = spendSummary()
  const sent = (s.alertsSent[sum.month] ||= [])
  const fired: string[] = []
  for (const t of THRESHOLDS) {
    if ((sum.budgetUsedPct || 0) >= t && !sent.includes(t)) {
      sent.push(t)
      const title = t >= 100 ? `AI spending has reached the monthly budget ($${sum.monthToDate.toFixed(2)} of $${s.budget})` : `AI spending is at ${t}% of the monthly budget ($${sum.monthToDate.toFixed(2)} of $${s.budget})`
      fired.push(title)
      const admins = getUsers().filter(u => u.role === 'admin')
      for (const a of admins) addNotifications(a.id, [{ kind: 'budget', title, body: `Projected for the month: $${sum.projected.toFixed(2)} (${sum.source}).`, url: '/admin?tab=ai' }])
      const to = new Set<string>([...(getCronConfig().alertEmails || []), ...admins.filter(a => a.email).map(a => a.email)])
      for (const addr of to) await sendEmail(addr, `World Country Groups: ${title}`, `${title}.\nProjected for the month: $${sum.projected.toFixed(2)} (${sum.source === 'billed' ? 'from OpenAI billing' : 'estimated from usage'}).\n\nDetails: https://www.worldcountrygroups.org/admin?tab=ai`)
    }
  }
  save(s)
  return fired
}

/** Ask-desk cost per person this month (estimated from tokens × prices). */
export function spendByPerson(listAsks: () => any[]) {
  const u = getUsageData()
  const month = new Date().toISOString().slice(0, 7)
  const by = new Map<string, { name: string; questions: number; tokens: number; usd: number }>()
  for (const a of listAsks()) {
    if (!a.usage || !(a.createdAt || '').startsWith(month)) continue
    const e = by.get(a.userId) || { name: a.userName, questions: 0, tokens: 0, usd: 0 }
    e.questions++; e.tokens += a.usage.input + a.usage.output
    e.usd += costOf(a.model || '', a.usage, u.prices) || 0
    by.set(a.userId, e)
  }
  return [...by.values()].sort((a, b) => b.usd - a.usd || b.tokens - a.tokens).map(e => ({ ...e, usd: Math.round(e.usd * 1000) / 1000 }))
}
