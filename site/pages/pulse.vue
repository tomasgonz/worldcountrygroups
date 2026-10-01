<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="mb-8">
      <NuxtLink to="/" class="text-sm text-primary-400 hover:text-primary-700 transition-colors">&larr; Back to home</NuxtLink>
    </div>

    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-2">This Week in Diplomacy</h1>
    <p class="text-primary-400 text-sm mb-10">Weekly briefing with AI-generated analysis drawn from news, conflicts, UN speeches, voting records, and GDELT media data.</p>

    <!-- Admin: Regenerate button -->
    <div v-if="isAdmin" class="mb-8 flex items-center gap-3">
      <button
        class="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm hover:bg-primary-200 transition-colors disabled:opacity-50"
        :disabled="regenerating"
        @click="regenerateBriefing"
      >
        {{ regenerating ? 'Generating...' : 'Regenerate Briefing' }}
      </button>
      <span class="text-xs text-primary-400">Tone, temperature, and other settings are in the <NuxtLink to="/admin" class="underline hover:text-primary-700">admin dashboard</NuxtLink>.</span>
      <span v-if="settingsMsg" class="text-xs" :class="settingsMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'">{{ settingsMsg }}</span>
    </div>

    <!-- Loading -->
    <div v-if="pulsePending" class="space-y-6">
      <div class="bg-white rounded-2xl border border-primary-100 p-6">
        <div class="space-y-3">
          <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
          <div class="h-3 bg-primary-100 rounded-full w-11/12 animate-pulse"></div>
          <div class="h-3 bg-primary-100 rounded-full w-4/5 animate-pulse"></div>
          <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
          <div class="h-3 bg-primary-100 rounded-full w-3/4 animate-pulse"></div>
        </div>
      </div>
    </div>

    <template v-else-if="pulseData?.headlines || pulseData?.content">
      <!-- Headlines -->
      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-6">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Headlines</h2>
        <div
          class="prose prose-sm prose-primary max-w-none prose-p:text-primary-700 prose-p:leading-relaxed prose-ul:my-1 prose-li:text-primary-700 prose-li:my-0.5"
          v-html="renderedHeadlines"
        ></div>
      </div>

      <!-- Full Analysis -->
      <div v-if="pulseData?.analysis" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-6">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Analysis &amp; Context</h2>
        <div
          class="prose prose-sm prose-primary max-w-none prose-headings:font-serif prose-headings:text-primary-900 prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1 prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3 prose-ul:my-2 prose-li:text-primary-700 prose-li:my-0.5"
          v-html="renderedAnalysis"
        ></div>
      </div>

      <!-- Anomalies / Insights -->
      <div v-if="insightsPending || insightsData?.content" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-6">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Anomalies &amp; Watch List</h2>
        <div v-if="insightsPending" class="space-y-3">
          <div class="h-3 bg-primary-100 rounded-full w-full animate-pulse"></div>
          <div class="h-3 bg-primary-100 rounded-full w-11/12 animate-pulse"></div>
          <div class="h-3 bg-primary-100 rounded-full w-4/5 animate-pulse"></div>
        </div>
        <div
          v-else-if="insightsData?.content"
          class="prose prose-sm prose-primary max-w-none prose-headings:font-serif prose-headings:text-primary-900 prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1 prose-p:text-primary-700 prose-p:leading-relaxed prose-p:mb-3 prose-ul:my-2 prose-li:text-primary-700 prose-li:my-0.5"
          v-html="renderedInsights"
        ></div>
        <div v-if="insightsData?.generatedAt" class="mt-3 pt-2 border-t border-primary-50 text-xs text-primary-300">
          Updated {{ timeAgoStr(insightsData.generatedAt) }}
        </div>
      </div>

      <div v-if="pulseData?.generatedAt" class="text-xs text-primary-300 text-right">
        Briefing generated {{ timeAgoStr(pulseData.generatedAt) }}
      </div>
    </template>

    <div v-else class="text-primary-400 text-sm">
      No briefing available. An AI provider must be configured to generate the weekly pulse.
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

useHead({ title: 'Weekly Pulse — World Country Groups' })

const auth = useAuth()
const isAdmin = computed(() => auth.state.value.role === 'admin')

const regenerating = ref(false)
const settingsMsg = ref('')

async function regenerateBriefing() {
  regenerating.value = true
  settingsMsg.value = ''
  try {
    const result = await $fetch<any>('/api/intelligence/ai/diplomatic-pulse', {
      params: { force: 'true' },
    })
    pulseData.value = result
    settingsMsg.value = 'Briefing regenerated'
  } catch (e: any) {
    settingsMsg.value = 'Error: ' + (e.data?.message || e.message || 'Failed to regenerate')
  } finally {
    regenerating.value = false
  }
}

const { data: pulseData, pending: pulsePending } = useAsyncData('pulse', () =>
  $fetch<any>('/api/intelligence/ai/diplomatic-pulse').catch(() => null)
)

const { data: insightsData, pending: insightsPending } = useAsyncData('insights', () =>
  $fetch<any>('/api/intelligence/ai/anomalies').catch(() => null)
)

const renderedHeadlines = computed(() => {
  const text = pulseData.value?.headlines || pulseData.value?.content
  return text ? marked.parse(text) as string : ''
})
const renderedAnalysis = computed(() => pulseData.value?.analysis ? marked.parse(pulseData.value.analysis) as string : '')
const renderedInsights = computed(() => insightsData.value?.content ? marked.parse(insightsData.value.content) as string : '')

function timeAgoStr(dateStr: string) {
  if (!dateStr) return ''
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
</script>
