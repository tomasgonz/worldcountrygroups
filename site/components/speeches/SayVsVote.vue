<template>
  <div class="bg-white rounded-2xl border border-primary-100 p-6">
    <h2 class="font-serif text-xl font-bold text-primary-900">Say vs Vote</h2>
    <p class="text-xs text-primary-400 mt-1 mb-5">
      What this country says in recent General Debate speeches<span v-if="data?.speechSessions?.length"> (sessions {{ [...data.speechSessions].sort().join(', ') }})</span>,
      compared with how it voted in the General Assembly<span v-if="data?.voteSessions?.length"> (sessions {{ data.voteSessions[0] }}&ndash;{{ data.voteSessions[data.voteSessions.length - 1] }})</span>.
    </p>

    <div v-if="pending" class="space-y-2">
      <div v-for="i in 4" :key="i" class="skeleton h-6 rounded" />
    </div>

    <template v-else-if="data">
      <!-- Flags -->
      <div v-if="data.flags.length" class="mb-6 space-y-2">
        <div v-for="(f, i) in data.flags" :key="i" class="flex gap-2 items-start text-sm rounded-lg px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900">
          <span aria-hidden="true">&#9888;</span><span>{{ f.text }}</span>
        </div>
      </div>
      <p v-else class="mb-6 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        No clear gaps: the way this country talks about others and its priorities broadly matches its voting.
      </p>

      <div class="grid gap-8 lg:grid-cols-2">
        <!-- Relationships -->
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-primary-500 mb-1">Countries mentioned &amp; vote agreement</h3>
          <p class="text-xs text-primary-400 mb-3">Typical agreement with any country: <strong class="tabular-nums">{{ pct(data.medianAgreement) }}</strong></p>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead class="text-primary-400 text-left">
                <tr><th class="py-1 pr-2 font-medium">Country</th><th class="py-1 pr-2 font-medium">In speeches</th><th class="py-1 font-medium text-right">Votes together</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in data.relationships.filter((r: any) => r.agreement != null).slice(0, 15)" :key="r.iso3" class="border-t border-primary-50" :class="r.flag ? 'bg-amber-50/60' : ''">
                  <td class="py-1.5 pr-2"><NuxtLink :to="`/countries/${r.iso3.toLowerCase()}`" class="text-primary-700 hover:text-accent-700">{{ countryName(r.iso3) }}</NuxtLink></td>
                  <td class="py-1.5 pr-2">
                    <span v-if="r.praised" class="text-emerald-700">{{ r.praised }}&times; partner</span>
                    <span v-if="r.praised && r.criticized" class="text-primary-300"> &middot; </span>
                    <span v-if="r.criticized" class="text-red-700">{{ r.criticized }}&times; criticized</span>
                    <span v-if="!r.praised && !r.criticized" class="text-primary-400">{{ r.mentions }}&times; mentioned</span>
                  </td>
                  <td class="py-1.5 text-right tabular-nums">
                    <span class="inline-block w-16 h-1.5 bg-primary-100 rounded-full align-middle mr-1.5 overflow-hidden">
                      <span class="block h-full rounded-full" :class="(r.relative ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-red-400'" :style="{ width: pct(r.agreement) }" />
                    </span>{{ pct(r.agreement) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Themes -->
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-primary-500 mb-1">Priorities &amp; voting with the majority</h3>
          <p class="text-xs text-primary-400 mb-3">Share of related resolutions where it voted the same way as most of the Assembly</p>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead class="text-primary-400 text-left">
                <tr><th class="py-1 pr-2 font-medium">Speech theme</th><th class="py-1 pr-2 font-medium">Emphasis</th><th class="py-1 pr-2 font-medium text-right">Resolutions</th><th class="py-1 font-medium text-right">With majority</th></tr>
              </thead>
              <tbody>
                <tr v-for="t in data.themes.filter((t: any) => t.resolutions > 0).slice(0, 12)" :key="t.speechTheme" class="border-t border-primary-50" :class="t.flag ? 'bg-amber-50/60' : ''">
                  <td class="py-1.5 pr-2 text-primary-700" :title="t.resolutionThemes.join(', ')">{{ t.speechTheme.replace(/_/g, ' ') }}</td>
                  <td class="py-1.5 pr-2 text-primary-500">{{ pct(t.emphasis) }} of speeches</td>
                  <td class="py-1.5 pr-2 text-right tabular-nums text-primary-500">{{ t.resolutions }}</td>
                  <td class="py-1.5 text-right tabular-nums" :class="(t.withMajority ?? 1) < 0.5 ? 'text-red-700 font-medium' : 'text-primary-700'">{{ pct(t.withMajority) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p class="text-[11px] text-primary-300 mt-5">Speech framing comes from AI analysis of each speech. Votes are recorded General Assembly votes; absences are excluded. Signals are prompts for investigation, not conclusions.</p>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ iso: string; countryName: (iso3: string) => string }>()

const { data, pending } = useFetch<any>(() => `/api/countries/${props.iso}/say-vs-vote`, { lazy: true, server: false })

function pct(x: number | null | undefined): string {
  return x == null ? 'n/a' : `${Math.round(x * 100)}%`
}
</script>
