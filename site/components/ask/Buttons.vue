<template>
  <div class="flex flex-wrap items-center gap-2" aria-label="Ask the research desk">
    <NuxtLink :to="link(briefQuestion, 'briefing', kind === 'group' ? 'group' : 'country')"
      class="inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full bg-primary-900 text-white hover:bg-primary-800">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z" /></svg>
      Brief me on {{ kind === 'group' ? 'this group' : name }}
    </NuxtLink>
    <template v-if="kind === 'country'">
      <form class="inline-flex items-center gap-1 rounded-full ring-1 ring-primary-200 bg-white pl-3 pr-1 py-0.5" @submit.prevent="goBilateral">
        <label :for="`bilat-${iso3}`" class="text-xs text-primary-500 whitespace-nowrap">Bilateral brief with</label>
        <select :id="`bilat-${iso3}`" v-model="partner" class="text-sm bg-transparent py-1 max-w-[11rem] focus:outline-none">
          <option value="">choose…</option>
          <option v-for="c in partners" :key="c.iso3" :value="c.name">{{ c.name }}</option>
        </select>
        <button class="text-xs px-2.5 py-1 rounded-full bg-primary-100 text-primary-800 hover:bg-primary-200 disabled:opacity-40" :disabled="!partner">Go</button>
      </form>
    </template>
    <NuxtLink v-for="q in quick" :key="q.label" :to="link(q.q, 'answer')"
      class="text-xs px-3 py-1.5 rounded-full ring-1 ring-primary-200 text-primary-600 hover:ring-primary-400 bg-white">{{ q.label }}</NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { useCountries } from '~/composables/useGroups'

const props = defineProps<{ kind: 'country' | 'group'; name: string; iso3?: string }>()

const briefQuestion = computed(() => props.kind === 'group'
  ? `Prepare a briefing on the ${props.name}: membership, cohesion in UN votes, positions and recent developments.`
  : `Prepare a country briefing on ${props.name}.`)
const quick = computed(() => props.kind === 'group'
  ? [
      { label: 'Who breaks ranks?', q: `Which members of the ${props.name} most often vote differently from the rest of the group at the General Assembly, and on which issues?` },
      { label: 'What did members say this year?', q: `What were the main themes in this year's General Debate speeches by members of the ${props.name}?` },
    ]
  : [
      { label: 'Recent developments', q: `What are the most important recent developments concerning ${props.name}, from the news and official statements?` },
      { label: 'UN voting pattern', q: `Summarise how ${props.name} votes at the General Assembly: who it agrees with most and least, and where it departs from its groups.` },
      { label: 'What it says at the UN', q: `What have ${props.name}'s General Debate speeches emphasised over the last ten years, and how has that changed?` },
    ])

function link(q: string, mode: 'answer' | 'briefing', template = 'free') {
  return { path: '/ask', query: { q, mode, template, run: '1' } }
}

const { countries } = useCountries()
const partner = ref('')
const partners = computed(() => ((countries.value as any[]) || []).filter((c: any) => c.iso3 && c.iso3 !== props.iso3).sort((a: any, b: any) => a.name.localeCompare(b.name)))
function goBilateral() {
  if (!partner.value) return
  navigateTo(link(`Prepare a bilateral meeting brief for ${props.name} and ${partner.value}.`, 'briefing', 'bilateral'))
}
</script>
