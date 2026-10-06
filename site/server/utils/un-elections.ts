import { readDataFile } from './data-file'
import { getRegistry } from './wcg'

/**
 * UN election trackers (Security Council seats, President of the General Assembly, Human Rights
 * Council, ECOSOC, International Court of Justice).
 * Data: server/data/un-elections.json (scripts/fetch_un_elections.py). Terms served per
 * country are derived from unsc-history.json (not duplicated) plus the members elected in
 * the latest election whose terms have not started yet.
 */

export const UN_ELECTIONS_FILE = 'un-elections.json'
export const UNSC_HISTORY_FILE = 'unsc-history.json'

export type GroupCode = 'AG' | 'APG' | 'EEG' | 'GRULAC' | 'WEOG'
export interface CountryRef { iso3: string | null; iso2?: string | null; name: string; group: GroupCode | null }
export interface SourceRef { title: string; url: string; section: string }
export interface Candidate extends CountryRef { note: string | null; withdrawn: boolean; refs: { text: string; url: string | null }[] }
export interface RoundVote extends CountryRef { votes: number | null; declared?: boolean }
export interface Round {
  round: number; label: string
  valid_ballots: number | null; invalid_ballots: number | null; abstentions: number | null
  present_and_voting: number | null; required_majority: number | null
  votes: RoundVote[]
}
export interface Ballot { label: string; groups: GroupCode[]; rounds: Round[] }
export interface ScElection {
  year: number; term: string; date: string | null; date_text: string | null
  seats: Partial<Record<GroupCode, number>>
  candidates: Partial<Record<GroupCode, Candidate[]>>
  contested: Partial<Record<GroupCode, boolean | null>>
  outgoing: CountryRef[]; elected: (CountryRef & { in_unsc_history?: boolean | null })[]; unsuccessful: CountryRef[]
  ballots?: Ballot[]; rounds_by_group: Partial<Record<GroupCode, number>>
  source: string; status?: 'held' | 'upcoming'; verified?: boolean; verification_note?: string; date_note?: string
  scr_check?: { url: string; status: number; checked: boolean; candidates_confirmed?: boolean; not_found?: string[] }
}
export interface Member extends CountryRef { permanent: boolean; term_start: number | null; term_end: number | null }
export interface HistoryRow {
  year: number; term: string; date: string | null; seats: Partial<Record<GroupCode, number>>
  elected: CountryRef[]; unsuccessful: CountryRef[]; contested_groups: GroupCode[]
  rounds_by_group: Partial<Record<GroupCode, number>>; max_rounds: number; source: string
}
export interface PgaRow {
  year: number; session: number | null; sessions_text: string; name: string; country: string
  iso3: string | null; iso2: string | null; region_raw: string; group: GroupCode | null; group_derived: boolean
  contested: boolean; person_slug?: string
  vote?: { year: number; winner: string; winner_country: string; runner_up: string; runner_up_country: string; votes_winner: number; votes_runner_up: number }
}
// ---- Human Rights Council / ECOSOC / International Court of Justice
export interface BodyMember extends CountryRef { term_end: number; term_start?: number; second_term?: boolean; replaced_by?: string; term_end_original?: number }
export interface HrcCandidate extends CountryRef {
  endorsed_by_group?: boolean; pledge?: { symbol: string; url: string } | null
  votes?: number | null; elected?: boolean | null; incumbent?: boolean
}
export interface HrcElection {
  year: number; term: string; status?: 'upcoming'; date: string | null; date_text: string | null; date_source?: string | null
  seats: Partial<Record<GroupCode, number>>; candidates: Partial<Record<GroupCode, HrcCandidate[]>>; contested: Partial<Record<GroupCode, boolean>>
  results: HrcCandidate[]; elected?: CountryRef[]; unsuccessful?: HrcCandidate[]; outgoing?: BodyMember[]
  required_majority: number; majority_rule?: string; notable: string[]
  source: string | null; votes_source?: string | null; secondary_source?: string | null
  verified: boolean; verification_note?: string | null; votes_note?: string; candidates_cross_checked?: boolean | null
}
export interface HrcData {
  year: number; seats_total: number; seats_by_group: Record<GroupCode, number>; rules: string
  members: BodyMember[]; latest_election: HrcElection; next_election: HrcElection
}
export interface EcosocElected extends CountryRef { votes?: number | null }
export interface EcosocData {
  year: number; seats_total: number; seats_by_group: Record<GroupCode, number>; rules: string
  members: BodyMember[]; members_verified: boolean; members_notes: string[]
  latest_election: {
    year: number; date: string; term: string; seats: Partial<Record<GroupCode, number>>
    elected: EcosocElected[]; elected_by_group: Partial<Record<GroupCode, EcosocElected[]>>
    by_election: (CountryRef & { term: string; replaces: string; note: string })[]
    vacancies: Partial<Record<GroupCode, number>>; present_and_voting: number | null; required_majority: number | null; majority_rule: string
    notable: string[]; unverified: string[]; sources: { title: string; url: string }[]
    checks: { url: string; status: number; confirmed: boolean; not_found: string[] }[]
    library_confirms: boolean | null; wikipedia_confirms: boolean | null; verified: boolean
  }
  next_election: {
    year: number; term: string; status: 'upcoming'; date: string | null; date_text: string
    seats: Partial<Record<GroupCode, number>>; outgoing: (BodyMember & { note?: string })[]; candidates: Record<string, never>; verified: boolean; note: string
  }
}
export interface IcjJudge {
  name: string; surname: string; iso3: string | null; iso2?: string | null; nationality: string; group: GroupCode | null
  role: 'president' | 'vice-president' | 'judge'; member_since: string | null; current_term_from: string | null; career: string
  term_end: number | null; term_end_derived: string | null
}
export interface IcjResult {
  name: string; ga: (number | null)[]; sc: (number | null)[]; ga_majority: boolean; sc_majority: boolean; elected: boolean; on_court: boolean
  nationality: string | null; iso3: string | null; iso2?: string | null; regional_group: GroupCode | string | null; nominating_groups: number | null
}
export interface IcjRound { label: string; date: string | null }
export interface IcjByElection {
  date: string; elected: string; country: string; iso3: string | null; iso2?: string | null; replaces: string; term_end: number
  candidates: number; ga_votes: number; ga_present: number; sc_votes: number; rounds_ga: number; rounds_sc: number
  ga_required: number; sc_required: number; source: string; on_court: boolean; verified: boolean
}
export interface IcjCandidate {
  name: string | null; iso3: string | null; iso2?: string | null; country: string | null; group: GroupCode | null
  nominating_groups: string[] | null; incumbent: boolean; source: string; note: string | null
}
export interface IcjData {
  year: number; seats_total: number; rules: string; judges: IcjJudge[]
  latest_election: {
    year: number; term: string; seats: number; date: string | null; ga_required: number; sc_required: number
    ga_rounds: IcjRound[]; sc_rounds: IcjRound[]; results: IcjResult[]; elected: string[]; unsuccessful: string[]
    notable: string[]; source: string; verified: boolean; verification_note: string
  }
  by_elections: IcjByElection[]
  next_election: {
    year: number; term: string; seats: number; status: 'upcoming' | 'held'; date: string | null; date_text: string | null
    ga_required: number; sc_required: number
    ending_terms: { name: string; iso3: string | null; iso2?: string | null; nationality: string; group: GroupCode | null; running: boolean }[]
    candidates: IcjCandidate[]; ballots: { ga_required: number; sc_required: number; ga_rounds: IcjRound[]; sc_rounds: IcjRound[]; results: { name: string; ga: (number | null)[]; sc: (number | null)[] }[] } | null
    checks: { url: string; status: number; confirmed: boolean; not_found: string[] }[]
    verified: boolean; verification_note: string | null; notable: string[]
  }
}

export interface UnElections {
  _meta: { updated_at: string; sources: SourceRef[]; notes: string[]; unmatched_countries: string[] }
  groups: Record<GroupCode, string>
  security_council: {
    year: number; composition: Member[]; incoming: Member[]
    latest_election: ScElection; next_election: ScElection | null; history: HistoryRow[]
  }
  pga: {
    current: PgaRow & { term: string; official_url: string | null; verified_official: boolean; elected_on: string | null; election_url: string | null; election_candidates: { name: string; country: string }[] | null }
    next: {
      session: number; year: number; group: GroupCode | null; group_label: string | null; rule: string; rule_detail?: string
      election_expected: string; candidates: { name: string; country: string }[]; candidates_source: string | null
      candidates_note: string | null; verified: boolean
    }
    rotation: { session: number; year: number; group: GroupCode | null; president: string | null; country: string | null; iso3: string | null; iso2?: string | null; status: 'past' | 'current' | 'upcoming' }[]
    contested_text: string
    list: PgaRow[]
  }
  hrc?: HrcData
  ecosoc?: EcosocData
  icj?: IcjData
}

export interface CountryTerms {
  iso3: string; iso2: string | null; name: string; group: GroupCode | null; permanent: boolean
  terms: { start: number; end: number; status: 'served' | 'serving' | 'elected' }[]
  count: number; last_term: string | null
  candidacies: { year: number; term: string; outcome: 'elected' | 'lost' | 'upcoming' }[]
}

export function getUnElections(): UnElections | null {
  return readDataFile<UnElections>(UN_ELECTIONS_FILE)
}

function sectionSources(d: UnElections, prefix: string) {
  return d._meta.sources.filter(s => s.section === prefix || s.section.startsWith(prefix + '.'))
}

const GID_TO_GROUP: Record<string, GroupCode> = { ag: 'AG', ap: 'APG', eeg: 'EEG', grulac: 'GRULAC', weog: 'WEOG' }

function nameOf(iso3: string): { name: string; iso2: string | null; group: GroupCode | null } {
  try {
    const m = getRegistry().getCountryMembership(iso3)
    const gid = m?.groups.map(g => g.gid).find(g => g in GID_TO_GROUP)
    // electoral practice: Türkiye votes with WEOG
    const group: GroupCode | null = iso3 === 'TUR' ? 'WEOG' : gid ? GID_TO_GROUP[gid] ?? null : null
    return { name: m?.name || iso3, iso2: m?.iso2 || null, group }
  } catch {
    return { name: iso3, iso2: null, group: null }
  }
}

/** Every country that ever held a non-permanent seat (plus members elected but not yet seated). */
export function getCountryTerms(): CountryTerms[] {
  const d = getUnElections()
  const hist = readDataFile<{ permanent: string[]; terms: Record<string, number[][]> }>(UNSC_HISTORY_FILE)
  const year = d?.security_council.year ?? new Date().getFullYear()
  const terms: Record<string, [number, number][]> = {}
  for (const [iso, ts] of Object.entries(hist?.terms || {})) terms[iso] = ts.filter(t => t.length >= 2).map(t => [t[0] as number, t[1] as number])
  for (const m of d?.security_council.incoming || []) {
    if (!m.iso3 || m.term_start == null || m.term_end == null) continue
    const list = (terms[m.iso3] ||= [])
    if (!list.some(t => t[0] === m.term_start)) list.push([m.term_start, m.term_end])
  }
  // names and groups seen in the election data take precedence over the registry
  const known = new Map<string, CountryRef>()
  const note = (c: CountryRef | null | undefined) => { if (c?.iso3 && !known.has(c.iso3)) known.set(c.iso3, c) }
  d?.security_council.composition.forEach(note)
  d?.security_council.incoming.forEach(note)
  d?.security_council.history.forEach(h => { h.elected.forEach(note); h.unsuccessful.forEach(note) })
  Object.values(d?.security_council.next_election?.candidates || {}).forEach(l => l?.forEach(note))

  const candidacies = new Map<string, CountryTerms['candidacies']>()
  const addC = (iso: string | null, row: CountryTerms['candidacies'][number]) => {
    if (!iso) return
    const l = candidacies.get(iso) || []
    if (!l.some(x => x.year === row.year)) l.push(row)
    candidacies.set(iso, l)
  }
  for (const h of d?.security_council.history || []) {
    h.elected.forEach(c => addC(c.iso3, { year: h.year, term: h.term, outcome: 'elected' }))
    h.unsuccessful.forEach(c => addC(c.iso3, { year: h.year, term: h.term, outcome: 'lost' }))
  }
  const ne = d?.security_council.next_election
  if (ne) Object.values(ne.candidates || {}).forEach(l => l?.forEach(c => { if (!c.withdrawn) addC(c.iso3, { year: ne.year, term: ne.term, outcome: 'upcoming' }) }))

  const permanent = new Set(hist?.permanent || [])
  const isos = new Set([...Object.keys(terms), ...candidacies.keys()])
  const out: CountryTerms[] = []
  for (const iso of isos) {
    const ts = (terms[iso] || []).slice().sort((a, b) => a[0] - b[0])
    const k = known.get(iso)
    const reg = nameOf(iso)
    const rows = ts.map(([s, e]) => ({ start: s, end: e, status: (s > year ? 'elected' : e >= year ? 'serving' : 'served') as 'served' | 'serving' | 'elected' }))
    const last = rows[rows.length - 1]
    out.push({
      iso3: iso, iso2: k?.iso2 ?? reg.iso2, name: k?.name || reg.name, group: k?.group ?? reg.group,
      permanent: permanent.has(iso), terms: rows, count: rows.length,
      last_term: last ? (last.start === last.end ? String(last.start) : `${last.start}–${last.end}`) : null,
      candidacies: (candidacies.get(iso) || []).sort((a, b) => b.year - a.year),
    })
  }
  return out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function getCouncilElections() {
  const d = getUnElections()
  if (!d) return null
  return {
    meta: { updated_at: d._meta.updated_at, notes: d._meta.notes, sources: sectionSources(d, 'security_council') },
    groups: d.groups,
    ...d.security_council,
    countries: getCountryTerms(),
  }
}

export function getPgaElections() {
  const d = getUnElections()
  if (!d) return null
  return {
    meta: { updated_at: d._meta.updated_at, notes: d._meta.notes, sources: sectionSources(d, 'pga') },
    groups: d.groups,
    ...d.pga,
  }
}

function bodySection<K extends 'hrc' | 'ecosoc' | 'icj'>(key: K) {
  const d = getUnElections()
  const body = d?.[key]
  if (!d || !body) return null
  return {
    meta: { updated_at: d._meta.updated_at, notes: d._meta.notes, sources: sectionSources(d, key) },
    groups: d.groups,
    ...(body as NonNullable<UnElections[K]>),
  }
}

/** Human Rights Council: members by regional group with term ends, latest election (votes vs the 97 needed), next election. */
export function getHrcElections() { return bodySection('hrc') }

/** ECOSOC: members with term ends, latest June election, seats up next year. */
export function getEcosocElections() { return bodySection('ecosoc') }

/** International Court of Justice: judges and term ends, latest triennial election (GA and Security Council rounds), by-elections, next election. */
export function getIcjElections() { return bodySection('icj') }
