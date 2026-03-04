<template>
  <div class="bg-white rounded-2xl border border-primary-100 p-6 mb-10">
    <h2 class="font-serif text-lg font-semibold text-primary-900 mb-1">Group Trend Analysis</h2>
    <p class="text-primary-400 text-xs mb-4">Analyze voting, speech, and sentiment trends for any group.</p>

    <div class="relative mb-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search for a group..."
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
          :key="opt.gid"
          class="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 transition-colors flex items-center justify-between"
          @mousedown.prevent="selectGroup(opt)"
        >
          <span>
            <span class="font-medium text-primary-900">{{ opt.acronym }}</span>
            <span class="text-primary-400 ml-2">{{ opt.name }}</span>
          </span>
          <span class="text-primary-300 text-xs">{{ opt.country_count }} countries</span>
        </button>
      </div>
    </div>

    <div v-if="selected" class="flex items-center gap-2 mb-4">
      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700">
        {{ selected.acronym }}
        <span class="text-primary-400 text-xs">{{ selected.name }}</span>
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
      @click="$emit('generate', selected!.gid)"
    >
      <template v-if="loading">
        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Analyzing...
      </template>
      <template v-else>Analyze Trends</template>
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  groups: any[] | null
  loading: boolean
  initialGid?: string
}>()

defineEmits<{ generate: [gid: string] }>()

const searchQuery = ref('')
const showDropdown = ref(false)
const selected = ref<{ gid: string; acronym: string; name: string } | null>(null)

const filteredOptions = computed(() => {
  if (!props.groups) return []
  const q = searchQuery.value.toLowerCase()
  return (props.groups as any[])
    .filter(g => !q || g.acronym.toLowerCase().includes(q) || g.name.toLowerCase().includes(q) || g.gid.toLowerCase().includes(q))
    .slice(0, 20)
})

function selectGroup(g: any) {
  selected.value = { gid: g.gid, acronym: g.acronym, name: g.name }
  searchQuery.value = ''
  showDropdown.value = false
}

watch(() => [props.initialGid, props.groups], () => {
  if (props.initialGid && props.groups && !selected.value) {
    const match = (props.groups as any[]).find(g => g.gid === props.initialGid)
    if (match) selected.value = { gid: match.gid, acronym: match.acronym, name: match.name }
  }
}, { immediate: true })

if (import.meta.client) {
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.relative')) showDropdown.value = false
  })
}
</script>
