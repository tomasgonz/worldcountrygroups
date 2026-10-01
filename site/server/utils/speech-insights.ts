import { getAllSpeeches, getSpeechesMeta, type SpeechMeta } from '~/server/utils/speeches'
import { getRegistry } from '~/server/utils/wcg'

/**
 * Session-level analysis of the General Debate: what was said, by whom, about whom,
 * and how it changed from the previous session. Built from the per-speech AI analyses.
 */

// Free-text conflict names from the AI analysis -> canonical crisis
const CONFLICTS: { name: string; re: RegExp }[] = [
  { name: 'Israel–Palestine / Gaza', re: /gaza|palestin|israel(i)?-palest|west bank/i },
  { name: 'Russia–Ukraine', re: /ukrain/i },
  { name: 'Sudan', re: /(^|\W)sudan(?!.*south)|sudanese|darfur|el fasher/i },
  { name: 'Wider Middle East', re: /middle east|gulf|hormuz|regional escalation/i },
  { name: 'Iran', re: /iran/i },
  { name: 'Syria', re: /syria/i },
  { name: 'Lebanon', re: /leban/i },
  { name: 'Yemen / Red Sea', re: /yemen|red sea|houthi/i },
  { name: 'DR Congo', re: /congo|drc|great lakes|rwanda/i },
  { name: 'Haiti', re: /haiti/i },
  { name: 'Sahel', re: /sahel|mali|burkina|niger(?!ia)/i },
  { name: 'Libya', re: /liby/i },
  { name: 'Myanmar', re: /myanmar|rohingya|burma/i },
  { name: 'Afghanistan', re: /afghan/i },
  { name: 'Western Sahara', re: /western sahara|sahraw/i },
  { name: 'Taiwan Strait', re: /taiwan/i },
  { name: 'Korean Peninsula', re: /korea|dprk/i },
  { name: 'Armenia–Azerbaijan', re: /armenia|azerbaijan|karabakh/i },
  { name: 'India–Pakistan / Kashmir', re: /kashmir|india-pakistan|pakistan-india/i },
  { name: 'Somalia', re: /somali/i },
  { name: 'South Sudan', re: /south sudan/i },
  { name: 'Ethiopia', re: /ethiopia|tigray|amhara/i },
  { name: 'Cyprus', re: /cyprus/i },
  { name: 'Venezuela', re: /venezuela/i },
  { name: 'Kosovo–Serbia', re: /kosovo/i },
]

const CONTEXT_BUCKET: Record<string, 'partner' | 'concern' | 'criticism' | 'neutral'> = {
  ally: 'partner', partnership: 'partner', support: 'partner', solidarity: 'partner', positive: 'partner',
  aid: 'partner', 'humanitarian assistance': 'partner', reconstruction: 'partner', 'support for peace': 'partner',
  concern: 'concern', 'historical concern': 'concern',
  criticism: 'criticism',
}

const REGIONS = [
  { gid: 'ag', label: 'Africa' },
  { gid: 'ap', label: 'Asia-Pacific' },
  { gid: 'eeg', label: 'Eastern Europe' },
  { gid: 'grulac', label: 'Latin America & Caribbean' },
  { gid: 'weog', label: 'Western Europe & Others' },
]

function speakerLevel(title: string): string {
  const t = (title || '').toLowerCase()
  if (!t) return 'Not recorded'
  if (/vice|deputy/.test(t)) return 'Vice-President / Deputy'
  if (/minister/.test(t) && !/prime minister|president of the council of ministers/.test(t)) return 'Minister'
  if (/^president|constitutional president|head of state|king|queen|emir|sultan|crown prince|prince|chairman of the presidency|captain/.test(t)) return 'Head of State'
  if (/prime minister|head of government|chancellor|taoiseach|president of the council of ministers|premier/.test(t)) return 'Head of Government'
  if (/permanent representative|ambassador|chair of the delegation/.test(t)) return 'Ambassador'
  return 'Other'
}

function tone(s: SpeechMeta): 'positive' | 'mixed' | 'neutral' | 'negative' {
  const o = (s.analysis?.sentiment?.overall || '').toLowerCase()
  if (o === 'positive') return 'positive'
  if (o === 'negative' || o === 'critical') return 'negative'
  if (o === 'neutral') return 'neutral'
  return 'mixed'
}

const salient = (s: SpeechMeta) => new Set((s.analysis?.themes || []).filter(t => t.relevance !== 'low').map(t => t.name))
const highThemes = (s: SpeechMeta) => new Set((s.analysis?.themes || []).filter(t => t.relevance === 'high').map(t => t.name))

function conflictsOf(s: SpeechMeta): Set<string> {
  const out = new Set<string>()
  for (const c of s.analysis?.mentioned_conflicts || []) {
    for (const k of CONFLICTS) if (k.re.test(c.name)) { out.add(k.name); break }
  }
  return out
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0)

const _cache = new Map<number, { at: number; value: any }>()

export function getSessionInsights(sessionArg?: number) {
  const meta = getSpeechesMeta()
  const latest = Math.max(...(meta?.sessions || [0]))
  const session = sessionArg ?? latest
  const hit = _cache.get(session)
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.value

  const registry = getRegistry()
  const EXTRA_NAMES: Record<string, string> = { VAT: 'Holy See', PSE: 'State of Palestine', EUU: 'European Union' }
  const nameOf = (iso3: string) => registry.getCountryMembership(iso3)?.name || EXTRA_NAMES[iso3] || iso3
  const iso2Of = (iso3: string) => registry.getCountryMembership(iso3)?.iso2 || ''

  const all = getAllSpeeches()
  const cur = all.filter(s => s.session === session && s.analysis)
  const prev = all.filter(s => s.session === session - 1 && s.analysis)
  const n = cur.length
  const pn = prev.length

  // ---- overview ----
  const words = cur.map(s => s.word_count || 0).sort((a, b) => a - b)
  const levels = new Map<string, number>()
  for (const s of cur) levels.set(speakerLevel(s.speaker_title), (levels.get(speakerLevel(s.speaker_title)) || 0) + 1)
  const levelOrder = ['Head of State', 'Head of Government', 'Vice-President / Deputy', 'Minister', 'Ambassador', 'Other', 'Not recorded']
  const toneCount = (list: SpeechMeta[]) => {
    const c = { positive: 0, mixed: 0, neutral: 0, negative: 0 }
    for (const s of list) c[tone(s)]++
    return c
  }
  const leaders = (levels.get('Head of State') || 0) + (levels.get('Head of Government') || 0)
  const prevLevels = prev.filter(s => s.speaker_title).map(s => speakerLevel(s.speaker_title))
  const prevLeaders = prevLevels.filter(l => l === 'Head of State' || l === 'Head of Government').length

  const overview = {
    speeches: n,
    prevSpeeches: pn,
    medianWords: words.length ? words[Math.floor(words.length / 2)] : 0,
    prevMedianWords: (() => { const w = prev.map(s => s.word_count || 0).sort((a, b) => a - b); return w.length ? w[Math.floor(w.length / 2)] : 0 })(),
    leaderShare: pct(leaders, n),
    prevLeaderShare: prevLevels.length ? pct(prevLeaders, prevLevels.length) : null,
    tone: toneCount(cur),
    prevTone: toneCount(prev),
    speakerLevels: levelOrder.filter(l => levels.get(l)).map(l => ({ level: l, count: levels.get(l)! })),
    dates: (() => { const d = cur.map(s => s.date).filter(Boolean).sort(); return d.length ? { first: d[0], last: d[d.length - 1] } : null })(),
  }

  // ---- themes: share of speeches where the theme is high or medium relevance ----
  const themeCount = (list: SpeechMeta[], fn: (s: SpeechMeta) => Set<string>) => {
    const m = new Map<string, number>()
    for (const s of list) for (const t of fn(s)) m.set(t, (m.get(t) || 0) + 1)
    return m
  }
  const curSal = themeCount(cur, salient)
  const curHigh = themeCount(cur, highThemes)
  const prevSal = themeCount(prev, salient)
  const themes = [...new Set([...curSal.keys(), ...prevSal.keys()])]
    .map(t => ({
      theme: t,
      share: pct(curSal.get(t) || 0, n),
      highShare: pct(curHigh.get(t) || 0, n),
      prevShare: pn ? pct(prevSal.get(t) || 0, pn) : null,
      count: curSal.get(t) || 0,
    }))
    .map(t => ({ ...t, delta: t.prevShare == null ? null : Math.round((t.share - t.prevShare) * 10) / 10 }))
    .filter(t => t.share >= 2 || (t.prevShare ?? 0) >= 2)
    .sort((a, b) => b.share - a.share)

  const movers = themes
    .filter(t => t.delta != null && (t.share >= 8 || (t.prevShare ?? 0) >= 8))
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
    .slice(0, 10)
    .sort((a, b) => b.delta! - a.delta!)

  // ---- who talked about whom ----
  const mentionStats = (list: SpeechMeta[]) => {
    const m = new Map<string, { partner: number; concern: number; criticism: number; neutral: number; speakers: Set<string> }>()
    for (const s of list) {
      const seen = new Set<string>()
      for (const c of s.analysis?.mentioned_countries || []) {
        const iso = (c.iso3 || '').toUpperCase()
        if (!iso || iso === s.iso3 || seen.has(iso)) continue
        seen.add(iso)
        const e = m.get(iso) || { partner: 0, concern: 0, criticism: 0, neutral: 0, speakers: new Set<string>() }
        e[CONTEXT_BUCKET[(c.context || '').toLowerCase()] || 'neutral']++
        e.speakers.add(s.iso3)
        m.set(iso, e)
      }
    }
    return m
  }
  const curMentions = mentionStats(cur)
  const prevMentions = mentionStats(prev)
  const mentioned = [...curMentions.entries()]
    .map(([iso3, e]) => ({
      iso3, iso2: iso2Of(iso3), name: nameOf(iso3),
      total: e.speakers.size, partner: e.partner, concern: e.concern, criticism: e.criticism, neutral: e.neutral,
      prevTotal: prevMentions.get(iso3)?.speakers.size ?? 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 16)

  // ---- conflicts ----
  const conflictCount = (list: SpeechMeta[]) => {
    const m = new Map<string, number>()
    for (const s of list) for (const c of conflictsOf(s)) m.set(c, (m.get(c) || 0) + 1)
    return m
  }
  const curC = conflictCount(cur)
  const prevC = conflictCount(prev)
  const conflicts = [...new Set([...curC.keys(), ...prevC.keys()])]
    .map(c => ({ name: c, share: pct(curC.get(c) || 0, n), count: curC.get(c) || 0, prevShare: pn ? pct(prevC.get(c) || 0, pn) : null }))
    .filter(c => c.count >= 2 || (c.prevShare ?? 0) >= 2)
    .sort((a, b) => b.share - a.share)
    .slice(0, 14)

  // ---- regions: tone mix and theme focus ----
  const regionMembers = REGIONS.map((r) => {
    const g = registry.getGroup(r.gid) as any
    const members = new Set<string>((g?.countries || []).map((c: any) => c.iso3))
    return { ...r, members }
  })
  const topThemes = themes.slice(0, 10).map(t => t.theme)
  const regions = regionMembers.map((r) => {
    const list = cur.filter(s => r.members.has(s.iso3))
    const sal = themeCount(list, salient)
    return {
      gid: r.gid,
      label: r.label,
      speeches: list.length,
      tone: toneCount(list),
      themes: Object.fromEntries(topThemes.map(t => [t, pct(sal.get(t) || 0, list.length)])),
    }
  }).filter(r => r.speeches > 0)

  // ---- most-discussed speakers and their quotes ----
  const quotes = mentioned
    .map(m => cur.find(s => s.iso3 === m.iso3 && s.analysis?.key_quotes?.length))
    .filter(Boolean)
    .slice(0, 6)
    .map((s: any) => ({ iso3: s.iso3, iso2: iso2Of(s.iso3), name: nameOf(s.iso3), speaker: s.speaker, title: s.speaker_title, quote: s.analysis.key_quotes[0] }))

  // ---- per-speech table ----
  const speeches = cur.map(s => ({
    iso3: s.iso3,
    iso2: iso2Of(s.iso3),
    name: nameOf(s.iso3),
    speaker: s.speaker,
    title: s.speaker_title,
    level: speakerLevel(s.speaker_title),
    date: s.date,
    words: s.word_count,
    tone: tone(s),
    themes: (s.analysis?.themes || []).filter(t => t.relevance === 'high').map(t => t.name).slice(0, 4),
    summary: s.analysis?.summary || '',
  })).sort((a, b) => a.name.localeCompare(b.name))

  // ---- long view: share of speeches per decade giving each theme high/medium priority ----
  const byDecade = new Map<number, SpeechMeta[]>()
  for (const s of all) {
    if (!s.analysis) continue
    const d = Math.floor(s.year / 10) * 10
    if (!byDecade.has(d)) byDecade.set(d, [])
    byDecade.get(d)!.push(s)
  }
  const decadeKeys = [...byDecade.keys()].sort((a, b) => a - b)
  const decadeShares = new Map<number, Map<string, number>>()
  for (const d of decadeKeys) decadeShares.set(d, themeCount(byDecade.get(d)!, salient))
  const longThemes = themes.slice(0, 12).map(t => t.theme)
  const decades = {
    columns: decadeKeys.map(d => ({ key: String(d), label: `${d}s`, speeches: byDecade.get(d)!.length })),
    themes: longThemes,
    values: Object.fromEntries(longThemes.map(t => [t, Object.fromEntries(decadeKeys.map(d => [String(d), pct(decadeShares.get(d)!.get(t) || 0, byDecade.get(d)!.length)]))])),
  }

  // Year-on-year changes are only meaningful when both sessions were analysed by the same model
  const models = (list: SpeechMeta[]) => [...new Set(list.map(s => s.analysis?._model).filter(Boolean))] as string[]
  const curModels = models(cur)
  const prevModels = models(prev)
  const comparable = !pn || (curModels.length === 1 && prevModels.length === 1 && curModels[0] === prevModels[0])

  const value = {
    models: { current: curModels, previous: prevModels, comparable },
    session,
    year: 1945 + session,
    prevSession: pn ? session - 1 : null,
    overview,
    themes,
    movers,
    mentioned,
    conflicts,
    regions,
    regionThemes: topThemes,
    quotes,
    speeches,
    decades,
  }
  _cache.set(session, { at: Date.now(), value })
  return value
}
