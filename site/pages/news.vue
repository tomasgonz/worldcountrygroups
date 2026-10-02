<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="mb-8">
      <NuxtLink to="/" class="text-sm text-primary-400 hover:text-primary-900 transition-colors mb-3 inline-block">&larr; Home</NuxtLink>
      <h1 class="font-serif text-3xl font-bold text-primary-900">Latest News</h1>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 8" :key="i" class="bg-white rounded-xl border border-primary-100 p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="h-4 w-20 bg-primary-100 rounded animate-pulse"></div>
          <div class="h-3 w-12 bg-primary-50 rounded animate-pulse"></div>
        </div>
        <div class="h-5 bg-primary-100 rounded w-3/4 animate-pulse mb-2"></div>
        <div class="h-4 bg-primary-50 rounded w-full animate-pulse"></div>
      </div>
    </div>

    <!-- Article list -->
    <div v-else class="space-y-4">
      <a
        v-for="article in articles"
        :key="article.id"
        :href="article.url"
        target="_blank"
        rel="noopener noreferrer"
        class="block bg-white rounded-xl border border-primary-100 p-5 hover:border-primary-200 hover:shadow-sm transition-all"
      >
        <div class="flex items-center gap-3 mb-2">
          <span class="text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">{{ formatSource(article.source) }}</span>
          <span v-if="article.sourceOwnership" class="text-[10px] px-1.5 py-0.5 rounded-full ring-1 ring-amber-200 bg-amber-50 text-amber-800" :title="`Outlet is ${article.sourceOwnership}`">{{ article.sourceOwnership }}</span>
          <span class="text-xs text-primary-300">{{ timeAgoStr(article.publishedAt) }}</span>
        </div>
        <h2 class="text-base font-semibold text-primary-900 mb-1 leading-snug">{{ article.title }}</h2>
        <p v-if="article.description" class="text-sm text-primary-500 line-clamp-2">{{ article.description }}</p>
        <div v-if="article.countries?.length" class="flex flex-wrap gap-1.5 mt-3">
          <span
            v-for="iso in article.countries"
            :key="iso"
            class="text-[11px] font-mono text-primary-400 bg-primary-50 px-1.5 py-0.5 rounded"
          >{{ iso }}</span>
        </div>
      </a>
    </div>

    <p v-if="!loading && !articles.length" class="text-primary-400 text-center py-12">No news articles available.</p>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Latest News — World Country Groups' })

const articles = ref<any[]>([])
const loading = ref(true)

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
    const res = await $fetch<any>('/api/news/feed?limit=50')
    articles.value = res.articles || []
  } catch {}
  loading.value = false
})
</script>
