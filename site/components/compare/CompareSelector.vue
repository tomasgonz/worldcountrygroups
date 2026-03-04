<template>
  <div class="bg-white rounded-2xl border border-primary-100 p-6 mb-10">
    <!-- Mode toggle -->
    <div class="flex items-center gap-1 p-1 bg-primary-50 rounded-lg w-fit mb-5">
      <button
        class="px-4 py-2 text-sm font-medium rounded-md transition-all"
        :class="mode === 'groups' ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-700'"
        @click="$emit('update:mode', 'groups')"
      >Compare Groups</button>
      <button
        class="px-4 py-2 text-sm font-medium rounded-md transition-all"
        :class="mode === 'countries' ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-700'"
        @click="$emit('update:mode', 'countries')"
      >Compare Countries</button>
    </div>

    <!-- Autocomplete -->
    <div class="relative mb-4">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="mode === 'groups' ? 'Search for a group to add...' : 'Search for a country to add...'"
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
          :key="opt.id"
          class="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 transition-colors flex items-center justify-between"
          @mousedown.prevent="addEntity(opt)"
        >
          <span>
            <span v-if="mode === 'countries' && opt.iso2" class="mr-1.5">{{ isoToFlag(opt.iso2) }}</span>
            <span class="font-medium text-primary-900">{{ opt.label }}</span>
            <span v-if="opt.sublabel" class="text-primary-400 ml-2">{{ opt.sublabel }}</span>
          </span>
          <span v-if="opt.meta" class="text-primary-300 text-xs">{{ opt.meta }}</span>
        </button>
      </div>
    </div>

    <!-- Selected chips -->
    <div class="flex flex-wrap gap-2 mb-4">
      <span
        v-for="ent in selected"
        :key="ent.id"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700"
      >
        <span v-if="mode === 'countries' && ent.iso2">{{ isoToFlag(ent.iso2) }}</span>
        {{ ent.label }}
        <button
          class="text-primary-300 hover:text-primary-600 transition-colors ml-0.5"
          @click="$emit('remove', ent.id)"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
      <span v-if="selected.length === 0" class="text-primary-300 text-sm">
        No {{ mode === 'groups' ? 'groups' : 'countries' }} selected
      </span>
    </div>

    <button
      :disabled="selected.length < 2 || loading"
      class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary-900 text-white text-sm rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      @click="$emit('compare')"
    >
      <template v-if="loading">
        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Comparing...
      </template>
      <template v-else>
        Compare
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </template>
    </button>
  </div>
</template>

<script setup lang="ts">
interface SelectOption {
  id: string
  label: string
  sublabel?: string
  meta?: string
  iso2?: string
}

const props = defineProps<{
  mode: 'groups' | 'countries'
  selected: SelectOption[]
  loading: boolean
  groups: any[] | null
  countries: any[] | null
}>()

const emit = defineEmits<{
  'update:mode': [mode: 'groups' | 'countries']
  add: [entity: SelectOption]
  remove: [id: string]
  compare: []
}>()

const searchQuery = ref('')
const showDropdown = ref(false)

const maxItems = computed(() => props.mode === 'groups' ? 5 : 10)

const filteredOptions = computed<SelectOption[]>(() => {
  const selectedIds = new Set(props.selected.map(s => s.id))
  const q = searchQuery.value.toLowerCase()

  if (props.mode === 'groups') {
    if (!props.groups) return []
    return (props.groups as any[])
      .filter(g => !selectedIds.has(g.gid))
      .filter(g => !q || g.acronym.toLowerCase().includes(q) || g.name.toLowerCase().includes(q) || g.gid.toLowerCase().includes(q))
      .slice(0, 20)
      .map(g => ({ id: g.gid, label: g.acronym, sublabel: g.name, meta: `${g.country_count} countries`, iso2: undefined }))
  } else {
    if (!props.countries) return []
    return (props.countries as any[])
      .filter(c => !selectedIds.has(c.iso2))
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q) || (c.iso3 && c.iso3.toLowerCase().includes(q)))
      .slice(0, 20)
      .map(c => ({ id: c.iso2, label: c.name, sublabel: c.iso2, iso2: c.iso2 }))
  }
})

function addEntity(opt: SelectOption) {
  if (props.selected.length >= maxItems.value) return
  emit('add', opt)
  searchQuery.value = ''
  showDropdown.value = false
}

// Close dropdown on outside click
if (import.meta.client) {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.relative')) {
      showDropdown.value = false
    }
  })
}
</script>
