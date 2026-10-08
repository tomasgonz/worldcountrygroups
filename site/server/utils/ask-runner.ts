import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { ToolSession } from './llm-client'
import { ASK_TOOLS, runTool, SourceCollector } from './ask-tools'
import { dataFileMtime } from './data-file'

const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const ASK_DIR = join(DATA_DIR, 'asks')

export type AskMode = 'answer' | 'briefing'
export type AskTemplate = 'country' | 'bilateral' | 'issue' | 'group' | 'free'

export interface AskRecord {
  id: string
  userId: string
  userName: string
  question: string
  mode: AskMode
  template: AskTemplate
  createdAt: string
  finishedAt?: string
  status: 'running' | 'done' | 'error'
  error?: string
  answer?: string
  sources?: { ref: string; title: string; url: string; kind: string }[]
  steps?: { tool: string; args: any; label: string }[]
  datasets?: Record<string, string | null>
  model?: string
  provider?: string
  shared: boolean
  review?: { status: 'verified' | 'incorrect' | null; note?: string; by?: string; at?: string }
  rerunOf?: string
  parentId?: string   // the answer this follows up on
  threadId?: string   // first question of the conversation
  usage?: { input: number; output: number; cached: number; calls: number }
  language?: string   // answer language code (en, es, fr, ar, zh, ru, pt, de)
  scheduleId?: string // set when produced by a scheduled briefing
}

const TEMPLATES: Record<AskTemplate, string> = {
  country: `Write a country briefing with these sections (markdown "##" headings):
## Summary (3-4 bullets)
## Political and economic snapshot
## At the United Nations (voting record, alignments, blocs, General Debate positions)
## Security Council relevance
## Recent developments (last two weeks)
## Leaders
## Talking points and what to watch`,
  bilateral: `Write a bilateral meeting briefing for the two countries with these sections:
## Summary (3-4 bullets)
## The relationship at the UN (overall and subject-by-subject voting agreement)
## Positions compared (from General Debate speeches)
## Recent developments on each side
## Where they converge and diverge
## Suggested talking points`,
  issue: `Write an issue briefing with these sections:
## Summary (3-4 bullets)
## Where the UN stands (resolutions and votes)
## Who said what (speeches and quotes)
## Security Council
## Recent developments
## Outlook`,
  group: `Write a briefing on the group with these sections:
## Summary (3-4 bullets)
## Membership and cohesion
## Voting behaviour at the UN
## Positions and priorities
## Recent developments
## What to watch`,
  free: `Write a structured briefing with clear "##" sections chosen to fit the request, starting with "## Summary" (3-4 bullets).`,
}

/** One line per dataset saying how current it is, from the latest health check. */
function freshnessNote(): string {
  try {
    const h = JSON.parse(readFileSync(join(DATA_DIR, 'data-health.json'), 'utf-8'))
    const day = (t?: string | null) => (t ? t.slice(0, 10) : 'unknown')
    const keep = ['fetch-news', 'fetch-statements', 'fetch-unsc', 'build-people', 'update-general-debate', 'refresh-country-stats', 'fetch-vdem', 'fetch-sdg', 'fetch-gdelt']
    const lines = (h.jobs || []).filter((j: any) => keep.includes(j.id)).map((j: any) => `- ${j.label}: last refreshed ${day(j.refreshedAt)}${j.status === 'failing' || j.status === 'stale' ? ' (refresh currently failing; may be out of date)' : ''}`)
    const g = h.votingGap || {}
    if (g.latestVote) lines.push(`- Per-country General Assembly votes: up to ${g.latestVote}${g.missingRecordedVotes ? `; ${g.missingRecordedVotes} later recorded votes are known only as totals (search_ga_resolutions)` : ''}`)
    for (const m of h.manual || []) if (m.file !== 'un-votes-resolutions.json') lines.push(`- ${m.label} (curated by hand): last updated ${day(m.updatedAt)}`)
    return lines.length ? `\nData currency (from the latest health check):\n${lines.join('\n')}\n` : ''
  } catch { return '' }
}

export const ASK_LANGUAGES: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', ar: 'Arabic', zh: 'Chinese (simplified)', ru: 'Russian', pt: 'Portuguese', de: 'German' }

function languageNote(lang?: string) {
  if (!lang || lang === 'en' || !ASK_LANGUAGES[lang]) return ''
  const name = ASK_LANGUAGES[lang]
  return `\nLanguage: write the whole answer in ${name}, including headings and table headers. Keep proper names, document symbols (e.g. A/RES/80/1) and the citation markers [S1] unchanged. Give quotations in their original language followed by a ${name} translation in brackets when the original is not ${name}.\n`
}

function systemPrompt(mode: AskMode, template: AskTemplate, followUp = false, lang?: string) {
  const today = new Date().toISOString().slice(0, 10)
  return `You are the research desk of World Country Groups, a database on countries, international groups and the United Nations. Today is ${today}.

Method:
- Before answering, use the tools to look up the facts. Call several tools when the question has several parts; look up each country, group or person involved.
- State only facts that appear in tool results, and cite each one with the "ref" of the record it came from, like [S3] (several: [S3][S7]). Do not invent figures, dates, votes or quotes.
- If the tools return nothing relevant, say plainly what the database does not cover. You may add widely known background, but label it "(general knowledge)" and never cite it.
- Mention how current the data is where it matters (for example, General Assembly voting records may end months before today).
- When a dataset is old or its refresh is failing (see Data currency below), say so where it affects the answer.
- To find what was said about a topic, use search_texts (full speeches since 1946, statements, news); quote passages verbatim and cite them.
- For what the current Secretary-General has said or whom he has appointed, use sg_office.
- For the General Assembly as a whole (how blocs and powers vote, divided votes, committees) or ECOSOC, use general_assembly.
- For ambassadors (Permanent Representatives) to the UN in New York, use permanent_representatives.
- For who heads a UN office (PGA, ECOSOC President, USGs, agency heads) and what they said, use un_leadership.
- For the UN budget, dues, arrears, the liquidity crisis, UN80 reform or the Fifth Committee, use un_budget.
- For the Secretary-General race use sg_selection; for Security Council and PGA elections use un_elections.
- For trade with emerging economies use trade_partners; for aid budgets, cuts and donor news use donor_tracker.
- For any question about a group or region as a whole (who funds it, who it trades with, what is coming up, how united it is), start with group_picture; for informal regions (Sahel, Horn of Africa, Western Balkans...) pass the member countries.
- Write in clear, neutral English for diplomats and analysts. Prefer short paragraphs and bullets. Quote speakers only from search_quotes or speech results.
${freshnessNote()}${languageNote(lang)}${followUp ? '\nThis is a follow-up in a conversation. The earlier questions and answers are included for context, with their citations removed: look facts up again with the tools before citing them, and do not repeat earlier material unless asked.\n' : ''}
${mode === 'briefing' ? TEMPLATES[template] + '\nKeep it to roughly 500-900 words.' : 'Answer concisely (usually under 250 words): lead with the direct answer, then the supporting facts.'}`
}

const LABELS: Record<string, (a: any) => string> = {
  sg_selection: a => `Secretary-General selection${a.candidate ? `: ${a.candidate}` : ''}`,
  un_elections: a => `UN elections: ${a.body === 'pga' ? 'President of the General Assembly' : 'Security Council'}${a.country ? ` (${a.country})` : ''}`,
  trade_partners: a => `Trade partners${a.country ? `: ${a.country}` : ''}${a.partner ? ` with ${a.partner}` : ''}`,
  donor_tracker: a => `Aid donors${a.donor ? `: ${a.donor}` : ''}${a.recipient ? ` → ${a.recipient}` : ''}`,
  upcoming_events: a => `Upcoming ${a.what === 'elections' ? 'elections' : a.what === 'meetings' ? 'UN meetings' : 'UN meetings and elections'}${a.country ? `: ${a.country}` : ''}`,
  sanctions_and_conflict: a => (a.country ? `Sanctions and conflict: ${a.country}` : 'Conflict hotspots'),
  search_texts: a => `Full-text search: “${a.query}”${a.country ? ` (${a.country})` : ''}${({ speech: ', speeches', statement: ', statements', news: ', news' } as any)[a.kind] || ''}${a.from_year || a.to_year ? `, ${a.from_year || '…'}–${a.to_year || 'now'}` : ''}`,
  country_overview: a => `Country profile: ${a.country}`,
  un_voting_record: a => `UN voting record: ${a.country}`,
  voting_agreement: a => `Voting agreement: ${a.country_a} and ${a.country_b}`,
  search_ga_resolutions: a => `General Assembly resolutions: “${a.query}”${a.session ? ` (session ${a.session})` : ''}`,
  group_overview: a => `Group: ${a.group}`,
  general_assembly: a => `General Assembly and ECOSOC${a.part && a.part !== 'all' ? `: ${a.part}` : ''}`,
  permanent_representatives: a => `Permanent Representatives${a.country ? `: ${a.country}` : ''}`,
  un_leadership: a => `UN leadership${a.office ? `: ${a.office}` : ''}${a.person ? `: ${a.person}` : ''}`,
  un_budget: a => `UN budget and Fifth Committee${a.country ? `: ${a.country}` : ''}${a.group ? ` (${a.group})` : ''}${a.query ? ` “${a.query}”` : ''}`,
  sg_office: a => `Secretary-General's office${a.what && a.what !== 'both' ? `: ${a.what}` : ''}${a.country ? ` (${a.country})` : ''}${a.query ? ` “${a.query}”` : ''}`,
  group_picture: a => `Group picture: ${a.group || a.label || (a.countries || []).slice(0, 4).join(', ')}`,
  voting_blocs: () => 'Voting blocs',
  security_council: a => `Security Council${a.topic ? `: ${a.topic}` : ''}`,
  general_debate_speeches: a => `General Debate speeches${a.country ? `: ${a.country}` : ''}${a.topic ? ` on “${a.topic}”` : ''}`,
  general_debate_overview: a => `General Debate overview${a.session ? ` (session ${a.session})` : ''}`,
  search_quotes: a => `Quotes${a.query ? `: “${a.query}”` : ''}${a.speaker ? ` by ${a.speaker}` : ''}${a.country ? ` (${a.country})` : ''}`,
  person_profile: a => `Person: ${a.name}`,
  recent_news_and_statements: a => `Recent news and statements${a.country ? `: ${a.country}` : ''}${a.query ? ` on “${a.query}”` : ''}`,
}

function save(rec: AskRecord) {
  if (!existsSync(ASK_DIR)) mkdirSync(ASK_DIR, { recursive: true })
  writeFileSync(join(ASK_DIR, `${rec.id}.json`), JSON.stringify(rec, null, 2))
}

export function getAsk(id: string): AskRecord | null {
  if (!/^[a-z0-9]+$/.test(id)) return null
  const p = join(ASK_DIR, `${id}.json`)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null
}

export function listAsks(): AskRecord[] {
  if (!existsSync(ASK_DIR)) return []
  return readdirSync(ASK_DIR).filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(readFileSync(join(ASK_DIR, f), 'utf-8')) } catch { return null } })
    .filter(Boolean)
    .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
}

export function updateAsk(id: string, patch: Partial<AskRecord>) {
  const rec = getAsk(id)
  if (!rec) return null
  Object.assign(rec, patch)
  save(rec)
  return rec
}

/** Which datasets an answer used have been refreshed since it was written. */
export function staleDatasets(rec: AskRecord): string[] {
  return Object.entries(rec.datasets || {}).filter(([f, t]) => {
    const now = dataFileMtime(f)
    return now && t && now > t
  }).map(([f]) => f)
}

/** All turns of a conversation, oldest first. */
export function getThread(threadId: string): AskRecord[] {
  return listAsks().filter(a => a.id === threadId || a.threadId === threadId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Whether a user may read a record: theirs, shared (or in a shared conversation), or admin. */
export function canView(a: AskRecord, user: { id: string; role?: string }): boolean {
  if (a.userId === user.id || a.shared || user.role === 'admin') return true
  const root = a.threadId && a.threadId !== a.id ? getAsk(a.threadId) : null
  return !!root?.shared
}

/** Earlier turns leading to `parentId`, oldest first (citations removed), at most `max`. */
function historyFor(parentId: string, max = 6): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = []
  let cur = getAsk(parentId)
  while (cur && out.length < max) {
    if (cur.status === 'done' && cur.answer) {
      out.unshift({ question: cur.question, answer: cur.answer.replace(/\[S\d+\]/g, '').slice(0, 12000) })
    }
    cur = cur.parentId ? getAsk(cur.parentId) : null
  }
  return out
}

export function asksToday(userId: string): number {
  const day = new Date().toISOString().slice(0, 10)
  return listAsks().filter(a => a.userId === userId && a.createdAt.startsWith(day)).length
}

export async function runAsk(opts: {
  question: string; mode: AskMode; template: AskTemplate; userId: string; userName: string; rerunOf?: string; parentId?: string; language?: string; scheduleId?: string
  onEvent: (ev: any) => void
}): Promise<AskRecord> {
  const rec: AskRecord = {
    id: Date.now().toString(36) + randomBytes(3).toString('hex'),
    userId: opts.userId, userName: opts.userName, question: opts.question.trim(), mode: opts.mode, template: opts.template,
    createdAt: new Date().toISOString(), status: 'running', shared: false, steps: [], rerunOf: opts.rerunOf,
    language: ASK_LANGUAGES[opts.language || ''] ? opts.language : 'en', scheduleId: opts.scheduleId,
  }
  const parent = opts.parentId ? getAsk(opts.parentId) : null
  if (parent) {
    rec.parentId = parent.id
    rec.threadId = parent.threadId || parent.id
  }
  save(rec)
  opts.onEvent({ type: 'start', id: rec.id })

  const src = new SourceCollector()
  let sessionRef: ToolSession | null = null
  try {
    const history = parent ? historyFor(parent.id) : []
    const session = new ToolSession(systemPrompt(opts.mode, opts.template, history.length > 0, rec.language), rec.question, ASK_TOOLS,
      { task: 'ask', maxTokens: opts.mode === 'briefing' ? 16000 : 8000 }, history)
    sessionRef = session
    const provider: any = session.provider
    let final = ''
    for (let round = 0; round < 8; round++) {
      const r = await session.next(round < 7)
      if (!r.toolCalls.length) { final = r.content; break }
      for (const call of r.toolCalls.slice(0, 10)) {
        const label = (LABELS[call.name] || (() => call.name))(call.arguments || {})
        rec.steps!.push({ tool: call.name, args: call.arguments, label })
        opts.onEvent({ type: 'step', label })
        let result: any
        try { result = await runTool(call.name, call.arguments || {}, src) } catch (e: any) { result = { error: String(e?.message || e) } }
        let text = JSON.stringify(result)
        if (text.length > 9000) text = text.slice(0, 9000) + '…(truncated)'
        session.addToolResult(call.id, text)
      }
      opts.onEvent({ type: 'thinking' })
    }
    if (!final.trim()) throw new Error('The model did not produce an answer')
    // keep only the sources the answer actually cites, in citation order
    // the question is already shown as the title, so drop a leading "# heading" the model adds
    final = final.replace(/^\s*#\s[^\n]*\n+/, '')
    // keep only cited sources that exist, renumbered S1, S2… in order of first citation
    const cited = [...new Set([...final.matchAll(/\[(S\d+)\]/g)].map(m => m[1]))].filter(ref => src.sources.some(s => s.ref === ref))
    const renum = new Map(cited.map((ref, i) => [ref, `S${i + 1}`]))
    final = final.replace(/\[(S\d+)\]/g, (m, ref) => (renum.has(ref) ? `[${renum.get(ref)}]` : ''))
    rec.sources = cited.map(ref => ({ ...src.sources.find(s => s.ref === ref)!, ref: renum.get(ref)! })) as any
    rec.answer = final
    rec.status = 'done'
    rec.model = provider?.model
    rec.provider = provider?.name
    rec.datasets = Object.fromEntries([...src.datasets].map(f => [f, dataFileMtime(f)]))
    rec.finishedAt = new Date().toISOString()
    rec.usage = sessionRef?.usage
    save(rec)
    opts.onEvent({ type: 'done', record: rec })
  } catch (e: any) {
    rec.status = 'error'
    rec.usage = sessionRef?.usage
    rec.error = String(e?.message || e).slice(0, 500)
    rec.finishedAt = new Date().toISOString()
    save(rec)
    opts.onEvent({ type: 'error', message: rec.error, id: rec.id })
  }
  return rec
}
