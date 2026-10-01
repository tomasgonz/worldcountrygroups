export function useUNMonitor() {
  const data = ref<any>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    if (pending.value) return
    pending.value = true
    error.value = null
    try {
      data.value = await $fetch('/api/intelligence/un-monitor')
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || 'Failed to load UN Monitor data'
    } finally {
      pending.value = false
    }
  }

  return { data, pending, error, fetch }
}
