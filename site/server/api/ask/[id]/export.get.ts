import { requireAuth, getSession } from '~/server/utils/auth'
import { shareFromEvent, sharedAskId } from '~/server/utils/share-links'
import { getAsk, getThread, canView, type AskRecord } from '~/server/utils/ask-runner'
import { buildDocx, buildPdf, exportFilename, type ExportTurn } from '~/server/utils/briefing-export'

/**
 * One answer (or, with ?thread=1, its whole conversation) as a Word document or PDF.
 * GET /api/ask/:id/export?format=docx|pdf&thread=1 — same access rules as GET /api/ask/:id.
 */
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id'))
  const q = getQuery(event)
  const format = String(q.format || 'docx').toLowerCase() === 'pdf' ? 'pdf' : 'docx'
  const wantThread = ['1', 'true', 'yes'].includes(String(q.thread || ''))

  let rec: AskRecord | null
  let turns: AskRecord[]
  const share = shareFromEvent(event)
  if (!getSession(event) && share && sharedAskId(share) === id) {
    // share-link visitor: this answer and the conversation it belongs to, read-only
    rec = getAsk(id)
    if (!rec) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    turns = wantThread ? getThread(rec.threadId || rec.id) : [rec]
  } else {
    const { user } = requireAuth(event)
    rec = getAsk(id)
    if (!rec || !canView(rec, user)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    turns = wantThread ? getThread(rec.threadId || rec.id).filter(t => canView(t, user)) : [rec]
  }

  // only finished answers; strip everything but what the document shows (no user data)
  const doc: ExportTurn[] = turns.filter(t => t.status === 'done' && t.answer).map(t => ({
    id: t.id, question: t.question, mode: t.mode, template: t.template,
    createdAt: t.createdAt, finishedAt: t.finishedAt, answer: t.answer, sources: t.sources,
  }))
  if (!doc.length) throw createError({ statusCode: 409, statusMessage: 'This answer has no finished text to export yet' })

  const buf = format === 'pdf' ? await buildPdf(doc, { thread: wantThread }) : await buildDocx(doc, { thread: wantThread })
  const last = doc.map(t => t.finishedAt || t.createdAt).sort().pop()!
  const name = exportFilename(doc[0].question, last, format)

  setResponseHeaders(event, {
    'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Content-Length': String(buf.length),
    'Cache-Control': 'private, no-store',
  })
  return buf
})
