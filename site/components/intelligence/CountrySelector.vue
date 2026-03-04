<template>
  <div class="bg-white rounded-2xl border border-primary-100 p-6 mb-10">
    <h2 class="font-serif text-lg font-semibold text-primary-900 mb-1">Country Briefing</h2>
    <p class="text-primary-400 text-xs mb-4">Generate a comprehensive intelligence briefing for any country.</p>

    <div class="relative mb-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search for a country..."
        class="block w-full px-4 py-2.5 border border-primary-100 rounded-lg bg-white text-primary-900 placeholder-primary-300 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-200 outline-none transition-all"
        @focus="showDropdown = true"
        @input="showDropdown = true"
      />
      <div
        v-if="showDropdown && filteredOptions.length > 0"
        class="absolute z-20 left-0 right-0 mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-60 overflow-y-auto"
      >
        <button
          v-for="opt in filteredOptions"
          :key="opt.iso2"
          class="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 transition-colors flex items-center gap-2"
          @mousedown.prevent="selectCountry(opt)"
        >
          <span>{{ isoToFlag(opt.iso2) }}</span>
          <span class="font-medium text-primary-900">{{ opt.name }}</span>
          <span class="text-primary-300 text-xs">{{ opt.iso3 }}</span>
        </button>
      </div>
    </div>

    <div v-if="selected" class="flex items-center gap-2 mb-4">
      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700">
        {{ isoToFlag(selected.iso2) }}
        {{ selected.name }}
        <button class="text-primary-300 hover:text-primary-600 ml-0.5" @click="selected = null">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>

    <button
      :disabled="!selected || loading"
      class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary-900 text-white text-sm rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      @click="$emit('generate', selected!.iso3)"
    >
      <template v-if="loading">
        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Generating...
      </template>
      <template v-else>Generate Briefing</template>
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  countries: any[] | null
  loading: boolean
  initialIso?: string
}>()

defineEmits<{ generate: [iso: string] }>()

const searchQuery = ref('')
const showDropdown = ref(false)
const selected = ref<{ name: string; iso2: string; iso3: string } | null>(null)

const filteredOptions = computed(() => {
  if (!props.countries) return []
  const q = searchQuery.value.toLowerCase()
  return (props.countries as any[])
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q) || (c.iso3 && c.iso3.toLowerCase().includes(q)))
    .slice(0, 20)
})

function selectCountry(c: any) {
  selected.value = { name: c.name, iso2: c.iso2, iso3: c.iso3 }
  searchQuery.value = ''
  showDropdown.value = false
}

// Pre-select from prop
watch(() => props.initialIso, (iso) => {
  if (iso && props.countries) {
    const match = (props.countries as any[]).find(c => c.iso3 === iso || c.iso2 === iso)
    if (match) selected.value = { name: match.name, iso2: match.iso2, iso3: match.iso3 }
  }
}, { immediate: true })

watch(() => props.countries, (countries) => {
  if (props.initialIso && countries && !selected.value) {
    const match = (countries as any[]).find(c => c.iso3 === props.initialIso || c.iso2 === props.initialIso)
    if (match) selected.value = { name: match.name, iso2: match.iso2, iso3: match.iso3 }
  }
})

if (import.meta.client) {
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.relative')) showDropdown.value = false
  })
}
</script>
