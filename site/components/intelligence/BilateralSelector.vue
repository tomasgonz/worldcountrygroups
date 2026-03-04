<template>
  <div class="bg-white rounded-2xl border border-primary-100 p-6 mb-10">
    <h2 class="font-serif text-lg font-semibold text-primary-900 mb-1">Bilateral Meeting Prep</h2>
    <p class="text-primary-400 text-xs mb-4">Prepare a diplomatic brief comparing two countries.</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      <!-- Country A -->
      <div>
        <label class="block text-xs font-medium text-primary-500 mb-1">Country A</label>
        <div class="relative">
          <input
            v-model="queryA"
            type="text"
            placeholder="Search country..."
            class="block w-full px-4 py-2.5 border border-primary-100 rounded-lg bg-white text-primary-900 placeholder-primary-300 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all"
            @focus="dropdownA = true"
            @input="dropdownA = true"
          />
          <div
            v-if="dropdownA && optionsA.length > 0"
            class="absolute z-20 left-0 right-0 mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          >
            <button
              v-for="opt in optionsA"
              :key="opt.iso2"
              class="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 transition-colors flex items-center gap-2"
              @mousedown.prevent="pick('a', opt)"
            >
              <span>{{ isoToFlag(opt.iso2) }}</span>
              <span class="font-medium text-primary-900">{{ opt.name }}</span>
              <span class="text-primary-300 text-xs">{{ opt.iso3 }}</span>
            </button>
          </div>
        </div>
        <div v-if="selectedA" class="mt-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700">
            {{ isoToFlag(selectedA.iso2) }} {{ selectedA.name }}
            <button class="text-primary-300 hover:text-primary-600 ml-0.5" @click="selectedA = null">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        </div>
      </div>

      <!-- Country B -->
      <div>
        <label class="block text-xs font-medium text-primary-500 mb-1">Country B</label>
        <div class="relative">
          <input
            v-model="queryB"
            type="text"
            placeholder="Search country..."
            class="block w-full px-4 py-2.5 border border-primary-100 rounded-lg bg-white text-primary-900 placeholder-primary-300 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all"
            @focus="dropdownB = true"
            @input="dropdownB = true"
          />
          <div
            v-if="dropdownB && optionsB.length > 0"
            class="absolute z-20 left-0 right-0 mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          >
            <button
              v-for="opt in optionsB"
              :key="opt.iso2"
              class="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 transition-colors flex items-center gap-2"
              @mousedown.prevent="pick('b', opt)"
            >
              <span>{{ isoToFlag(opt.iso2) }}</span>
              <span class="font-medium text-primary-900">{{ opt.name }}</span>
              <span class="text-primary-300 text-xs">{{ opt.iso3 }}</span>
            </button>
          </div>
        </div>
        <div v-if="selectedB" class="mt-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700">
            {{ isoToFlag(selectedB.iso2) }} {{ selectedB.name }}
            <button class="text-primary-300 hover:text-primary-600 ml-0.5" @click="selectedB = null">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        </div>
      </div>
    </div>

    <button
      :disabled="!selectedA || !selectedB || loading"
      class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary-900 text-white text-sm rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      @click="$emit('generate', selectedA!.iso3, selectedB!.iso3)"
    >
      <template v-if="loading">
        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Preparing...
      </template>
      <template v-else>Prepare Brief</template>
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  countries: any[] | null
  loading: boolean
  initialA?: string
  initialB?: string
}>()

defineEmits<{ generate: [a: string, b: string] }>()

const queryA = ref('')
const queryB = ref('')
const dropdownA = ref(false)
const dropdownB = ref(false)
const selectedA = ref<{ name: string; iso2: string; iso3: string } | null>(null)
const selectedB = ref<{ name: string; iso2: string; iso3: string } | null>(null)

function filterCountries(q: string, exclude?: string) {
  if (!props.countries) return []
  const lower = q.toLowerCase()
  return (props.countries as any[])
    .filter(c => c.iso3 !== exclude)
    .filter(c => !lower || c.name.toLowerCase().includes(lower) || c.iso2.toLowerCase().includes(lower) || (c.iso3 && c.iso3.toLowerCase().includes(lower)))
    .slice(0, 20)
}

const optionsA = computed(() => filterCountries(queryA.value, selectedB.value?.iso3))
const optionsB = computed(() => filterCountries(queryB.value, selectedA.value?.iso3))

function pick(side: 'a' | 'b', c: any) {
  const val = { name: c.name, iso2: c.iso2, iso3: c.iso3 }
  if (side === 'a') { selectedA.value = val; queryA.value = ''; dropdownA.value = false }
  else { selectedB.value = val; queryB.value = ''; dropdownB.value = false }
}

function preSelect() {
  if (!props.countries) return
  if (props.initialA && !selectedA.value) {
    const m = (props.countries as any[]).find(c => c.iso3 === props.initialA || c.iso2 === props.initialA)
    if (m) selectedA.value = { name: m.name, iso2: m.iso2, iso3: m.iso3 }
  }
  if (props.initialB && !selectedB.value) {
    const m = (props.countries as any[]).find(c => c.iso3 === props.initialB || c.iso2 === props.initialB)
    if (m) selectedB.value = { name: m.name, iso2: m.iso2, iso3: m.iso3 }
  }
}

watch(() => [props.initialA, props.initialB, props.countries], preSelect, { immediate: true })

if (import.meta.client) {
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.relative')) {
      dropdownA.value = false
      dropdownB.value = false
    }
  })
}
</script>
