export function useGroups() {
  const { data: groups, pending, error } = useFetch('/api/groups')
  return { groups, pending, error }
}

export function useCountries() {
  const { data: countries, pending, error } = useFetch('/api/countries')
  return { countries, pending, error }
}

export function useGroup(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: group, pending, error } = useFetch(() => `/api/groups/${id.value}`)
  return { group, pending, error }
}

export function useGroupStats(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: stats, pending, error } = useFetch(() => `/api/groups/${id.value}/stats`, { lazy: true })
  return { stats, pending, error }
}

export function useGroupVotes(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: votes, pending, error } = useFetch(() => `/api/groups/${id.value}/votes`, { lazy: true })
  return { votes, pending, error }
}

export function useGroupResolutions(
  gid: string | Ref<string>,
  opts: {
    page: Ref<number>
    session: Ref<number | undefined>
    search: Ref<string>
    theme?: Ref<string | undefined>
  },
) {
  const id = toRef(gid)
  const { data: resolutions, pending, error, refresh } = useFetch(() => {
    const params = new URLSearchParams()
    params.set('page', String(opts.page.value))
    params.set('limit', '20')
    if (opts.session.value != null) params.set('session', String(opts.session.value))
    if (opts.search.value) params.set('search', opts.search.value)
    if (opts.theme?.value) params.set('theme', opts.theme.value)
    return `/api/groups/${id.value}/resolutions?${params.toString()}`
  }, { lazy: true })
  return { resolutions, pending, error, refresh }
}

export function useResolutions(
  opts: {
    page: Ref<number>
    session: Ref<number | undefined>
    search: Ref<string>
    theme: Ref<string | undefined>
    countries: Ref<string[]>
    groups: Ref<string[]>
  },
) {
  const { data: resolutions, pending, error, refresh } = useFetch(() => {
    const params = new URLSearchParams()
    params.set('page', String(opts.page.value))
    params.set('limit', '20')
    if (opts.session.value != null) params.set('session', String(opts.session.value))
    if (opts.search.value) params.set('search', opts.search.value)
    if (opts.theme.value) params.set('theme', opts.theme.value)
    if (opts.countries.value.length) params.set('countries', opts.countries.value.join(','))
    if (opts.groups.value.length) params.set('groups', opts.groups.value.join(','))
    return `/api/resolutions?${params.toString()}`
  }, { lazy: true })
  return { resolutions, pending, error, refresh }
}

export function useCountryResolutions(
  iso: string | Ref<string>,
  opts: {
    page: Ref<number>
    search: Ref<string>
    theme?: Ref<string | undefined>
  },
) {
  const code = toRef(iso)
  const { data: resolutions, pending, error, refresh } = useFetch(() => {
    const params = new URLSearchParams()
    params.set('page', String(opts.page.value))
    params.set('limit', '20')
    if (opts.search.value) params.set('search', opts.search.value)
    if (opts.theme?.value) params.set('theme', opts.theme.value)
    return `/api/countries/${code.value}/resolutions?${params.toString()}`
  }, { lazy: true })
  return { resolutions, pending, error, refresh }
}

export function useGroupThemeStats(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: themeStats, pending, error } = useFetch(() => `/api/groups/${id.value}/theme-stats`, { lazy: true })
  return { themeStats, pending, error }
}

export function useGroupThemeTrends(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: themeTrends, pending, error } = useFetch(() => `/api/groups/${id.value}/theme-trends`, { lazy: true })
  return { themeTrends, pending, error }
}

export function useCountryThemeStats(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: themeStats, pending, error } = useFetch(() => `/api/countries/${code.value}/theme-stats`, { lazy: true })
  return { themeStats, pending, error }
}

export function useCountryThemeTrends(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: themeTrends, pending, error } = useFetch(() => `/api/countries/${code.value}/theme-trends`, { lazy: true })
  return { themeTrends, pending, error }
}

export function useCountryVotes(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: votes, pending, error } = useFetch(() => `/api/countries/${code.value}/votes`, { lazy: true })
  return { votes, pending, error }
}

export function useCountry(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: country, pending, error } = useFetch(() => `/api/countries/${code.value}`)
  return { country, pending, error }
}

export function useCountryStats(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: stats, pending, error } = useFetch(() => `/api/countries/${code.value}/stats`, { lazy: true })
  return { stats, pending, error }
}

export function isoToFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return ''
  const code = iso2.toUpperCase()
  return String.fromCodePoint(
    ...([...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
  )
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return n.toLocaleString()
}

export function formatPopulation(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}

export function formatCO2(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)} Gt`
  if (n >= 1) return `${n.toFixed(1)} Mt`
  return `${(n * 1e3).toFixed(0)} kt`
}

export function formatGdpPerCapita(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${Math.round(n)}`
}

export function formatLifeExpectancy(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  return `${n.toFixed(1)} years`
}

export function formatHDI(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  return n.toFixed(3)
}

export function formatArea(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M km²`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K km²`
  return `${n.toLocaleString()} km²`
}

// --- Vetoes ---
export function useCountryVetoes(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: vetoes, pending, error } = useFetch(() => `/api/countries/${code.value}/vetoes`, { lazy: true })
  return { vetoes, pending, error }
}

// --- Treaties ---
export function useCountryTreaties(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: treaties, pending, error } = useFetch(() => `/api/countries/${code.value}/treaties`, { lazy: true })
  return { treaties, pending, error }
}

export function useGroupTreaties(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: treaties, pending, error } = useFetch(() => `/api/groups/${id.value}/treaties`, { lazy: true })
  return { treaties, pending, error }
}

// --- Sanctions ---
export function useCountrySanctions(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: sanctions, pending, error } = useFetch(() => `/api/countries/${code.value}/sanctions`, { lazy: true })
  return { sanctions, pending, error }
}

export function useGroupSanctions(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: sanctions, pending, error } = useFetch(() => `/api/groups/${id.value}/sanctions`, { lazy: true })
  return { sanctions, pending, error }
}

// --- Recognition ---
export function useCountryRecognition(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: recognition, pending, error } = useFetch(() => `/api/countries/${code.value}/recognition`, { lazy: true })
  return { recognition, pending, error }
}

export function useGroupRecognition(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: recognition, pending, error } = useFetch(() => `/api/groups/${id.value}/recognition`, { lazy: true })
  return { recognition, pending, error }
}

// --- Alignment ---
export function useCountryAlignment(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: alignment, pending, error } = useFetch(() => `/api/countries/${code.value}/alignment`, { lazy: true })
  return { alignment, pending, error }
}

// --- UNSC Votes ---
export function useUNSCResolutions(opts: {
  page: Ref<number>
  search: Ref<string>
  vetoed_only?: Ref<boolean>
}) {
  const { data: resolutions, pending, error, refresh } = useFetch(() => {
    const params = new URLSearchParams()
    params.set('page', String(opts.page.value))
    params.set('limit', '20')
    if (opts.search.value) params.set('search', opts.search.value)
    if (opts.vetoed_only?.value) params.set('vetoed_only', 'true')
    return `/api/unsc/resolutions?${params.toString()}`
  }, { lazy: true })
  return { resolutions, pending, error, refresh }
}

export function useCountryUNSCVotes(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: unscVotes, pending, error } = useFetch(() => `/api/countries/${code.value}/unsc-votes`, { lazy: true })
  return { unscVotes, pending, error }
}

// --- Military Capabilities ---
export function useCountryMilitary(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: military, pending, error } = useFetch(() => `/api/countries/${code.value}/military`, { lazy: true })
  return { military, pending, error }
}

export function useGroupMilitary(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: military, pending, error } = useFetch(() => `/api/groups/${id.value}/military`, { lazy: true })
  return { military, pending, error }
}

// --- Conflict Events ---
export function useCountryConflict(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: conflict, pending, error } = useFetch(() => `/api/countries/${code.value}/conflict`, { lazy: true })
  return { conflict, pending, error }
}

export function useGroupConflict(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: conflict, pending, error } = useFetch(() => `/api/groups/${id.value}/conflict`, { lazy: true })
  return { conflict, pending, error }
}

// --- UN General Debate Speeches ---
export function useCountrySpeeches(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: speeches, pending, error } = useFetch(() => `/api/countries/${code.value}/speeches`, { lazy: true })
  return { speeches, pending, error }
}

export function useCountrySpeechText(iso: string | Ref<string>, session: Ref<number | null>) {
  const code = toRef(iso)
  const { data: speechText, pending, error, refresh } = useFetch(() => {
    if (session.value == null) return null
    return `/api/countries/${code.value}/speech/${session.value}`
  }, { lazy: true, watch: [session] })
  return { speechText, pending, error, refresh }
}

export function useSpeechSessions() {
  const { data, pending, error } = useFetch('/api/speeches/sessions')
  const sessions = computed(() => (data.value as any)?.sessions ?? [])
  const latestSession = computed(() => (data.value as any)?.latest ?? null)
  const analysisSessions = computed(() => (data.value as any)?.analysisSessions ?? [])
  return { sessions, latestSession, analysisSessions, pending, error }
}

export function useSpeechGroupPriorities(session?: Ref<number | undefined>) {
  const { data: priorities, pending, error } = useFetch(() => {
    const params = new URLSearchParams()
    if (session?.value != null) params.set('session', String(session.value))
    const qs = params.toString()
    return `/api/speeches/group-priorities${qs ? '?' + qs : ''}`
  })
  return { priorities, pending, error }
}

export function useSpeechTopics(session?: Ref<number | undefined>) {
  const { data: topics, pending, error } = useFetch(() => {
    const params = new URLSearchParams()
    if (session?.value != null) params.set('session', String(session.value))
    const qs = params.toString()
    return `/api/speeches/topics${qs ? '?' + qs : ''}`
  }, { lazy: true })
  return { topics, pending, error }
}

export function useSpeechAnalysis(session?: Ref<number | undefined>) {
  const { data: analysis, pending, error } = useFetch(() => {
    const params = new URLSearchParams()
    if (session?.value != null) params.set('session', String(session.value))
    const qs = params.toString()
    return `/api/speeches/analysis${qs ? '?' + qs : ''}`
  }, { lazy: true })
  return { analysis, pending, error }
}

// --- Group Speeches ---
export function useGroupSpeeches(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: speeches, pending, error } = useFetch(() => `/api/groups/${id.value}/speeches`, { lazy: true })
  return { speeches, pending, error }
}

// --- GDELT Events & Tone ---
export function useCountryGDELT(iso: string | Ref<string>) {
  const code = toRef(iso)
  const { data: gdelt, pending, error } = useFetch(() => `/api/countries/${code.value}/gdelt`, { lazy: true })
  return { gdelt, pending, error }
}

export function useGroupGDELT(gid: string | Ref<string>) {
  const id = toRef(gid)
  const { data: gdelt, pending, error } = useFetch(() => `/api/groups/${id.value}/gdelt`, { lazy: true })
  return { gdelt, pending, error }
}

export function formatMilitary(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}

export function formatDefenseBudget(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  return `$${n.toLocaleString()}`
}
