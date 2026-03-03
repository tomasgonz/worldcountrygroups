<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center justify-between mb-8">
      <h1 class="font-serif text-3xl font-bold text-primary-900">Admin Dashboard</h1>
      <button
        @click="handleLogout"
        class="text-sm text-primary-400 hover:text-primary-900 transition-colors"
      >
        Logout
      </button>
    </div>

    <!-- Auth check loading -->
    <div v-if="authPending" class="space-y-4">
      <div class="skeleton h-32 rounded-xl" />
      <div class="skeleton h-48 rounded-xl" />
    </div>

    <template v-else-if="isAuthenticated">
      <!-- Data Refresh -->
      <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
        <div class="flex items-center justify-between mb-6">
          <h2 class="font-serif text-xl font-bold text-primary-900">Data Refresh</h2>
          <button
            @click="handleRefreshAll"
            :disabled="anyRefreshing"
            class="bg-primary-900 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            {{ anyRefreshing ? 'Refreshing...' : 'Refresh All' }}
          </button>
        </div>

        <!-- Per-source cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Country Statistics -->
          <div class="border border-primary-100 rounded-xl p-4">
            <div class="text-sm font-semibold text-primary-800 mb-1">Country Statistics</div>
            <div class="text-xs text-primary-400 mb-3">World Bank + REST Countries + UNDP</div>
            <div v-if="refreshStatus?.country?.refreshing" class="text-xs text-blue-600 mb-2">
              {{ refreshStatus.country.progress || 'Refreshing...' }}
            </div>
            <div v-else-if="refreshStatus?.country?.last_refresh" class="text-xs text-primary-500 mb-2">
              Last: {{ formatTime(refreshStatus.country.last_refresh) }}
            </div>
            <div v-else class="text-xs text-primary-300 mb-2">Not refreshed yet</div>
            <div v-if="refreshStatus?.country?.last_error" class="text-xs text-red-500 mb-2 truncate" :title="refreshStatus.country.last_error">
              {{ refreshStatus.country.last_error }}
            </div>
            <button
              @click="handleRefreshSource('country')"
              :disabled="refreshStatus?.country?.refreshing"
              class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
            >
              {{ refreshStatus?.country?.refreshing ? 'Running...' : 'Refresh' }}
            </button>
          </div>

          <!-- UN Voting Data -->
          <div class="border border-primary-100 rounded-xl p-4">
            <div class="text-sm font-semibold text-primary-800 mb-1">UN Voting Data</div>
            <div class="text-xs text-primary-400 mb-3">UN Digital Library CSV</div>
            <div v-if="refreshStatus?.unvotes?.refreshing" class="text-xs text-blue-600 mb-2">
              {{ refreshStatus.unvotes.progress || 'Refreshing...' }}
            </div>
            <div v-else-if="refreshStatus?.unvotes?.last_refresh" class="text-xs text-primary-500 mb-2">
              Last: {{ formatTime(refreshStatus.unvotes.last_refresh) }}
            </div>
            <div v-else class="text-xs text-primary-300 mb-2">Not refreshed yet</div>
            <div v-if="refreshStatus?.unvotes?.last_error" class="text-xs text-red-500 mb-2 truncate" :title="refreshStatus.unvotes.last_error">
              {{ refreshStatus.unvotes.last_error }}
            </div>
            <button
              @click="handleRefreshSource('unvotes')"
              :disabled="refreshStatus?.unvotes?.refreshing"
              class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
            >
              {{ refreshStatus?.unvotes?.refreshing ? 'Running...' : 'Refresh' }}
            </button>
          </div>

          <!-- Theme Classification -->
          <div class="border border-primary-100 rounded-xl p-4">
            <div class="text-sm font-semibold text-primary-800 mb-1">Theme Classification</div>
            <div class="text-xs text-primary-400 mb-3">Regex-based resolution classifier</div>
            <div v-if="refreshStatus?.themes?.refreshing" class="text-xs text-blue-600 mb-2">
              {{ refreshStatus.themes.progress || 'Refreshing...' }}
            </div>
            <div v-else-if="refreshStatus?.themes?.last_refresh" class="text-xs text-primary-500 mb-2">
              Last: {{ formatTime(refreshStatus.themes.last_refresh) }}
            </div>
            <div v-else class="text-xs text-primary-300 mb-2">Not refreshed yet</div>
            <div v-if="refreshStatus?.themes?.last_error" class="text-xs text-red-500 mb-2 truncate" :title="refreshStatus.themes.last_error">
              {{ refreshStatus.themes.last_error }}
            </div>
            <button
              @click="handleRefreshSource('themes')"
              :disabled="refreshStatus?.themes?.refreshing"
              class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
            >
              {{ refreshStatus?.themes?.refreshing ? 'Running...' : 'Refresh' }}
            </button>
          </div>
        </div>

        <!-- Result message -->
        <div v-if="refreshResult" class="mt-4 rounded-lg px-4 py-3 text-sm" :class="refreshResult.ok !== false ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
          {{ refreshResult.message }}
        </div>
      </div>

      <!-- Data Source Timestamps -->
      <div v-if="sourceMeta" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Data Sources</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div v-for="(ts, source) in sourceMeta" :key="source" class="border border-primary-100 rounded-lg p-4">
            <div class="text-xs text-primary-400 uppercase tracking-wider mb-1">{{ source }}</div>
            <div class="text-sm text-primary-700">{{ ts ? formatTime(ts) : 'Not fetched' }}</div>
          </div>
        </div>
      </div>

      <!-- Data Coverage -->
      <div v-if="coverage" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
        <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Data Coverage</h2>
        <p class="text-sm text-primary-500 mb-4">{{ coverage.total }} countries loaded</p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-primary-100 text-left">
                <th class="px-4 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Indicator</th>
                <th class="px-4 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Countries</th>
                <th class="px-4 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Coverage</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ind in coverage.indicators" :key="ind.name" class="border-b border-primary-50 last:border-0">
                <td class="px-4 py-2.5 text-primary-700">{{ ind.name }}</td>
                <td class="px-4 py-2.5 text-right text-primary-600 tabular-nums">{{ ind.count }}</td>
                <td class="px-4 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-20 h-1.5 bg-primary-100 rounded-full overflow-hidden">
                      <div class="h-full bg-primary-400 rounded-full" :style="{ width: ind.pct + '%' }"></div>
                    </div>
                    <span class="text-primary-500 text-xs tabular-nums w-12 text-right">{{ ind.pct }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin — World Country Groups' })

const authPending = ref(true)
const isAuthenticated = ref(false)
const sourceMeta = ref<Record<string, string | null> | null>(null)
const coverage = ref<{ total: number; indicators: { name: string; count: number; pct: number }[] } | null>(null)
const refreshStatus = ref<any>(null)
const refreshResult = ref<{ ok: boolean; message: string } | null>(null)

let pollInterval: ReturnType<typeof setInterval> | null = null

const anyRefreshing = computed(() => {
  const s = refreshStatus.value
  if (!s) return false
  return s.country?.refreshing || s.unvotes?.refreshing || s.themes?.refreshing
})

async function checkAuth() {
  try {
    const status = await $fetch<any>('/api/admin/status')
    isAuthenticated.value = status.authenticated
    if (!status.authenticated) {
      await navigateTo('/admin/login')
    }
  } catch {
    await navigateTo('/admin/login')
  } finally {
    authPending.value = false
  }
}

async function loadMeta() {
  try {
    const meta = await $fetch<any>('/api/meta')
    if (meta) {
      sourceMeta.value = meta.sources || null
      if (meta.country_count) {
        coverage.value = {
          total: meta.country_count,
          indicators: meta.coverage || [],
        }
      }
    }
  } catch {
    // Not critical
  }
}

async function loadRefreshStatus() {
  try {
    refreshStatus.value = await $fetch<any>('/api/admin/refresh-status')
  } catch {
    // Not critical
  }
}

function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(async () => {
    await loadRefreshStatus()
    if (!anyRefreshing.value) {
      stopPolling()
      await loadMeta()
    }
  }, 2000)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

async function handleRefreshSource(target: string) {
  refreshResult.value = null
  startPolling()
  try {
    const result = await $fetch<any>('/api/admin/refresh', { method: 'POST', query: { target } })
    const ok = result.ok !== false
    refreshResult.value = {
      ok,
      message: ok
        ? `${target} refresh completed at ${formatTime(result.updated_at)}`
        : `${target} refresh failed: ${result.errors?.join(', ') || 'Unknown error'}`,
    }
    await loadRefreshStatus()
    await loadMeta()
  } catch (e: any) {
    refreshResult.value = { ok: false, message: e?.data?.statusMessage || 'Request failed' }
  }
  stopPolling()
}

async function handleRefreshAll() {
  refreshResult.value = null
  startPolling()
  try {
    const result = await $fetch<any>('/api/admin/refresh', { method: 'POST', query: { target: 'all' } })
    refreshResult.value = { ok: true, message: 'All data sources refreshed successfully.' }
    await loadRefreshStatus()
    await loadMeta()
  } catch (e: any) {
    refreshResult.value = { ok: false, message: e?.data?.statusMessage || 'Request failed' }
  }
  stopPolling()
}

async function handleLogout() {
  try {
    await $fetch('/api/admin/logout', { method: 'POST' })
  } catch {
    // Continue even if request fails
  }
  await navigateTo('/admin/login')
}

function formatTime(iso: string): string {
  if (!iso) return 'N/A'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

onMounted(async () => {
  await checkAuth()
  if (isAuthenticated.value) {
    await Promise.all([loadMeta(), loadRefreshStatus()])
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>
