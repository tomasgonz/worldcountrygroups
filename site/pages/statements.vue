<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="mb-8">
      <NuxtLink to="/" class="text-sm text-primary-400 hover:text-primary-900 transition-colors mb-3 inline-block">&larr; Home</NuxtLink>
      <h1 class="font-serif text-3xl font-bold text-primary-900">Diplomatic Statements</h1>
      <p class="text-sm text-primary-500 mt-1">Official statements from UN missions and UN press releases</p>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <select v-model="filterCountry" class="text-sm border border-primary-200 rounded-lg px-3 py-2 text-primary-700 bg-white">
        <option value="">All Countries</option>
        <option v-for="c in countryOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <select v-model="filterType" class="text-sm border border-primary-200 rounded-lg px-3 py-2 text-primary-700 bg-white">
        <option value="">All Types</option>
        <option value="press-release">Press Release</option>
        <option value="statement">Statement</option>
        <option value="remarks">Remarks</option>
        <option value="vote-explanation">Vote Explanation</option>
        <option value="letter">Letter</option>
        <option value="other">Other</option>
      </select>
      <select v-model="filterCategory" class="text-sm border border-primary-200 rounded-lg px-3 py-2 text-primary-700 bg-white">
        <option value="">All Categories</option>
        <option value="p5-mission">P5 Missions</option>
        <option value="major-mission">Major Missions</option>
        <option value="un-official">UN Official</option>
      </select>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 8" :key="i" class="bg-white rounded-xl border border-primary-100 p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="h-4 w-12 bg-primary-100 rounded animate-pulse"></div>
          <div class="h-4 w-16 bg-primary-50 rounded animate-pulse"></div>
          <div class="h-3 w-20 bg-primary-50 rounded animate-pulse"></div>
        </div>
        <div class="h-5 bg-primary-100 rounded w-3/4 animate-pulse mb-2"></div>
        <div class="h-4 bg-primary-50 rounded w-full animate-pulse"></div>
      </div>
    </div>

    <!-- Statement list -->
    <div v-else class="space-y-4">
      <a
        v-for="stmt in filteredStatements"
        :key="stmt.id"
        :href="stmt.url"
        target="_blank"
        rel="noopener noreferrer"
        class="block bg-white rounded-xl border border-primary-100 p-5 hover:border-primary-200 hover:shadow-sm transition-all"
      >
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span v-if="stmt.country" class="text-xs font-mono font-medium text-white bg-primary-700 px-2 py-0.5 rounded">{{ stmt.country }}</span>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full" :class="typeBadge(stmt.type)">{{ formatType(stmt.type) }}</span>
          <span class="text-xs text-primary-400 bg-primary-50 px-2 py-0.5 rounded-full">{{ formatSource(stmt.source) }}</span>
          <span class="text-xs text-primary-300">{{ timeAgoStr(stmt.publishedAt) }}</span>
        </div>
        <h2 class="text-base font-semibold text-primary-900 mb-1 leading-snug">{{ stmt.title }}</h2>
        <p v-if="stmt.speaker" class="text-xs text-primary-500 mb-1">Speaker: {{ stmt.speaker }}</p>
        <p v-if="stmt.excerpt" class="text-sm text-primary-500 line-clamp-2">{{ stmt.excerpt }}</p>
        <div v-if="stmt.topics?.length" class="flex flex-wrap gap-1.5 mt-3">
          <span
            v-for="topic in stmt.topics"
            :key="topic"
            class="text-[11px] text-primary-400 bg-primary-50 px-1.5 py-0.5 rounded"
          >{{ topic }}</span>
        </div>
      </a>
    </div>

    <p v-if="!loading && !filteredStatements.length" class="text-primary-400 text-center py-12">No statements match your filters.</p>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Diplomatic Statements — World Country Groups' })

const statements = ref<any[]>([])
const sources = ref<any[]>([])
const loading = ref(true)
const filterCountry = ref('')
const filterType = ref('')
const filterCategory = ref('')

const countryOptions = [
  { value: 'USA', label: 'United States' },
  { value: 'GBR', label: 'United Kingdom' },
  { value: 'FRA', label: 'France' },
  { value: 'RUS', label: 'Russia' },
  { value: 'CHN', label: 'China' },
  { value: 'DEU', label: 'Germany' },
  { value: 'JPN', label: 'Japan' },
  { value: 'IND', label: 'India' },
  { value: 'BRA', label: 'Brazil' },
  { value: 'ZAF', label: 'South Africa' },
  { value: 'KEN', label: 'Kenya' },
]

const sourceByCategory = computed(() => {
  const map: Record<string, string[]> = {}
  for (const s of sources.value) {
    if (!map[s.category]) map[s.category] = []
    map[s.category].push(s.id)
  }
  return map
})

const filteredStatements = computed(() => {
  let result = statements.value
  if (filterCountry.value) {
    const iso = filterCountry.value
    result = result.filter(s => s.country === iso || s.countries?.includes(iso))
  }
  if (filterType.value) {
    result = result.filter(s => s.type === filterType.value)
  }
  if (filterCategory.value) {
    const ids = sourceByCategory.value[filterCategory.value] || []
    result = result.filter(s => ids.includes(s.source))
  }
  return result
})

function typeBadge(type: string) {
  switch (type) {
    case 'press-release': return 'bg-blue-100 text-blue-700'
    case 'statement': return 'bg-indigo-100 text-indigo-700'
    case 'remarks': return 'bg-purple-100 text-purple-700'
    case 'vote-explanation': return 'bg-amber-100 text-amber-700'
    case 'letter': return 'bg-teal-100 text-teal-700'
    default: return 'bg-primary-100 text-primary-600'
  }
}

function formatType(type: string) {
  return type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatSource(s: string) {
  if (!s) return ''
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

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

onMounted(async () => {
  try {
    const [feedRes, srcRes] = await Promise.all([
      $fetch<any>('/api/statements/feed?limit=100'),
      $fetch<any>('/api/admin/statement-sources').catch(() => ({ sources: [] })),
    ])
    statements.value = feedRes.statements || []
    sources.value = srcRes.sources || []
  } catch {}
  loading.value = false
})
</script>
