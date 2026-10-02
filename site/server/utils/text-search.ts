import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { getAIConfig } from './ai-config'
import { recordUsage, usageFrom } from './ai-usage'

/**
 * Full-text search over General Debate speeches (paragraph level, 1946 onwards),
 * official statements and news, from the index built by scripts/build_search_index.py.
 * Combines keyword ranking (SQLite FTS5, BM25) with meaning-based ranking
 * (OpenAI embeddings) by reciprocal-rank fusion. Falls back to keywords alone
 * when embeddings are unavailable.
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const DB_PATH = join(DATA_DIR, 'search.db')
const EMBED_MODEL = 'text-embedding-3-small'
const DIMS = 256
const KINDS = ['speech', 'statement', 'news'] as const
export type PassageKind = typeof KINDS[number]

export interface Passage {
  id: number; kind: PassageKind; iso3: string; year: number; session: number | null; date: string
  speaker: string; title: string; url: string; text: string; match: string
}

let db: any = null
let dbStamp = ''
function getDb(): any | null {
  if (!existsSync(DB_PATH)) return null
  const st = statSync(DB_PATH)
  const stamp = `${st.ino}`
  if (db && stamp === dbStamp) return db
  try { db?.close() } catch {}
  // node:sqlite is built in (Node 22); loaded at runtime so the bundler leaves it alone
  const { DatabaseSync } = (process as any).getBuiltinModule('node:sqlite')
  db = new DatabaseSync(DB_PATH, { readOnly: true })
  dbStamp = stamp
  vec = null
  return db
}

// ---------- vectors, held in memory ----------
interface VecStore { ids: Int32Array; kind: Uint8Array; year: Int16Array; iso: Uint16Array; isoIndex: Map<string, number>; scale: Float32Array; v: Int8Array; builtAt: string }
let vec: VecStore | null = null
let vecChecked = 0

function loadVectors(d: any): VecStore | null {
  const now = Date.now()
  if (vec && now - vecChecked < 5 * 60_000) return vec
  vecChecked = now
  const builtAt = (d.prepare("SELECT v FROM meta WHERE k='built_at'").get() as any)?.v || ''
  if (vec && vec.builtAt === builtAt) return vec
  const rows = d.prepare('SELECT p.id, p.kind, p.iso3, p.year, v.v AS blob FROM passages p JOIN vectors v ON v.hash = p.hash').all() as any[]
  if (!rows.length) { vec = null; return null }
  const n = rows.length
  const s: VecStore = {
    ids: new Int32Array(n), kind: new Uint8Array(n), year: new Int16Array(n), iso: new Uint16Array(n),
    isoIndex: new Map(), scale: new Float32Array(n), v: new Int8Array(n * DIMS), builtAt,
  }
  rows.forEach((r, i) => {
    s.ids[i] = r.id
    s.kind[i] = Math.max(0, KINDS.indexOf(r.kind))
    s.year[i] = r.year || 0
    if (!s.isoIndex.has(r.iso3 || '')) s.isoIndex.set(r.iso3 || '', s.isoIndex.size)
    s.iso[i] = s.isoIndex.get(r.iso3 || '')!
    const b: Uint8Array = r.blob
    s.scale[i] = Buffer.from(b.buffer, b.byteOffset, 4).readFloatLE(0) / 127
    s.v.set(new Int8Array(b.buffer, b.byteOffset + 4, DIMS), i * DIMS)
  })
  vec = s
  return s
}

async function embedQuery(text: string): Promise<Float32Array | null> {
  const p = getAIConfig().providers.find(x => x.type === 'openai' && x.apiKey && (!x.baseUrl || x.baseUrl.includes('api.openai.com')))
  if (!p) return null
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 2000), dimensions: DIMS }),
    })
    if (!res.ok) { recordUsage('search', { name: 'OpenAI embeddings', model: EMBED_MODEL }, null, true); return null }
    const data: any = await res.json()
    const u = usageFrom(data)
    recordUsage('search', { name: 'OpenAI embeddings', model: EMBED_MODEL }, u ? { input: u.input, output: 0 } : null)
    return Float32Array.from(data.data[0].embedding)
  } catch { return null }
}

// ---------- search ----------
const STOP = new Set('the a an and or of to in on for with by at from as is are was were be been this that these those it its their our we you they he she what which who whom how why when where did does do has have had about into over than then there here not no can could would should will shall may might must also all any some such more most very much many own same so only just'.split(' '))

function ftsQuery(q: string): string {
  const words = (q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) || [])
    .filter(w => w.length > 1 && !STOP.has(w)).slice(0, 12)
  if (!words.length) return ''
  const terms = words.map(w => `"${w}"`)
  // the whole phrase ranks highest, then passages with all words, then any word
  const parts = [terms.join(' OR ')]
  if (words.length > 1) parts.unshift(`(${terms.join(' AND ')})`)
  return parts.join(' OR ')
}

export interface SearchOptions { query: string; kinds?: PassageKind[]; iso3?: string | null; fromYear?: number; toYear?: number; limit?: number }

export async function searchTexts(o: SearchOptions): Promise<{ passages: Passage[]; method: string; indexed: { passages: number; withVectors: number; builtAt: string } } | null> {
  const d = getDb()
  if (!d) return null
  const limit = Math.min(15, Math.max(1, o.limit || 8))
  const kinds = (o.kinds?.length ? o.kinds : [...KINDS]).filter(k => KINDS.includes(k))
  const from = o.fromYear || 0
  const to = o.toYear || 9999
  const iso3 = o.iso3 || null

  // keyword ranking
  const kw: number[] = []
  const fq = ftsQuery(o.query)
  if (fq) {
    const where = [`passages_fts MATCH ?`, `p.kind IN (${kinds.map(() => '?').join(',')})`, 'p.year BETWEEN ? AND ?']
    const params: any[] = [fq, ...kinds, from, to]
    if (iso3) { where.push('p.iso3 = ?'); params.push(iso3) }
    try {
      const rows = d.prepare(`SELECT p.id FROM passages_fts JOIN passages p ON p.id = passages_fts.rowid WHERE ${where.join(' AND ')} ORDER BY bm25(passages_fts, 1.0, 0.4) LIMIT 150`).all(...params) as any[]
      for (const r of rows) kw.push(r.id)
    } catch {}
  }

  // meaning-based ranking
  const sem: number[] = []
  const store = loadVectors(d)
  if (store) {
    const q = await embedQuery(o.query)
    if (q) {
      const kindSet = new Set(kinds.map(k => KINDS.indexOf(k)))
      const isoIdx = iso3 ? store.isoIndex.get(iso3) : undefined
      if (!(iso3 && isoIdx === undefined)) {
        const top: { i: number; s: number }[] = []
        let floor = -Infinity
        const n = store.ids.length
        for (let i = 0; i < n; i++) {
          if (!kindSet.has(store.kind[i]) || store.year[i] < from || store.year[i] > to) continue
          if (isoIdx !== undefined && store.iso[i] !== isoIdx) continue
          let dot = 0
          const off = i * DIMS
          for (let k = 0; k < DIMS; k++) dot += q[k] * store.v[off + k]
          const s = dot * store.scale[i]
          if (top.length < 150 || s > floor) {
            top.push({ i, s })
            if (top.length > 300) { top.sort((a, b) => b.s - a.s); top.length = 150; floor = top[149].s }
          }
        }
        top.sort((a, b) => b.s - a.s)
        for (const t of top.slice(0, 150)) sem.push(store.ids[t.i])
      }
    }
  }

  // reciprocal-rank fusion
  const score = new Map<number, { s: number; how: Set<string> }>()
  const addRanks = (ids: number[], how: string) => ids.forEach((id, r) => {
    const e = score.get(id) || { s: 0, how: new Set<string>() }
    e.s += 1 / (60 + r)
    e.how.add(how)
    score.set(id, e)
  })
  addRanks(kw, 'keywords')
  addRanks(sem, 'meaning')
  const ranked = [...score.entries()].sort((a, b) => b[1].s - a[1].s)
  if (!ranked.length) return { passages: [], method: store ? 'keywords + meaning' : 'keywords', indexed: stats(d) }

  // fetch rows, at most two passages from the same speech or item
  const out: Passage[] = []
  const perSrc = new Map<string, number>()
  const get = d.prepare('SELECT id, kind, src, iso3, year, session, date, speaker, title, url, text FROM passages WHERE id = ?')
  for (const [id, e] of ranked) {
    const r = get.get(id) as any
    if (!r) continue
    const n = perSrc.get(r.src) || 0
    if (n >= 2) continue
    perSrc.set(r.src, n + 1)
    out.push({ id: r.id, kind: r.kind, iso3: r.iso3, year: r.year, session: r.session, date: r.date, speaker: r.speaker, title: r.title, url: r.url, text: r.text, match: [...e.how].join(' + ') })
    if (out.length >= limit) break
  }
  return { passages: out, method: sem.length ? 'keywords + meaning' : 'keywords', indexed: stats(d) }
}

function stats(d: any) {
  const c = JSON.parse((d.prepare("SELECT v FROM meta WHERE k='counts'").get() as any)?.v || '{}')
  const built = JSON.parse((d.prepare("SELECT v FROM meta WHERE k='built_at'").get() as any)?.v || '""')
  return { passages: c.passages || 0, withVectors: c.with_vectors || 0, builtAt: built }
}
