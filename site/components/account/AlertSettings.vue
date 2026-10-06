<template>
  <div id="alerts" class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 scroll-mt-24">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
      <h2 class="font-serif text-xl font-bold text-primary-900">Alerts</h2>
      <label v-if="s" class="flex items-center gap-2 text-sm text-primary-700">
        <input v-model="s.enabled" type="checkbox" class="rounded" @change="save"> Alerts on
      </label>
    </div>
    <p class="text-sm text-primary-500 mb-4">Be told when something happens on what you follow. Checked every hour; alerts appear under the bell at the top of the page and, if you choose, by email.</p>
    <div v-if="s" class="space-y-5" :class="s.enabled ? '' : 'opacity-60'">
      <div>
        <div class="text-sm font-medium text-primary-800">Countries</div>
        <p class="text-xs text-primary-500 mb-2">{{ s.countries.length ? 'Alerts cover these countries.' : (s.followed.length ? `Using the ${s.followed.length} countries you follow (bookmarks). Add countries here to choose a different list.` : 'Add countries, or bookmark them on country pages.') }}</p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="c in (s.countries.length ? s.countries : s.followed)" :key="c" class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-800">
            {{ nameOf(c) }}<button v-if="s.countries.length" class="text-primary-400 hover:text-red-600" :aria-label="`Remove ${nameOf(c)}`" @click="s.countries = s.countries.filter((x: string) => x !== c); save()">×</button>
          </span>
          <select class="text-xs border border-primary-200 rounded-lg px-2 py-1 bg-white" aria-label="Add a country" @change="add(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
            <option value="">+ Add a country</option>
            <option v-for="c in countryList" :key="c.iso3" :value="c.iso3">{{ c.name }}</option>
          </select>
        </div>
      </div>
      <div>
        <div class="text-sm font-medium text-primary-800 mb-1">Tell me about</div>
        <div class="grid sm:grid-cols-2 gap-1.5 text-sm text-primary-700">
          <label v-for="t in TYPES" :key="t.k" class="flex items-start gap-2"><input v-model="s.types[t.k]" type="checkbox" class="rounded mt-1" @change="save"><span>{{ t.label }}<span class="block text-xs text-primary-400">{{ t.hint }}</span></span></label>
        </div>
      </div>
      <div>
        <label class="text-sm font-medium text-primary-800" for="alert-keywords">Keywords</label>
        <p class="text-xs text-primary-500 mb-1">Get an alert when news or official statements mention these words (comma-separated, e.g. “debt relief, Sahel, Grynspan”).</p>
        <input id="alert-keywords" v-model="keywords" class="w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" @change="save">
      </div>
      <div class="flex flex-wrap items-end gap-4">
        <label class="text-sm text-primary-800">Email
          <select v-model="s.email" class="block mt-1 border border-primary-200 rounded-lg px-2 py-1.5 text-sm bg-white" @change="save">
            <option value="daily">Once a day, a summary</option><option value="instant">As they happen (at most hourly)</option><option value="off">No email, notifications only</option>
          </select>
        </label>
        <label v-if="s.email === 'daily'" class="text-sm text-primary-800">At
          <select v-model.number="s.dailyHour" class="block mt-1 border border-primary-200 rounded-lg px-2 py-1.5 text-sm bg-white" @change="save">
            <option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00 UTC</option>
          </select>
        </label>
        <span v-if="!hasEmail && s.email !== 'off'" class="text-xs text-amber-700">Add an email address in your profile to receive emails.</span>
        <span v-if="saved" class="text-xs text-emerald-700">Saved</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCountries } from '~/composables/useGroups'

const s = ref<any>(null)
const hasEmail = ref(false)
const keywords = ref('')
const saved = ref(false)
const TYPES = [
  { k: 'elections', label: 'Elections', hint: 'announced, or dates changed' },
  { k: 'statements', label: 'Official statements', hint: 'new statements by or about the country' },
  { k: 'unsc', label: 'Security Council', hint: 'resolutions about the country, and vetoes' },
  { k: 'attention', label: 'Surges in news attention', hint: 'far more coverage than usual' },
  { k: 'sg', label: 'Secretary-General race', hint: 'straw polls, nominations, withdrawals' },
]
const { countries } = useCountries()
const countryList = computed(() => ((countries.value as any[]) || []).filter((c: any) => c.iso3).sort((a: any, b: any) => a.name.localeCompare(b.name)))
const nameOf = (iso3: string) => countryList.value.find((c: any) => c.iso3 === iso3)?.name || iso3
async function load() {
  const r = await $fetch<any>('/api/account/alerts')
  s.value = r.settings; hasEmail.value = r.hasEmail; keywords.value = (r.settings.keywords || []).join(', ')
}
onMounted(load)
function add(iso3: string) {
  if (!iso3) return
  const base = s.value.countries.length ? s.value.countries : [...s.value.followed]
  if (!base.includes(iso3)) s.value.countries = [...base, iso3]
  save()
}
async function save() {
  const body = { ...s.value, keywords: keywords.value.split(',').map(k => k.trim()).filter(Boolean) }
  const r = await $fetch<any>('/api/account/alerts', { method: 'POST', body })
  s.value = r.settings; saved.value = true; setTimeout(() => { saved.value = false }, 1500)
}
</script>
