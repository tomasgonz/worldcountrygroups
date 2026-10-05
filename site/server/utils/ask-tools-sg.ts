import type { ToolDef } from './llm-client'
import { getSgSelection, findSgCandidate, findSgMentioned, getSgNews, getSgSummary, SG_FILE, SG_OFFICIAL_URL } from './sg-selection'
import type { SgCandidate, SgStrawPoll } from './sg-selection'

/**
 * Research-desk tool for the 2026 UN Secretary-General selection.
 * Wire into ask-tools.ts: spread SG_TOOLS into ASK_TOOLS and, in runTool's default
 * branch, `const r = await runSgTool(name, args, src); if (r !== undefined) return r`.
 */

type Src = { add(title: string, url: string, kind: string): string; used(...files: string[]): void }

export const SG_TOOLS: ToolDef[] = [
  {
    name: 'sg_selection',
    description: 'The selection of the next UN Secretary-General (Guterres\'s term ends 31 Dec 2026). Without arguments: official nominees (from the UN selection page) with nominating states, status (nominated/withdrawn/selected), Security Council straw-poll results (leaked tallies: encourage/discourage/no opinion; whether ballots were colour-coded for the P5), process timeline, outlook and latest news. With a candidate (name or surname): that nominee\'s profile, vision statement/CV links, dialogue date, poll trend and news. "also_mentioned" people are names discussed in coverage — they are NOT official candidates.',
    parameters: {
      type: 'object',
      properties: {
        candidate: { type: 'string', description: 'Candidate or mentioned person name / surname (e.g. "Grynspan"). Optional.' },
      },
    },
  },
]

const POLL_NOTE = 'Straw polls are informal and their results are not published by the Security Council; figures are leaked tallies reported by 1 for 8 Billion, PassBlue, Reuters and others. Until ballots are colour-coded, a discourage vote cannot be attributed to a permanent member (possible veto).'

function pollRow(p: SgStrawPoll, src: Src) {
  return {
    n: p.n,
    date: p.date,
    colour_coded: p.colour_coded,
    results: p.results.map(r => ({ candidate: r.candidate, e: r.encourage, d: r.discourage, n: r.no_opinion, ...(p.colour_coded ? { p5_encourage: r.p5_encourage, p5_discourage: r.p5_discourage } : {}) })),
    ref: src.add(`Security Council straw poll ${p.n} (${p.date})`, p.source_url, 'news'),
  }
}

function candRow(c: SgCandidate, src: Src, full = false) {
  const ref = src.add(c.letter_url ? `Joint letter on the nomination of ${c.official_name}${c.letter_symbol ? ` (${c.letter_symbol})` : ''}` : `UN selection page: ${c.official_name}`, c.letter_url || SG_OFFICIAL_URL, 'document')
  const row: Record<string, any> = {
    name: c.name,
    nationality: c.nationality_name,
    nominated_by: c.nominated_by_names,
    nominated: c.nomination_date,
    status: c.status,
    ...(c.status === 'withdrawn' ? { withdrawn: c.withdrawal_date } : {}),
    gender: c.gender,
    region_group: c.region_group,
    current_role: c.current_role,
    latest_poll: c.latest_poll ? { n: c.latest_poll.n, e: c.latest_poll.encourage, d: c.latest_poll.discourage, n_o: c.latest_poll.no_opinion } : null,
    ref,
  }
  if (c.slug) row.profile = `/people/${c.slug}`
  if (full) {
    row.official_name = c.official_name
    row.previous_roles = c.previous_roles
    row.poll_trend = c.poll_history.map(h => ({ n: h.n, date: h.date, e: h.encourage, d: h.discourage, n_o: h.no_opinion }))
    row.dialogue = c.dialogue_date ? { date: c.dialogue_date, time: c.dialogue_time } : null
    if (c.vision_statement_url) row.vision_statement_ref = src.add(`${c.official_name}: vision statement`, c.vision_statement_url, 'document')
    if (c.cv_url) row.cv_ref = src.add(`${c.official_name}: CV`, c.cv_url, 'document')
    if (c.webcast_url) row.dialogue_webcast_ref = src.add(`General Assembly interactive dialogue with ${c.official_name} (webcast)`, c.webcast_url, 'video')
    row.withdrawals = c.withdrawals.map(w => ({ date: w.date, by: w.by, symbol: w.symbol, ref: w.url ? src.add(`Withdrawal letter (${w.symbol || c.official_name})`, w.url, 'document') : null }))
    row.news_count_60d = c.news_count_60d
  }
  return row
}

function newsRows(src: Src, candidate: string | null, limit: number) {
  return getSgNews({ candidate, limit }).map(n => ({
    title: n.title, date: n.date.slice(0, 10), outlet: n.outlet,
    ref: src.add(n.title, n.url, 'news'),
  }))
}

export async function runSgTool(name: string, args: any, src: Src): Promise<any | undefined> {
  if (name !== 'sg_selection') return undefined
  src.used(SG_FILE)
  const d = getSgSelection()
  if (!d) return { error: 'Secretary-General selection data is not loaded yet' }
  const a = args || {}
  const q = typeof a.candidate === 'string' ? a.candidate.trim() : ''
  const pageRef = src.add('UN: Selection and Appointment of the Next Secretary-General', SG_OFFICIAL_URL, 'page')

  if (q) {
    const c = findSgCandidate(q)
    if (c) {
      return {
        updated_at: d._meta.updated_at,
        candidate: candRow(c, src, true),
        poll_note: POLL_NOTE,
        news: newsRows(src, c.id, 8),
      }
    }
    const m = findSgMentioned(q)
    if (m) {
      return {
        updated_at: d._meta.updated_at,
        not_an_official_candidate: true,
        note: `${m.name} has NOT been nominated by any Member State; the name appears in coverage or trackers as a possible candidate.`,
        person: {
          name: m.name, role: m.role, iso3: m.iso3, status: m.status, why: m.why,
          race_articles_mentioning_60d: m.mention_count_60d,
          evidence: m.evidence.slice(0, 4).map(e => ({ title: e.title, date: e.date, ref: src.add(e.title, e.url, 'news') })),
          ...(m.slug ? { profile: `/people/${m.slug}` } : {}),
        },
        official_candidates: d.candidates.filter(x => x.status === 'nominated').map(x => x.name),
        ref: pageRef,
      }
    }
    return {
      error: `"${q}" is not an official candidate and is not among the names mentioned in coverage.`,
      official_candidates: d.candidates.map(x => `${x.name} (${x.status})`),
      ref: pageRef,
    }
  }

  const p = d.process
  const outlook = p.expected_appointment.outlook
  return {
    updated_at: d._meta.updated_at,
    summary: getSgSummary(),
    ref: pageRef,
    launched: p.launched ? { date: p.launched.date, doc: p.launched.ref, ref: src.add(`PGA/PSC joint letter launching the selection (${p.launched.ref || p.launched.date})`, p.launched.url, 'document') } : null,
    nominations: p.nomination_window.note,
    candidates: d.candidates.map(c => candRow(c, src)),
    straw_polls: p.straw_polls.map(x => pollRow(x, src)),
    poll_note: POLL_NOTE,
    dialogues: p.dialogues.map(x => ({ date: x.date, candidate: x.candidate })),
    handover: p.handover ? { to: p.handover.successor, session: p.handover.successor_session, date: p.handover.session_end } : null,
    term_ends: p.expected_appointment.term_ends,
    outlook: outlook ? { text: outlook.text, date: outlook.date, ref: src.add(`${outlook.source}: outlook`, outlook.url, 'news') } : null,
    also_mentioned_not_candidates: d.also_mentioned.filter(m => m.status !== 'ruled_out').slice(0, 10).map(m => ({ name: m.name, status: m.status, role: m.role, articles_60d: m.mention_count_60d })),
    news: newsRows(src, null, 8),
  }
}
