import { isAIConfigured, callLLMStream } from '~/server/utils/llm-client'
import { buildChatContextPrompt } from '~/server/utils/ai-prompts'
import type { LLMMessage } from '~/server/utils/llm-client'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const body = await readBody(event)
  const { contextType, contextParams, messages: chatMessages } = body

  if (!contextType || !chatMessages?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Missing contextType or messages' })
  }

  // Fetch context data based on type
  let contextData: any = {}
  try {
    if (contextType === 'country' && contextParams?.iso) {
      contextData = await $fetch('/api/intelligence/country-briefing', { query: { iso: contextParams.iso } })
    } else if (contextType === 'bilateral' && contextParams?.a && contextParams?.b) {
      contextData = await $fetch('/api/intelligence/bilateral-prep', { query: { a: contextParams.a, b: contextParams.b } })
    } else if (contextType === 'group' && contextParams?.gid) {
      contextData = await $fetch('/api/intelligence/group-trends', { query: { gid: contextParams.gid } })
    }
  } catch {}

  const history: LLMMessage[] = chatMessages.map((m: any) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const messages = buildChatContextPrompt(contextType, contextData, history)

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const stream = await callLLMStream(messages, { task: 'chat', task: 'chat' })
  const reader = stream.getReader()

  const encoder = new TextEncoder()
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
    },
  })
})
