<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-3">
        <NuxtLink to="/admin" class="text-primary-400 hover:text-primary-700 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </NuxtLink>
        <h1 class="font-serif text-3xl font-bold text-primary-900">Group Management</h1>
        <span v-if="groups.length" class="text-sm text-primary-400">{{ filteredGroups.length }} groups</span>
      </div>
      <button
        @click="startCreate"
        class="bg-primary-900 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors"
      >
        Create New Group
      </button>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed top-6 right-6 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg transition-all"
      :class="toast.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
      {{ toast.message }}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Group List -->
      <div class="bg-white rounded-2xl border border-primary-100 p-6">
        <input
          v-model="search"
          type="text"
          placeholder="Search by name, acronym, or GID..."
          class="w-full px-4 py-2.5 mb-4 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        <div class="overflow-y-auto max-h-[70vh]">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-white">
              <tr class="border-b border-primary-100 text-left">
                <th class="px-3 py-2 font-medium text-primary-400 text-xs uppercase tracking-wider">GID</th>
                <th class="px-3 py-2 font-medium text-primary-400 text-xs uppercase tracking-wider">Acronym</th>
                <th class="px-3 py-2 font-medium text-primary-400 text-xs uppercase tracking-wider">Name</th>
                <th class="px-3 py-2 font-medium text-primary-400 text-xs uppercase tracking-wider text-right">Countries</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="g in filteredGroups"
                :key="g.gid"
                @click="selectGroup(g.gid)"
                class="border-b border-primary-50 last:border-0 cursor-pointer transition-colors"
                :class="selectedGid === g.gid ? 'bg-primary-50' : 'hover:bg-primary-25'"
              >
                <td class="px-3 py-2 text-primary-500 font-mono text-xs">{{ g.gid }}</td>
                <td class="px-3 py-2 text-primary-700 font-medium">{{ g.acronym }}</td>
                <td class="px-3 py-2 text-primary-600 truncate max-w-[200px]">{{ g.name }}</td>
                <td class="px-3 py-2 text-primary-500 text-right tabular-nums">{{ g.country_count }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!filteredGroups.length && !loading" class="text-center text-primary-400 py-8 text-sm">
            No groups found.
          </div>
        </div>
      </div>

      <!-- Editor Panel -->
      <div v-if="editor" class="bg-white rounded-2xl border border-primary-100 p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="font-serif text-xl font-bold text-primary-900">
            {{ isCreating ? 'Create New Group' : `Edit: ${editor.acronym || editor.gid}` }}
          </h2>
          <button @click="closeEditor" class="text-primary-400 hover:text-primary-700">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Metadata Fields -->
        <div class="space-y-4 mb-6">
          <div v-if="isCreating">
            <label class="block text-xs font-medium text-primary-500 mb-1">Group ID (gid)</label>
            <input v-model="editor.gid" type="text" placeholder="e.g. my-group"
              class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Acronym *</label>
              <input v-model="editor.acronym" type="text"
                class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Classifier</label>
              <input v-model="editor.classifier" type="text"
                class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-primary-500 mb-1">Name *</label>
            <input v-model="editor.name" type="text"
              class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label class="block text-xs font-medium text-primary-500 mb-1">Description</label>
            <textarea v-model="editor.description" rows="3"
              class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Domains (comma-separated)</label>
              <input v-model="domainsStr" type="text" placeholder="Europe, Asia"
                class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Founded (year)</label>
              <input v-model="editor.founded" type="number" placeholder="1945"
                class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Headquarters</label>
              <input v-model="editor.headquarters" type="text"
                class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label class="block text-xs font-medium text-primary-500 mb-1">Website</label>
              <input v-model="editor.website" type="text" placeholder="https://..."
                class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-primary-500 mb-1">Official Languages (comma-separated)</label>
            <input v-model="languagesStr" type="text" placeholder="English, French"
              class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
        </div>

        <!-- Country List -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-primary-800">
              Member Countries ({{ editor.countries.length }})
            </h3>
          </div>

          <!-- Add Country -->
          <div class="relative mb-3">
            <input
              v-model="countrySearch"
              @input="onCountrySearchInput"
              @focus="showCountryDropdown = true"
              @keydown.escape="showCountryDropdown = false"
              type="text"
              placeholder="Search and add a country..."
              class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <div
              v-if="showCountryDropdown && countryResults.length"
              class="absolute z-10 mt-1 w-full bg-white border border-primary-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
              <button
                v-for="c in countryResults"
                :key="c.iso2"
                @mousedown.prevent="addCountry(c)"
                class="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex items-center gap-2"
              >
                <span>{{ isoToFlag(c.iso2) }}</span>
                <span class="text-primary-700">{{ c.name }}</span>
                <span class="text-primary-400 text-xs ml-auto">{{ c.iso2 }} / {{ c.iso3 }}</span>
              </button>
            </div>
          </div>

          <!-- Country Table -->
          <div class="overflow-y-auto max-h-64 border border-primary-100 rounded-lg">
            <table class="w-full text-sm">
              <tbody>
                <tr v-for="(c, idx) in editor.countries" :key="c.iso2" class="border-b border-primary-50 last:border-0">
                  <td class="px-3 py-1.5 w-8">{{ isoToFlag(c.iso2) }}</td>
                  <td class="px-3 py-1.5 text-primary-700">{{ c.name }}</td>
                  <td class="px-3 py-1.5 text-primary-400 text-xs font-mono">{{ c.iso2 }} / {{ c.iso3 }}</td>
                  <td class="px-2 py-1.5 text-right">
                    <button @click="removeCountry(idx)" class="text-red-400 hover:text-red-600 transition-colors" title="Remove">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="!editor.countries.length" class="text-center text-primary-400 py-4 text-xs">
              No countries added yet.
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3">
          <button
            @click="saveGroup"
            :disabled="saving"
            class="bg-primary-900 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
          <button
            @click="closeEditor"
            class="bg-primary-100 text-primary-600 py-2 px-5 rounded-lg text-sm font-medium hover:bg-primary-200 transition-colors"
          >
            Cancel
          </button>
          <button
            v-if="!isCreating"
            @click="confirmDelete"
            class="ml-auto bg-red-50 text-red-600 py-2 px-5 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200"
          >
            Delete Group
          </button>
        </div>
      </div>

      <!-- Empty state when no editor -->
      <div v-else class="bg-white rounded-2xl border border-primary-100 p-6 flex items-center justify-center min-h-[300px]">
        <p class="text-primary-400 text-sm">Select a group to edit, or create a new one.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isoToFlag } from '~/composables/useGroups'

useHead({ title: 'Group Management — Admin' })

interface Country {
  name: string
  iso2: string
  iso3: string
}

interface GroupSummary {
  gid: string
  acronym: string
  name: string
  description: string
  classifier: string
  domains: string[]
  country_count: number
  founded?: number
  headquarters?: string
  website?: string
  official_languages?: string[]
}

interface EditorState {
  gid: string
  acronym: string
  name: string
  description: string
  classifier: string
  domains: string[]
  countries: Country[]
  founded: number | null
  headquarters: string
  website: string
  official_languages: string[]
}

const groups = ref<GroupSummary[]>([])
const allCountries = ref<Country[]>([])
const search = ref('')
const selectedGid = ref<string | null>(null)
const editor = ref<EditorState | null>(null)
const isCreating = ref(false)
const saving = ref(false)
const loading = ref(true)
const toast = ref<{ ok: boolean; message: string } | null>(null)
const countrySearch = ref('')
const showCountryDropdown = ref(false)

let toastTimer: ReturnType<typeof setTimeout> | null = null

const domainsStr = computed({
  get: () => editor.value?.domains.join(', ') || '',
  set: (v: string) => {
    if (editor.value) {
      editor.value.domains = v.split(',').map(s => s.trim()).filter(Boolean)
    }
  },
})

const languagesStr = computed({
  get: () => editor.value?.official_languages.join(', ') || '',
  set: (v: string) => {
    if (editor.value) {
      editor.value.official_languages = v.split(',').map(s => s.trim()).filter(Boolean)
    }
  },
})

const filteredGroups = computed(() => {
  if (!search.value) return groups.value
  const q = search.value.toLowerCase()
  return groups.value.filter(g =>
    g.gid.includes(q) ||
    g.acronym.toLowerCase().includes(q) ||
    g.name.toLowerCase().includes(q)
  )
})

const countryResults = computed(() => {
  if (!countrySearch.value) return []
  const q = countrySearch.value.toLowerCase()
  const memberIso2s = new Set(editor.value?.countries.map(c => c.iso2) || [])
  return allCountries.value
    .filter(c =>
      !memberIso2s.has(c.iso2) &&
      (c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q))
    )
    .slice(0, 20)
})

function showToast(ok: boolean, message: string) {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { ok, message }
  toastTimer = setTimeout(() => { toast.value = null }, 3000)
}

async function loadGroups() {
  try {
    groups.value = await $fetch<GroupSummary[]>('/api/admin/groups')
  } catch (e: any) {
    showToast(false, e?.data?.statusMessage || 'Failed to load groups')
  } finally {
    loading.value = false
  }
}

async function loadCountries() {
  try {
    allCountries.value = await $fetch<Country[]>('/api/admin/groups/countries')
  } catch {
    // Not critical — autocomplete just won't work
  }
}

async function selectGroup(gid: string) {
  selectedGid.value = gid
  isCreating.value = false
  try {
    const g = await $fetch<any>(`/api/groups/${gid}`)
    editor.value = {
      gid: g.gid,
      acronym: g.acronym || '',
      name: g.name || '',
      description: g.description || '',
      classifier: g.classifier || '',
      domains: g.domains || [],
      countries: g.countries || [],
      founded: g.founded || null,
      headquarters: g.headquarters || '',
      website: g.website || '',
      official_languages: g.official_languages || [],
    }
  } catch (e: any) {
    showToast(false, e?.data?.statusMessage || 'Failed to load group')
  }
}

function startCreate() {
  selectedGid.value = null
  isCreating.value = true
  editor.value = {
    gid: '',
    acronym: '',
    name: '',
    description: '',
    classifier: '',
    domains: [],
    countries: [],
    founded: null,
    headquarters: '',
    website: '',
    official_languages: [],
  }
}

function closeEditor() {
  editor.value = null
  selectedGid.value = null
  isCreating.value = false
}

function addCountry(c: Country) {
  if (!editor.value) return
  if (editor.value.countries.some(x => x.iso2 === c.iso2)) return
  editor.value.countries.push({ ...c })
  editor.value.countries.sort((a, b) => a.name.localeCompare(b.name))
  countrySearch.value = ''
  showCountryDropdown.value = false
}

function removeCountry(idx: number) {
  editor.value?.countries.splice(idx, 1)
}

function onCountrySearchInput() {
  showCountryDropdown.value = true
}

async function saveGroup() {
  if (!editor.value) return
  saving.value = true
  try {
    const body: any = {
      acronym: editor.value.acronym,
      name: editor.value.name,
      description: editor.value.description,
      classifier: editor.value.classifier,
      domains: editor.value.domains,
      countries: editor.value.countries,
    }
    if (editor.value.founded) body.founded = editor.value.founded
    if (editor.value.headquarters) body.headquarters = editor.value.headquarters
    if (editor.value.website) body.website = editor.value.website
    if (editor.value.official_languages.length) body.official_languages = editor.value.official_languages

    if (isCreating.value) {
      body.gid = editor.value.gid
      await $fetch('/api/admin/groups', { method: 'POST', body })
      showToast(true, `Group "${body.gid}" created successfully`)
      isCreating.value = false
      selectedGid.value = body.gid
    } else {
      await $fetch(`/api/admin/groups/${editor.value.gid}`, { method: 'PUT', body })
      showToast(true, `Group "${editor.value.gid}" saved successfully`)
    }
    await loadGroups()
  } catch (e: any) {
    showToast(false, e?.data?.statusMessage || 'Failed to save group')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!editor.value || isCreating.value) return
  if (!confirm(`Delete group "${editor.value.gid}"? This will remove the JSON file permanently.`)) return
  try {
    await $fetch(`/api/admin/groups/${editor.value.gid}`, { method: 'DELETE' })
    showToast(true, `Group "${editor.value.gid}" deleted`)
    closeEditor()
    await loadGroups()
  } catch (e: any) {
    showToast(false, e?.data?.statusMessage || 'Failed to delete group')
  }
}

onMounted(async () => {
  await Promise.all([loadGroups(), loadCountries()])
})
</script>
