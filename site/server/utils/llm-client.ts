import { getActiveProvider, getProviderForTask, type AIProviderConfig } from './ai-config'
import { recordUsage, usageFrom, type Usage } from './ai-usage'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMOptions {
  maxTokens?: number
  temperature?: number
  provider?: AIProviderConfig
  /** which kind of work this is; picks the model assigned to it in the admin page */
  task?: string
}

export function isAIConfigured(): boolean {
  return getActiveProvider() !== null
}

export function getAIStatus(): { configured: boolean; provider: string | null } {
  const p = getActiveProvider()
  return { configured: !!p, provider: p ? p.name : null }
}

export async function callLLM(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
  const provider = options?.provider || getProviderForTask(options?.task)
  if (!provider) throw new Error('No AI provider configured')

  try {
    return provider.type === 'anthropic' ? await callAnthropic(provider, messages, options) : await callOpenAI(provider, messages, options)
  } catch (e) {
    recordUsage(options?.task, provider, null, true)
    throw e
  }
}

export async function callLLMStream(messages: LLMMessage[], options?: LLMOptions): Promise<ReadableStream<string>> {
  const provider = options?.provider || getProviderForTask(options?.task)
  if (!provider) throw new Error('No AI provider configured')

  try {
    return provider.type === 'anthropic' ? await streamAnthropic(provider, messages, options) : await streamOpenAI(provider, messages, options)
  } catch (e) {
    recordUsage(options?.task, provider, null, true)
    throw e
  }
}

/** Providers known to accept stream_options.include_usage (others may reject unknown fields). */
function streamsUsage(baseUrl: string) {
  return /api\.openai\.com|api\.groq\.com/.test(baseUrl)
}

// OpenAI / OpenAI-compatible
function useNewOpenAIParams(model: string): boolean {
  // reasoning models: max_completion_tokens and no temperature
  return /^(o\d|gpt-([5-9]|\d{2})|gpt-4\.5)/.test(model || '')
}

async function callOpenAI(provider: AIProviderConfig, messages: LLMMessage[], options?: LLMOptions): Promise<string> {
  const baseUrl = provider.baseUrl || 'https://api.openai.com/v1'
  const newParams = useNewOpenAIParams(provider.model)
  const maxTok = options?.maxTokens || provider.maxTokens || 4096
  const body: Record<string, any> = {
    model: provider.model,
    messages,
    [newParams ? 'max_completion_tokens' : 'max_tokens']: maxTok,
  }
  if (!newParams) body.temperature = options?.temperature ?? provider.temperature ?? 0.7
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  recordUsage(options?.task, provider, usageFrom(data))
  return data.choices?.[0]?.message?.content || ''
}

async function streamOpenAI(provider: AIProviderConfig, messages: LLMMessage[], options?: LLMOptions): Promise<ReadableStream<string>> {
  const baseUrl = provider.baseUrl || 'https://api.openai.com/v1'
  const newParams = useNewOpenAIParams(provider.model)
  const maxTok = options?.maxTokens || provider.maxTokens || 4096
  const body: Record<string, any> = {
    model: provider.model,
    messages,
    [newParams ? 'max_completion_tokens' : 'max_tokens']: maxTok,
    stream: true,
  }
  if (streamsUsage(baseUrl)) body.stream_options = { include_usage: true }
  if (!newParams) body.temperature = options?.temperature ?? provider.temperature ?? 0.7
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${err}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let usage: Usage | null = null
  let recorded = false
  const done = () => { if (!recorded) { recorded = true; recordUsage(options?.task, provider, usage) } }

  return new ReadableStream<string>({
    async pull(controller) {
      let buffer = ''
      while (true) {
        const { done: end, value } = await reader.read()
        if (end) { done(); controller.close(); return }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') { done(); controller.close(); return }
          try {
            const json = JSON.parse(payload)
            usage = usageFrom(json) || usage
            const content = json.choices?.[0]?.delta?.content
            if (content) controller.enqueue(content)
          } catch {}
        }
      }
    },
  })
}

// Anthropic
async function callAnthropic(provider: AIProviderConfig, messages: LLMMessage[], options?: LLMOptions): Promise<string> {
  const baseUrl = provider.baseUrl || 'https://api.anthropic.com'
  const systemMsg = messages.find(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')

  const body: any = {
    model: provider.model,
    max_tokens: options?.maxTokens || provider.maxTokens || 4096,
    temperature: options?.temperature ?? provider.temperature ?? 0.7,
    messages: nonSystem.map(m => ({ role: m.role, content: m.content })),
  }
  if (systemMsg) body.system = systemMsg.content

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  recordUsage(options?.task, provider, usageFrom(data))
  return data.content?.[0]?.text || ''
}

async function streamAnthropic(provider: AIProviderConfig, messages: LLMMessage[], options?: LLMOptions): Promise<ReadableStream<string>> {
  const baseUrl = provider.baseUrl || 'https://api.anthropic.com'
  const systemMsg = messages.find(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')

  const body: any = {
    model: provider.model,
    max_tokens: options?.maxTokens || provider.maxTokens || 4096,
    temperature: options?.temperature ?? provider.temperature ?? 0.7,
    messages: nonSystem.map(m => ({ role: m.role, content: m.content })),
    stream: true,
  }
  if (systemMsg) body.system = systemMsg.content

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let aIn = 0
  let aOut = 0

  return new ReadableStream<string>({
    async pull(controller) {
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) { controller.close(); return }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          try {
            const json = JSON.parse(payload)
            if (json.type === 'message_start') aIn = json.message?.usage?.input_tokens || 0
            if (json.type === 'message_delta') aOut = json.usage?.output_tokens || aOut
            if (json.type === 'content_block_delta' && json.delta?.text) {
              controller.enqueue(json.delta.text)
            }
            if (json.type === 'message_stop') {
              recordUsage(options?.task, provider, { input: aIn, output: aOut })
              controller.close()
              return
            }
          } catch {}
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Tool calling (OpenAI-compatible APIs: OpenAI, Groq, most others)
// ---------------------------------------------------------------------------

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, any> // JSON schema
}

export interface ToolCall { id: string; name: string; arguments: any }

/**
 * One round of a tool-using conversation. `messages` may include assistant messages
 * with tool_calls and { role: 'tool', tool_call_id, content } results.
 */
export async function callLLMWithTools(
  messages: any[],
  tools: ToolDef[],
  options?: LLMOptions,
): Promise<{ content: string; toolCalls: ToolCall[]; assistantMessage: any; provider: AIProviderConfig; usage: Usage | null }> {
  const provider = options?.provider || getProviderForTask(options?.task)
  if (!provider) throw new Error('No AI provider configured')
  if (provider.type === 'anthropic') {
    throw new Error('The research desk needs an OpenAI-compatible model (OpenAI, Groq…). Assign one to “Ask the database” in Admin › Model per task.')
  }
  const baseUrl = provider.baseUrl || 'https://api.openai.com/v1'
  const newParams = useNewOpenAIParams(provider.model)
  const maxTok = options?.maxTokens || provider.maxTokens || 4096
  const body: any = {
    model: provider.model,
    messages,
    [newParams ? 'max_completion_tokens' : 'max_tokens']: maxTok,
  }
  if (tools.length) { // an empty tool list is rejected; omit it to force a written answer
    body.tools = tools.map(t => ({ type: 'function', function: t }))
    body.tool_choice = 'auto'
  }
  if (!newParams) body.temperature = options?.temperature ?? provider.temperature ?? 0.3
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    recordUsage(options?.task, provider, null, true)
    throw new Error(`AI provider error ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const data: any = await res.json()
  const usage = usageFrom(data)
  recordUsage(options?.task, provider, usage)
  const msg = data.choices?.[0]?.message || {}
  const toolCalls: ToolCall[] = (msg.tool_calls || []).map((c: any) => {
    let args: any = {}
    try { args = JSON.parse(c.function?.arguments || '{}') } catch {}
    return { id: c.id, name: c.function?.name, arguments: args }
  })
  return { content: msg.content || '', toolCalls, assistantMessage: msg, provider, usage }
}

/**
 * A multi-round tool-using session. OpenAI providers use the Responses API (required
 * for tools with reasoning models such as GPT-5.x/6.x); OpenAI-compatible providers
 * (Groq, etc.) use chat completions with tool calls.
 */
export class ToolSession {
  private messages: any[] = []
  private previousId: string | null = null
  private pending: any[] = []
  provider: AIProviderConfig

  /** Tokens used by this session so far. */
  usage = { input: 0, output: 0, cached: 0, calls: 0 }
  private task?: string

  /**
   * history: earlier turns of the same thread (question + the answer given), oldest
   * first, so a follow-up question is understood in context.
   */
  constructor(private system: string, question: string, private tools: ToolDef[], options?: LLMOptions,
    history: { question: string; answer: string }[] = []) {
    const p = options?.provider || getProviderForTask(options?.task)
    if (!p) throw new Error('No AI provider configured')
    if (p.type === 'anthropic') {
      throw new Error('The research desk needs an OpenAI or OpenAI-compatible model. Assign one to “Ask the database” in Admin › Model per task.')
    }
    this.provider = p
    this.task = options?.task
    this.maxTokens = options?.maxTokens || p.maxTokens || 8000
    const turns = history.flatMap(h => [{ role: 'user', content: h.question }, { role: 'assistant', content: h.answer }])
    if (p.type === 'openai') this.pending = [...turns, { role: 'user', content: question }]
    else this.messages = [{ role: 'system', content: system }, ...turns, { role: 'user', content: question }]
  }

  private add(u: Usage | null) {
    this.usage.calls++
    if (!u) return
    this.usage.input += u.input || 0
    this.usage.output += u.output || 0
    this.usage.cached += u.cached || 0
  }

  private maxTokens: number

  /** Add the results of the previous round's tool calls. */
  addToolResult(callId: string, output: string) {
    if (this.provider.type === 'openai') this.pending.push({ type: 'function_call_output', call_id: callId, output })
    else this.messages.push({ role: 'tool', tool_call_id: callId, content: output })
  }

  /** Run one round. With allowTools=false the model must write its answer. */
  async next(allowTools = true): Promise<{ content: string; toolCalls: ToolCall[] }> {
    return this.provider.type === 'openai' ? this.nextResponses(allowTools) : this.nextChat(allowTools)
  }

  private async nextResponses(allowTools: boolean) {
    const p = this.provider
    const body: any = {
      model: p.model,
      instructions: this.system,
      input: this.pending,
      max_output_tokens: this.maxTokens,
    }
    if (this.previousId) body.previous_response_id = this.previousId
    if (allowTools) body.tools = this.tools.map(t => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters }))
    if (!useNewOpenAIParams(p.model)) body.temperature = p.temperature ?? 0.3
    const res = await fetch(`${p.baseUrl || 'https://api.openai.com/v1'}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      recordUsage(this.task, p, null, true)
      throw new Error(`AI provider error ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }
    const data: any = await res.json()
    const usage = usageFrom(data)
    recordUsage(this.task, p, usage)
    this.add(usage)
    this.previousId = data.id
    this.pending = []
    const out: any[] = data.output || []
    const toolCalls: ToolCall[] = out.filter(o => o.type === 'function_call').map((o) => {
      let args: any = {}
      try { args = JSON.parse(o.arguments || '{}') } catch {}
      return { id: o.call_id, name: o.name, arguments: args }
    })
    const content = out.filter(o => o.type === 'message')
      .flatMap(o => (o.content || []).filter((c: any) => c.type === 'output_text').map((c: any) => c.text)).join('\n')
    return { content, toolCalls }
  }

  private async nextChat(allowTools: boolean) {
    const r = await callLLMWithTools(this.messages, allowTools ? this.tools : [], { provider: this.provider, maxTokens: this.maxTokens, task: this.task })
    this.add(r.usage)
    if (r.toolCalls.length) this.messages.push({ role: 'assistant', content: r.content || null, tool_calls: r.assistantMessage.tool_calls })
    return { content: r.content, toolCalls: r.toolCalls }
  }
}
