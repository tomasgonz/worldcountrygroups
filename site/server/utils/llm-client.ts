import { getActiveProvider, type AIProviderConfig } from './ai-config'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMOptions {
  maxTokens?: number
  temperature?: number
  provider?: AIProviderConfig
}

export function isAIConfigured(): boolean {
  return getActiveProvider() !== null
}

export function getAIStatus(): { configured: boolean; provider: string | null } {
  const p = getActiveProvider()
  return { configured: !!p, provider: p ? p.name : null }
}

export async function callLLM(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
  const provider = options?.provider || getActiveProvider()
  if (!provider) throw new Error('No AI provider configured')

  if (provider.type === 'anthropic') {
    return callAnthropic(provider, messages, options)
  }
  return callOpenAI(provider, messages, options)
}

export async function callLLMStream(messages: LLMMessage[], options?: LLMOptions): Promise<ReadableStream<string>> {
  const provider = options?.provider || getActiveProvider()
  if (!provider) throw new Error('No AI provider configured')

  if (provider.type === 'anthropic') {
    return streamAnthropic(provider, messages, options)
  }
  return streamOpenAI(provider, messages, options)
}

// OpenAI / OpenAI-compatible
function useNewOpenAIParams(model: string): boolean {
  return /^(o1|o3|gpt-5|gpt-4\.5)/.test(model || '')
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
          if (payload === '[DONE]') { controller.close(); return }
          try {
            const json = JSON.parse(payload)
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
            if (json.type === 'content_block_delta' && json.delta?.text) {
              controller.enqueue(json.delta.text)
            }
            if (json.type === 'message_stop') {
              controller.close()
              return
            }
          } catch {}
        }
      }
    },
  })
}
