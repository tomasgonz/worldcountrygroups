import type { ToolDef } from './llm-client'
import { getRegistry } from './wcg'
import { getUnElections, getCountryTerms, UN_ELECTIONS_FILE, UNSC_HISTORY_FILE } from './un-elections'

/**
 * Research-desk tool for UN elections (Security Council seats, President of the General Assembly, Human Rights
 * Council, ECOSOC, International Court of Justice).
 * Wire into ask-tools.ts: spread UNELECTION_TOOLS into ASK_TOOLS and, in runTool's default branch,
 * `const r = await runUnElectionTool(name, args, src); if (r !== undefined) return r`.
 */

type Src = { add(title: string, url: string, kind: string): string; used(...files: string[]): void }

export const UNELECTION_TOOLS: ToolDef[] = [
  {
    name: 'un_elections',
    description: 'UN elections held in the General Assembly. body="security_council": current Council composition with term ends, the latest election (June, for the two-year term starting next January) with candidates, results by round vs the two-thirds required majority and winners, the NEXT election\'s declared candidates per regional group (contested or clean slate), and ~10 years of history; with a country, its terms on the Council, last term and candidacies. body="pga": the current President of the General Assembly (election and vote), the regional rotation, which group holds the next presidency and any declared candidates, and recent presidents; with a country, its presidencies. body="hrc": Human Rights Council members by regional group with term ends (and second consecutive terms), the latest October election (candidates, votes vs the absolute majority of 97, clean slates or contested) and the next election (date, seats, candidates per group); with a country, its membership and candidacies. body="ecosoc": ECOSOC members with term ends, the latest June election (winners by group, vacancies, by-elections, known votes vs two-thirds) and seats up next; with a country, its membership. body="icj": International Court of Justice judges (role, nationality, term end), the latest triennial election with General Assembly (97) and Security Council (8) rounds, by-elections, and the next election (date, the five ending terms, candidates and nominating groups where known); with a country, its judges and candidates. Candidacies for future elections are unverified unless marked otherwise.',
    parameters: {
      type: 'object',
      properties: {
        body: { type: 'string', enum: ['security_council', 'pga', 'hrc', 'ecosoc', 'icj'], description: 'Which election: Security Council seats, President of the General Assembly, Human Rights Council, ECOSOC or International Court of Justice judges' },
        country: { type: 'string', description: 'Optional country name or ISO code to focus on' },
      },
      required: ['body'],
    },
  },
]

const fold = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function resolveIso3(input: unknown): string | null {
  const q = fold(String(input ?? ''))
  if (!q) return null
  const registry = getRegistry()
  if (/^[a-z]{3}$/.test(q) && registry.getCountryMembership(q.toUpperCase())) return q.toUpperCase()
  if (/^[a-z]{2}$/.test(q)) { const m = registry.getCountryMembership(q.toUpperCase()); if (m?.iso3) return m.iso3 }
  const ALIAS: Record<string, string> = { 'united states': 'USA', us: 'USA', usa: 'USA', uk: 'GBR', britain: 'GBR', 'united kingdom': 'GBR', turkey: 'TUR', turkiye: 'TUR', 'south korea': 'KOR', korea: 'KOR', 'republic of korea': 'KOR', uae: 'ARE', 'dr congo': 'COD', drc: 'COD', 'democratic republic of the congo': 'COD', 'ivory coast': 'CIV', "cote d'ivoire": 'CIV', russia: 'RUS', kyrgyzstan: 'KGZ', iran: 'IRN', syria: 'SYR', venezuela: 'VEN', egypt: 'EGY' }
  if (ALIAS[q]) return ALIAS[q]
  const all = registry.getAllCountries().filter((c: any) => c.iso3)
  const exact = all.find((c: any) => fold(c.name) === q)
  if (exact) return exact.iso3
  const part = all.find((c: any) => fold(c.name).includes(q) || q.includes(fold(c.name)))
  return part?.iso3 || null
}

function ordinal(n: number | null | undefined) {
  if (n == null) return ''
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0]!)
}

export async function runUnElectionTool(name: string, args: any, src: Src): Promise<any | undefined> {
  if (name !== 'un_elections') return undefined
  const d = getUnElections()
  if (!d) return { error: 'UN election data is not loaded yet' }
  src.used(UN_ELECTIONS_FILE)
  const BODIES = ['security_council', 'pga', 'hrc', 'ecosoc', 'icj'] as const
  const body: typeof BODIES[number] = (BODIES as readonly string[]).includes(args?.body) ? args.body : 'security_council'
  const iso = args?.country ? resolveIso3(args.country) : null
  if (args?.country && !iso) return { error: `Unknown country: ${args.country}` }
  const G = d.groups
  const gname = (g: string | null | undefined) => (g ? (G as any)[g] || g : null)
  const asOf = d._meta.updated_at.slice(0, 10)
  const addSources = (section: string, kind = 'reference') => {
    const refs: string[] = []
    for (const s of d._meta.sources) if (s.section === section || s.section.startsWith(section + '.')) refs.push(src.add(s.title, s.url, kind))
    return [...new Set(refs)]
  }

  if (body === 'hrc') {
    const h = d.hrc
    if (!h) return { error: 'Human Rights Council data is not loaded yet' }
    const le = h.latest_election, ne = h.next_election
    const refs = addSources('hrc')
    const out: any = {
      as_of: asOf, refs, rules: h.rules,
      members_by_group: Object.fromEntries(Object.entries(G).map(([g, label]) => [label, h.members.filter(m => m.group === g).map(m => `${m.name} (to ${m.term_end}${m.second_term ? ', 2nd consecutive term' : ''})`)])),
      latest_election: {
        year: le.year, date: le.date, term: le.term, seats: le.seats, contested: le.contested, required_majority: le.required_majority,
        results: le.results.map(r => ({ country: r.name, group: r.group, votes: r.votes ?? null, elected: r.elected })),
        notable: le.notable, votes_source_note: le.votes_note,
      },
      next_election: ne ? {
        year: ne.year, date: ne.date, date_text: ne.date_text, term: ne.term, seats: ne.seats, contested: ne.contested,
        candidates: Object.fromEntries(Object.entries(ne.candidates).map(([g, l]) => [g, (l || []).map(c => `${c.name}${c.endorsed_by_group ? ' (endorsed by group)' : ''}`)])),
        outgoing: (ne.outgoing || []).map(o => `${o.name} (${o.group}${o.second_term ? ', not eligible: two consecutive terms' : ''})`),
        notable: ne.notable, caveat: ne.verification_note,
      } : null,
    }
    if (iso) {
      const m = h.members.find(x => x.iso3 === iso)
      const lr = le.results.find(r => r.iso3 === iso)
      const nc = ne ? Object.values(ne.candidates).flat().find(c => c?.iso3 === iso) : null
      out.country = {
        iso3: iso, current_member: !!m, term_end: m?.term_end ?? null, second_consecutive_term: m?.second_term ?? false,
        latest_election: lr ? { votes: lr.votes ?? null, elected: lr.elected } : 'not a candidate',
        next_election: nc ? { candidate: true, group: gname(nc.group) } : 'not a declared candidate',
      }
    }
    return out
  }

  if (body === 'ecosoc') {
    const e = d.ecosoc
    if (!e) return { error: 'ECOSOC data is not loaded yet' }
    const le = e.latest_election, ne = e.next_election
    const refs = addSources('ecosoc')
    const out: any = {
      as_of: asOf, refs, rules: e.rules,
      members_by_group: Object.fromEntries(Object.entries(G).map(([g, label]) => [label, e.members.filter(m => m.group === g).map(m => `${m.name} (to ${m.term_end}${m.replaced_by ? `; ${m.replaced_by} takes its seat from ${m.term_end + 1}` : ''})`)])),
      latest_election: {
        year: le.year, date: le.date, term: le.term, seats: le.seats, majority_rule: le.majority_rule,
        present_and_voting: le.present_and_voting, required_majority: le.required_majority,
        elected: Object.fromEntries(Object.entries(le.elected_by_group).map(([g, l]) => [g, (l || []).map(x => x.votes ? `${x.name} (${x.votes})` : x.name)])),
        vacancies: le.vacancies, by_election: le.by_election.map(b => `${b.name} (${b.term}), replacing ${b.replaces}`),
        notable: le.notable, unverified: le.unverified, verified: le.verified,
      },
      next_election: { year: ne.year, when: ne.date || ne.date_text, term: ne.term, seats: ne.seats, outgoing: ne.outgoing.map(o => `${o.name} (${o.group})`), note: ne.note },
    }
    if (iso) {
      const m = e.members.find(x => x.iso3 === iso)
      const el = le.elected.find(x => x.iso3 === iso)
      out.country = { iso3: iso, current_member: !!m, term_end: m?.term_end ?? null, elected_in_latest: !!el, votes: el?.votes ?? null }
    }
    return out
  }

  if (body === 'icj') {
    const c = d.icj
    if (!c) return { error: 'International Court of Justice data is not loaded yet' }
    const le = c.latest_election, ne = c.next_election
    const refs = addSources('icj')
    const out: any = {
      as_of: asOf, refs, rules: c.rules,
      judges: c.judges.map(j => ({ name: j.name, nationality: j.nationality, role: j.role, term_end: j.term_end ? `5 February ${j.term_end}` : null, casual_vacancy: !!j.term_end_derived?.startsWith('completes') })),
      latest_regular_election: {
        year: le.year, date: le.date, term: le.term, ga_required: le.ga_required, sc_required: le.sc_required,
        ga_rounds: le.ga_rounds.length, sc_rounds: le.sc_rounds.length,
        results: le.results.map(r => ({ candidate: r.name, nationality: r.nationality, ga_votes: r.ga, sc_votes_by_round: r.sc, elected: r.elected })),
        notable: le.notable,
      },
      by_elections: c.by_elections.map(b => ({ date: b.date, elected: `${b.elected} (${b.country})`, replaces: b.replaces, ga: `${b.ga_votes} (needed ${b.ga_required})`, sc: `${b.sc_votes} (needed ${b.sc_required})`, candidates: b.candidates })),
      next_election: {
        year: ne.year, date: ne.date, date_text: ne.date_text, term: ne.term, seats: ne.seats,
        ending_terms: ne.ending_terms.map(t => `${t.name} (${t.nationality}${t.running ? ', standing again' : ', not standing'})`),
        candidates: ne.candidates.map(x => ({ name: x.name, country: x.country, group: x.group, sitting_judge: x.incumbent, nominating_groups: x.nominating_groups?.length ?? null, note: x.note })),
        notable: ne.notable, caveat: ne.verification_note, verified: ne.verified,
      },
    }
    if (iso) {
      out.country = {
        iso3: iso,
        judges: c.judges.filter(j => j.iso3 === iso).map(j => ({ name: j.name, role: j.role, term_end: j.term_end })),
        next_election_candidates: ne.candidates.filter(x => x.iso3 === iso).map(x => x.name || 'name not confirmed'),
        latest_election: le.results.filter(r => r.iso3 === iso).map(r => ({ candidate: r.name, elected: r.elected })),
      }
    }
    return out
  }

  if (body === 'security_council') {
    const sc = d.security_council
    const le = sc.latest_election
    const ne = sc.next_election
    const leRef = src.add(`${le.year} UN Security Council election (Wikipedia)`, le.source, 'reference')
    if (le.scr_check?.checked) src.add(`Security Council Report: Security Council Elections ${le.year}`, le.scr_check.url, 'report')
    const neRef = ne ? src.add(`${ne.year} UN Security Council election (Wikipedia)`, ne.source, 'reference') : null
    const out: any = {
      as_of: d._meta.updated_at.slice(0, 10),
      rules: 'Five of the ten elected seats are filled each June by secret ballot in the General Assembly; a candidate needs two-thirds of members present and voting. Terms run two years from 1 January.',
      composition: sc.composition.map(m => ({ country: m.name, iso3: m.iso3, group: m.group, permanent: m.permanent, term: m.permanent ? 'permanent' : `${m.term_start}–${m.term_end}` })),
      latest_election: {
        ref: leRef, year: le.year, date: le.date, term: le.term, seats: le.seats, contested: le.contested,
        elected: le.elected.map(e => `${e.name} (${e.group})`),
        ballots: (le.ballots || []).map(b => ({
          contest: b.label,
          rounds: b.rounds.map(r => ({ round: r.round, required_majority: r.required_majority, present_and_voting: r.present_and_voting, votes: r.votes.filter(v => (v.votes ?? 0) > 0).map(v => `${v.name} ${v.votes}`) })),
        })),
        verified: le.verified,
      },
      next_election: ne ? {
        ref: neRef, year: ne.year, term: ne.term, when: ne.date_note, seats: ne.seats,
        outgoing: ne.outgoing.map(o => `${o.name} (${o.group})`),
        candidates: Object.fromEntries(Object.entries(ne.candidates).map(([g, l]) => [g, (l || []).filter(c => !c.withdrawn).map(c => c.name)])),
        contested: ne.contested,
        caveat: ne.verification_note,
      } : null,
      history: sc.history.map(h => ({ year: h.year, elected: h.elected.map(e => e.name), defeated: h.unsuccessful.map(e => e.name), contested_groups: h.contested_groups, rounds_by_group: h.rounds_by_group })),
      group_names: G,
    }
    if (iso) {
      src.used(UNSC_HISTORY_FILE)
      const c = getCountryTerms().find(x => x.iso3 === iso)
      out.country = c ? {
        name: c.name, iso3: c.iso3, group: gname(c.group), permanent_member: c.permanent, terms_served: c.count,
        last_term: c.last_term, terms: c.terms.map(t => `${t.start}–${t.end} (${t.status})`), recent_candidacies: c.candidacies,
      } : { iso3: iso, permanent_member: sc.composition.some(m => m.iso3 === iso && m.permanent), terms_served: 0, note: 'Never held an elected Security Council seat (per unsc-history.json)' }
      if (out.country) {
        const nc = ne ? Object.values(ne.candidates).flat().find(x => x?.iso3 === iso) : null
        if (ne && nc) out.country.next_election = { year: ne.year, group: gname(nc.group), contested: nc.group ? ne.contested[nc.group] ?? null : null, withdrawn: nc.withdrawn }
      }
      out.history = out.history.slice(0, 5)
    }
    return out
  }

  const p = d.pga
  const cur = p.current
  const wiki = src.add('President of the United Nations General Assembly (Wikipedia)', 'https://en.wikipedia.org/wiki/President_of_the_United_Nations_General_Assembly', 'reference')
  const off = cur.official_url ? src.add(`Office of the President of the General Assembly (${ordinal(cur.session)} session)`, cur.official_url, 'official') : null
  if (cur.election_url) src.add(`Election of the President of the General Assembly, ${ordinal(cur.session)} session`, cur.election_url, 'official')
  const out: any = {
    as_of: d._meta.updated_at.slice(0, 10),
    current: {
      ref: off || wiki, name: cur.name, country: cur.country, group: gname(cur.group), session: cur.session, term: cur.term,
      elected_on: cur.elected_on, contested: cur.contested, vote: cur.vote || null,
      profile: cur.person_slug ? src.add(`${cur.name} — profile`, `/people/${cur.person_slug}`, 'page') : null,
    },
    next: {
      session: p.next.session, year: p.next.year, group: gname(p.next.group), rule: p.next.rule_detail || p.next.rule,
      election_expected: p.next.election_expected,
      candidates: p.next.candidates, candidates_note: p.next.candidates_note,
    },
    rotation: p.rotation.map(r => ({ session: r.session, year: r.year, group: r.group, president: r.president, country: r.country })),
    recent_presidents: p.list.filter(x => x.session).slice(-12).reverse().map(x => ({ session: x.session, year: x.year, name: x.name, country: x.country, group: x.group, contested: x.contested })),
    contested_elections: p.list.filter(x => x.vote).map(x => x.vote),
    ref: wiki,
  }
  if (iso) {
    const mine = p.list.filter(x => x.iso3 === iso)
    out.country = { iso3: iso, presidencies: mine.map(x => ({ year: x.year, session: x.session, sessions: x.sessions_text, name: x.name })), count: mine.length }
  }
  return out
}
