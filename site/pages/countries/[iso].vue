<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div v-if="error" class="text-center py-20">
      <h1 class="text-2xl font-bold text-gray-400 mb-2">Country not found</h1>
      <NuxtLink to="/groups" class="text-accent-500 hover:text-accent-600">Browse groups &rarr;</NuxtLink>
    </div>

    <template v-else-if="country">
      <!-- Breadcrumb -->
      <nav class="text-sm text-gray-400 mb-6">
        <NuxtLink to="/groups" class="hover:text-accent-500">Groups</NuxtLink>
        <span class="mx-2">/</span>
        <span class="text-gray-700">{{ (country as any).name }}</span>
      </nav>

      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center gap-4">
          <span v-if="(country as any).iso2" class="text-5xl">{{ isoToFlag((country as any).iso2) }}</span>
          <div>
            <h1 class="text-3xl sm:text-4xl font-bold text-primary-500">{{ (country as any).name }}</h1>
            <p class="text-gray-500 mt-1">
              <span v-if="(country as any).iso2">ISO 3166-1 alpha-2: <strong>{{ (country as any).iso2 }}</strong></span>
              <span v-if="(country as any).iso2 && (country as any).iso3"> &middot; </span>
              <span v-if="(country as any).iso3">alpha-3: <strong>{{ (country as any).iso3 }}</strong></span>
            </p>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="mb-10">
        <h2 class="text-xl font-bold text-primary-500 mb-4">Country Statistics</h2>
        <GroupStats :stats="stats as any" :pending="statsPending" />
      </div>

      <!-- Memberships -->
      <div>
        <h2 class="text-xl font-bold text-primary-500 mb-4">
          Group Memberships
          <span class="text-base font-normal text-gray-400">({{ (country as any).groups.length }})</span>
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <GroupCard v-for="g in (country as any).groups" :key="g.gid" :group="g" />
        </div>
      </div>
    </template>

    <div v-else class="space-y-6">
      <div class="skeleton h-10 w-64" />
      <div class="skeleton h-6 w-96" />
      <div class="grid grid-cols-3 gap-4">
        <div class="skeleton h-24 rounded-xl" />
        <div class="skeleton h-24 rounded-xl" />
        <div class="skeleton h-24 rounded-xl" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const iso = route.params.iso as string

const { country, error } = useCountry(iso)
const { stats, pending: statsPending } = useCountryStats(iso)

useHead({
  title: computed(() => {
    const c = country.value as any
    return c ? `${c.name} — World Country Groups` : 'Loading...'
  }),
})
</script>
