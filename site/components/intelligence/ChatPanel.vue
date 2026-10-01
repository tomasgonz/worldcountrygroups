<template>
  <!-- Floating trigger button -->
  <button
    v-if="!isOpen && aiStatus?.configured"
    @click="isOpen = true"
    class="fixed bottom-6 right-6 z-40 bg-primary-900 text-white rounded-full p-4 shadow-lg hover:bg-primary-800 transition-colors"
    title="Ask AI"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
    </svg>
  </button>

  <!-- Slide-over panel -->
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-x-0"
    leave-to-class="translate-x-full"
  >
    <div
      v-if="isOpen"
      class="fixed right-0 top-0 h-full w-full sm:w-96 z-50 bg-white border-l border-primary-200 shadow-2xl flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-primary-100 bg-primary-50">
        <div>
          <div class="text-sm font-semibold text-primary-900">Ask AI</div>
          <div v-if="contextLabel" class="text-xs text-primary-500 truncate max-w-[250px]">{{ contextLabel }}</div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="clearChat" class="text-xs text-primary-400 hover:text-primary-600" title="Clear chat">Clear</button>
          <button @click="isOpen = false" class="text-primary-400 hover:text-primary-700">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messageContainer" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div v-if="!messages.length" class="text-center py-12">
          <div class="text-primary-300 text-sm">Ask a question about the current analysis</div>
          <div class="mt-3 space-y-2">
            <button v-for="q in suggestedQuestions" :key="q" @click="sendMessage(q)" class="block w-full text-left text-xs px-3 py-2 rounded-lg border border-primary-100 text-primary-600 hover:bg-primary-50">
              {{ q }}
            </button>
          </div>
        </div>

        <div v-for="(msg, i) in messages" :key="i" :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
          <div
            :class="msg.role === 'user'
              ? 'bg-primary-900 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]'
              : 'bg-primary-50 text-primary-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]'"
            class="text-sm leading-relaxed whitespace-pre-wrap"
          >
            {{ msg.content }}
            <span v-if="isStreaming && i === messages.length - 1 && msg.role === 'assistant'" class="inline-block w-1.5 h-4 bg-primary-400 ml-0.5 animate-pulse"></span>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="border-t border-primary-100 px-4 py-3">
        <div class="flex items-end gap-2">
          <textarea
            v-model="input"
            @keydown.enter.exact.prevent="handleSend"
            rows="1"
            class="flex-1 resize-none border border-primary-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400 max-h-24"
            placeholder="Ask a question..."
            :disabled="isStreaming"
          />
          <button
            @click="handleSend"
            :disabled="!input.trim() || isStreaming"
            class="bg-primary-900 text-white rounded-xl px-3 py-2 text-sm disabled:opacity-40 hover:bg-primary-800"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const props = defineProps<{
  messages: any[]
  isStreaming: boolean
  isOpen: boolean
  contextLabel: string
  aiStatus: { configured: boolean; provider: string | null } | null
}>()

const emit = defineEmits<{
  'update:isOpen': [val: boolean]
  sendMessage: [msg: string]
  clearChat: []
}>()

const isOpen = computed({
  get: () => props.isOpen,
  set: (val) => emit('update:isOpen', val),
})

const input = ref('')
const messageContainer = ref<HTMLElement | null>(null)

const suggestedQuestions = computed(() => {
  return [
    'What are the key takeaways?',
    'What are the biggest risks?',
    'How has the situation changed recently?',
    'What should diplomats focus on?',
  ]
})

function handleSend() {
  if (!input.value.trim() || props.isStreaming) return
  emit('sendMessage', input.value.trim())
  input.value = ''
}

function sendMessage(msg: string) {
  emit('sendMessage', msg)
}

function clearChat() {
  emit('clearChat')
}

watch(() => props.messages.length, () => {
  nextTick(() => {
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
    }
  })
})
</script>
