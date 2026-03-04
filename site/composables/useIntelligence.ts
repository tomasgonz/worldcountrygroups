export function useCountryBriefing() {
  const data = ref<any>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function fetch(iso: string) {
    if (!iso) return
    pending.value = true
    error.value = null
    data.value = null
    try {
      data.value = await $fetch(`/api/intelligence/country-briefing?iso=${encodeURIComponent(iso)}`)
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.message || 'Failed to load briefing'
    } finally {
      pending.value = false
    }
  }

  return { data, pending, error, fetch }
}

export function useBilateralPrep() {
  const data = ref<any>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function fetch(a: string, b: string) {
    if (!a || !b) return
    pending.value = true
    error.value = null
    data.value = null
    try {
      data.value = await $fetch(`/api/intelligence/bilateral-prep?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`)
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.message || 'Failed to load bilateral data'
    } finally {
      pending.value = false
    }
  }

  return { data, pending, error, fetch }
}

export function useGroupTrends() {
  const data = ref<any>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function fetch(gid: string) {
    if (!gid) return
    pending.value = true
    error.value = null
    data.value = null
    try {
      data.value = await $fetch(`/api/intelligence/group-trends?gid=${encodeURIComponent(gid)}`)
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.message || 'Failed to load group trends'
    } finally {
      pending.value = false
    }
  }

  return { data, pending, error, fetch }
}
