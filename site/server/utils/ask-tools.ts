import type { ToolDef } from './llm-client'
import { getRegistry } from './wcg'
import { getCountryData } from './countrydata'
import { getCountryVDem, classifyRegimeLabel } from './vdem'
import { getCountrySanctions, getCountrySanctionsListings, getSanctionsMeta } from './sanctions'
import { getCountryConflict, getConflictMeta, getAllConflicts } from './conflict'
import { getElections, getJournalDays } from './upcoming'
import { archiveSearch, archiveStats } from './news-analysis'
import { TRADE_TOOLS, runTradeTool } from './ask-tools-trade'
import { DONOR_TOOLS, runDonorTool } from './ask-tools-donors'
import { UNELECTION_TOOLS, runUnElectionTool } from './ask-tools-unelections'
import { SG_TOOLS, runSgTool } from './ask-tools-sg'
import { getMilitaryCapabilities } from './military'
import { getCountryVoteSummary, getCountryThemeStats, getCountryAlignmentScores, getBilateralVotingAlignment, searchResolutions, getRecentResolutions } from './unvotes'
import { detectVotingBlocs } from './voting-blocs'
import { groupLoyalty } from './voting-dynamics'
import { getCountrySpeeches, getAllSpeeches } from './speeches'
import { getRecentStatements } from './statements-feed'
import { getRecentNews } from './news-feed'
import { readDataFile } from './data-file'
import { searchTexts, type PassageKind } from './text-search'
import { getSessionInsights } from './speech-insights'

/**
 * Tools the research desk's model can call. Each returns compact JSON; records that
 * can be cited carry a "ref" (S1, S2, ...) registered with the SourceCollector, and the
 * model cites them as [S1]. Every tool also declares which data files it read, so the
 * saved answer knows how current its inputs were.
 */

export interface Source { ref: string; title: string; url: string; kind: string }

export class SourceCollector {
  sources: Source[] = []
  private byUrl = new Map<string, string>()
  datasets = new Set<string>()
  add(title: string, url: string, kind: string): string {
    const known = this.byUrl.get(url)
    if (known) return known
    const ref = `S${this.sources.length + 1}`
    this.sources.push({ ref, title: (title || '').slice(0, 200), url, kind })
    this.byUrl.set(url, ref)
    return ref
  }
  used(...files: string[]) { for (const f of files) this.datasets.add(f) }
}

const SITE = ''
const fold = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const round = (x: number | null | undefined, d = 1) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d)

function countryName(iso3: string) {
  const m = getRegistry().getCountryMembership(iso3)
  return m?.name || iso3
}

function resolveIso3(input: string): string | null {
  const q = fold(String(input || '').trim())
  if (!q) return null
  const registry = getRegistry()
  if (/^[a-z]{3}$/.test(q) && registry.getCountryMembership(q.toUpperCase())) return q.toUpperCase()
  if (/^[a-z]{2}$/.test(q)) { const m = registry.getCountryMembership(q.toUpperCase()); if (m) return m.iso3 }
  const ALIAS: Record<string, string> = { 'united states': 'USA', us: 'USA', usa: 'USA', america: 'USA', uk: 'GBR', britain: 'GBR', 'united kingdom': 'GBR', russia: 'RUS', china: 'CHN', iran: 'IRN', syria: 'SYR', 'south korea': 'KOR', 'north korea': 'PRK', palestine: 'PSE', 'dr congo': 'COD', drc: 'COD', turkey: 'TUR', turkiye: 'TUR', 'ivory coast': 'CIV', vietnam: 'VNM', venezuela: 'VEN', bolivia: 'BOL', egypt: 'EGY', laos: 'LAO' }
  if (ALIAS[q]) return ALIAS[q]
  const all = registry.getAllCountries().filter(c => c.iso3)
  const exact = all.find(c => fold(c.name) === q)
  if (exact) return exact.iso3
  const part = all.find(c => fold(c.name).includes(q))
  return part?.iso3 || null
}

function groupId(input: string): string | null {
  const registry = getRegistry()
  const q = fold(String(input || '').trim())
  if (registry.getGroup(q)) return q
  const s = registry.listSummaries().find(g => fold(g.acronym) === q || fold(g.name) === q) || registry.listSummaries().find(g => fold(g.name).includes(q))
  return s?.gid || null
}

/** Newer General Assembly resolutions (vote totals only) from the library feed, past the per-country data. */
function recentGaTotals(query: string, src: SourceCollector) {
  const latest = latestVoteDate()
  const q = fold(query || '')
  const words = q.split(/\s+/).filter(w => w.length > 2)
  const rows = (readDataFile<any>('ga-resolutions.json')?.resolutions || [])
    .filter((x: any) => (x.date || '') > latest && words.every(w => fold(x.title || '').includes(w)))
    .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')).slice(0, 12)
  if (!rows.length) return {}
  src.used('ga-resolutions.json')
  return {
    newer_resolutions_totals_only: rows.map((x: any) => ({
      symbol: x.id, title: x.title, date: x.date,
      outcome: x.without_vote ? 'adopted without a vote' : x.tally ? `recorded vote: ${x.tally.yes} yes, ${x.tally.no} no, ${x.tally.abstain} abstentions` : 'no tally',
      ref: src.add(`${x.id}: ${x.title}`, x.url || `https://docs.un.org/${x.id}`, 'resolution'),
    })),
    newer_note: `Adopted after ${latest}; country-by-country votes for these are not yet in the database, only the totals.`,
  }
}

/** Date of the most recent recorded General Assembly vote in the data. */
function latestVoteDate(): string {
  return getRecentResolutions(1).reduce((m, r) => (r.d > m ? r.d : m), '') || 'unknown'
}

// ---------------------------------------------------------------------------
export const ASK_TOOLS: ToolDef[] = [
  { name: 'upcoming_events', description: 'What is coming up: the official UN meetings programme for the next days from the Journal of the United Nations (New York and Geneva: General Assembly, Security Council, ECOSOC, Human Rights Council...), and national elections (upcoming and recently held, worldwide or for one country).', parameters: { type: 'object', properties: { what: { type: 'string', enum: ['meetings', 'elections', 'both'] }, country: { type: 'string', description: 'For elections: only this country' }, location: { type: 'string', enum: ['New York', 'Geneva', 'all'] }, days: { type: 'integer', description: 'Look-ahead in days (meetings up to 8, elections up to 365; default 8 / 120)' }, include_past_elections: { type: 'boolean' } } } },
  { name: 'sanctions_and_conflict', description: 'UN Security Council sanctions (live Consolidated List: regimes targeting the country, listings of its nationals and entities, recent listings) and armed conflict data (UCDP: events, deaths, violence types, trend, last 12 months, main conflicts). Without a country: worldwide conflict hotspots ranked by deaths in the last 12 months.', parameters: { type: 'object', properties: { country: { type: 'string' } } } },
  { name: 'search_texts', description: 'Search the full text of every General Debate speech since 1946 (paragraph by paragraph), plus official statements and news summaries, by meaning and keywords. Use it to find what was actually said about a topic, by whom and when, and to quote exact passages. Describe the topic in plain words (e.g. "debt relief for poor countries", "reform of the Security Council veto"); call it again with different wording or filters for better coverage.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'The topic or idea to find, in plain words' }, country: { type: 'string', description: 'Only passages from or about this country' }, kind: { type: 'string', enum: ['speech', 'statement', 'news', 'any'], description: 'speech = General Debate speeches (default any)' }, from_year: { type: 'integer' }, to_year: { type: 'integer' }, limit: { type: 'integer', description: 'Passages to return, up to 15 (default 8)' } }, required: ['query'] } },
  { name: 'country_overview', description: 'Key facts about a country: population, GDP, income group, region, democracy (V-Dem), sanctions, military, Security Council membership, main groups it belongs to, and its current leaders.', parameters: { type: 'object', properties: { country: { type: 'string', description: 'Country name or ISO code' } }, required: ['country'] } },
  { name: 'un_voting_record', description: "A country's UN General Assembly voting record: yes/no/abstain per recent session, voting by subject, and the countries it agrees with most and least.", parameters: { type: 'object', properties: { country: { type: 'string' }, sessions: { type: 'integer', description: 'Recent sessions to analyse (default 10)' } }, required: ['country'] } },
  { name: 'voting_agreement', description: 'How often two countries vote the same way in the General Assembly, overall and by subject.', parameters: { type: 'object', properties: { country_a: { type: 'string' }, country_b: { type: 'string' } }, required: ['country_a', 'country_b'] } },
  { name: 'search_ga_resolutions', description: 'Search General Assembly resolutions by keyword (title), optionally one session; returns tallies and how the named countries voted, plus newer resolutions known only by their totals.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Words in the resolution title, e.g. "Myanmar", "nuclear"' }, session: { type: 'integer' }, countries: { type: 'array', items: { type: 'string' }, description: 'Countries whose votes to include' } }, required: ['query'] } },
  { name: 'group_overview', description: 'A country group or organisation (EU, NATO, G77, AU, ASEAN, BRICS, OIC...): members, and how loyally members vote with the group majority on contested UN votes.', parameters: { type: 'object', properties: { group: { type: 'string', description: 'Acronym or name' } }, required: ['group'] } },
  { name: 'voting_blocs', description: 'Voting blocs in the General Assembly detected from contested votes, plus unaligned countries.', parameters: { type: 'object', properties: { sessions: { type: 'integer', description: 'Recent sessions (default 5)' } } } },
  { name: 'security_council', description: 'Security Council: current members and presidency, recent decisions with votes, vetoes and meetings; optionally filtered by topic words.', parameters: { type: 'object', properties: { topic: { type: 'string', description: 'e.g. "Haiti", "Ukraine", "Middle East"' }, since: { type: 'string', description: 'ISO date, default one year ago' } } } },
  { name: 'general_debate_speeches', description: "UN General Debate speeches (AI-analysed): a country's speeches with summary, themes, policy positions and stance on conflicts; or, with a topic, which countries addressed it in a session.", parameters: { type: 'object', properties: { country: { type: 'string' }, topic: { type: 'string', description: 'Word or phrase to look for in summaries and positions' }, session: { type: 'integer', description: 'e.g. 81 for 2026' } } } },
  { name: 'general_debate_overview', description: 'Session-level picture of a General Debate: most common themes and their change from the previous year, most-mentioned countries, crises discussed.', parameters: { type: 'object', properties: { session: { type: 'integer' } } } },
  { name: 'search_quotes', description: 'Verified quotes from General Debate speeches by words, country, speaker or years.', parameters: { type: 'object', properties: { query: { type: 'string' }, country: { type: 'string' }, speaker: { type: 'string' }, from_year: { type: 'integer' }, to_year: { type: 'integer' } } } },
  { name: 'person_profile', description: 'A leader, minister or UN official: current roles, General Debate speeches, statements delivered and recent mentions.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'recent_news_and_statements', description: 'News and official statements, optionally about a country and/or containing words. Covers the last weeks by default; give from/to dates (YYYY-MM-DD) to search the full archive of everything collected since October 2026.', parameters: { type: 'object', properties: { query: { type: 'string' }, country: { type: 'string' }, days: { type: 'integer', description: 'Default 14' }, from: { type: 'string', description: 'Start date YYYY-MM-DD (searches the archive)' }, to: { type: 'string', description: 'End date YYYY-MM-DD' }, kind: { type: 'string', enum: ['news', 'statement', 'any'] }, limit: { type: 'integer', description: 'Default 12' } } } },
  ...TRADE_TOOLS,
  ...DONOR_TOOLS,
  ...UNELECTION_TOOLS,
  ...SG_TOOLS,
]

// ---------------------------------------------------------------------------
export async function runTool(name: string, args: any, src: SourceCollector): Promise<any> {
  switch (name) {
    case 'country_overview': {
      const iso3 = resolveIso3(args.country)
      if (!iso3) return { error: `Unknown country "${args.country}"` }
      src.used('country-stats.json', 'vdem-data.json', 'sanctions.json', 'military-capabilities.json', 'unsc-history.json', 'people-index.json')
      const c = getCountryData(iso3)
      const v = getCountryVDem(iso3)
      const m = getMilitaryCapabilities(iso3)
      const registry = getRegistry()
      const groups = (registry.getCountryMembership(iso3)?.groups || []).map((g: any) => g.acronym || g.name).slice(0, 25)
      const hist = readDataFile<any>('unsc-history.json')
      const terms = hist?.terms?.[iso3] || []
      const people = (readDataFile<any>('people-index.json')?.people || []).filter((p: any) => p.roles.some((r: any) => r.iso3 === iso3)).slice(0, 5)
      return {
        country: countryName(iso3), iso3, ref: src.add(`${countryName(iso3)}: country profile`, `${SITE}/countries/${iso3.toLowerCase()}`, 'page'),
        region: c?.region, subregion: c?.subregion, capital: c?.capital, income_group: c?.income_group,
        population: c?.population, gdp_usd: c?.gdp, gdp_per_capita_usd: round(c?.gdp_per_capita, 0), hdi: c?.hdi, life_expectancy: c?.life_expectancy,
        data_years: c?.data_year,
        democracy: v ? { year: v.latest.year, electoral_democracy_index: v.latest.v2x_polyarchy, regime: classifyRegimeLabel(v.latest.v2x_polyarchy), liberal_democracy: v.latest.v2x_libdem, source: 'V-Dem v16' } : null,
        sanctions: getCountrySanctions(iso3).map(s => `${s.name} (${s.resolution})`).slice(0, 8),
        military: m ? { global_firepower_rank: m.rank, active_personnel: m.active_military, source: 'Global Firepower 2025' } : null,
        security_council_terms: terms,
        groups,
        leaders: people.map((p: any) => ({ name: p.name, roles: p.roles.filter((r: any) => r.iso3 === iso3).map((r: any) => r.role), ref: src.add(p.name, `${SITE}/people/${p.slug}`, 'person') })),
      }
    }
    case 'un_voting_record': {
      const iso3 = resolveIso3(args.country)
      if (!iso3) return { error: `Unknown country "${args.country}"` }
      src.used('un-votes-summary.json', 'un-votes-resolutions.json', 'resolution-themes.json')
      const n = Math.min(20, Math.max(1, args.sessions || 10))
      const summary = getCountryVoteSummary(iso3)
      const sess = Object.entries(summary?.sessions || {}).sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, n)
        .map(([s, t]: any) => ({ session: Number(s), year: 1945 + Number(s), yes: t.yes, no: t.no, abstain: t.abstain, absent: t.non_voting }))
      const align = getCountryAlignmentScores(iso3, { sessions: n, limit: 8 })
      const themes = getCountryThemeStats(iso3).slice(0, 12).map(t => ({ subject: t.theme, resolutions: t.resolutions, yes_pct: round((t.yes / Math.max(1, t.resolutions)) * 100, 0), no_pct: round((t.no / Math.max(1, t.resolutions)) * 100, 0), abstain_pct: round((t.abstain / Math.max(1, t.resolutions)) * 100, 0) }))
      return {
        country: countryName(iso3), ref: src.add(`${countryName(iso3)}: UN voting record`, `${SITE}/countries/${iso3.toLowerCase()}/votes`, 'page'),
        by_session: sess, by_subject_all_years: themes,
        most_aligned: align.mostAligned.map(a => ({ country: countryName(a.iso3), agreement_pct: round(a.agreement * 100, 0) })),
        least_aligned: align.leastAligned.map(a => ({ country: countryName(a.iso3), agreement_pct: round(a.agreement * 100, 0) })),
        note: `Agreement = share of recorded votes cast the same way (all votes, last N sessions). Recorded votes up to ${latestVoteDate()}.`,
      }
    }
    case 'voting_agreement': {
      const a = resolveIso3(args.country_a), b = resolveIso3(args.country_b)
      if (!a || !b) return { error: 'Unknown country' }
      src.used('un-votes-resolutions.json', 'resolution-themes.json')
      const r = getBilateralVotingAlignment(a, b)
      return {
        countries: [countryName(a), countryName(b)], overall_agreement_pct: round(r.overall * 100, 1), votes_compared: r.resolutionsCompared,
        by_subject: r.perTheme.slice(0, 12).map(t => ({ subject: t.theme, agreement_pct: round(t.alignment * 100, 0), votes: t.resolutions })),
        ref: src.add(`Voting agreement: ${countryName(a)} and ${countryName(b)}`, `${SITE}/compare?mode=countries&countries=${a},${b}`, 'page'),
        note: 'All recorded General Assembly votes since 1946.',
      }
    }
    case 'search_ga_resolutions': {
      src.used('un-votes-resolutions.json')
      const isos = (args.countries || []).map((c: string) => resolveIso3(c)).filter(Boolean) as string[]
      const r = searchResolutions({ search: args.query, session: args.session, limit: 12, countries: isos.length ? isos : undefined })
      return {
        total_matching: r.total,
        resolutions: r.resolutions.map(x => ({
          title: x.title, session: x.session, date: x.date, tally: x.globalTally,
          votes: x.countryVotes ? Object.fromEntries(Object.entries(x.countryVotes).map(([k, v]) => [countryName(k), ({ Y: 'yes', N: 'no', A: 'abstain', X: 'absent' } as any)[v] || v])) : undefined,
          ref: src.add(x.title, `https://digitallibrary.un.org/record/${x.id}`, 'resolution'),
        })),
        coverage: `Recorded votes up to ${latestVoteDate()} (session ${r.meta.lastSession})`,
        ...recentGaTotals(args.query, src),
      }
    }
    case 'group_overview': {
      const gid = groupId(args.group)
      if (!gid) return { error: `Unknown group "${args.group}"` }
      src.used('un-votes-resolutions.json')
      const g = getRegistry().getGroup(gid)!
      const loyal = groupLoyalty(gid, 5)
      return {
        group: g.name, acronym: g.acronym, members: g.countries.length, member_names: g.countries.map(c => c.name),
        voting_cohesion: loyal ? { median_member_with_majority_pct: round((loyal.median || 0) * 100, 0), least_loyal: loyal.members.slice(0, 6).map((m: any) => ({ country: m.name, with_majority_pct: round(m.loyalty * 100, 0) })), contested_votes: loyal.contested } : null,
        ref: src.add(`${g.name} (${g.acronym})`, `${SITE}/groups/${gid}`, 'page'),
      }
    }
    case 'voting_blocs': {
      src.used('un-votes-resolutions.json')
      const r = detectVotingBlocs({ sessions: Math.min(10, args.sessions || 5), threshold: 0.85 })
      return {
        blocs: r.blocs.map((b: any) => ({ name: b.label, size: b.size, cohesion_pct: round(b.cohesion * 100, 0), yes_on_contested_pct: round(b.yesRate * 100, 0), members: b.memberNames.map((m: any) => m.name) })),
        unaligned: r.unaligned.map((u: any) => ({ country: u.name, closest_bloc: u.closestLabel, agreement_pct: round(u.agreement * 100, 0) })),
        method: 'Contested votes only (>=10% departed from the majority), average-linkage clustering at 85% agreement.',
        ref: src.add('Voting bloc detector', `${SITE}/intelligence?tab=blocs`, 'page'),
      }
    }
    case 'security_council': {
      src.used('unsc-votes.json', 'unsc-vetoes.json', 'unsc-activity.json', 'unsc-history.json')
      const since = args.since || new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
      const t = fold(args.topic || '')
      const match = (s: string) => !t || fold(s).includes(t)
      const votes = readDataFile<any>('unsc-votes.json')?.resolutions || []
      const vetoes = readDataFile<any>('unsc-vetoes.json')?.vetoes || []
      const act = readDataFile<any>('unsc-activity.json')
      const month = new Date().toISOString().slice(0, 7)
      return {
        presidency: (act?.presidency || []).find((p: any) => p.month === month)?.country || null,
        decisions: votes.filter((r: any) => r.date >= since && match(r.title)).slice(0, 15).map((r: any) => ({
          id: r.id, date: r.date, topic: r.title, outcome: r.adopted ? 'adopted' : r.vetoed ? 'vetoed' : 'not adopted', tally: r.tally,
          ref: src.add(`${r.id}: ${r.title}`, r.press_release || `https://docs.un.org/${r.id}`, 'un-document'),
        })),
        vetoes: vetoes.filter((v: any) => v.date >= since && match(v.subject)).slice(0, 10).map((v: any) => ({ date: v.date, draft: v.draft, subject: v.subject, by: (v.vetoed_by || []).map(countryName) })),
        meetings: (act?.meetings || []).filter((m: any) => m.date >= since && match(m.topic)).slice(0, 12).map((m: any) => ({ date: m.date, topic: m.topic, outcome: m.outcome || 'no decision', ref: src.add(`${m.meeting}: ${m.topic}`, m.record, 'un-document') })),
        source: 'Dag Hammarskjöld Library',
      }
    }
    case 'general_debate_speeches': {
      src.used('un-speeches-index.json')
      const iso3 = args.country ? resolveIso3(args.country) : null
      const t = fold(args.topic || '')
      let list = iso3 ? getCountrySpeeches(iso3) : getAllSpeeches()
      if (args.session) list = list.filter(s => s.session === args.session)
      else if (!iso3) { const latest = Math.max(...list.map(s => s.session)); list = list.filter(s => s.session === latest) }
      list = list.filter(s => s.analysis)
      if (t) list = list.filter(s => fold(JSON.stringify([s.analysis?.summary, s.analysis?.policy_positions, s.analysis?.mentioned_conflicts, s.analysis?.themes])).includes(t))
      const out = list.slice(0, iso3 ? 4 : 15).map(s => ({
        country: countryName(s.iso3), session: s.session, year: s.year, speaker: s.speaker || null, title: s.speaker_title || null,
        summary: s.analysis?.summary, themes: (s.analysis?.themes || []).filter(x => x.relevance === 'high').map(x => x.name),
        policy_positions: iso3 ? s.analysis?.policy_positions : (s.analysis?.policy_positions || []).filter(p => !t || fold(p.topic + ' ' + p.position).includes(t)).slice(0, 3),
        conflicts: iso3 ? s.analysis?.mentioned_conflicts : undefined,
        ref: src.add(`${countryName(s.iso3)}, General Debate ${s.year}`, `${SITE}/countries/${s.iso3.toLowerCase()}/speeches`, 'speech'),
      }))
      return { matching_speeches: list.length, speeches: out, note: 'Summaries and positions come from AI analysis of each speech.' }
    }
    case 'general_debate_overview': {
      src.used('un-speeches-index.json')
      const ins = getSessionInsights(args.session)
      return {
        session: ins.session, year: ins.year, statements: ins.overview.speeches,
        top_themes: ins.themes.slice(0, 10).map((t: any) => ({ theme: t.theme, share_pct: round(t.share, 0), change_pts: t.delta })),
        most_mentioned_countries: ins.mentioned.slice(0, 10).map((m: any) => ({ country: m.name, speeches: m.total, criticism: m.criticism, concern: m.concern, partner: m.partner })),
        crises: ins.conflicts.slice(0, 8).map((c: any) => ({ crisis: c.name, share_pct: round(c.share, 0), previous_pct: c.prevShare })),
        ref: src.add(`General Debate ${ins.year} analysis`, `${SITE}/speeches`, 'page'),
      }
    }
    case 'sanctions_and_conflict': {
      src.used('sanctions.json', 'conflict-events.json')
      const cm: any = getConflictMeta()
      const conflictRef = src.add(`UCDP conflict data (${cm?.period || 'recent years'})`, `${SITE}/conflicts`, 'dataset')
      if (!args.country) {
        const all: any = getAllConflicts()
        const rows = Object.entries(all.countries || {}).map(([iso, c]: [string, any]) => ({ iso, c }))
          .sort((a, b) => (b.c.last_12_months?.fatalities ?? b.c.total_fatalities) - (a.c.last_12_months?.fatalities ?? a.c.total_fatalities)).slice(0, 15)
        return {
          hotspots: rows.map(({ iso, c }) => ({ country: countryName(iso), deaths_last_12_months: c.last_12_months?.fatalities ?? null, events_last_12_months: c.last_12_months?.events ?? null, intensity: c.conflict_intensity, main_conflict: c.top_conflicts?.[0]?.name || null })),
          period: cm?.period, note: 'UCDP GED and monthly candidate events (recent months provisional); UCDP does not record protests or riots.', ref: conflictRef,
        }
      }
      const iso3 = resolveIso3(args.country)
      if (!iso3) return { error: `Unknown country "${args.country}"` }
      const sm: any = getSanctionsMeta()
      const sanctionsRef = src.add(`UN Security Council Consolidated List (generated ${String(sm?.list_generated || sm?.generated || '').slice(0, 10) || 'recently'})`, 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list', 'dataset')
      const regimes = getCountrySanctions(iso3).map((r: any) => ({
        regime: r.name, resolution: r.resolution, since: r.established, measures: r.measures,
        listed_individuals: r.listed_individuals ?? null, listed_entities: r.listed_entities ?? null, latest_listing: r.latest_listing ?? null,
        recent_listings: (r.recent_listings || []).slice(0, 4).map((l: any) => `${l.name} (${l.reference}, listed ${l.listed_on})`),
      }))
      const listings = getCountrySanctionsListings(iso3)
      const c: any = getCountryConflict(iso3)
      return {
        country: countryName(iso3),
        sanctions: { regimes_targeting_country: regimes, nationals_and_entities_on_list: { individuals: listings.individuals, entities: listings.entities, by_regime: listings.by_regime }, ref: sanctionsRef },
        conflict: c ? {
          period: cm?.period, intensity: c.conflict_intensity, events: c.total_events, deaths_best: c.total_fatalities,
          deaths_range: c.fatalities_low != null ? `${c.fatalities_low}–${c.fatalities_high}` : null, civilian_deaths: c.civilian_deaths ?? null,
          by_type: c.by_type, trend: c.trend, last_12_months: c.last_12_months ?? null, latest_event: c.latest_event_date ?? null,
          main_conflicts: (c.top_conflicts || []).slice(0, 3).map((x: any) => ({ name: x.name, deaths: x.fatalities, latest: x.latest_event })),
          ref: conflictRef,
        } : { note: 'No organised violence recorded by UCDP in the period', ref: conflictRef },
      }
    }
    case 'upcoming_events': {
      const what = args.what || 'both'
      const out: any = {}
      if (what !== 'elections') {
        src.used('un-journal.json')
        const days = getJournalDays({ location: args.location || 'New York', days: Math.min(8, args.days || 8) })
        out.un_meetings = days.map(d => ({
          date: d.date, location: d.location,
          ref: src.add(`Journal of the United Nations, ${d.location}, ${d.date}`, d.journalUrl || 'https://journal.un.org', 'schedule'),
          meetings: d.meetings.filter(m => !m.cancelled).slice(0, 25).map(m => ({
            time: m.time, body: m.organ, group: m.group, title: m.title, room: m.room, closed: m.closed,
            agenda: (m.agenda || []).slice(0, 4),
          })),
        }))
        out.meetings_note = 'Security Council meetings usually appear in the Journal only a day ahead.'
      }
      if (what !== 'meetings') {
        src.used('elections.json')
        const iso3 = args.country ? resolveIso3(args.country) : undefined
        if (args.country && !iso3) return { error: `Unknown country "${args.country}"` }
        const list = getElections({ iso3: iso3 || undefined, status: args.include_past_elections ? 'all' : 'upcoming', withinDays: iso3 ? undefined : Math.min(365, args.days || 120), limit: 40 })
        out.elections = list.map(e => ({
          date: e.date, precision: e.precision, country: e.country, type: e.type, description: e.description, status: e.status,
          ref: src.add(`Elections: ${e.country} ${e.date} (Wikipedia national electoral calendar)`, e.source_url, 'calendar'),
        }))
        out.elections_note = 'From Wikipedia national electoral calendars (CC BY-SA); dates can change.'
      }
      return out
    }
    case 'search_texts': {
      const iso3 = args.country ? resolveIso3(args.country) : null
      if (args.country && !iso3) return { error: `Unknown country "${args.country}"` }
      const kind = ['speech', 'statement', 'news'].includes(args.kind) ? [args.kind as PassageKind] : undefined
      const r = await searchTexts({ query: String(args.query || ''), kinds: kind, iso3, fromYear: args.from_year, toYear: args.to_year, limit: args.limit })
      if (!r) return { error: 'The full-text index has not been built yet' }
      const files: Record<string, string> = { speech: 'un-speeches-index.json', statement: 'statements-feed.json', news: 'news-feed.json' }
      for (const k of new Set(r.passages.map(p => p.kind))) src.used(files[k])
      return {
        method: r.method,
        passages: r.passages.map(p => ({
          kind: p.kind, country: p.iso3 ? countryName(p.iso3) : null, year: p.year, date: p.date || null, speaker: p.speaker || null,
          source: p.title, text: p.text.length > 1100 ? p.text.slice(0, 1100) + '…' : p.text,
          ref: src.add(p.title, p.url.startsWith('/') ? `${SITE}${p.url}` : p.url, p.kind),
        })),
        note: 'Speech passages are verbatim from the official record (older speeches are UN translations); statements and news are headline and summary only.',
      }
    }
    case 'search_quotes': {
      src.used('quotes-index.json')
      const file = readDataFile<any>('quotes-index.json')
      const iso3 = args.country ? resolveIso3(args.country) : null
      const q = fold(args.query || ''), sp = fold(args.speaker || '')
      const hits = (file?.quotes || []).filter((x: any) => x.status !== 'unverified'
        && (!iso3 || x.iso3 === iso3) && (!sp || fold(x.speaker).includes(sp))
        && (!args.from_year || x.year >= args.from_year) && (!args.to_year || x.year <= args.to_year)
        && (!q || q.split(/\s+/).every((w: string) => fold(x.q).includes(w))))
        .sort((a: any, b: any) => b.year - a.year).slice(0, 10)
      return { quotes: hits.map((x: any) => ({ quote: x.q, country: x.country, speaker: x.speaker || null, year: x.year, verification: x.status, ref: src.add(`${x.country} ${x.year}: “${x.q.slice(0, 60)}…”`, `${SITE}/quotes?q=${encodeURIComponent('"' + x.q.slice(0, 40) + '"')}`, 'quote') })) }
    }
    case 'person_profile': {
      src.used('people-index.json')
      const n = fold(args.name || '')
      const people = readDataFile<any>('people-index.json')?.people || []
      const p = people.find((x: any) => fold(x.name) === n) || people.find((x: any) => fold(x.name).includes(n) || (x.aliases || []).some((a: string) => fold(a).includes(n)))
      if (!p) return { error: `No profile for "${args.name}"` }
      return {
        name: p.name, description: p.description, roles: p.roles.map((r: any) => `${r.role}${r.country ? ', ' + r.country : ''}${r.since ? ' (since ' + r.since + ')' : ''}`),
        general_debate: p.speeches.map((s: any) => `${s.year}: ${s.title}, ${s.country}`),
        mentions_last_30_days: p.mentions30d,
        statements_delivered: p.delivered.slice(0, 6).map((d: any) => ({ title: d.title, date: d.publishedAt?.slice(0, 10), ref: src.add(d.title, d.url, 'statement') })),
        recent_mentions: p.mentions.slice(0, 6).map((d: any) => ({ title: d.title, date: d.publishedAt?.slice(0, 10), ref: src.add(d.title, d.url, d.kind) })),
        ref: src.add(p.name, `${SITE}/people/${p.slug}`, 'person'),
      }
    }
    case 'recent_news_and_statements': {
      if (args.from || args.to) {
        const iso = args.country ? resolveIso3(args.country) : null
        if (args.country && !iso) return { error: `Unknown country "${args.country}"` }
        const ws = String(args.query || '').split(/\s+/).filter((w: string) => w.length > 2)
        const rows = archiveSearch({ iso3: iso, words: ws, from: args.from, to: args.to, kind: ['news', 'statement'].includes(args.kind) ? args.kind : undefined, limit: Math.min(25, args.limit || 12) })
        const st = archiveStats()
        return {
          archive: st ? `Archive of ${st.items} items collected since ${st.firstDay}` : 'archive unavailable',
          items: rows.map(x => ({ title: x.title, summary: (x.summary || '').slice(0, 240), outlet: x.outlet, ownership: x.ownership || undefined, kind: x.kind, date: (x.publishedAt || '').slice(0, 10), ref: src.add(x.title, x.url, x.kind) })),
        }
      }
      src.used('news-feed.json', 'statements-feed.json')
      const iso3 = args.country ? resolveIso3(args.country) : null
      const days = Math.min(60, Math.max(1, args.days || 14))
      const cut = new Date(Date.now() - days * 86400000).toISOString()
      const words = fold(args.query || '').split(/\s+/).filter(w => w.length > 2)
      const items = [...getRecentNews(3000).map(x => ({ ...x, kind: 'news' })), ...getRecentStatements(3000).map(x => ({ ...x, kind: 'statement' }))]
        .filter((x: any) => (x.publishedAt || '') >= cut && x.source !== 'un-webtv-schedule')
        .filter((x: any) => !iso3 || (x.countries || []).includes(iso3))
        .filter((x: any) => !words.length || words.every(w => fold(`${x.title} ${x.description || x.excerpt || ''}`).includes(w)))
        .sort((a: any, b: any) => (a.sourceTier ?? 5) - (b.sourceTier ?? 5) || (b.publishedAt || '').localeCompare(a.publishedAt || ''))
        .slice(0, Math.min(25, args.limit || 12))
      return { items: items.map((x: any) => ({ title: x.title, summary: (x.description || x.excerpt || '').slice(0, 240), source: x.source, kind: x.kind, date: (x.publishedAt || '').slice(0, 10), ref: src.add(x.title, x.url, x.kind) })) }
    }
  }
  const extra = (await runTradeTool(name, args, src)) ?? (await runDonorTool(name, args, src)) ?? (await runUnElectionTool(name, args, src)) ?? (await runSgTool(name, args, src))
  if (extra !== undefined) return extra
  return { error: `Unknown tool ${name}` }
}
