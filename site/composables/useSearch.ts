export function useSearch() {
  const query = ref('')
  const domain = ref('')
  const country = ref('')
  const results = ref<any[]>([])
  const pending = ref(false)
  let timeout: ReturnType<typeof setTimeout> | null = null

  async function doSearch() {
    pending.value = true
    const params = new URLSearchParams()
    if (query.value) params.set('q', query.value)
    if (domain.value) params.set('domain', domain.value)
    if (country.value) params.set('country', country.value)

    try {
      const data = await $fetch(`/api/search?${params.toString()}`)
      results.value = data as any[]
    } catch {
      results.value = []
    } finally {
      pending.value = false
    }
  }

  function debouncedSearch() {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(doSearch, 300)
  }

  watch([query, domain, country], debouncedSearch)

  return { query, domain, country, results, pending, doSearch }
}
