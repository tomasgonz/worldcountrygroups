export function useGroups() {
  const { data: groups, pending, error } = useFetch('/api/groups')
  return { groups, pending, error }
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
