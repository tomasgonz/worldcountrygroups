import { existsSync, readFileSync, writeFileSync, renameSync, statSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { readDataFile } from './data-file'
import { callLLM, isAIConfigured } from './llm-client'
import { getRegistry } from './wcg'

/**
 * "What was said": notable quotes of the day and the week for a section of the site.
 * Quotes are only ever copied verbatim from a source (headlines and summaries in the news
 * archive, Fifth Committee statement texts); the model only chooses among numbered candidates
 * and names the speaker, which must appear in the source. Without AI, the most recent
 * attributed quotes are shown.
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'said.json')
const ARCHIVE = join(DATA_DIR, 'archive.db')

export const SAID_SECTIONS = {
  un: 'UN Monitor',
  budget: 'Budget, dues and reform',
  leadership: 'UN leadership',
} as const
export type SaidSection = keyof typeof SAID_SECTIONS

interface Cand {
  id: number
  quote: string
  context: string
  speakerHint: string | null
  iso3?: string | null
  title: string
  url: string
  outlet: string
  date: string
}
export interface SaidQuote { quote: string; speaker: string; role: string | null; why: string | null; title: string; url: string; outlet: string; date: string; iso3?: string | null }
interface Store { sections: Record<string, Record<string, { hash: string; quotes: SaidQuote[]; updatedAt: string; candidates: number; method: string }>> }

function load(): Store {
  try {
    return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf-8')) : { sections: {} }
  } catch {
    return { sections: {} }
  }
}
function save(s: Store) {
  const text = JSON.stringify(s)
  writeFileSync(FILE + '.tmp', text)
  renameSync(FILE + '.tmp', FILE)
}

let adb: any = null
let adbIno = 0
function archive(): any | null {
  if (!existsSync(ARCHIVE)) return null
  const ino = statSync(ARCHIVE).ino
  if (adb && ino === adbIno) return adb
  try { adb?.close() } catch {}
  const { DatabaseSync } = (process as any).getBuiltinModule('node:sqlite')
  adb = new DatabaseSync(ARCHIVE, { readOnly: true })
  adbIno = ino
  return adb
}

/** Quoted passages of at least four words: ‘…’, “…” or "…" (apostrophes inside words are not quotes). */
export function extractQuotes(text: string): string[] {
  const out: string[] = []
  const re = /(?:^|[\s(—–-])[“‘"]([^“”"]{18,420}?)[”’"](?=[\s,.;:!?)—–-]|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text || ''))) {
    const q = m[1].trim().replace(/[,;:]$/, '')
    if (q.split(/\s+/).length >= 4 && !/^https?:/.test(q)) out.push(q)
  }
  return out
}

const STRONG = /\b(must|cannot|can not|never|urge|urges|unacceptable|regret|deeply|crisis|collapse|liquidity|arrears|reform|cuts?|insist|reject|concern|alarm|fail|survival|trust|credib|accountab|transparen|predictab|burden|unfair|ceiling|capacity to pay|mandates?|people we serve|on time|in full|without conditions|unconditional)\b/i

function statementSentences(text: string): string[] {
  const flat = String(text || '').replace(/\s+/g, ' ')
  const sents = flat.split(/(?<=[.!?])\s+(?=[A-Z“"‘])/)
  return sents.map(s => s.trim()).filter(s => {
    const w = s.split(/\s+/).length
    // complete sentences only: not list fragments ("(a) …; and")
    return w >= 12 && w <= 55 && STRONG.test(s) && /[.!?”"]$/.test(s) && !/\([a-h]\)|;\s*(and|or)?$/i.test(s) &&
      !/^(Mr\.|Madam|Thank you|I thank|Allow me|Let me (begin|start|conclude))/i.test(s)
  })
}

// officials as listed on the Fifth Committee page ("Introductory remarks USG DMSPC", "Presentation of the USG DMSPC on …")
const OFFICIALS: [RegExp, string][] = [
  [/USG DMSPC|Management Strategy/i, 'Under-Secretary-General for Management Strategy, Policy and Compliance'], [/Controller|OPPFB/i, 'UN Controller (Office of Programme Planning, Finance and Budget)'],
  [/Chair IAAC|Independent Audit Advisory/i, 'Chair of the Independent Audit Advisory Committee'], [/USG OIOS|Internal Oversight/i, 'Under-Secretary-General for Internal Oversight Services'],
  [/Committee on Contributions/i, 'Chair of the Committee on Contributions'], [/ACABQ|Advisory Committee on Administrative/i, 'Chair of the Advisory Committee on Administrative and Budgetary Questions (ACABQ)'],
  [/Ethics Office/i, 'Director of the UN Ethics Office'], [/Board of Auditors/i, 'Board of Auditors'], [/UNOP|Office for Partnerships/i, 'Executive Director, UN Office for Partnerships'],
  [/President of the General Assembly/i, 'President of the General Assembly'],
]
function officialName(label: string) {
  for (const [re, name] of OFFICIALS) if (re.test(label)) return name
  return label.replace(/^(Introductory remarks|Presentation of the|Presentation by the|Statement by the)\s+/i, '').replace(/\s+on the .*$/i, '').trim()
}

const sinceIso = (days: number) => new Date(Date.now() - days * 86400_000).toISOString()

function archiveCands(where: string, params: any[], days: number): Omit<Cand, 'id'>[] {
  const db = archive()
  if (!db) return []
  const rows = db.prepare(`SELECT title, summary, url, outlet, published_at AS date, speaker FROM items WHERE published_at >= ? AND (${where}) ORDER BY published_at DESC LIMIT 400`)
    .all(sinceIso(days), ...params) as any[]
  const out: Omit<Cand, 'id'>[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const context = `${r.title}. ${r.summary || ''}`.slice(0, 600)
    for (const q of [...extractQuotes(r.title), ...extractQuotes(r.summary || '')]) {
      const k = q.toLowerCase().slice(0, 80)
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ quote: q, context, speakerHint: r.speaker || null, title: r.title, url: r.url, outlet: r.outlet, date: r.date })
    }
  }
  return out
}

const UN_WHERE = "source LIKE 'un-%' OR url LIKE '%.un.org/%' OR url LIKE 'https://un.org/%' OR outlet LIKE 'UN %' OR outlet LIKE 'United Nations%' OR title LIKE '%Guterres%' OR title LIKE '%Secretary-General%' OR title LIKE '%Security Council%' OR title LIKE '%General Assembly%' OR title LIKE '%UN chief%'"

/** Headline quotes from the leadership and Secretary-General feeds (statements on UN sites). */
function feedCands(days: number, onlyOffices?: (id: string) => boolean): Omit<Cand, 'id'>[] {
  const since = sinceIso(days)
  const out: Omit<Cand, 'id'>[] = []
  const L = readDataFile<any>('un-leadership.json')
  for (const o of L?.offices || []) {
    if (onlyOffices && !onlyOffices(o.id)) continue
    const who = o.holder?.name ? `${o.holder.name} (${o.label})` : o.label
    for (const st of o.statements || []) {
      if (st.date < since) continue
      for (const q of extractQuotes(st.title)) out.push({ quote: q, context: st.title, speakerHint: who, iso3: 'UN', title: st.title, url: st.url, outlet: st.host || 'UN', date: st.date })
    }
  }
  return out
}

function dedupe(list: Omit<Cand, 'id'>[]) {
  const seen = new Set<string>()
  return list.filter(c => { const k = c.quote.toLowerCase().slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true })
}

function candidates(section: SaidSection, days: number): Omit<Cand, 'id'>[] {
  if (section === 'un') return dedupe([...archiveCands(UN_WHERE, [], days), ...feedCands(days, id => ['sg', 'pga', 'ecosoc', 'dsg'].includes(id))])
  if (section === 'budget') {
    const out: Omit<Cand, 'id'>[] = []
    const f = readDataFile<any>('fifth-committee.json')
    const texts = readDataFile<Record<string, string | null>>('fifth-statements.json') || {}
    const since = sinceIso(days).slice(0, 10)
    for (const s of f?.statements || []) {
      if (!s.textKey || !s.date || s.date < since || s.official) continue
      const who = s.onBehalfOf ? `${s.speaker} on behalf of ${s.onBehalfOf}` : (s.iso3 || /European Union/.test(s.speaker) ? s.speaker : officialName(s.speaker))
      const sents = statementSentences(texts[s.textKey] || '').slice(0, 10)
      for (const q of sents) out.push({ quote: q, context: `Fifth Committee, ${s.topic || 'statement'}: statement by ${who}`, speakerHint: who, iso3: s.iso3 || (/European Union/.test(s.speaker) ? 'EU' : null), title: `${who}: ${s.topic || 'Fifth Committee statement'}`, url: s.url, outlet: 'Fifth Committee statement', date: `${s.date}T12:00:00Z` })
    }
    // officials' introductions (Controller, ACABQ, OIOS) are often the most informative on figures
    for (const s of f?.statements || []) {
      if (!s.textKey || !s.date || s.date < since || !s.official) continue
      const who = officialName(s.speaker)
      for (const q of statementSentences(texts[s.textKey] || '').slice(0, 5)) out.push({ quote: q, context: `Fifth Committee, ${s.topic || 'statement'}: ${who}`, speakerHint: who, iso3: 'UN', title: `${who}: ${s.topic || 'Fifth Committee'}`, url: s.url, outlet: 'Fifth Committee statement', date: `${s.date}T12:00:00Z` })
    }
    out.push(...archiveCands("(title LIKE '%budget%' OR title LIKE '%liquidity%' OR title LIKE '%arrears%' OR title LIKE '%dues%' OR title LIKE '%UN80%' OR title LIKE '%Fifth Committee%' OR summary LIKE '%Fifth Committee%' OR summary LIKE '%liquidity crisis%' OR summary LIKE '%UN80%') AND (" + UN_WHERE + ")", [], days))
    return out
  }
  // leadership: items naming a tracked office or its holder
  const L = readDataFile<any>('un-leadership.json')
  const terms: string[] = []
  for (const o of L?.offices || []) {
    if (o.id === 'sg') continue
    const sn = o.holder?.name?.split(/\s+/).pop()
    if (sn && sn.length > 3) terms.push(sn)
    for (const t of o.terms || []) if (t.length > 8) terms.push(t)
  }
  if (!terms.length) return dedupe(feedCands(days, id => id !== 'sg'))
  const where = terms.slice(0, 60).map(() => '(title LIKE ? OR summary LIKE ?)').join(' OR ')
  return dedupe([...feedCands(days, id => id !== 'sg'), ...archiveCands(`(${where}) AND (${UN_WHERE} OR url LIKE '%unicef.org%' OR url LIKE '%unhcr.org%' OR url LIKE '%wfp.org%' OR url LIKE '%undp.org%' OR url LIKE '%ohchr.org%')`, terms.slice(0, 60).flatMap(t => [`%${t}%`, `%${t}%`]), days)])
}

function fold(s: string) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }

async function pick(section: SaidSection, window: 'today' | 'week', cands: Cand[], max: number): Promise<{ quotes: SaidQuote[]; method: string }> {
  const asQuote = (c: Cand, speaker: string, role: string | null, why: string | null): SaidQuote => ({ quote: c.quote, speaker, role, why, title: c.title, url: c.url, outlet: c.outlet, date: c.date, iso3: c.iso3 ?? null })
  if (!cands.length) return { quotes: [], method: 'none' }
  if (!isAIConfigured()) {
    const quotes = cands.filter(c => c.speakerHint && c.quote.split(/\s+/).length >= 8).slice(0, max).map(c => asQuote(c, c.speakerHint!, null, null))
    return { quotes, method: 'recent' }
  }
  const list = cands.map(c => `[${c.id}] QUOTE: "${c.quote}"\n    SOURCE (${c.outlet}, ${c.date.slice(0, 10)}): ${c.context}${c.speakerHint ? `\n    SPEAKER: ${c.speakerHint}` : ''}`).join('\n')
  const sys = `You pick the most notable quotes for a "What was said ${window === 'today' ? 'today' : 'this week'}" panel on a site for diplomats and analysts following the United Nations (${SAID_SECTIONS[section]}).
Choose up to ${max} quotes that are substantive and revealing: positions, warnings, demands, figures, sharp disagreements. Prefer variety of speakers and topics: at most two quotes from the same speaker. Skip platitudes, procedural lines, and quotes whose speaker cannot be identified from the SOURCE or SPEAKER line.
Never edit a quote: you only return its number. Name the speaker exactly as the source does (person and/or country or group), and their role if the source gives it.
Answer with JSON only: [{"id": 12, "speaker": "Volker Türk", "role": "UN High Commissioner for Human Rights", "why": "under 15 words on why it matters"}]`
  let raw = ''
  try {
    raw = await callLLM([{ role: 'system', content: sys }, { role: 'user', content: list }], { task: 'said', maxTokens: 1500, temperature: 0.2 })
  } catch {
    const quotes = cands.filter(c => c.speakerHint).slice(0, max).map(c => asQuote(c, c.speakerHint!, null, null))
    return { quotes, method: 'recent (AI unavailable)' }
  }
  let arr: any[] = []
  try { arr = JSON.parse((raw.match(/\[[\s\S]*\]/) || ['[]'])[0]) } catch { arr = [] }
  const byId = new Map(cands.map(c => [c.id, c]))
  const quotes: SaidQuote[] = []
  for (const x of arr) {
    const c = byId.get(Number(x?.id))
    const speaker = String(x?.speaker || c?.speakerHint || '').trim()
    if (!c || !speaker) continue
    // the speaker must be named in the source text or speaker line
    const hay = fold(`${c.context} ${c.speakerHint || ''} ${c.title}`)
    const tokens = fold(speaker).split(/[^a-z]+/).filter(t => t.length >= 4)
    if (tokens.length && !tokens.some(t => hay.includes(t))) continue
    if (quotes.some(q => q.quote === c.quote)) continue
    if (quotes.filter(q => fold(q.speaker) === fold(speaker)).length >= 2) continue // variety: two per speaker at most
    let role = x?.role ? String(x.role).slice(0, 120) : null
    if (role && (fold(speaker).includes(fold(role)) || fold(role).includes(fold(speaker)))) role = null
    quotes.push(asQuote(c, speaker, role, x?.why ? String(x.why).slice(0, 140) : null))
    if (quotes.length >= max) break
  }
  return { quotes, method: 'ai' }
}

/** Refresh every section (called every 3 hours); the model is only asked when the candidates have changed. */
export async function runSaid(o: { force?: boolean } = {}): Promise<Record<string, any>> {
  if (!existsSync(REPO)) syncRepository()
  const store = load()
  const report: Record<string, any> = {}
  for (const section of Object.keys(SAID_SECTIONS) as SaidSection[]) {
    store.sections[section] ||= {}
    for (const [window, days, max] of [['today', 1, 6], ['week', 7, 8]] as const) {
      const raw = candidates(section, days)
      const cands: Cand[] = raw.slice(0, 160).map((c, i) => ({ ...c, id: i + 1 }))
      const hash = createHash('sha1').update(cands.map(c => c.quote).sort().join('|')).digest('hex').slice(0, 16)
      const prev = store.sections[section][window]
      if (!o.force && prev && prev.hash === hash && prev.quotes.length) { report[`${section}/${window}`] = 'unchanged'; continue }
      const r = await pick(section, window, cands, max)
      store.sections[section][window] = { hash, quotes: r.quotes, updatedAt: new Date().toISOString(), candidates: cands.length, method: r.method }
      addToRepository(section, r.quotes)
      report[`${section}/${window}`] = `${r.quotes.length} of ${cands.length} (${r.method})`
      save(store)
    }
  }
  return report
}

export function getSaid(section: string) {
  const s = load().sections[section]
  if (!s) return null
  return { today: s.today || null, week: s.week || null }
}

// ---------------------------------------------------------------- quote repository
// Picked quotes are kept for good in quotes-said.json, in the same shape as the General Debate
// repository (quotes-index.json, which is rebuilt from the speeches), and searched together with it.
const REPO = join(DATA_DIR, 'quotes-said.json')
const UN_ROLE = /\b(Guterres|Secretary-General|Under-Secretary|High Commissioner|High Representative|Executive Director|Administrator|Emergency Relief|Spokesperson|President of the (General Assembly|Economic and Social Council)|UN chief|UN rights chief|UN refugee chief|Controller|Chair of the|Committee on Contributions|Board of Auditors|UNICEF|UNHCR|WFP|UNDP|OCHA|UNFPA|UN Women|UNEP|UNRWA|Special (Envoy|Representative|Rapporteur|Adviser)|United Nations)\b/i
const THEME: Record<string, string[]> = { budget: ['reform_un'], un: [], leadership: [] }

function countryOf(q: SaidQuote): { iso3: string; iso2: string; country: string } {
  const reg = getRegistry()
  if (q.iso3 && q.iso3 !== 'UN') {
    if (q.iso3 === 'EU') return { iso3: 'EU', iso2: 'EU', country: 'European Union' }
    const m: any = reg.getCountryMembership(q.iso3)
    return { iso3: q.iso3, iso2: m?.iso2 || '', country: m?.name || q.iso3 }
  }
  if (q.iso3 === 'UN' || UN_ROLE.test(`${q.speaker} ${q.role || ''}`)) return { iso3: 'UN', iso2: '', country: 'United Nations' }
  // a country named in the speaker line ("Pakistan", "Uruguay on behalf of …")
  const hay = q.speaker
  // the first country named ("Australia on behalf of Canada, Australia and New Zealand" → Australia)
  let best: any = null
  let bestAt = Infinity
  for (const c of reg.getAllCountries() as any[]) {
    if (!c.iso3 || !c.name) continue
    const m = new RegExp(`(^|[^A-Za-z])${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`).exec(hay)
    if (m && (m.index < bestAt || (m.index === bestAt && c.name.length > best.name.length))) { best = c; bestAt = m.index }
  }
  return best ? { iso3: best.iso3, iso2: best.iso2 || '', country: best.name } : { iso3: '', iso2: '', country: '' }
}

function levelOf(q: SaidQuote, iso3: string) {
  if (iso3 === 'UN') return 'UN official'
  if (/on behalf of/i.test(q.speaker)) return 'Group of countries'
  return iso3 ? 'Delegation' : ''
}

function gaSession(d: string) {
  const dt = new Date(d)
  return dt.getUTCFullYear() - 1945 - ((dt.getUTCMonth() + 1) * 100 + dt.getUTCDate() < 909 ? 1 : 0)
}

function loadRepo(): { _meta: any; quotes: any[] } {
  try {
    return existsSync(REPO) ? JSON.parse(readFileSync(REPO, 'utf-8')) : { _meta: {}, quotes: [] }
  } catch {
    return { _meta: {}, quotes: [] }
  }
}

/** UN officials by name and office, from the leadership page ("Guterres" → "António Guterres", Secretary-General). */
function normaliseOfficial(q: SaidQuote): SaidQuote {
  const L = readDataFile<any>('un-leadership.json')
  const who = fold(`${q.speaker} ${q.role || ''}`)
  for (const o of L?.offices || []) {
    const name: string | undefined = o.holder?.name
    if (!name) continue
    const sn = fold(name.split(/\s+/).pop() || '')
    const byName = sn.length > 3 && new RegExp(`\\b${sn}\\b`).test(who)
    const byOffice = fold(q.speaker) === fold(o.label) || (o.label.length > 25 && who.includes(fold(o.label)))
    if (byName || byOffice) {
      const people = readDataFile<any>('people-index.json')?.people || []
      const p = people.find((x: any) => fold(x.name).endsWith(sn))
      return { ...q, speaker: p?.name || name, role: o.label, iso3: 'UN' }
    }
  }
  return q
}

function addToRepository(section: SaidSection, quotes: SaidQuote[]) {
  quotes = quotes.map(normaliseOfficial)
  if (!quotes.length) return
  const repo = loadRepo()
  const have = new Set(repo.quotes.map((x: any) => x.q.toLowerCase().slice(0, 120)))
  let added = 0
  for (const q of quotes) {
    const k = q.quote.toLowerCase().slice(0, 120)
    if (have.has(k)) continue
    have.add(k)
    const c = countryOf(q)
    const date = (q.date || new Date().toISOString()).slice(0, 10)
    repo.quotes.push({
      id: `said-${createHash('sha1').update(q.quote + q.url).digest('hex').slice(0, 12)}`, q: q.quote,
      iso3: c.iso3, iso2: c.iso2, country: c.country, session: gaSession(date), year: Number(date.slice(0, 4)), date,
      speaker: q.speaker, title: q.role || '', level: levelOf(q, c.iso3), themes: THEME[section] || [], tone: '',
      status: 'exact', url: q.url, source: 'statements', sourceLabel: q.outlet, context: q.why || null, section, addedAt: new Date().toISOString(),
    })
    added++
  }
  if (!added) return
  repo._meta = { generated: new Date().toISOString(), total: repo.quotes.length, source: 'Quotes picked for "What was said": copied verbatim from statements, UN press releases and news headlines' }
  const text = JSON.stringify(repo)
  writeFileSync(REPO + '.tmp', text)
  renameSync(REPO + '.tmp', REPO)
}

/** Backfill: add every quote currently shown in the panels (used once when the repository is created). */
export function syncRepository() {
  const store = load()
  for (const [section, wins] of Object.entries(store.sections)) for (const w of Object.values(wins)) addToRepository(section as SaidSection, w.quotes)
  return loadRepo().quotes.length
}

export function saidUpdatedAt(): string | null {
  let latest: string | null = null
  for (const wins of Object.values(load().sections)) for (const w of Object.values(wins)) if (!latest || w.updatedAt > latest) latest = w.updatedAt
  return latest
}
