<template>
  <div id="section-overlap" class="mb-10">
    <!-- Overlap Matrix -->
    <div class="mb-10">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-5">Country Overlap</h3>
      <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-primary-100 text-left">
                <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider"></th>
                <th
                  v-for="g in groups"
                  :key="g.gid"
                  class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-center"
                >{{ g.acronym }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, ri) in groups"
                :key="row.gid"
                class="border-b border-primary-50 last:border-0"
              >
                <td class="px-5 py-3 font-medium text-primary-600">{{ row.acronym }}</td>
                <td
                  v-for="(col, ci) in groups"
                  :key="col.gid"
                  class="px-5 py-3 text-center"
                >
                  <template v-if="ri === ci">
                    <span class="text-primary-300">{{ row.country_count }}</span>
                  </template>
                  <template v-else>
                    <button
                      class="text-accent-600 hover:text-accent-700 font-medium tabular-nums hover:underline"
                      @click="togglePairExpand(row.gid, col.gid)"
                    >{{ getPairCount(row.gid, col.gid) }}</button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="expandedPair" class="border-t border-primary-100 px-5 py-4 bg-primary-50/50">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-primary-700">Shared between {{ expandedPairLabel }}</span>
            <button class="text-primary-400 hover:text-primary-600 text-xs" @click="expandedPair = null">Close</button>
          </div>
          <div class="flex flex-wrap gap-2">
            <CountryBadge
              v-for="c in expandedPairCountries"
              :key="c.iso2 || c.iso3"
              :country="c"
            />
            <span v-if="expandedPairCountries.length === 0" class="text-primary-300 text-sm">No shared countries</span>
          </div>
        </div>
      </div>

      <div v-if="overlap.common.length > 0" class="mt-5">
        <h3 class="text-sm font-medium text-primary-700 mb-3">
          Common to all {{ groups.length }} groups
          <span class="text-primary-400 font-normal">({{ overlap.common.length }})</span>
        </h3>
        <div class="flex flex-wrap gap-2">
          <CountryBadge
            v-for="c in overlap.common"
            :key="c.iso2 || c.iso3"
            :country="c"
          />
        </div>
      </div>
    </div>

    <!-- Unique Members -->
    <div class="mb-10">
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-5">Unique Members</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="g in groups"
          :key="g.gid"
          class="bg-white rounded-2xl border border-primary-100 p-6"
        >
          <h3 class="font-medium text-primary-900 mb-1">{{ g.acronym }}</h3>
          <p class="text-primary-400 text-xs mb-3">
            {{ (unique[g.gid] || []).length }} exclusive {{ (unique[g.gid] || []).length === 1 ? 'member' : 'members' }}
          </p>
          <div class="flex flex-wrap gap-2">
            <CountryBadge
              v-for="c in (unique[g.gid] || [])"
              :key="c.iso2 || c.iso3"
              :country="c"
            />
            <span v-if="(unique[g.gid] || []).length === 0" class="text-primary-300 text-sm">None — all members shared</span>
          </div>
        </div>
      </div>
    </div>

    <!-- All Members by Group -->
    <div>
      <h3 class="font-serif text-xl font-bold text-primary-900 mb-5">All Members by Group</h3>
      <div class="space-y-5">
        <div
          v-for="g in groups"
          :key="g.gid"
          class="bg-white rounded-2xl border border-primary-100 p-6"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-medium text-primary-900">
              <NuxtLink :to="`/groups/${g.gid}`" class="hover:text-primary-600 transition-colors">
                {{ g.acronym }}
              </NuxtLink>
              <span class="text-primary-400 font-normal ml-1.5 text-sm">{{ g.name }}</span>
            </h3>
            <span class="text-primary-400 text-xs">{{ g.country_count }} countries</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <CountryBadge
              v-for="c in g.countries"
              :key="c.iso2 || c.iso3"
              :country="c"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  groups: any[]
  overlap: { pairs: Record<string, any[]>; common: any[] }
  unique: Record<string, any[]>
}>()

const expandedPair = ref<string | null>(null)

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function getPairCount(a: string, b: string): number {
  return props.overlap.pairs[pairKey(a, b)]?.length ?? 0
}

function togglePairExpand(a: string, b: string) {
  const key = pairKey(a, b)
  expandedPair.value = expandedPair.value === key ? null : key
}

const expandedPairLabel = computed(() => {
  if (!expandedPair.value) return ''
  const [a, b] = expandedPair.value.split(':')
  const ga = props.groups.find(g => g.gid === a)
  const gb = props.groups.find(g => g.gid === b)
  return `${ga?.acronym ?? a} and ${gb?.acronym ?? b}`
})

const expandedPairCountries = computed(() => {
  if (!expandedPair.value) return []
  return props.overlap.pairs[expandedPair.value] ?? []
})
</script>
