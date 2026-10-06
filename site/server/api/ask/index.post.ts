import { requireAuth } from '~/server/utils/auth'
import { runAsk, asksToday, getAsk, canView, type AskMode, type AskTemplate } from '~/server/utils/ask-runner'

const DAILY_LIMIT = 40

/** Ask the research desk; streams progress as server-sent events. */
export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  const body = await readBody(event)
  const question = String(body?.question || '').trim()
  if (question.length < 5) throw createError({ statusCode: 400, statusMessage: 'Ask a question' })
  if (question.length > 2000) throw createError({ statusCode: 400, statusMessage: 'Question is too long' })
  const mode: AskMode = body?.mode === 'briefing' ? 'briefing' : 'answer'
  const template: AskTemplate = ['country', 'bilateral', 'issue', 'group', 'free'].includes(body?.template) ? body.template : 'free'
  let parentId: string | undefined
  if (body?.parentId) {
    const parent = getAsk(String(body.parentId))
    if (!parent || !canView(parent, user)) throw createError({ statusCode: 404, statusMessage: 'The earlier answer was not found' })
    parentId = parent.id
  }
  if (user.role !== 'admin' && asksToday(user.id) >= DAILY_LIMIT) {
    throw createError({ statusCode: 429, statusMessage: `Daily limit of ${DAILY_LIMIT} questions reached` })
  }

  setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      const send = (ev: any) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`)) } catch {} }
      // keep proxies from closing a quiet connection while the model works
      const ping = setInterval(() => send({ type: 'ping' }), 15000)
      try {
        await runAsk({ question, mode, template, userId: user.id, userName: user.displayName || user.username, rerunOf: body?.rerunOf, parentId, language: typeof body?.language === 'string' ? body.language : undefined, onEvent: send })
      } finally {
        clearInterval(ping)
        controller.close()
      }
    },
  })
})
