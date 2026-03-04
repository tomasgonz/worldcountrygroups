<template>
  <div>
    <!-- Hero -->
    <section class="bg-white border-b border-primary-100">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-900 mb-6 max-w-3xl leading-[1.1]">
          A reference for international country groupings
        </h1>
        <p class="text-primary-400 text-lg max-w-2xl mb-10 leading-relaxed">
          Explore {{ groupCount }} groups and {{ countryCount }} countries — membership data, GDP, population, CO2 emissions, UN voting records, and AI-analyzed General Assembly speeches.
        </p>
        <div class="max-w-lg mb-12">
          <SearchBar v-model="searchQuery" placeholder="Search countries, groups, or keywords..." />
        </div>
        <div class="flex items-center gap-10 text-sm">
          <div>
            <div class="text-3xl font-serif font-bold text-primary-900">{{ groupCount }}</div>
            <div class="text-primary-400 mt-0.5">Groups</div>
          </div>
          <div class="w-px h-10 bg-primary-100"></div>
          <div>
            <div class="text-3xl font-serif font-bold text-primary-900">{{ countryCount }}</div>
            <div class="text-primary-400 mt-0.5">Countries</div>
          </div>
          <div class="w-px h-10 bg-primary-100"></div>
          <div>
            <div class="text-3xl font-serif font-bold text-primary-900">5,600+</div>
            <div class="text-primary-400 mt-0.5">Resolutions</div>
          </div>
          <div class="w-px h-10 bg-primary-100"></div>
          <div>
            <div class="text-3xl font-serif font-bold text-primary-900">169</div>
            <div class="text-primary-400 mt-0.5">Speeches</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Search results -->
    <section v-if="searchQuery" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div v-if="searchPending" class="space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div v-for="i in 6" :key="i" class="skeleton h-20 rounded-xl" />
        </div>
      </div>
      <div v-else-if="searchData.countries.length || searchData.groups.length">
        <!-- Country results -->
        <div v-if="searchData.countries.length" class="mb-10">
          <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Countries</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NuxtLink
              v-for="c in searchData.countries"
              :key="c.iso2"
              :to="`/countries/${c.iso2.toLowerCase()}`"
              class="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary-100 bg-white hover:border-primary-200 hover:shadow-sm transition-all"
            >
              <span class="text-2xl leading-none">{{ isoToFlag(c.iso2) }}</span>
              <div class="min-w-0 flex-1">
                <div class="font-medium text-primary-900 truncate">{{ c.name }}</div>
                <div class="text-xs text-primary-400">{{ c.iso2 }} · Member of {{ c.groupCount }} groups</div>
              </div>
            </NuxtLink>
          </div>
        </div>
        <!-- Group results -->
        <div v-if="searchData.groups.length">
          <h2 class="font-serif text-xl font-bold text-primary-900 mb-4">Groups</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <GroupCard v-for="g in searchData.groups" :key="g.gid" :group="g" />
          </div>
        </div>
      </div>
      <p v-else class="text-primary-400">No results found for "{{ searchQuery }}"</p>
    </section>

  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

useHead({ title: 'World Country Groups — International Organizations Reference' })

const { groups } = useGroups()

const groupCount = computed(() => groups.value?.length ?? 0)
const countryCount = computed(() => {
  if (!groups.value) return 0
  const world = groups.value.find((g: any) => g.gid === 'world')
  return world ? world.country_count : 220
})

const searchQuery = ref('')
const searchData = ref<{ groups: any[]; countries: any[] }>({ groups: [], countries: [] })
const searchPending = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (q) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!q) {
    searchData.value = { groups: [], countries: [] }
    return
  }
  searchPending.value = true
  searchTimeout = setTimeout(async () => {
    try {
      searchData.value = await $fetch(`/api/search?q=${encodeURIComponent(q)}`)
    } catch {
      searchData.value = { groups: [], countries: [] }
    } finally {
      searchPending.value = false
    }
  }, 300)
})
</script>
