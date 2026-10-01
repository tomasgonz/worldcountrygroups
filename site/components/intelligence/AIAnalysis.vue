<template>
  <section v-if="aiStatus?.configured" :id="sectionIds[type]" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
    <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">{{ titles[type] || 'Strategic Overview' }}</h3>

    <div v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg p-3">{{ error }}</div>

    <div v-else-if="loading" class="space-y-3 py-2">
      <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
      <div class="h-3 bg-primary-100 rounded-full w-11/12 animate-pulse"></div>
      <div class="h-3 bg-primary-100 rounded-full w-4/5 animate-pulse"></div>
      <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
      <div class="h-3 bg-primary-100 rounded-full w-3/4 animate-pulse"></div>
    </div>

    <div v-else-if="result">
      <div
        class="prose prose-sm prose-primary max-w-none
          prose-headings:font-serif prose-headings:text-primary-900 prose-headings:font-bold
          prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2
          prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1.5
          prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3
          prose-strong:text-primary-800 prose-strong:font-semibold
          prose-ul:my-2 prose-li:text-primary-700 prose-li:my-0.5
          prose-ol:my-2"
        v-html="renderedContent"
      ></div>
      <div class="flex items-center justify-between mt-4 pt-3 border-t border-primary-100">
        <span class="text-xs text-primary-300">Updated {{ timeAgo }}</span>
        <button @click="regenerate" class="text-xs text-primary-300 hover:text-primary-500 transition-colors">
          Refresh
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps<{
  type: 'country' | 'bilateral' | 'group'
  params: Record<string, string>
  aiStatus: { configured: boolean; provider: string | null } | null
}>()

interface AnalysisResult {
  cached: boolean
  content: string
  generatedAt: string
  provider: string
  model: string
}

const titles: Record<string, string> = {
  country: 'Strategic Overview',
  bilateral: 'Relationship Overview',
  group: 'Group Overview',
}

const sectionIds: Record<string, string> = {
  country: 'intel-overview',
  bilateral: 'bi-overview',
  group: 'gt-overview',
}

const result = ref<AnalysisResult | null>(null)
const loading = ref(false)
const error = ref('')

const { highlight } = useBriefHighlight()
const renderedContent = computed(() => {
  if (!result.value?.content) return ''
  return marked.parse(highlight(result.value.content)) as string
})

const timeAgo = computed(() => {
  if (!result.value?.generatedAt) return ''
  const ms = Date.now() - new Date(result.value.generatedAt).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
})

const endpoints: Record<string, string> = {
  country: '/api/intelligence/ai/country-analysis',
  bilateral: '/api/intelligence/ai/bilateral-analysis',
  group: '/api/intelligence/ai/group-analysis',
}

async function fetchAnalysis(force = false) {
  if (!props.aiStatus?.configured) return
  error.value = ''
  loading.value = true
  result.value = null

  try {
    const params = { ...props.params } as Record<string, string>
    if (force) params.force = 'true'
    result.value = await $fetch<AnalysisResult>(endpoints[props.type], { query: params })
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to load analysis'
  }

  loading.value = false
}

function regenerate() {
  fetchAnalysis(true)
}

watch(() => props.params, () => {
  fetchAnalysis()
}, { deep: true })

onMounted(() => {
  fetchAnalysis()
})
</script>
