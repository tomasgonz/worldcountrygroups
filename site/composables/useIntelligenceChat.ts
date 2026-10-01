interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function useIntelligenceChat() {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const isOpen = ref(false)
  const contextType = ref<string>('')
  const contextParams = ref<Record<string, string>>({})
  const contextLabel = ref('')

  function setContext(type: string, params: Record<string, string>, label: string = '') {
    contextType.value = type
    contextParams.value = params
    contextLabel.value = label
    // Clear messages when context changes
    messages.value = []
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isStreaming.value) return

    messages.value.push({ role: 'user', content: content.trim() })
    isStreaming.value = true

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    messages.value.push(assistantMsg)

    try {
      const res = await fetch('/api/intelligence/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextType: contextType.value,
          contextParams: contextParams.value,
          messages: messages.value.slice(0, -1), // exclude the empty assistant message
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        assistantMsg.content = `Error: ${res.status} — ${err}`
        isStreaming.value = false
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') break
          try {
            const text = JSON.parse(payload)
            if (typeof text === 'string') {
              assistantMsg.content += text
            }
          } catch {}
        }
      }
    } catch (e: any) {
      assistantMsg.content = `Error: ${e.message}`
    }

    isStreaming.value = false
  }

  function clearChat() {
    messages.value = []
  }

  return {
    messages,
    isStreaming,
    isOpen,
    contextType,
    contextParams,
    contextLabel,
    setContext,
    sendMessage,
    clearChat,
  }
}
