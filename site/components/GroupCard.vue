<template>
  <NuxtLink
    :to="`/groups/${group.gid}`"
    class="block bg-white rounded-xl border border-primary-200/60 hover:border-primary-300 hover:shadow-md transition-all p-5 group"
  >
    <div class="flex items-start justify-between mb-1.5">
      <h3 class="font-serif font-semibold text-primary-900 text-lg group-hover:text-accent-600 transition-colors">{{ group.acronym }}</h3>
      <span class="text-xs text-primary-400 font-medium tabular-nums ml-2 whitespace-nowrap">
        {{ group.country_count }}
      </span>
    </div>
    <p class="text-primary-500 text-sm mb-3 line-clamp-2">{{ group.name }}</p>
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
