<template>
  <section v-if="d && (d.today?.quotes?.length || d.week?.quotes?.length)" class="said rounded-2xl ring-1 ring-sky-100 bg-white p-5 sm:p-6">
    <div class="flex flex-wrap items-baseline justify-between gap-2 mb-4">
      <h2 class="font-serif text-2xl text-primary-900">What was said</h2>
      <div class="flex gap-1.5" role="tablist">
        <button v-for="w in WINDOWS" :key="w.id" role="tab" :aria-selected="win === w.id" class="text-xs px-3 py-1 rounded-full ring-1"
          :class="win === w.id ? 'bg-[#0077b6] text-white ring-[#0077b6]' : 'ring-sky-200 text-primary-700 hover:ring-[#009edb]'" :disabled="!d[w.id]?.quotes?.length" @click="win = w.id">{{ w.label }}</button>
      </div>
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      <figure v-for="q in shown" :key="q.url + q.quote" class="rounded-xl bg-[#f6f9fc] p-4 min-w-0 flex flex-col">
        <blockquote class="font-serif text-[17px] leading-snug text-primary-900">“{{ q.quote }}”</blockquote>
        <figcaption class="mt-2 text-sm text-primary-700">
          <span class="font-medium">{{ q.speaker }}</span><span v-if="q.role" class="text-primary-500">, {{ q.role }}</span>
        </figcaption>
        <p v-if="q.why" class="text-xs text-primary-500 mt-1">{{ q.why }}</p>
        <a :href="q.url" target="_blank" rel="noopener" class="mt-auto pt-2 text-[11px] text-[#0077b6] hover:underline truncate">{{ q.outlet }} · {{ day(q.date) }} · source →</a>
      </figure>
    </div>
    <MethodNote title="How quotes are chosen">
      <p>Every quote is copied word for word from its source, linked under each card: headlines and summaries in the site's news archive (UN sources and coverage of the UN) and, for the budget, the text of statements delivered in the Fifth Committee. {{ current?.method === 'ai' ? 'An AI model chooses the most substantive among the candidates found and names the speaker; it cannot write or alter a quote, and a speaker who is not named in the source is rejected.' : 'The most recent quotes with a known speaker are shown.' }} Updated every 3 hours ({{ current?.candidates ?? 0 }} candidates {{ win === 'today' ? 'in the last 24 hours' : 'this week' }}).</p>
    </MethodNote>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ section: 'un' | 'budget' | 'leadership' }>()
const WINDOWS = [{ id: 'today', label: 'Today' }, { id: 'week', label: 'This week' }] as const
const { data: d } = useFetch<any>('/api/said', { query: { section: props.section }, lazy: true, server: false })
const win = ref<'today' | 'week'>('today')
watch(d, v => { if (v && !v.today?.quotes?.length) win.value = 'week' }, { immediate: true })
const current = computed(() => d.value?.[win.value])
const shown = computed(() => current.value?.quotes || [])
const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '')
</script>
