<template>
  <div>
    <!-- Controls -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-4">Voting Bloc Detector</h3>
      <p class="text-sm text-primary-500 mb-4">Discover clusters of countries that vote similarly in the UN General Assembly.</p>

      <div class="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label class="block text-xs text-primary-500 mb-1">Sessions (last N)</label>
          <input
            v-model.number="sessions"
            type="number" min="1" max="10"
            class="w-20 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs text-primary-500 mb-1">Agreement Threshold: {{ (threshold * 100).toFixed(0) }}%</label>
          <input
            v-model.number="threshold"
            type="range" min="0.50" max="0.95" step="0.01"
            class="w-full accent-indigo-600"
          />
        </div>
        <button
          @click="detect"
          :disabled="loading"
          class="px-4 py-2 bg-primary-900 text-white text-sm font-medium rounded-lg hover:bg-primary-800 disabled:opacity-50 transition-colors"
        >
          {{ loading ? 'Detecting...' : 'Detect Blocs' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="bg-white rounded-xl border border-primary-100 p-6 animate-pulse">
        <div class="h-5 bg-primary-100 rounded w-1/3 mb-3"></div>
        <div class="h-4 bg-primary-100 rounded w-2/3 mb-2"></div>
        <div class="flex gap-2">
          <div v-for="j in 5" :key="j" class="h-6 w-12 bg-primary-100 rounded"></div>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div v-else-if="blocs.length" class="space-y-4">
      <div
        v-for="bloc in blocs"
        :key="bloc.id"
        class="bg-white rounded-xl border border-primary-100 p-6"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <span class="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold">Bloc {{ bloc.id }}</span>
            <span class="text-sm text-primary-700 font-medium">{{ bloc.size }} countries</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-primary-500">Cohesion:</span>
            <span class="text-sm font-bold" :class="cohesionColor(bloc.cohesion)">{{ (bloc.cohesion * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <!-- Best matching groups -->
        <div v-if="bloc.matchingGroups?.length" class="mb-3">
          <span class="text-xs text-primary-500 mr-2">Matches:</span>
          <span
            v-for="g in bloc.matchingGroups.slice(0, 3)"
            :key="g.gid"
            class="inline-flex items-center gap-1 mr-2 px-2 py-0.5 bg-primary-50 rounded text-xs text-primary-600"
          >
            <NuxtLink :to="`/groups/${g.gid}`" class="hover:text-indigo-600">{{ g.acronym }}</NuxtLink>
            <span class="text-primary-400">({{ (g.jaccard * 100).toFixed(0) }}%)</span>
          </span>
        </div>

        <!-- Member flags preview -->
        <div class="flex flex-wrap gap-1 mb-2">
          <span
            v-for="m in bloc.memberNames.slice(0, expanded[bloc.id] ? undefined : 15)"
            :key="m.iso3"
            class="text-xs px-1.5 py-0.5 bg-primary-50 rounded text-primary-600"
            :title="m.name"
          >{{ m.iso3 }}</span>
          <button
            v-if="bloc.memberNames.length > 15"
            @click="expanded[bloc.id] = !expanded[bloc.id]"
            class="text-xs text-indigo-600 hover:text-indigo-800"
          >
            {{ expanded[bloc.id] ? 'Show less' : `+${bloc.memberNames.length - 15} more` }}
          </button>
        </div>
      </div>

      <p class="text-[10px] text-primary-300 text-center">
        Computed at {{ new Date(computedAt).toLocaleString() }} &middot; Threshold: {{ (usedThreshold * 100).toFixed(0) }}% &middot; Sessions: {{ usedSessions }}
      </p>
    </div>

    <div v-else-if="hasRun" class="bg-white rounded-xl border border-primary-100 p-8 text-center">
      <p class="text-primary-500">No voting blocs detected at this threshold. Try lowering the agreement threshold.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const sessions = ref(5)
const threshold = ref(0.80)
const loading = ref(false)
const blocs = ref<any[]>([])
const computedAt = ref('')
const usedThreshold = ref(0.80)
const usedSessions = ref(5)
const hasRun = ref(false)
const expanded = reactive<Record<number, boolean>>({})

async function detect() {
  loading.value = true
  hasRun.value = true
  try {
    const res = await $fetch<any>('/api/intelligence/voting-blocs', {
      query: { sessions: sessions.value, threshold: threshold.value }
    })
    blocs.value = res.blocs || []
    computedAt.value = res.computedAt
    usedThreshold.value = res.threshold
    usedSessions.value = res.sessions
  } catch {
    blocs.value = []
  }
  loading.value = false
}

function cohesionColor(v: number) {
  if (v >= 0.9) return 'text-emerald-600'
  if (v >= 0.8) return 'text-blue-600'
  if (v >= 0.7) return 'text-amber-600'
  return 'text-red-600'
}

// Auto-detect on mount
onMounted(() => detect())
</script>
