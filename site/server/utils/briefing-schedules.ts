import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { runAsk, getAsk, ASK_LANGUAGES, type AskMode, type AskTemplate } from './ask-runner'
import { readDataFile } from './data-file'
import { sendEmail, userEmail, SITE_URL } from './email'
import { addNotifications } from './notifications'
import { getUserById } from './users'

/**
 * Scheduled briefings: a saved question that the research desk answers again on a
 * schedule (daily, weekly, monthly) or when something happens (a new Security Council
 * straw poll in the Secretary-General race). The result is saved like any answer,
 * announced in the site's notifications and, if the user has an email address, emailed.
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'briefing-schedules.json')
export const MAX_PER_USER = 10

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'sg-straw-poll'
export interface Schedule {
  id: string; userId: string; title: string; question: string
  mode: AskMode; template: AskTemplate; language: string
  frequency: Frequency; weekday: number; day: number; hour: number   // UTC hour; weekday 0=Sunday; day of month 1–28
  email: boolean; enabled: boolean
  createdAt: string; lastRunAt: string | null; lastAskId: string | null; lastError: string | null
  lastTrigger?: string | null   // for event schedules: what was last seen (e.g. number of straw polls)
}

function load(): Schedule[] { try { return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf-8')).schedules || [] : [] } catch { return [] } }
function save(list: Schedule[]) { writeFileSync(FILE + '.tmp', JSON.stringify({ schedules: list }, null, 2)); renameSync(FILE + '.tmp', FILE) }

export function listSchedules(userId?: string) { return load().filter(s => !userId || s.userId === userId) }

function clean(b: any, prev?: Schedule) {
  const frequency: Frequency = ['daily', 'weekly', 'monthly', 'sg-straw-poll'].includes(b.frequency) ? b.frequency : (prev?.frequency || 'weekly')
  const n = (v: any, lo: number, hi: number, d: number) => { const x = Math.floor(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d }
  return {
    title: String(b.title ?? prev?.title ?? '').trim().slice(0, 120) || String(b.question || prev?.question || '').slice(0, 80),
    question: String(b.question ?? prev?.question ?? '').trim().slice(0, 2000),
    mode: (b.mode === 'answer' ? 'answer' : b.mode === 'briefing' ? 'briefing' : prev?.mode || 'briefing') as AskMode,
    template: (['country', 'bilateral', 'issue', 'group', 'free'].includes(b.template) ? b.template : prev?.template || 'free') as AskTemplate,
    language: ASK_LANGUAGES[b.language] ? b.language : prev?.language || 'en',
    frequency, weekday: n(b.weekday ?? prev?.weekday, 0, 6, 1), day: n(b.day ?? prev?.day, 1, 28, 1), hour: n(b.hour ?? prev?.hour, 0, 23, 6),
    email: b.email === undefined ? (prev?.email ?? true) : !!b.email,
    enabled: b.enabled === undefined ? (prev?.enabled ?? true) : !!b.enabled,
  }
}

export function createSchedule(userId: string, b: any): Schedule {
  const list = load()
  if (list.filter(s => s.userId === userId).length >= MAX_PER_USER) throw new Error(`You can have up to ${MAX_PER_USER} scheduled briefings`)
  const c = clean(b)
  if (c.question.length < 10) throw new Error('The question is too short')
  const s: Schedule = { id: randomBytes(6).toString('hex'), userId, ...c, createdAt: new Date().toISOString(), lastRunAt: null, lastAskId: null, lastError: null,
    lastTrigger: c.frequency === 'sg-straw-poll' ? strawPollMarker() : null }
  save([...list, s])
  return s
}

export function updateSchedule(userId: string, id: string, b: any, isAdmin = false): Schedule | null {
  const list = load()
  const i = list.findIndex(s => s.id === id && (s.userId === userId || isAdmin))
  if (i < 0) throw new Error('Not found')
  if (b.action === 'delete') { list.splice(i, 1); save(list); return null }
  list[i] = { ...list[i], ...clean(b, list[i]) }
  save(list)
  return list[i]
}

export function deleteUserSchedules(userId: string) { save(load().filter(s => s.userId !== userId)) }

function strawPollMarker(): string {
  const sg = readDataFile<any>('sg-selection.json')
  const polls = sg?.process?.straw_polls || []
  return String(polls.length)
}

/** Is this schedule due now (on the hourly run)? */
export function isDue(s: Schedule, now = new Date()): boolean {
  if (!s.enabled) return false
  if (s.frequency === 'sg-straw-poll') return strawPollMarker() !== (s.lastTrigger ?? '')
  if (now.getUTCHours() !== s.hour) return false
  const today = now.toISOString().slice(0, 10)
  if (s.lastRunAt && s.lastRunAt.slice(0, 10) === today) return false
  if (s.frequency === 'weekly' && now.getUTCDay() !== s.weekday) return false
  if (s.frequency === 'monthly' && now.getUTCDate() !== s.day) return false
  return true
}

function plainText(markdown: string, sources: { ref: string; title: string; url: string }[]) {
  const body = markdown
    .replace(/\[S(\d+)\]/g, '[$1]')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\s)\*(.+?)\*/g, '$1$2')
  const src = sources.map(s => `[${s.ref.slice(1)}] ${s.title} — ${s.url.startsWith('/') ? SITE_URL + s.url : s.url}`).join('\n')
  return body + (src ? `\n\nSources\n${src}` : '')
}

/** Run one schedule now: answer the question, then notify and email. */
export async function runSchedule(s: Schedule, trigger?: string): Promise<{ ok: boolean; askId?: string; error?: string }> {
  const user = getUserById(s.userId)
  if (!user) return { ok: false, error: 'user no longer exists' }
  const question = s.frequency === 'sg-straw-poll'
    ? `${s.question}\n\n(This briefing was triggered by new Security Council straw poll results in the Secretary-General selection; focus on what changed.)`
    : s.question
  const rec = await runAsk({ question, mode: s.mode, template: s.template, language: s.language, userId: s.userId, userName: user.displayName || user.username, scheduleId: s.id, onEvent: () => {} })
  const list = load()
  const i = list.findIndex(x => x.id === s.id)
  const ok = rec.status === 'done'
  if (i >= 0) {
    list[i] = { ...list[i], lastRunAt: new Date().toISOString(), lastAskId: rec.id, lastError: ok ? null : (rec.error || 'failed'), lastTrigger: trigger ?? list[i].lastTrigger }
    save(list)
  }
  const url = `${SITE_URL}/ask?id=${rec.id}`
  if (ok) {
    addNotifications(s.userId, [{ kind: 'briefing', title: `Briefing ready: ${s.title}`, body: (rec.answer || '').replace(/\[S\d+\]/g, '').replace(/[#*]/g, '').slice(0, 180), url: `/ask?id=${rec.id}` }])
    const to = s.email ? userEmail(s.userId) : null
    if (to) {
      const head = `${s.title}\n${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}\n\nRead it on the site, with links to every source: ${url}\n\n`
      const foot = `\n\n—\nScheduled briefing from World Country Groups. Change or stop it on your account page: ${SITE_URL}/account`
      await sendEmail(to, `Briefing: ${s.title}`, head + plainText(rec.answer || '', (rec.sources || []) as any) + foot)
    }
  } else {
    addNotifications(s.userId, [{ kind: 'briefing', title: `Briefing failed: ${s.title}`, body: rec.error?.slice(0, 180), url: `/account` }])
  }
  return { ok, askId: rec.id, error: ok ? undefined : rec.error }
}

/** Hourly: run every due schedule, one at a time. */
export async function runDueSchedules(): Promise<{ ran: number; failed: number }> {
  let ran = 0, failed = 0
  const now = new Date()
  for (const s of load()) {
    if (!isDue(s, now)) continue
    const trigger = s.frequency === 'sg-straw-poll' ? strawPollMarker() : undefined
    if (s.frequency === 'sg-straw-poll' && !s.lastTrigger) {
      // first check after creation: just record the current state
      const list = load(); const i = list.findIndex(x => x.id === s.id)
      if (i >= 0) { list[i].lastTrigger = trigger; save(list) }
      continue
    }
    try {
      const r = await runSchedule(s, trigger)
      r.ok ? ran++ : failed++
    } catch { failed++ }
  }
  return { ran, failed }
}

export function scheduleSummary(s: Schedule): string {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const at = `${String(s.hour).padStart(2, '0')}:00 UTC`
  return s.frequency === 'daily' ? `Every day at ${at}` : s.frequency === 'weekly' ? `Every ${DAYS[s.weekday]} at ${at}` : s.frequency === 'monthly' ? `On day ${s.day} of each month at ${at}` : 'After each new Security Council straw poll'
}

export function lastAnswerFor(s: Schedule) { return s.lastAskId ? getAsk(s.lastAskId) : null }
