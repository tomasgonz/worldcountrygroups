<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-3">
        <NuxtLink to="/admin" class="text-primary-400 hover:text-primary-700 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </NuxtLink>
        <h1 class="font-serif text-3xl font-bold text-primary-900">Statement Sources</h1>
        <span v-if="sources.length" class="text-sm text-primary-400">{{ filteredSources.length }} sources</span>
      </div>
      <button
        @click="startCreate"
        class="bg-primary-900 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors"
      >
        Add Source
      </button>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed top-6 right-6 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg transition-all"
      :class="toast.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
      {{ toast.message }}
    </div>

    <!-- Stats Bar -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
      <div class="text-center p-3 bg-white rounded-xl border border-primary-100">
        <span class="block text-xl font-bold text-primary-900 tabular-nums">{{ feedStats.statements }}</span>
        <span class="text-xs text-primary-400">Statements</span>
      </div>
      <div class="text-center p-3 bg-white rounded-xl border border-primary-100">
        <span class="block text-xl font-bold text-primary-900 tabular-nums">{{ enabledCount }}</span>
        <span class="text-xs text-primary-400">Enabled</span>
      </div>
      <div class="text-center p-3 bg-white rounded-xl border border-primary-100">
        <span class="block text-xl font-bold text-primary-900 tabular-nums">{{ feedStats.countries }}</span>
        <span class="text-xs text-primary-400">Countries</span>
      </div>
      <div class="text-center p-3 bg-white rounded-xl border border-primary-100">
        <span class="block text-xl font-bold text-primary-900 tabular-nums">{{ feedStats.sizeKB }} KB</span>
        <span class="text-xs text-primary-400">Feed Size</span>
      </div>
      <div class="text-center p-3 bg-white rounded-xl border border-primary-100">
        <span class="block text-sm font-medium text-primary-700">{{ feedStats.lastUpdated ? formatTime(feedStats.lastUpdated) : 'Never' }}</span>
        <span class="text-xs text-primary-400">Last Updated</span>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Source List -->
      <div class="bg-white rounded-2xl border border-primary-100 p-6">
        <!-- Filters -->
        <div class="flex items-center gap-3 mb-4">
          <input
            v-model="search"
            type="text"
            placeholder="Search sources..."
            class="flex-1 px-4 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <select v-model="filterCategory" class="text-sm border border-primary-200 rounded-lg px-3 py-2 text-primary-700 bg-white">
            <option value="">All</option>
            <option value="p5-mission">P5</option>
            <option value="major-mission">Major</option>
            <option value="un-official">UN</option>
          </select>
        </div>

        <!-- Bulk Actions -->
        <div v-if="filterCategory" class="flex items-center gap-2 mb-4">
          <button @click="bulkToggle(true)" class="text-xs px-3 py-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
            Enable All {{ filterLabel }}
          </button>
          <button @click="bulkToggle(false)" class="text-xs px-3 py-1.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
            Disable All {{ filterLabel }}
          </button>
        </div>

        <div class="overflow-y-auto max-h-[65vh]">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-white">
              <tr class="border-b border-primary-100 text-left">
                <th class="px-3 py-2 font-medium text-primary-400 text-xs uppercase tracking-wider">Source</th>
                <th class="px-3 py-2 font-medium text-primary-400 text-xs uppercase tracking-wider">Country</th>
                <th class="px-3 py-2 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Count</th>
                <th class="px-3 py-2 font-medium text-primary-400 text-xs uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="src in filteredSources"
                :key="src.id"
                @click="selectSource(src)"
                class="border-b border-primary-50 last:border-0 cursor-pointer transition-colors"
                :class="selectedId === src.id ? 'bg-primary-50' : 'hover:bg-primary-25'"
              >
                <td class="px-3 py-2.5">
                  <div class="flex items-center gap-2">
                    <div class="text-primary-800 font-medium text-sm">{{ src.name }}</div>
                    <span class="text-[10px] px-1.5 py-0.5 rounded-full" :class="categoryClass(src.category)">{{ categoryLabel(src.category) }}</span>
                  </div>
                  <div class="text-[11px] text-primary-400 truncate max-w-[280px]">{{ src.type }}</div>
                </td>
                <td class="px-3 py-2.5 text-xs text-primary-600 font-mono">{{ src.country || '—' }}</td>
                <td class="px-3 py-2.5 text-primary-600 tabular-nums text-xs text-right">{{ src.statementCount || 0 }}</td>
                <td class="px-3 py-2.5 text-center">
                  <span class="w-2 h-2 rounded-full inline-block" :class="src.enabled ? 'bg-green-500' : 'bg-primary-300'"></span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!filteredSources.length && !loading" class="text-center text-primary-400 py-8 text-sm">
            No sources match your filter.
          </div>
        </div>
      </div>

      <!-- Editor Panel -->
      <div v-if="editor" class="bg-white rounded-2xl border border-primary-100 p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="font-serif text-xl font-bold text-primary-900">
            {{ isCreating ? 'Add New Source' : `Edit: ${editor.name}` }}
          </h2>
          <button @click="closeEditor" class="text-primary-400 hover:text-primary-700">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="space-y-4">
          <!-- Basic Fields -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Source ID</label>
              <input v-model="editor.id" :disabled="!isCreating" class="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm disabled:bg-primary-50 disabled:text-primary-400" placeholder="country-un-mission">
            </div>
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Name</label>
              <input v-model="editor.name" class="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm" placeholder="Country Mission to the UN">
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-primary-500 mb-1">URL</label>
            <div class="flex gap-2">
              <input v-model="editor.url" class="flex-1 border border-primary-200 rounded-lg px-3 py-2 text-sm" placeholder="https://...">
              <button @click="testUrl" :disabled="testingUrl || !editor.url" class="px-3 py-2 border border-primary-200 text-primary-600 text-sm rounded-lg hover:bg-primary-50 disabled:opacity-40">
                {{ testingUrl ? '...' : 'Test' }}
              </button>
            </div>
            <div v-if="testResult" class="mt-1.5 rounded px-3 py-1.5 text-xs" :class="testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
              <template v-if="testResult.ok">{{ testResult.format }} &middot; {{ testResult.size }} bytes</template>
              <template v-else>{{ testResult.error }}</template>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Type</label>
              <select v-model="editor.type" class="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm">
                <option value="rss">RSS</option>
                <option value="atom">Atom</option>
                <option value="html-scrape">HTML Scrape</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Country (ISO3)</label>
              <input v-model="editor.country" class="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm" placeholder="USA">
            </div>
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Category</label>
              <select v-model="editor.category" class="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm">
                <option value="p5-mission">P5 Mission</option>
                <option value="major-mission">Major Mission</option>
                <option value="un-official">UN Official</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <label class="text-xs font-medium text-primary-500">Enabled</label>
            <button @click="editor.enabled = !editor.enabled" class="w-10 h-5 rounded-full transition-colors relative" :class="editor.enabled ? 'bg-green-500' : 'bg-primary-200'">
              <span class="block w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform" :class="editor.enabled ? 'translate-x-5' : 'translate-x-0.5'"></span>
            </button>
          </div>

          <!-- Scrape Config -->
          <div v-if="editor.type === 'html-scrape'" class="border border-primary-200 rounded-xl p-4 space-y-3">
            <h3 class="text-sm font-medium text-primary-700">Scrape Configuration</h3>
            <p class="text-xs text-primary-400 -mt-1">CSS-like selectors: tag, .class, #id, or tag.class</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-primary-500 mb-1">List Selector *</label>
                <input v-model="editor.scrapeConfig.listSelector" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder=".news-item">
              </div>
              <div>
                <label class="block text-xs text-primary-500 mb-1">Title Selector</label>
                <input v-model="editor.scrapeConfig.titleSelector" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="a">
              </div>
              <div>
                <label class="block text-xs text-primary-500 mb-1">Link Selector</label>
                <input v-model="editor.scrapeConfig.linkSelector" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="a">
              </div>
              <div>
                <label class="block text-xs text-primary-500 mb-1">Base URL</label>
                <input v-model="editor.scrapeConfig.baseUrl" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder="https://example.com">
              </div>
              <div>
                <label class="block text-xs text-primary-500 mb-1">Date Selector</label>
                <input v-model="editor.scrapeConfig.dateSelector" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder=".date (optional)">
              </div>
              <div>
                <label class="block text-xs text-primary-500 mb-1">Excerpt Selector</label>
                <input v-model="editor.scrapeConfig.excerptSelector" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" placeholder=".excerpt (optional)">
              </div>
            </div>
          </div>

          <!-- Status Info (for existing sources) -->
          <div v-if="!isCreating" class="border-t border-primary-100 pt-4 space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-primary-400">Last Fetch</span>
              <span class="text-primary-600">{{ editor.lastFetch ? formatTime(editor.lastFetch) : 'Never' }}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-primary-400">Statements Fetched</span>
              <span class="text-primary-600 tabular-nums">{{ editor.statementCount || 0 }}</span>
            </div>
            <div v-if="editor.lastError" class="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-2">
              {{ editor.lastError }}
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-2">
            <button @click="saveSource" class="px-5 py-2 bg-primary-900 text-white text-sm rounded-lg hover:bg-primary-800 transition-colors">
              {{ isCreating ? 'Add Source' : 'Save Changes' }}
            </button>
            <button @click="closeEditor" class="px-4 py-2 text-primary-400 text-sm hover:text-primary-600">Cancel</button>
            <button v-if="!isCreating" @click="deleteSource" class="ml-auto px-4 py-2 text-red-600 text-sm hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors">
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="bg-white rounded-2xl border border-primary-100 p-6 flex items-center justify-center min-h-[300px]">
        <div class="text-center">
          <p class="text-primary-400 text-sm mb-2">Select a source to edit</p>
          <p class="text-primary-300 text-xs">or click "Add Source" to create a new one</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Statement Sources — Admin' })

const sources = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const filterCategory = ref('')
const selectedId = ref<string | null>(null)
const isCreating = ref(false)
const toast = ref<{ ok: boolean; message: string } | null>(null)
const testingUrl = ref(false)
const testResult = ref<any>(null)
const feedStats = reactive({ statements: 0, sources: 0, countries: 0, sizeKB: 0, lastUpdated: '' })

const editor = ref<any>(null)

const enabledCount = computed(() => sources.value.filter(s => s.enabled).length)

const filterLabel = computed(() => {
  switch (filterCategory.value) {
    case 'p5-mission': return 'P5'
    case 'major-mission': return 'Major'
    case 'un-official': return 'UN'
    default: return ''
  }
})

const filteredSources = computed(() => {
  let result = sources.value
  if (filterCategory.value) {
    result = result.filter(s => s.category === filterCategory.value)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.country || '').toLowerCase().includes(q)
    )
  }
  return result
})

function categoryClass(cat: string) {
  switch (cat) {
    case 'p5-mission': return 'bg-red-100 text-red-700'
    case 'major-mission': return 'bg-blue-100 text-blue-700'
    case 'un-official': return 'bg-teal-100 text-teal-700'
    default: return 'bg-primary-100 text-primary-600'
  }
}

function categoryLabel(cat: string) {
  switch (cat) {
    case 'p5-mission': return 'P5'
    case 'major-mission': return 'Major'
    case 'un-official': return 'UN'
    default: return cat
  }
}

function formatTime(iso: string): string {
  if (!iso) return 'N/A'
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

function showToast(ok: boolean, message: string) {
  toast.value = { ok, message }
  setTimeout(() => { toast.value = null }, 3000)
}

function makeScrapeConfig(src: any) {
  return {
    listSelector: src?.scrapeConfig?.listSelector || '',
    titleSelector: src?.scrapeConfig?.titleSelector || 'a',
    linkSelector: src?.scrapeConfig?.linkSelector || 'a',
    baseUrl: src?.scrapeConfig?.baseUrl || '',
    dateSelector: src?.scrapeConfig?.dateSelector || '',
    excerptSelector: src?.scrapeConfig?.excerptSelector || '',
  }
}

function selectSource(src: any) {
  selectedId.value = src.id
  isCreating.value = false
  testResult.value = null
  editor.value = {
    id: src.id,
    name: src.name,
    url: src.url,
    type: src.type,
    country: src.country,
    category: src.category,
    enabled: src.enabled,
    lastFetch: src.lastFetch,
    lastError: src.lastError,
    statementCount: src.statementCount,
    scrapeConfig: makeScrapeConfig(src),
  }
}

function startCreate() {
  selectedId.value = null
  isCreating.value = true
  testResult.value = null
  editor.value = {
    id: '',
    name: '',
    url: '',
    type: 'rss',
    country: '',
    category: 'major-mission',
    enabled: true,
    scrapeConfig: makeScrapeConfig(null),
  }
}

function closeEditor() {
  editor.value = null
  selectedId.value = null
  isCreating.value = false
  testResult.value = null
}

async function loadSources() {
  try {
    const res = await $fetch<any>('/api/admin/statement-sources')
    sources.value = res.sources || []
  } catch {}
  loading.value = false
}

async function loadFeedStats() {
  try {
    const res = await $fetch<any>('/api/statements/stats')
    feedStats.statements = res.statementCount || 0
    feedStats.sources = res.sourceCount || 0
    feedStats.countries = res.countryCoverage || 0
    feedStats.sizeKB = res.sizeKB || 0
    feedStats.lastUpdated = res.lastUpdated || ''
  } catch {}
}

async function saveSource() {
  const e = editor.value
  if (!e.id || !e.name || !e.url) {
    showToast(false, 'ID, name, and URL are required.')
    return
  }

  const source: any = {
    id: e.id,
    name: e.name,
    url: e.url,
    type: e.type,
    country: e.country,
    category: e.category,
    enabled: e.enabled,
  }
  if (e.type === 'html-scrape' && e.scrapeConfig.listSelector) {
    source.scrapeConfig = {
      listSelector: e.scrapeConfig.listSelector,
      titleSelector: e.scrapeConfig.titleSelector || 'a',
      linkSelector: e.scrapeConfig.linkSelector || 'a',
      baseUrl: e.scrapeConfig.baseUrl || undefined,
      dateSelector: e.scrapeConfig.dateSelector || undefined,
      excerptSelector: e.scrapeConfig.excerptSelector || undefined,
    }
  }

  try {
    if (isCreating.value) {
      const res = await $fetch<any>('/api/admin/statement-sources', {
        method: 'POST',
        body: { action: 'add', source },
      })
      sources.value = res.sources || []
      showToast(true, `Source "${e.name}" added.`)
      closeEditor()
    } else {
      const res = await $fetch<any>('/api/admin/statement-sources', {
        method: 'POST',
        body: { action: 'update', id: e.id, name: e.name, url: e.url, type: e.type, country: e.country, category: e.category, enabled: e.enabled, scrapeConfig: source.scrapeConfig },
      })
      sources.value = res.sources || []
      showToast(true, `Source "${e.name}" updated.`)
    }
  } catch (err: any) {
    showToast(false, err?.data?.statusMessage || 'Failed to save source.')
  }
}

async function deleteSource() {
  if (!editor.value || !confirm(`Delete source "${editor.value.name}"?`)) return
  try {
    const res = await $fetch<any>('/api/admin/statement-sources', {
      method: 'POST',
      body: { action: 'remove', id: editor.value.id },
    })
    sources.value = res.sources || []
    showToast(true, `Source "${editor.value.name}" removed.`)
    closeEditor()
  } catch (err: any) {
    showToast(false, err?.data?.statusMessage || 'Failed to delete source.')
  }
}

async function testUrl() {
  testResult.value = null
  testingUrl.value = true
  try {
    testResult.value = await $fetch<any>('/api/admin/statement-sources', {
      method: 'POST',
      body: { action: 'test', url: editor.value.url },
    })
  } catch (err: any) {
    testResult.value = { ok: false, error: err?.data?.statusMessage || 'Test failed' }
  }
  testingUrl.value = false
}

async function bulkToggle(enabled: boolean) {
  const ids = filteredSources.value.map(s => s.id)
  for (const id of ids) {
    try {
      await $fetch<any>('/api/admin/statement-sources', {
        method: 'POST',
        body: { action: 'toggle', id, enabled },
      })
    } catch {}
  }
  await loadSources()
  showToast(true, `${enabled ? 'Enabled' : 'Disabled'} ${ids.length} sources.`)
}

onMounted(async () => {
  await Promise.all([loadSources(), loadFeedStats()])
})
</script>
