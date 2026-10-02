<template>
  <!-- Current leaders and other known officials of a country, linking to their profiles -->
  <section v-if="people.length" class="mb-8">
    <div class="flex items-baseline justify-between mb-3">
      <h3 class="font-serif text-lg font-bold text-primary-800">Leaders and officials</h3>
      <NuxtLink :to="`/people?country=${iso3}`" class="text-xs text-accent-600 hover:underline">All people &rarr;</NuxtLink>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <NuxtLink v-for="p in people" :key="p.slug" :to="`/people/${p.slug}`" class="group flex items-center gap-3 bg-white rounded-xl ring-1 ring-primary-100 p-3 hover:ring-accent-300 transition">
        <PersonPhoto :image="p.image" :image-path="p.imagePath" :image-url="p.imageUrl" :name="p.name" size="h-12 w-12" :width="120" />
        <div class="min-w-0">
          <div class="text-sm font-medium text-primary-900 group-hover:text-accent-700 truncate">{{ p.name }}</div>
          <div class="text-xs text-primary-500 truncate">{{ roleHere(p) }}</div>
          <div v-if="p.mentions30d" class="text-[10px] text-primary-400">{{ p.mentions30d }} mention{{ p.mentions30d === 1 ? '' : 's' }} in 30 days</div>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ iso3: string }>()
const { data } = useFetch<any>('/api/people', { query: computed(() => ({ iso3: props.iso3, limit: 30 })), server: false })
const RANK: Record<string, number> = { 'Head of State': 0, 'Head of Government': 1, 'Foreign Minister': 2 }
const roleHere = (p: any) => p.roles.filter((r: any) => r.iso3 === props.iso3).map((r: any) => r.role).join(' · ') || 'General Debate speaker'
const people = computed(() => [...(data.value?.people || [])]
  .sort((a: any, b: any) => {
    const ra = Math.min(...a.roles.filter((r: any) => r.iso3 === props.iso3).map((r: any) => RANK[r.role] ?? 5), 6)
    const rb = Math.min(...b.roles.filter((r: any) => r.iso3 === props.iso3).map((r: any) => RANK[r.role] ?? 5), 6)
    return ra - rb || (b.mentions30d - a.mentions30d)
  })
  .slice(0, 6))
</script>
