import { readDataFile } from './data-file'
import { getCronJobs, startJobNow } from './cron-config'
import { generateUNBriefing } from './un-briefing'
import { getCachedAnalysis } from './ai-cache'
import { runSaid, saidUpdatedAt } from './said'

/** Admin "Regenerate" on a page: start the data jobs or AI tasks behind it, and report their state. */
const running: Record<string, { since: string; error?: string | null }> = {}
const lastDone: Record<string, { at: string; ok: boolean; error?: string | null }> = {}

const TASKS: Record<string, { label: string; run: () => Promise<any>; updatedAt: () => string | null }> = {
  'un-briefing': { label: 'Council analysis (AI)', run: () => generateUNBriefing(), updatedAt: () => getCachedAnalysis('un-monitor-briefing')?.generatedAt || null },
  said: { label: 'What was said (quote picks, AI)', run: () => runSaid({ force: true }), updatedAt: () => saidUpdatedAt() },
}

export function regenerateStatus(ids: string[]) {
  const jobs = getCronJobs()
  const st = readDataFile<Record<string, any>>('job-status.json') || {}
  return ids.map((id) => {
    if (TASKS[id]) {
      const t = TASKS[id]
      return { id, kind: 'task', label: t.label, running: !!running[id], updatedAt: t.updatedAt(), ok: lastDone[id]?.ok ?? true, error: lastDone[id]?.error || null }
    }
    const j = jobs.find(x => x.id === id)
    const s = st[id] || {}
    return { id, kind: 'job', label: j?.label || id, running: !!s.running, lastStart: s.lastStart || null, lastEnd: s.lastEnd || null, updatedAt: s.lastSuccess || s.lastEnd || null, ok: s.ok !== false, error: s.ok === false ? (s.error || 'failed') : null, missing: !j }
  })
}

export function regenerate(id: string): { started: boolean; note?: string } {
  if (TASKS[id]) {
    if (running[id]) return { started: false, note: 'already running' }
    running[id] = { since: new Date().toISOString() }
    TASKS[id].run()
      .then(() => { lastDone[id] = { at: new Date().toISOString(), ok: true } })
      .catch((e: any) => { lastDone[id] = { at: new Date().toISOString(), ok: false, error: String(e?.message || e).slice(0, 200) } })
      .finally(() => { delete running[id] })
    return { started: true }
  }
  const st = readDataFile<Record<string, any>>('job-status.json') || {}
  if (st[id]?.running) return { started: false, note: 'already running' }
  startJobNow(id)
  return { started: true }
}
