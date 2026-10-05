import { readDataFile } from './data-file'

/**
 * UN Secretary-General selection tracker (scripts/fetch_sg_selection.py → sg-selection.json).
 * Official nominees come from the UN selection page; straw-poll tallies are leaked figures
 * (never published by the Council); "also mentioned" names are NOT candidates.
 */

export const SG_FILE = 'sg-selection.json'
export const SG_OFFICIAL_URL = 'https://www.un.org/en/sg-selection-and-appointment'

export interface SgSource { name: string; url: string }
export interface SgPollPoint { n: number; date: string; encourage: number; discourage: number; no_opinion: number }

export interface SgCandidate {
  id: string
  name: string
  official_name: string
  slug: string | null
  nationality: string | null
  nationality_iso2: string | null
  nationality_name: string | null
  nationality_note: string | null
  nationality_source: string | null
  nominated_by: string[]
  nominated_by_names: string[]
  nominated_by_iso2: (string | null)[]
  nomination_date: string | null
  status: 'nominated' | 'withdrawn' | 'selected'
  withdrawal_date: string | null
  withdrawal_announced: string | null
  withdrawals: { date: string | null; by: string[]; url: string | null; symbol: string | null }[]
  gender: 'female' | 'male' | null
  region_group: string | null
  region_group_code: string | null
  current_role: string | null
  current_role_source: string | null
  previous_roles: string[]
  vision_statement_url: string | null
  vision_statement_other: { label: string; url: string }[]
  cv_url: string | null
  disclosure_url: string | null
  letter_url: string | null
  letter_symbol: string | null
  dialogue_date: string | null
  dialogue_time: string | null
  webcast_url: string | null
  photo: string | null
  photo_official: string | null
  wikipedia_url: string | null
  news_count_60d: number
  poll_history: SgPollPoint[]
  latest_poll: SgPollPoint | null
  sources: SgSource[]
}

export interface SgPollResult {
  candidate: string
  candidate_id: string
  encourage: number
  discourage: number
  no_opinion: number
  p5_encourage: boolean | null
  p5_discourage: boolean | null
}

export interface SgStrawPoll {
  n: number
  date: string
  colour_coded: boolean
  ballot_note: string | null
  candidates_voted: number | null
  ballots_cast: number | null
  results: SgPollResult[]
  source_url: string
  sources: SgSource[]
  scr_url: string | null
  scr_colour_coded?: boolean | null
  results_official: boolean
}

export interface SgTimelineEvent {
  date: string
  kind: 'process' | 'nomination' | 'withdrawal' | 'dialogue' | 'straw_poll' | 'milestone'
  title: string
  url: string | null
  candidate_id: string | null
  detail: string | null
  upcoming: boolean
}

export interface SgAlsoMentioned {
  id: string
  name: string
  slug: string | null
  role: string | null
  iso3: string | null
  iso2: string | null
  status: 'likely' | 'expressed_interest' | 'rumoured' | 'speculated' | 'ruled_out' | null
  why: string | null
  listed_by: string[]
  evidence: { title: string; url: string; date: string | null }[]
  mention_count_60d: number
  latest_mention: string | null
  first_mentioned: string | null
  wikipedia_url: string | null
}

export interface SgNewsItem {
  title: string
  url: string
  outlet: string | null
  date: string
  candidates_mentioned: string[]
  also_mentioned: string[]
  in_headline?: string[]
  via?: string
}

export interface SgSelection {
  _meta: {
    updated_at: string
    status_line: string
    sources: SgSource[]
    source_status: Record<string, string>
    discrepancies: string[]
    notes: string[]
    window_days: number
  }
  process: {
    launched: { date: string; ref: string | null; url: string } | null
    nomination_window: { opened: string; closes: string | null; note: string; sources: SgSource[] }
    dialogue_summary: string | null
    dialogues: { date: string; time: string | null; candidate: string; candidate_id: string; webcast_url: string | null; source_url: string }[]
    town_hall: { date: string; title: string; url: string } | null
    handover: { session_end: string; letter_date: string; symbol: string; successor: string; successor_session: number; url: string; outgoing?: string } | null
    straw_polls: SgStrawPoll[]
    gender_and_region_notes: { text: string; url: string }[]
    expected_appointment: {
      term_ends: string
      takes_office: string
      recommendation: string | null
      appointment: string | null
      outlook: { text: string; url: string; date: string; source: string } | null
      note: string
      sources: SgSource[]
    }
    documents: { date: string | null; title: string; url: string }[]
    timeline: SgTimelineEvent[]
  }
  candidates: SgCandidate[]
  also_mentioned: SgAlsoMentioned[]
  news: SgNewsItem[]
}

export function getSgSelection(): SgSelection | null {
  return readDataFile<SgSelection>(SG_FILE)
}

const fold = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-.]/g, ' ').replace(/\s+/g, ' ').trim()

/** Find an official candidate by id, slug, name, surname or nationality (ISO3). */
export function findSgCandidate(query: string): SgCandidate | null {
  const d = getSgSelection()
  const q = fold(query)
  if (!d || !q) return null
  const all = d.candidates
  return all.find(c => c.id === q.replace(/ /g, '-') || c.slug === q.replace(/ /g, '-'))
    || all.find(c => fold(c.name) === q || fold(c.official_name) === q)
    || all.find(c => (/^[a-z]{3}$/.test(q) && c.nationality?.toLowerCase() === q))
    || all.find(c => fold(c.official_name).split(' ').slice(1).some(t => t.length >= 3 && q.split(' ').includes(t)))
    || all.find(c => fold(c.official_name).includes(q) || fold(c.name).includes(q))
    || null
}

/** Find an "also mentioned" (non-candidate) name. */
export function findSgMentioned(query: string): SgAlsoMentioned | null {
  const d = getSgSelection()
  const q = fold(query)
  if (!d || !q) return null
  return d.also_mentioned.find(m => m.id === q.replace(/ /g, '-') || fold(m.name) === q)
    || d.also_mentioned.find(m => fold(m.name).split(' ').slice(1).some(t => t.length >= 3 && q.split(' ').includes(t)))
    || null
}

export function getSgStrawPolls(): SgStrawPoll[] {
  return getSgSelection()?.process.straw_polls ?? []
}

export function getSgNews(opts: { candidate?: string | null; limit?: number; days?: number } = {}): SgNewsItem[] {
  const d = getSgSelection()
  if (!d) return []
  let items = d.news
  if (opts.candidate) {
    const c = findSgCandidate(opts.candidate)
    const m = c ? null : findSgMentioned(opts.candidate)
    if (c) items = items.filter(n => n.candidates_mentioned.includes(c.id))
    else if (m) items = items.filter(n => n.also_mentioned.includes(m.id))
    else items = []
  }
  if (opts.days) {
    const since = new Date(Date.now() - opts.days * 86400_000).toISOString()
    items = items.filter(n => n.date >= since)
  }
  return items.slice(0, opts.limit ?? 60)
}

/** Headline numbers for a status line / summary. */
export function getSgSummary() {
  const d = getSgSelection()
  if (!d) return null
  const active = d.candidates.filter(c => c.status === 'nominated')
  const selected = d.candidates.find(c => c.status === 'selected') || null
  const polls = d.process.straw_polls
  const latest = [...polls].reverse().find(p => p.results.length) || polls[polls.length - 1] || null
  return {
    updated_at: d._meta.updated_at,
    status_line: d._meta.status_line,
    active: active.length,
    withdrawn: d.candidates.filter(c => c.status === 'withdrawn').length,
    women: active.filter(c => c.gender === 'female').length,
    selected: selected ? selected.name : null,
    polls_held: polls.length,
    latest_poll: latest ? { n: latest.n, date: latest.date, colour_coded: latest.colour_coded } : null,
    any_colour_coded: polls.some(p => p.colour_coded),
  }
}
