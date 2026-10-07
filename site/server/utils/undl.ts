import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'

/** UN Digital Library API: the admin's personal key, stored privately on the server. */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'undl-config.json')
export const UNDL_API = 'https://digitallibrary.un.org/api/v1'

interface Cfg { key: string | null; savedAt: string | null; lastTest: { at: string; ok: boolean; status: number; detail: string } | null }

function load(): Cfg {
  try {
    return existsSync(FILE) ? { key: null, savedAt: null, lastTest: null, ...JSON.parse(readFileSync(FILE, 'utf-8')) } : { key: null, savedAt: null, lastTest: null }
  } catch {
    return { key: null, savedAt: null, lastTest: null }
  }
}
function save(c: Cfg) {
  writeFileSync(FILE + '.tmp', JSON.stringify(c, null, 2), { mode: 0o600 })
  renameSync(FILE + '.tmp', FILE)
}

export function undlKey() { return load().key }
export function undlStatus() {
  const c = load()
  return { hasKey: !!c.key, hint: c.key ? `${c.key.slice(0, 4)}…${c.key.slice(-4)}` : null, savedAt: c.savedAt, lastTest: c.lastTest }
}
export function setUndlKey(key: string | null) {
  const c = load()
  const k = String(key || '').trim()
  if (k && !/^[A-Za-z0-9._\-:=+/]{12,200}$/.test(k)) throw new Error('That does not look like an API key')
  c.key = k || null
  c.savedAt = k ? new Date().toISOString() : null
  c.lastTest = null
  save(c)
  return undlStatus()
}

/** One small read request: the latest records in the Voting Data collection. */
export async function testUndl() {
  const c = load()
  if (!c.key) throw new Error('No key saved')
  const url = `${UNDL_API}/search?${new URLSearchParams({ cc: 'Voting Data', rg: '3', sf: 'latest first', so: 'd', format: 'json' })}`
  let status = 0
  let detail = ''
  let sample: any = null
  try {
    const r = await fetch(url, { headers: { Authorization: `Token ${c.key}`, Accept: 'application/json', 'User-Agent': 'WorldCountryGroups/1.0 (research)' }, signal: AbortSignal.timeout(30_000) })
    status = r.status
    const text = await r.text()
    try { sample = JSON.parse(text) } catch { sample = null }
    detail = sample ? JSON.stringify(sample).slice(0, 600) : text.slice(0, 300)
  } catch (e: any) {
    detail = String(e?.message || e)
  }
  const ok = status === 200 && !!sample && !sample.error
  c.lastTest = { at: new Date().toISOString(), ok, status, detail: detail.slice(0, 600) }
  save(c)
  return { ok, status, detail: c.lastTest.detail }
}
