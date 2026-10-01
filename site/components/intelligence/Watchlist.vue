<template>
  <div>
    <div v-if="!codes.length" class="bg-white rounded-2xl border border-primary-100 p-8 text-center">
      <p class="text-primary-500 mb-3">No countries bookmarked yet.</p>
      <NuxtLink to="/countries" class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
        Browse countries to add bookmarks →
      </NuxtLink>
    </div>

    <template v-else>
      <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in Math.min(codes.length, 6)" :key="i" class="bg-white rounded-xl border border-primary-100 p-4 animate-pulse">
          <div class="h-4 bg-primary-100 rounded w-2/3 mb-3"></div>
          <div class="h-3 bg-primary-100 rounded w-1/2 mb-2"></div>
          <div class="h-3 bg-primary-100 rounded w-full"></div>
        </div>
      </div>

      <div v-else-if="countries.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="c in countries"
          :key="c.iso3"
          class="bg-white rounded-xl border border-primary-100 p-4 hover:shadow-sm transition-shadow"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ isoToFlag(c.iso2) }}</span>
              <div>
                <h4 class="text-sm font-semibold text-primary-900">{{ c.name }}</h4>
                <p class="text-[10px] text-primary-400">{{ c.region || c.iso3 }}</p>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <span
                v-if="c.conflictIntensity !== 'none'"
                class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                :class="intensityBadge(c.conflictIntensity)"
              >{{ c.conflictIntensity }}</span>
              <span
                v-if="c.sanctionsCount"
                class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700"
              >{{ c.sanctionsCount }} sanction{{ c.sanctionsCount !== 1 ? 's' : '' }}</span>
            </div>
          </div>

          <div v-if="c.riskScore" class="flex items-center gap-2 mb-2">
            <span class="text-xs text-primary-500">Risk:</span>
            <span class="text-xs font-bold" :class="riskColor(c.riskScore)">{{ c.riskScore }}/100</span>
          </div>

          <p v-if="c.latestHeadline" class="text-xs text-primary-600 line-clamp-2 mb-3">
            {{ c.latestHeadline }}
          </p>
          <p v-else class="text-xs text-primary-400 italic mb-3">No recent news</p>

          <button
            @click="$emit('view-country', c.iso3)"
            class="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            View Briefing →
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  codes: string[]
}>()

defineEmits<{
  'view-country': [iso3: string]
}>()

const pending = ref(false)
const countries = ref<any[]>([])

async function fetchWatchlist() {
  if (!props.codes.length) { countries.value = []; return }
  pending.value = true
  try {
    const res = await $fetch<any>('/api/intelligence/watchlist', {
      query: { codes: props.codes.join(',') }
    })
    countries.value = res.countries || []
  } catch {
    countries.value = []
  }
  pending.value = false
}

watch(() => props.codes, fetchWatchlist, { immediate: true })

function intensityBadge(i: string) {
  if (i === 'high') return 'bg-red-100 text-red-700'
  if (i === 'medium') return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

function riskColor(score: string) {
  const n = parseInt(score)
  if (n >= 70) return 'text-red-600'
  if (n >= 40) return 'text-amber-600'
  return 'text-emerald-600'
}
</script>
