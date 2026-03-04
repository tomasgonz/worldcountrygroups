import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const INDEX_FILE = join(process.cwd(), 'server', 'data', 'un-speeches-index.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const INDEX_FILE_ALT = join(ALT_DIR, 'un-speeches-index.json')

const SPEECHES_DIR = join(process.cwd(), 'server', 'data', 'speeches')
const SPEECHES_DIR_ALT = join(ALT_DIR, 'speeches')

export interface SpeechAnalysis {
  summary: string
  themes: { name: string; relevance: 'high' | 'medium' | 'low' }[]
  sentiment: {
    overall: 'positive' | 'negative' | 'neutral' | 'mixed'
    tone_descriptors: string[]
    criticism_targets: string[]
  }
  mentioned_countries: { iso3: string; context: string }[]
  mentioned_conflicts: { name: string; stance: string }[]
  policy_positions: { topic: string; position: string }[]
  alliances_mentioned: { entity: string; sentiment: 'positive' | 'neutral' | 'negative' }[]
  key_quotes: string[]
  language_detected: string
  _model?: string
  _analyzed_at?: string
}

export interface SpeechMeta {
  iso3: string
  iso2: string
  session: number
  year: number
  speaker: string
  speaker_title: string
  date: string
  word_count: number
  keywords: string[]
  file: string
  analysis?: SpeechAnalysis
}

interface SpeechesIndex {
  _meta: {
    updated_at: string
    source: string
    total_speeches: number
    sessions: number[]
    country_count: number
  }
  speeches: SpeechMeta[]
}

let _data: SpeechesIndex | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(INDEX_FILE, INDEX_FILE_ALT)
  if (!filePath) {
    _data = { _meta: { updated_at: '', source: '', total_speeches: 0, sessions: [], country_count: 0 }, speeches: [] }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { _meta: { updated_at: '', source: '', total_speeches: 0, sessions: [], country_count: 0 }, speeches: [] }
  }
}

export function reloadSpeeches(): void {
  _data = null
  ensureLoaded()
}

export function getSpeechesMeta() {
  ensureLoaded()
  return _data!._meta
}

export function getAllSpeeches(): SpeechMeta[] {
  ensureLoaded()
  return _data!.speeches
}

export function getCountrySpeeches(iso3: string): SpeechMeta[] {
  ensureLoaded()
  const code = iso3.toUpperCase()
  return _data!.speeches
    .filter(s => s.iso3 === code)
    .sort((a, b) => b.year - a.year || b.session - a.session)
}

export function getSpeechText(iso3: string, session: number): string | null {
  ensureLoaded()
  const code = iso3.toUpperCase()
  const meta = _data!.speeches.find(s => s.iso3 === code && s.session === session)
  if (!meta) return null

  const dir = resolve(SPEECHES_DIR, SPEECHES_DIR_ALT)
  if (!dir) return null

  // dir here is actually the resolved path of the directory itself
  const speechDir = existsSync(SPEECHES_DIR) ? SPEECHES_DIR : SPEECHES_DIR_ALT
  const filePath = join(speechDir, meta.file)
  if (!existsSync(filePath)) return null

  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

export function getTopKeywords(session?: number): { keyword: string; count: number }[] {
  ensureLoaded()
  const counts = new Map<string, number>()

  const speeches = session != null
    ? _data!.speeches.filter(s => s.session === session)
    : _data!.speeches

  for (const s of speeches) {
    for (const kw of s.keywords) {
      counts.set(kw, (counts.get(kw) || 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
}

// --- Analysis aggregation ---

export function getThemeAggregation(session?: number): { theme: string; count: number; high: number; medium: number; low: number }[] {
  ensureLoaded()
  const themes = new Map<string, { count: number; high: number; medium: number; low: number }>()

  const speeches = session != null
    ? _data!.speeches.filter(s => s.session === session)
    : _data!.speeches

  for (const s of speeches) {
    if (!s.analysis?.themes) continue
    for (const t of s.analysis.themes) {
      const entry = themes.get(t.name) || { count: 0, high: 0, medium: 0, low: 0 }
      entry.count++
      if (t.relevance === 'high') entry.high++
      else if (t.relevance === 'medium') entry.medium++
      else entry.low++
      themes.set(t.name, entry)
    }
  }

  return [...themes.entries()]
    .map(([theme, stats]) => ({ theme, ...stats }))
    .sort((a, b) => b.count - a.count)
}

export function getConflictMentions(session?: number): { conflict: string; mentions: number; stances: { iso3: string; stance: string }[] }[] {
  ensureLoaded()
  const conflicts = new Map<string, { mentions: number; stances: { iso3: string; stance: string }[] }>()

  const speeches = session != null
    ? _data!.speeches.filter(s => s.session === session)
    : _data!.speeches

  for (const s of speeches) {
    if (!s.analysis?.mentioned_conflicts) continue
    for (const c of s.analysis.mentioned_conflicts) {
      const entry = conflicts.get(c.name) || { mentions: 0, stances: [] }
      entry.mentions++
      entry.stances.push({ iso3: s.iso3, stance: c.stance })
      conflicts.set(c.name, entry)
    }
  }

  return [...conflicts.entries()]
    .map(([conflict, data]) => ({ conflict, ...data }))
    .sort((a, b) => b.mentions - a.mentions)
}

export function getSentimentDistribution(session?: number): { positive: number; negative: number; neutral: number; mixed: number } {
  ensureLoaded()
  const dist = { positive: 0, negative: 0, neutral: 0, mixed: 0 }

  const speeches = session != null
    ? _data!.speeches.filter(s => s.session === session)
    : _data!.speeches

  for (const s of speeches) {
    if (!s.analysis?.sentiment?.overall) continue
    const key = s.analysis.sentiment.overall as keyof typeof dist
    if (key in dist) dist[key]++
  }

  return dist
}

// --- Keyword extraction ---

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'been', 'were', 'will',
  'would', 'could', 'should', 'which', 'their', 'there', 'they', 'them', 'than',
  'what', 'when', 'where', 'while', 'also', 'more', 'most', 'must', 'only',
  'other', 'some', 'such', 'very', 'just', 'over', 'into', 'about', 'after',
  'before', 'between', 'each', 'every', 'both', 'through', 'during', 'under',
  'above', 'below', 'same', 'well', 'these', 'those', 'being', 'does', 'done',
  'doing', 'like', 'make', 'made', 'many', 'much', 'need', 'even', 'back',
  'take', 'come', 'came', 'give', 'gave', 'good', 'great', 'long', 'still',
  'first', 'last', 'never', 'then', 'here', 'part', 'upon', 'own', 'shall',
  'your', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out',
  'are', 'but', 'not', 'you', 'say', 'she', 'his', 'how', 'its', 'let',
  'may', 'nor', 'who', 'why', 'did', 'get', 'got', 'has', 'him', 'yet',
  'now', 'old', 'see', 'way', 'too', 'use', 'for', 'new', 'per',
  // Speech-specific common words
  'president', 'assembly', 'general', 'united', 'nations', 'session',
  'country', 'countries', 'people', 'world', 'international', 'national',
  'government', 'state', 'states', 'year', 'years', 'today', 'time',
  'continue', 'continued', 'efforts', 'work', 'important', 'ensure',
  'order', 'region', 'global', 'support', 'including', 'development',
  'community', 'challenges', 'since', 'among', 'commitment', 'future',
  'together', 'towards', 'call', 'called', 'calls', 'face', 'recent',
  'right', 'rights', 'achieve', 'address', 'agenda', 'behalf', 'believe',
  'common', 'full', 'further', 'hand', 'number', 'necessary', 'regard',
  'role', 'situation', 'within', 'note', 'without', 'already', 'clear',
  'respect', 'seek', 'remain', 'must', 'however', 'particular', 'basis',
  'member', 'recognize', 'thank', 'express', 'organization', 'fellow',
  'opportunity', 'platform', 'statement', 'delegation', 'excellency',
  'madam', 'mister', 'distinguished', 'colleagues', 'ladies', 'gentlemen',
])

// --- Intelligence cross-referencing ---

export function getCountryCrossReferences(iso3A: string, iso3B: string): {
  aMentionsB: { session: number; year: number; context: string; sentiment: string }[]
  bMentionsA: { session: number; year: number; context: string; sentiment: string }[]
  sharedThemes: { theme: string; countA: number; countB: number }[]
} {
  ensureLoaded()
  const codeA = iso3A.toUpperCase()
  const codeB = iso3B.toUpperCase()

  const speechesA = _data!.speeches.filter(s => s.iso3 === codeA && s.analysis)
  const speechesB = _data!.speeches.filter(s => s.iso3 === codeB && s.analysis)

  // A mentions B
  const aMentionsB: { session: number; year: number; context: string; sentiment: string }[] = []
  for (const s of speechesA) {
    if (!s.analysis?.mentioned_countries) continue
    for (const mc of s.analysis.mentioned_countries) {
      if (mc.iso3.toUpperCase() === codeB) {
        const alliance = s.analysis.alliances_mentioned?.find(a => a.entity.toUpperCase().includes(codeB))
        aMentionsB.push({
          session: s.session,
          year: s.year,
          context: mc.context,
          sentiment: alliance?.sentiment || 'neutral',
        })
      }
    }
  }

  // B mentions A
  const bMentionsA: { session: number; year: number; context: string; sentiment: string }[] = []
  for (const s of speechesB) {
    if (!s.analysis?.mentioned_countries) continue
    for (const mc of s.analysis.mentioned_countries) {
      if (mc.iso3.toUpperCase() === codeA) {
        const alliance = s.analysis.alliances_mentioned?.find(a => a.entity.toUpperCase().includes(codeA))
        bMentionsA.push({
          session: s.session,
          year: s.year,
          context: mc.context,
          sentiment: alliance?.sentiment || 'neutral',
        })
      }
    }
  }

  // Shared themes
  const themesA = new Map<string, number>()
  const themesB = new Map<string, number>()
  for (const s of speechesA) {
    if (!s.analysis?.themes) continue
    for (const t of s.analysis.themes) {
      themesA.set(t.name, (themesA.get(t.name) || 0) + 1)
    }
  }
  for (const s of speechesB) {
    if (!s.analysis?.themes) continue
    for (const t of s.analysis.themes) {
      themesB.set(t.name, (themesB.get(t.name) || 0) + 1)
    }
  }

  const sharedThemes: { theme: string; countA: number; countB: number }[] = []
  for (const [theme, countA] of themesA) {
    const countB = themesB.get(theme)
    if (countB) {
      sharedThemes.push({ theme, countA, countB })
    }
  }
  sharedThemes.sort((a, b) => (b.countA + b.countB) - (a.countA + a.countB))

  return { aMentionsB, bMentionsA, sharedThemes }
}

export function getGroupSentimentBySession(iso3Codes: string[]): {
  session: number; year: number; positive: number; negative: number; neutral: number; mixed: number; speechCount: number
}[] {
  ensureLoaded()
  const codes = new Set(iso3Codes.map(c => c.toUpperCase()))
  const buckets = new Map<number, { year: number; positive: number; negative: number; neutral: number; mixed: number; speechCount: number }>()

  for (const s of _data!.speeches) {
    if (!codes.has(s.iso3) || !s.analysis?.sentiment?.overall) continue
    let bucket = buckets.get(s.session)
    if (!bucket) {
      bucket = { year: s.year, positive: 0, negative: 0, neutral: 0, mixed: 0, speechCount: 0 }
      buckets.set(s.session, bucket)
    }
    bucket.speechCount++
    const key = s.analysis.sentiment.overall as 'positive' | 'negative' | 'neutral' | 'mixed'
    if (key in bucket) bucket[key]++
  }

  return [...buckets.entries()]
    .map(([session, data]) => ({ session, ...data }))
    .sort((a, b) => a.session - b.session)
}

export function getGroupEmergingTopics(iso3Codes: string[], recentSessionCount = 3): {
  recent: { theme: string; count: number }[]
  historical: { theme: string; count: number }[]
  newInRecent: string[]
} {
  ensureLoaded()
  const codes = new Set(iso3Codes.map(c => c.toUpperCase()))
  const memberSpeeches = _data!.speeches.filter(s => codes.has(s.iso3) && s.analysis?.themes)

  // Find session cutoff
  const sessions = [...new Set(memberSpeeches.map(s => s.session))].sort((a, b) => b - a)
  const recentCutoff = sessions[Math.min(recentSessionCount, sessions.length) - 1] || 0

  const recentThemes = new Map<string, number>()
  const historicalThemes = new Map<string, number>()

  for (const s of memberSpeeches) {
    const map = s.session >= recentCutoff ? recentThemes : historicalThemes
    for (const t of s.analysis!.themes) {
      map.set(t.name, (map.get(t.name) || 0) + 1)
    }
  }

  const recent = [...recentThemes.entries()].map(([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count)
  const historical = [...historicalThemes.entries()].map(([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count)
  const historicalSet = new Set(historicalThemes.keys())
  const newInRecent = recent.filter(t => !historicalSet.has(t.theme)).map(t => t.theme)

  return { recent, historical, newInRecent }
}

export function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase()
  const words = lower.split(/[^a-z]+/).filter(w => w.length >= 4 && !STOPWORDS.has(w))

  // Unigram counts
  const unigrams = new Map<string, number>()
  for (const w of words) {
    unigrams.set(w, (unigrams.get(w) || 0) + 1)
  }

  // Bigram counts
  const bigrams = new Map<string, number>()
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1)
  }

  // Merge: keep bigrams that appear 3+ times
  const merged = new Map<string, number>()
  for (const [bg, count] of bigrams) {
    if (count >= 3) {
      merged.set(bg, count)
    }
  }
  // Add unigrams that aren't subsumed by strong bigrams
  const bigramWords = new Set<string>()
  for (const [bg, count] of merged) {
    if (count >= 5) {
      for (const w of bg.split(' ')) bigramWords.add(w)
    }
  }
  for (const [word, count] of unigrams) {
    if (count >= 3 && !bigramWords.has(word)) {
      merged.set(word, count)
    }
  }

  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([kw]) => kw)
}
