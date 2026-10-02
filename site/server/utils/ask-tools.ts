import type { ToolDef } from './llm-client'
import { getRegistry } from './wcg'
import { getCountryData } from './countrydata'
import { getCountryVDem, classifyRegimeLabel } from './vdem'
import { getCountrySanctions } from './sanctions'
import { getMilitaryCapabilities } from './military'
import { getCountryVoteSummary, getCountryThemeStats, getCountryAlignmentScores, getBilateralVotingAlignment, searchResolutions, getRecentResolutions } from './unvotes'
import { detectVotingBlocs } from './voting-blocs'
import { groupLoyalty } from './voting-dynamics'
import { getCountrySpeeches, getAllSpeeches } from './speeches'
import { getRecentStatements } from './statements-feed'
import { getRecentNews } from './news-feed'
import { readDataFile } from './data-file'
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

/** Date of the most recent recorded General Assembly vote in the data. */
function latestVoteDate(): string {
  return getRecentResolutions(1).reduce((m, r) => (r.d > m ? r.d : m), '') || 'unknown'
}

// ---------------------------------------------------------------------------
export const ASK_TOOLS: ToolDef[] = [
  { name: 'country_overview', description: 'Key facts about a country: population, GDP, income group, region, democracy (V-Dem), sanctions, military, Security Council membership, main groups it belongs to, and its current leaders.', parameters: { type: 'object', properties: { country: { type: 'string', description: 'Country name or ISO code' } }, required: ['country'] } },
  { name: 'un_voting_record', description: "A country's UN General Assembly voting record: yes/no/abstain per recent session, voting by subject, and the countries it agrees with most and least.", parameters: { type: 'object', properties: { country: { type: 'string' }, sessions: { type: 'integer', description: 'Recent sessions to analyse (default 10)' } }, required: ['country'] } },
  { name: 'voting_agreement', description: 'How often two countries vote the same way in the General Assembly, overall and by subject.', parameters: { type: 'object', properties: { country_a: { type: 'string' }, country_b: { type: 'string' } }, required: ['country_a', 'country_b'] } },
  { name: 'search_ga_resolutions', description: 'Search General Assembly resolutions with recorded votes by keyword (title), optionally one session; returns tallies and how the named countries voted.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Words in the resolution title, e.g. "Myanmar", "nuclear"' }, session: { type: 'integer' }, countries: { type: 'array', items: { type: 'string' }, description: 'Countries whose votes to include' } }, required: ['query'] } },
  { name: 'group_overview', description: 'A country group or organisation (EU, NATO, G77, AU, ASEAN, BRICS, OIC...): members, and how loyally members vote with the group majority on contested UN votes.', parameters: { type: 'object', properties: { group: { type: 'string', description: 'Acronym or name' } }, required: ['group'] } },
  { name: 'voting_blocs', description: 'Voting blocs in the General Assembly detected from contested votes, plus unaligned countries.', parameters: { type: 'object', properties: { sessions: { type: 'integer', description: 'Recent sessions (default 5)' } } } },
  { name: 'security_council', description: 'Security Council: current members and presidency, recent decisions with votes, vetoes and meetings; optionally filtered by topic words.', parameters: { type: 'object', properties: { topic: { type: 'string', description: 'e.g. "Haiti", "Ukraine", "Middle East"' }, since: { type: 'string', description: 'ISO date, default one year ago' } } } },
  { name: 'general_debate_speeches', description: "UN General Debate speeches (AI-analysed): a country's speeches with summary, themes, policy positions and stance on conflicts; or, with a topic, which countries addressed it in a session.", parameters: { type: 'object', properties: { country: { type: 'string' }, topic: { type: 'string', description: 'Word or phrase to look for in summaries and positions' }, session: { type: 'integer', description: 'e.g. 81 for 2026' } } } },
  { name: 'general_debate_overview', description: 'Session-level picture of a General Debate: most common themes and their change from the previous year, most-mentioned countries, crises discussed.', parameters: { type: 'object', properties: { session: { type: 'integer' } } } },
  { name: 'search_quotes', description: 'Verified quotes from General Debate speeches by words, country, speaker or years.', parameters: { type: 'object', properties: { query: { type: 'string' }, country: { type: 'string' }, speaker: { type: 'string' }, from_year: { type: 'integer' }, to_year: { type: 'integer' } } } },
  { name: 'person_profile', description: 'A leader, minister or UN official: current roles, General Debate speeches, statements delivered and recent mentions.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'recent_news_and_statements', description: 'Recent news and official statements (last weeks), optionally about a country and/or containing words.', parameters: { type: 'object', properties: { query: { type: 'string' }, country: { type: 'string' }, days: { type: 'integer', description: 'Default 14' }, limit: { type: 'integer', description: 'Default 12' } } } },
]

// ---------------------------------------------------------------------------
export function runTool(name: string, args: any, src: SourceCollector): any {
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
  return { error: `Unknown tool ${name}` }
}
