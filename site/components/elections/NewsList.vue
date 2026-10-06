<template>
  <section class="bg-white rounded-2xl ring-1 ring-primary-200/70 p-5 sm:p-6">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="font-serif text-xl text-primary-900">{{ title }}</h3>
      <span v-if="updated" class="text-[11px] text-primary-400">updated {{ ago(updated) }} · refreshed every 6 hours</span>
    </div>
    <p v-if="subtitle" class="text-xs text-primary-500 mt-1">{{ subtitle }}</p>
    <ul v-if="items.length" class="mt-3 divide-y divide-primary-100">
      <li v-for="it in items.slice(0, shown)" :key="it.url" class="py-2.5">
        <a :href="it.url" target="_blank" rel="noopener" class="text-sm text-primary-900 hover:text-accent-700 leading-snug">{{ it.title }}</a>
        <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-primary-500">
          <span v-if="it.tag" class="px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">{{ it.tag }}</span>
          <span>{{ it.outlet }}</span>
          <span v-if="it.via === 'official'" class="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800">official</span>
          <span>· {{ ago(it.date) }}</span>
        </div>
      </li>
    </ul>
    <p v-else class="text-sm text-primary-400 mt-3">{{ empty || 'No recent news.' }}</p>
    <button v-if="items.length > shown" class="mt-2 text-xs text-accent-700 hover:underline" @click="shown += 10">Show more ({{ items.length - shown }})</button>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title: string; subtitle?: string; items: any[]; updated?: string | null; empty?: string }>(), { items: () => [] })
const shown = ref(6)
function ago(d?: string) {
  if (!d) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  if (m < 60) return `${m || 1} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)} days ago`
}
</script>
