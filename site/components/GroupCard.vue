<template>
  <NuxtLink
    :to="`/groups/${group.gid}`"
    class="block bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-accent-200 transition-all p-5"
  >
    <div class="flex items-start justify-between mb-2">
      <h3 class="font-bold text-primary-500 text-lg leading-tight">{{ group.acronym }}</h3>
      <span class="text-xs bg-primary-50 text-primary-500 px-2 py-0.5 rounded-full font-medium whitespace-nowrap ml-2">
        {{ group.country_count }} countries
      </span>
    </div>
    <p class="text-gray-600 text-sm mb-3 line-clamp-2">{{ group.name }}</p>
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
