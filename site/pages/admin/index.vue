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

    <!-- Site Mode -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Site Access Mode</h2>
      <p class="text-sm text-primary-500 mb-4">
        <strong>Public:</strong> All pages accessible without login.
        <strong>Restricted:</strong> Only homepage, about, and sources are public; everything else requires login.
      </p>
      <div class="flex items-center gap-3">
        <button
          @click="toggleSiteMode('public')"
          :class="siteMode === 'public' ? 'bg-green-600 text-white' : 'bg-primary-100 text-primary-600'"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Public
        </button>
        <button
          @click="toggleSiteMode('restricted')"
          :class="siteMode === 'restricted' ? 'bg-amber-600 text-white' : 'bg-primary-100 text-primary-600'"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Restricted
        </button>
      </div>
    </div>

    <!-- Navigation Links -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Navigation Links</h2>
      <p class="text-sm text-primary-500 mb-4">
        Disable pages to hide them from the navigation bar for non-admin users.
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="page in toggleablePages"
          :key="page.path"
          @click="togglePage(page.path)"
          class="text-sm px-4 py-2 rounded-lg font-medium transition-colors border"
          :class="disabledPages.includes(page.path)
            ? 'bg-red-50 text-red-600 border-red-200'
            : 'bg-green-50 text-green-700 border-green-200'"
        >
          {{ page.label }}
          <span class="text-xs ml-1 opacity-60">{{ disabledPages.includes(page.path) ? 'OFF' : 'ON' }}</span>
        </button>
      </div>
    </div>

    <!-- User Management -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <div class="flex items-center gap-3 mb-6">
        <h2 class="font-serif text-xl font-bold text-primary-900">User Management</h2>
        <span v-if="pendingCount > 0" class="bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {{ pendingCount }} pending
        </span>
      </div>

      <div v-if="!users.length" class="text-sm text-primary-400">No users found.</div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-primary-100 text-left">
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Username</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Display Name</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Email</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Role</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Status</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Created</th>
              <th class="px-3 py-2.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" class="border-b border-primary-50 last:border-0">
              <td class="px-3 py-2.5 text-primary-700 font-medium">{{ user.username }}</td>
              <td class="px-3 py-2.5 text-primary-600">{{ user.displayName }}</td>
              <td class="px-3 py-2.5 text-primary-600">{{ user.email || '—' }}</td>
              <td class="px-3 py-2.5">
                <span :class="user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-primary-100 text-primary-600'" class="text-xs font-medium px-2 py-0.5 rounded-full">
                  {{ user.role }}
                </span>
              </td>
              <td class="px-3 py-2.5">
                <span :class="statusClass(user.status)" class="text-xs font-medium px-2 py-0.5 rounded-full">
                  {{ user.status }}
                </span>
              </td>
              <td class="px-3 py-2.5 text-primary-500 text-xs">{{ formatTime(user.createdAt) }}</td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <button
                    v-if="user.status === 'pending'"
                    @click="approveUser(user.id)"
                    class="text-xs px-2.5 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    v-if="user.status === 'pending'"
                    @click="rejectUser(user.id)"
                    class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    v-if="user.status === 'approved' && user.role !== 'admin'"
                    @click="suspendUser(user.id)"
                    class="text-xs px-2.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    Suspend
                  </button>
                  <button
                    v-if="user.status === 'suspended'"
                    @click="suspendUser(user.id)"
                    class="text-xs px-2.5 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                  >
                    Unsuspend
                  </button>
                  <button
                    v-if="user.role !== 'admin'"
                    @click="removeUser(user.id)"
                    class="text-xs px-2.5 py-1 rounded bg-primary-50 text-primary-500 hover:bg-primary-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

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
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <!-- GDELT Events & Tone -->
        <div class="border border-primary-100 rounded-xl p-4">
          <div class="text-sm font-semibold text-primary-800 mb-1">GDELT Events &amp; Tone</div>
          <div class="text-xs text-primary-400 mb-3">GDELT Event Database + DOC API</div>
          <div v-if="refreshStatus?.gdelt?.refreshing" class="text-xs text-blue-600 mb-2">
            {{ refreshStatus.gdelt.progress || 'Refreshing...' }}
          </div>
          <div v-else-if="refreshStatus?.gdelt?.last_refresh" class="text-xs text-primary-500 mb-2">
            Last: {{ formatTime(refreshStatus.gdelt.last_refresh) }}
          </div>
          <div v-else class="text-xs text-primary-300 mb-2">Not refreshed yet</div>
          <div v-if="refreshStatus?.gdelt?.last_error" class="text-xs text-red-500 mb-2 truncate" :title="refreshStatus.gdelt.last_error">
            {{ refreshStatus.gdelt.last_error }}
          </div>
          <button
            @click="handleRefreshSource('gdelt')"
            :disabled="refreshStatus?.gdelt?.refreshing"
            class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
          >
            {{ refreshStatus?.gdelt?.refreshing ? 'Running...' : 'Refresh' }}
          </button>
        </div>

        <!-- UN Speeches -->
        <div class="border border-primary-100 rounded-xl p-4">
          <div class="text-sm font-semibold text-primary-800 mb-1">UN Speeches</div>
          <div class="text-xs text-primary-400 mb-3">gadebate.un.org</div>
          <div v-if="refreshStatus?.speeches?.refreshing" class="text-xs text-blue-600 mb-2">
            {{ refreshStatus.speeches.progress || 'Refreshing...' }}
          </div>
          <div v-else-if="refreshStatus?.speeches?.last_refresh" class="text-xs text-primary-500 mb-2">
            Last: {{ formatTime(refreshStatus.speeches.last_refresh) }}
          </div>
          <div v-else class="text-xs text-primary-300 mb-2">Not refreshed yet</div>
          <div v-if="refreshStatus?.speeches?.last_error" class="text-xs text-red-500 mb-2 truncate" :title="refreshStatus.speeches.last_error">
            {{ refreshStatus.speeches.last_error }}
          </div>
          <button
            @click="handleRefreshSource('speeches')"
            :disabled="refreshStatus?.speeches?.refreshing"
            class="text-xs px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
          >
            {{ refreshStatus?.speeches?.refreshing ? 'Running...' : 'Refresh' }}
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
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Admin — World Country Groups' })

const { state: authState, logout } = useAuth()
const sourceMeta = ref<Record<string, string | null> | null>(null)
const coverage = ref<{ total: number; indicators: { name: string; count: number; pct: number }[] } | null>(null)
const refreshStatus = ref<any>(null)
const refreshResult = ref<{ ok: boolean; message: string } | null>(null)
const users = ref<any[]>([])
const siteMode = ref<'public' | 'restricted'>('restricted')
const disabledPages = ref<string[]>([])

const toggleablePages = [
  { path: '/groups', label: 'Groups' },
  { path: '/countries', label: 'Countries' },
  { path: '/compare', label: 'Compare' },
  { path: '/votes', label: 'Votes' },
  { path: '/conflicts', label: 'Conflicts' },
  { path: '/speeches', label: 'Speeches' },
  { path: '/sources', label: 'Sources' },
  { path: '/about', label: 'About' },
]

let pollInterval: ReturnType<typeof setInterval> | null = null

const pendingCount = computed(() => users.value.filter((u) => u.status === 'pending').length)

const anyRefreshing = computed(() => {
  const s = refreshStatus.value
  if (!s) return false
  return s.country?.refreshing || s.unvotes?.refreshing || s.themes?.refreshing || s.gdelt?.refreshing || s.speeches?.refreshing
})

function statusClass(status: string) {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-700'
    case 'pending': return 'bg-amber-100 text-amber-700'
    case 'rejected': return 'bg-red-100 text-red-700'
    case 'suspended': return 'bg-orange-100 text-orange-700'
    default: return 'bg-primary-100 text-primary-600'
  }
}

async function loadUsers() {
  try {
    users.value = await $fetch<any[]>('/api/admin/users')
  } catch {
    // Not critical
  }
}

async function approveUser(id: string) {
  try {
    await $fetch(`/api/admin/users/${id}/approve`, { method: 'POST' })
    await loadUsers()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to approve user')
  }
}

async function rejectUser(id: string) {
  try {
    await $fetch(`/api/admin/users/${id}/reject`, { method: 'POST' })
    await loadUsers()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to reject user')
  }
}

async function suspendUser(id: string) {
  try {
    await $fetch(`/api/admin/users/${id}/suspend`, { method: 'POST' })
    await loadUsers()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to suspend/unsuspend user')
  }
}

async function removeUser(id: string) {
  if (!confirm('Are you sure you want to delete this user?')) return
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    await loadUsers()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to delete user')
  }
}

async function togglePage(path: string) {
  const current = [...disabledPages.value]
  const idx = current.indexOf(path)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(path)
  }
  try {
    await $fetch('/api/admin/disabled-pages', { method: 'POST', body: { pages: current } })
    disabledPages.value = current
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to update pages')
  }
}

async function toggleSiteMode(mode: 'public' | 'restricted') {
  try {
    await $fetch('/api/admin/site-mode', { method: 'POST', body: { mode } })
    siteMode.value = mode
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Failed to change site mode')
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
    await $fetch<any>('/api/admin/refresh', { method: 'POST', query: { target: 'all' } })
    refreshResult.value = { ok: true, message: 'All data sources refreshed successfully.' }
    await loadRefreshStatus()
    await loadMeta()
  } catch (e: any) {
    refreshResult.value = { ok: false, message: e?.data?.statusMessage || 'Request failed' }
  }
  stopPolling()
}

async function handleLogout() {
  await logout()
  await navigateTo('/login')
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
  siteMode.value = authState.value.siteMode || 'restricted'
  disabledPages.value = authState.value.disabledPages || []
  await Promise.all([loadUsers(), loadMeta(), loadRefreshStatus()])
})

onUnmounted(() => {
  stopPolling()
})
</script>
