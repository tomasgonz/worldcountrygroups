import { getCountrySpeeches } from '~/server/utils/speeches'
import { getRecentResolutions, getResolutionThemes } from '~/server/utils/unvotes'

/**
 * "Say vs vote": compares what a country says in recent General Debate speeches
 * with how it votes in the General Assembly.
 *
 * 1. Relationships: countries it praises or criticizes in speeches, against how often
 *    it actually votes the same way as them (relative to its own typical agreement).
 * 2. Themes: themes it emphasizes in speeches, against how often it votes with the
 *    Assembly majority on resolutions of that theme.
 */

const SPEECH_SESSIONS = 3 // speeches from the last three debates
const VOTE_SESSIONS = 5   // votes from the last five sessions with recorded votes
const MIN_GAP = 0.05

// Speech theme (from AI analysis) -> resolution themes (from resolution classifier)
const THEME_MAP: Record<string, string[]> = {
  nuclear_disarmament: ['Nuclear & Disarmament'],
  human_rights: ['Human Rights'],
  gender_equality: ['Human Rights'],
  indigenous_rights: ['Human Rights'],
  self_determination: ['Colonialism & Self-Determination', 'Palestine & Middle East'],
  colonialism: ['Colonialism & Self-Determination'],
  sustainable_development: ['Economic Development', 'Environment & Sustainability'],
  economic_growth: ['Economic Development'],
  poverty: ['Economic Development', 'LDCs, LLDCs & SIDS'],
  debt: ['Economic Development'],
  trade: ['Economic Development'],
  inequality: ['Economic Development'],
  climate_change: ['Environment & Sustainability'],
  biodiversity: ['Environment & Sustainability'],
  oceans: ['Environment & Sustainability', 'International Law'],
  water: ['Environment & Sustainability'],
  energy: ['Environment & Sustainability'],
  migration: ['Refugees & Migration'],
  peace_security: ['Peacekeeping & Security'],
  conflict_resolution: ['Peacekeeping & Security', 'Country-Specific Situations'],
  terrorism: ['Peacekeeping & Security'],
  rule_of_law: ['International Law'],
  sovereignty: ['International Law', 'Country-Specific Situations'],
  sanctions: ['Country-Specific Situations', 'Economic Development'],
  health: ['Health & Social'],
  education: ['Health & Social'],
  youth: ['Health & Social'],
  food_security: ['Health & Social', 'Economic Development'],
  technology: ['Information & Cyber'],
  cyber_security: ['Information & Cyber'],
}

const POSITIVE = new Set(['ally', 'partnership'])
const NEGATIVE = new Set(['criticism'])

export interface RelationshipSignal {
  iso3: string
  praised: number
  criticized: number
  mentions: number
  agreement: number | null
  votesCompared: number
  relative: number | null // agreement minus the country's median agreement
  flag: 'praised_but_votes_apart' | 'criticized_but_votes_together' | null
}

export interface ThemeSignal {
  speechTheme: string
  emphasis: number // share of recent speeches where the theme is high or medium relevance
  resolutionThemes: string[]
  resolutions: number
  withMajority: number | null // share of its votes matching the Assembly majority
  yes: number
  no: number
  abstain: number
  flag: 'emphasized_but_votes_against_majority' | null
}

export interface SayVsVote {
  iso3: string
  speechSessions: number[]
  voteSessions: number[]
  medianAgreement: number | null
  relationships: RelationshipSignal[]
  themes: ThemeSignal[]
  flags: { kind: string; text: string; iso3?: string; theme?: string }[]
}

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function majorityVote(v: Record<string, string>): string | null {
  let y = 0, n = 0, a = 0
  for (const x of Object.values(v)) {
    if (x === 'Y') y++
    else if (x === 'N') n++
    else if (x === 'A') a++
  }
  if (y + n + a === 0) return null
  if (y >= n && y >= a) return 'Y'
  if (n >= y && n >= a) return 'N'
  return 'A'
}

const CACHE_TTL_MS = 60 * 60 * 1000 // speeches and votes can be refreshed from the admin page
const _cache = new Map<string, { at: number; value: SayVsVote }>()

export function getSayVsVote(iso3: string, nameOf: (iso3: string) => string = c => c): SayVsVote {
  const code = iso3.toUpperCase()
  const hit = _cache.get(code)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  const speeches = getCountrySpeeches(code).filter(s => s.analysis).slice(0, SPEECH_SESSIONS)
  const resolutions = getRecentResolutions(VOTE_SESSIONS).filter(r => r.v[code] && r.v[code] !== 'X')

  // --- vote agreement with every other country ---
  const agreeCount = new Map<string, { agree: number; total: number }>()
  for (const r of resolutions) {
    const mine = r.v[code]
    for (const [other, theirs] of Object.entries(r.v)) {
      if (other === code || !theirs || theirs === 'X') continue
      const e = agreeCount.get(other) || { agree: 0, total: 0 }
      e.total++
      if (theirs === mine) e.agree++
      agreeCount.set(other, e)
    }
  }
  const agreement = new Map<string, { value: number; total: number }>()
  for (const [other, e] of agreeCount) {
    if (e.total >= 20) agreement.set(other, { value: e.agree / e.total, total: e.total })
  }
  const allAgreement = [...agreement.values()].map(a => a.value)
  const med = median(allAgreement)
  const sorted = [...allAgreement].sort((a, b) => a - b)
  const pct = (p: number) => sorted.length ? sorted[Math.floor(p * (sorted.length - 1))] : 0
  const low = pct(0.25), high = pct(0.75)

  // --- relationships from speeches ---
  const rel = new Map<string, { praised: number; criticized: number; mentions: number }>()
  for (const s of speeches) {
    for (const m of s.analysis!.mentioned_countries || []) {
      const iso = (m.iso3 || '').toUpperCase()
      if (!iso || iso === code) continue
      const e = rel.get(iso) || { praised: 0, criticized: 0, mentions: 0 }
      e.mentions++
      if (POSITIVE.has(m.context)) e.praised++
      if (NEGATIVE.has(m.context)) e.criticized++
      rel.set(iso, e)
    }
  }
  const relationships: RelationshipSignal[] = [...rel.entries()].map(([iso, e]) => {
    const a = agreement.get(iso)
    let flag: RelationshipSignal['flag'] = null
    // Flag only clear gaps: outside the country's usual range and at least 5 points from its median
    const gap = a && med != null ? a.value - med : 0
    if (a && e.praised > e.criticized && a.value <= low && gap <= -MIN_GAP) flag = 'praised_but_votes_apart'
    if (a && e.criticized > e.praised && a.value >= high && gap >= MIN_GAP) flag = 'criticized_but_votes_together'
    return {
      iso3: iso,
      ...e,
      agreement: a ? Math.round(a.value * 1000) / 1000 : null,
      votesCompared: a?.total ?? 0,
      relative: a && med != null ? Math.round((a.value - med) * 1000) / 1000 : null,
      flag,
    }
  }).sort((x, y) => (Number(!!y.flag) - Number(!!x.flag)) || y.mentions - x.mentions)

  // --- themes ---
  const themeEmphasis = new Map<string, number>()
  for (const s of speeches) {
    for (const t of s.analysis!.themes || []) {
      if (t.relevance === 'low') continue
      themeEmphasis.set(t.name, (themeEmphasis.get(t.name) || 0) + 1)
    }
  }
  const majorities = new Map(resolutions.map(r => [r.id, majorityVote(r.v)]))
  const themes: ThemeSignal[] = []
  for (const [theme, n] of themeEmphasis) {
    const resThemes = THEME_MAP[theme]
    if (!resThemes) continue
    let total = 0, withMaj = 0, yes = 0, no = 0, abstain = 0
    for (const r of resolutions) {
      if (!getResolutionThemes(r.id).some(t => resThemes.includes(t))) continue
      const v = r.v[code]
      total++
      if (v === 'Y') yes++
      else if (v === 'N') no++
      else if (v === 'A') abstain++
      if (v === majorities.get(r.id)) withMaj++
    }
    const share = total ? withMaj / total : null
    const emphasis = speeches.length ? n / speeches.length : 0
    themes.push({
      speechTheme: theme,
      emphasis: Math.round(emphasis * 100) / 100,
      resolutionThemes: resThemes,
      resolutions: total,
      withMajority: share == null ? null : Math.round(share * 1000) / 1000,
      yes, no, abstain,
      flag: share != null && total >= 10 && emphasis >= 0.5 && share < 0.4 ? 'emphasized_but_votes_against_majority' : null,
    })
  }
  themes.sort((a, b) => b.emphasis - a.emphasis || b.resolutions - a.resolutions)

  const pctStr = (x: number) => `${Math.round(x * 100)}%`
  const flags: SayVsVote['flags'] = []
  for (const r of relationships) {
    if (r.flag === 'praised_but_votes_apart') {
      flags.push({ kind: r.flag, iso3: r.iso3, text: `Speaks of ${nameOf(r.iso3)} as a partner, but votes with it only ${pctStr(r.agreement!)} of the time (typical: ${pctStr(med!)}).` })
    } else if (r.flag === 'criticized_but_votes_together') {
      flags.push({ kind: r.flag, iso3: r.iso3, text: `Criticizes ${nameOf(r.iso3)} in speeches, yet votes with it ${pctStr(r.agreement!)} of the time (typical: ${pctStr(med!)}).` })
    }
  }
  for (const t of themes) {
    if (t.flag) {
      flags.push({ kind: t.flag, theme: t.speechTheme, text: `Emphasizes ${t.speechTheme.replace(/_/g, ' ')} in speeches, but votes with the Assembly majority on related resolutions only ${pctStr(t.withMajority!)} of the time.` })
    }
  }

  const result: SayVsVote = {
    iso3: code,
    speechSessions: speeches.map(s => s.session),
    voteSessions: [...new Set(resolutions.map(r => r.s))].sort((a, b) => a - b),
    medianAgreement: med == null ? null : Math.round(med * 1000) / 1000,
    relationships,
    themes,
    flags,
  }
  _cache.set(code, { at: Date.now(), value: result })
  return result
}

export function clearSayVsVoteCache(): void {
  _cache.clear()
}
