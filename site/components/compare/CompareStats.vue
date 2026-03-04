<template>
  <div id="section-stats" class="mb-10">
    <h2 class="font-serif text-xl font-bold text-primary-900 mb-5">Statistics</h2>
    <div class="bg-white rounded-2xl border border-primary-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-primary-100 text-left">
              <th class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider">Metric</th>
              <th
                v-for="e in entities"
                :key="e.id"
                class="px-5 py-3.5 font-medium text-primary-400 text-xs uppercase tracking-wider text-right"
              >{{ e.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="mode === 'groups'" class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Countries</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right tabular-nums" :class="hlClass(countryCountVals, e.countryCount)">
                {{ e.countryCount ?? 'N/A' }}
              </td>
            </tr>
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">GDP (nominal)</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right tabular-nums" :class="hlClass(gdpVals, e.stats?.gdp?.total)">
                {{ formatNumber(e.stats?.gdp?.total) }}
              </td>
            </tr>
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">GDP per Capita</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right tabular-nums" :class="hlClass(gdpPcVals, e.extended?.gdp_per_capita)">
                {{ formatGdpPerCapita(e.extended?.gdp_per_capita) }}
              </td>
            </tr>
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Population</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right tabular-nums" :class="hlClass(popVals, e.stats?.population?.total)">
                {{ formatPopulation(e.stats?.population?.total) }}
              </td>
            </tr>
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">CO2 Emissions</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right tabular-nums" :class="hlClass(co2Vals, e.stats?.co2?.total, true)">
                {{ formatCO2(e.stats?.co2?.total) }}
              </td>
            </tr>
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Life Expectancy</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right tabular-nums" :class="hlClass(lifeExpVals, e.extended?.life_expectancy)">
                {{ formatLifeExpectancy(e.extended?.life_expectancy) }}
              </td>
            </tr>
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">HDI</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right tabular-nums" :class="hlClass(hdiVals, e.extended?.hdi)">
                {{ formatHDI(e.extended?.hdi) }}
              </td>
            </tr>
            <tr class="border-b border-primary-50">
              <td class="px-5 py-3 text-primary-600 font-medium">Area</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right tabular-nums" :class="hlClass(areaVals, e.extended?.area_km2)">
                {{ formatArea(e.extended?.area_km2) }}
              </td>
            </tr>
            <tr v-if="mode === 'groups'">
              <td class="px-5 py-3 text-primary-600 font-medium">Domains</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right">
                <div class="flex flex-wrap justify-end gap-1">
                  <DomainTag v-for="d in (e.domains || [])" :key="d" :domain="d" size="sm" />
                </div>
              </td>
            </tr>
            <tr v-if="mode === 'countries'">
              <td class="px-5 py-3 text-primary-600 font-medium">Region</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right text-primary-800">
                {{ e.extended?.region || 'N/A' }}
              </td>
            </tr>
            <tr v-if="mode === 'countries'">
              <td class="px-5 py-3 text-primary-600 font-medium">Income Group</td>
              <td v-for="e in entities" :key="e.id" class="px-5 py-3 text-right text-primary-800">
                {{ e.extended?.income_group || 'N/A' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  entities: any[]
  mode: 'groups' | 'countries'
}>()

function extractVals(getter: (e: any) => number | null | undefined): number[] {
  return props.entities.map(e => getter(e)).filter((v): v is number => v != null)
}

const countryCountVals = computed(() => extractVals(e => e.countryCount))
const gdpVals = computed(() => extractVals(e => e.stats?.gdp?.total))
const gdpPcVals = computed(() => extractVals(e => e.extended?.gdp_per_capita))
const popVals = computed(() => extractVals(e => e.stats?.population?.total))
const co2Vals = computed(() => extractVals(e => e.stats?.co2?.total))
const lifeExpVals = computed(() => extractVals(e => e.extended?.life_expectancy))
const hdiVals = computed(() => extractVals(e => e.extended?.hdi))
const areaVals = computed(() => extractVals(e => e.extended?.area_km2))

function hlClass(vals: number[], val: number | null | undefined, invertBest = false): string {
  if (val == null || vals.length < 2) return 'text-primary-800'
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  if (max === min) return 'text-primary-800'
  if (invertBest) {
    if (val === min) return 'text-emerald-600 font-medium'
    if (val === max) return 'text-amber-600 font-medium'
  } else {
    if (val === max) return 'text-emerald-600 font-medium'
    if (val === min) return 'text-amber-600 font-medium'
  }
  return 'text-primary-800'
}
</script>
