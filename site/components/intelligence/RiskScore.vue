<template>
  <section v-if="aiStatus?.configured" id="intel-risk-score" class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
    <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Risk Assessment</h3>

    <div v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg p-3">{{ error }}</div>

    <div v-else-if="loading" class="space-y-3 py-2">
      <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
      <div class="h-3 bg-primary-100 rounded-full w-11/12 animate-pulse"></div>
      <div class="h-3 bg-primary-100 rounded-full w-4/5 animate-pulse"></div>
    </div>

    <template v-else-if="riskData">
      <!-- Overall Score -->
      <div class="flex items-center gap-6 mb-6">
        <div class="text-center">
          <div
            class="text-4xl font-bold font-serif"
            :class="scoreColor(riskData.overall_score)"
          >{{ riskData.overall_score }}</div>
          <div class="text-xs text-primary-400 mt-1">/ 10</div>
        </div>
        <div class="flex-1">
          <div class="text-sm text-primary-700 mb-1">Overall Risk Level</div>
          <div class="h-3 rounded-full bg-primary-100 overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="barColor(riskData.overall_score)"
              :style="{ width: (riskData.overall_score * 10) + '%' }"
            ></div>
          </div>
        </div>
        <span
          class="px-3 py-1 rounded-full text-xs font-medium"
          :class="outlookBadge(riskData.outlook)"
        >{{ riskData.outlook }}</span>
      </div>

      <!-- Category Bars -->
      <div class="space-y-3 mb-6">
        <div v-for="(score, category) in riskData.categories" :key="category">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-primary-600 capitalize">{{ formatCategory(category as string) }}</span>
            <span class="font-medium" :class="scoreColor(score as number)">{{ score }}</span>
          </div>
          <div class="h-2 rounded-full bg-primary-100 overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="barColor(score as number)"
              :style="{ width: ((score as number) * 10) + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Key Risks -->
      <div v-if="riskData.key_risks?.length" class="mb-4">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Key Risks</h5>
        <ul class="space-y-1">
          <li v-for="(risk, i) in riskData.key_risks" :key="i" class="text-sm text-primary-700 flex items-start gap-2">
            <span class="text-red-400 mt-0.5">&#9679;</span>
            <span>{{ risk }}</span>
          </li>
        </ul>
      </div>

      <!-- Mitigating Factors -->
      <div v-if="riskData.mitigating_factors?.length" class="mb-4">
        <h5 class="text-xs font-medium text-primary-500 mb-2">Mitigating Factors</h5>
        <ul class="space-y-1">
          <li v-for="(factor, i) in riskData.mitigating_factors" :key="i" class="text-sm text-primary-700 flex items-start gap-2">
            <span class="text-emerald-400 mt-0.5">&#9679;</span>
            <span>{{ factor }}</span>
          </li>
        </ul>
      </div>

      <div class="flex items-center justify-between mt-4 pt-3 border-t border-primary-100">
        <span class="text-xs text-primary-300">Updated {{ timeAgo }}</span>
        <button @click="fetchRisk(true)" class="text-xs text-primary-300 hover:text-primary-500 transition-colors">Refresh</button>
      </div>
    </template>

    <!-- Fallback: render raw markdown if JSON parse fails -->
    <div
      v-else-if="rawContent"
      class="prose prose-sm prose-primary max-w-none"
      v-html="renderedRaw"
    ></div>
  </section>
</template>

<script setup lang="ts">
import { marked } from 'marked'

const props = defineProps<{
  iso: string
  aiStatus: { configured: boolean; provider: string | null } | null
}>()

interface RiskScoreData {
  overall_score: number
  categories: {
    security: number
    governance: number
    diplomatic_isolation: number
    economic_vulnerability: number
    regional_instability: number
  }
  key_risks: string[]
  mitigating_factors: string[]
  outlook: string
}

const riskData = ref<RiskScoreData | null>(null)
const rawContent = ref('')
const loading = ref(false)
const error = ref('')
const generatedAt = ref('')

const renderedRaw = computed(() => rawContent.value ? marked.parse(rawContent.value) as string : '')

const timeAgo = computed(() => {
  if (!generatedAt.value) return ''
  const ms = Date.now() - new Date(generatedAt.value).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
})

function scoreColor(score: number) {
  if (score <= 3) return 'text-emerald-600'
  if (score <= 7) return 'text-amber-600'
  return 'text-red-600'
}

function barColor(score: number) {
  if (score <= 3) return 'bg-emerald-400'
  if (score <= 7) return 'bg-amber-400'
  return 'bg-red-400'
}

function outlookBadge(outlook: string) {
  if (outlook === 'improving') return 'bg-emerald-100 text-emerald-700'
  if (outlook === 'stable') return 'bg-blue-100 text-blue-700'
  if (outlook === 'deteriorating') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

function formatCategory(cat: string) {
  return cat.replace(/_/g, ' ')
}

async function fetchRisk(force = false) {
  if (!props.aiStatus?.configured || !props.iso) return
  error.value = ''
  loading.value = true
  riskData.value = null
  rawContent.value = ''

  try {
    const params: Record<string, string> = { iso: props.iso }
    if (force) params.force = 'true'
    const res = await $fetch<any>('/api/intelligence/ai/risk-score', { query: params })
    generatedAt.value = res.generatedAt

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(res.content)
      riskData.value = parsed
    } catch {
      // Fallback: try to extract JSON from markdown code block
      const jsonMatch = res.content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          riskData.value = JSON.parse(jsonMatch[1].trim())
        } catch {
          rawContent.value = res.content
        }
      } else {
        rawContent.value = res.content
      }
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to load risk score'
  }

  loading.value = false
}

watch(() => props.iso, () => fetchRisk())

onMounted(() => fetchRisk())
</script>
