<template>
  <NuxtLink
    :to="`/groups/${group.gid}`"
    class="block bg-white rounded-2xl border border-primary-100 hover:border-primary-200 hover:shadow-sm transition-all p-6 group"
  >
    <div class="flex items-start justify-between mb-2">
      <h3 class="font-serif font-semibold text-primary-900 text-lg group-hover:text-primary-700 transition-colors">{{ group.acronym }}</h3>
      <span class="text-xs text-primary-400 tabular-nums ml-2 whitespace-nowrap">
        {{ group.country_count }} {{ group.country_count === 1 ? 'country' : 'countries' }}
      </span>
    </div>
    <p class="text-primary-400 text-sm mb-4 line-clamp-2">{{ group.name }}</p>
    <div class="flex flex-wrap gap-1.5">
      <DomainTag v-for="d in group.domains" :key="d" :domain="d" size="sm" />
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{
  group: {
    gid: string
    acronym: string
    name: string
    description: string
    domains: string[]
    country_count: number
  }
}>()
</script>
