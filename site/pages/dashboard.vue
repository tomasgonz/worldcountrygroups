<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-8">Dashboard</h1>

    <!-- Bookmarked Countries -->
    <div class="mb-10">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Bookmarked Countries</h2>
      <div v-if="!bookmarks.state.value.loaded" class="text-sm text-primary-400">Loading...</div>
      <div v-else-if="!bookmarks.state.value.bookmarkedCountries.length" class="bg-white rounded-2xl border border-primary-100 p-8 text-center">
        <p class="text-sm text-primary-400 mb-3">No bookmarked countries yet.</p>
        <NuxtLink to="/countries" class="text-sm text-primary-900 font-medium hover:underline">Browse countries</NuxtLink>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="c in bookmarkedCountryData"
          :key="c.iso2"
          class="bg-white rounded-xl border border-primary-100 p-4 flex items-center justify-between hover:border-primary-300 transition-colors"
        >
          <NuxtLink :to="`/countries/${c.iso3?.toLowerCase() || c.iso2.toLowerCase()}`" class="flex items-center gap-3 min-w-0">
            <span class="text-xl">{{ isoToFlag(c.iso2) }}</span>
            <span class="text-sm font-medium text-primary-800 truncate">{{ c.name }}</span>
          </NuxtLink>
          <button @click="removeBookmark('country', c.iso2)" class="text-primary-300 hover:text-red-500 transition-colors ml-2 flex-shrink-0" title="Remove bookmark">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Bookmarked Groups -->
    <div>
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Bookmarked Groups</h2>
      <div v-if="!bookmarks.state.value.loaded" class="text-sm text-primary-400">Loading...</div>
      <div v-else-if="!bookmarks.state.value.bookmarkedGroups.length" class="bg-white rounded-2xl border border-primary-100 p-8 text-center">
        <p class="text-sm text-primary-400 mb-3">No bookmarked groups yet.</p>
        <NuxtLink to="/groups" class="text-sm text-primary-900 font-medium hover:underline">Browse groups</NuxtLink>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="g in bookmarkedGroupData"
          :key="g.gid"
          class="bg-white rounded-xl border border-primary-100 p-4 flex items-center justify-between hover:border-primary-300 transition-colors"
        >
          <NuxtLink :to="`/groups/${g.gid}`" class="flex items-center gap-3 min-w-0">
            <span class="text-xs font-bold text-primary-400 bg-primary-50 px-2 py-0.5 rounded">{{ g.acronym }}</span>
            <span class="text-sm font-medium text-primary-800 truncate">{{ g.name }}</span>
          </NuxtLink>
          <button @click="removeBookmark('group', g.gid)" class="text-primary-300 hover:text-red-500 transition-colors ml-2 flex-shrink-0" title="Remove bookmark">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Dashboard — World Country Groups' })

const bookmarks = useBookmarks()
const { countries } = useCountries()
const { groups } = useGroups()

const bookmarkedCountryData = computed(() => {
  const list = countries.value as any[] | null
  if (!list) return []
  return bookmarks.state.value.bookmarkedCountries
    .map((iso) => list.find((c) => c.iso2 === iso))
    .filter(Boolean)
})

const bookmarkedGroupData = computed(() => {
  const list = groups.value as any[] | null
  if (!list) return []
  return bookmarks.state.value.bookmarkedGroups
    .map((gid) => list.find((g) => g.gid === gid))
    .filter(Boolean)
})

async function removeBookmark(type: 'country' | 'group', id: string) {
  await bookmarks.toggleBookmark(type, id)
}

onMounted(async () => {
  if (!bookmarks.state.value.loaded) {
    await bookmarks.fetchBookmarks()
  }
})
</script>
