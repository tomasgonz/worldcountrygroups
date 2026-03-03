export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/admin/login') return

  try {
    const { data } = await useFetch('/api/admin/status')
    if (!data.value || !(data.value as any).authenticated) {
      return navigateTo('/admin/login')
    }
  } catch {
    return navigateTo('/admin/login')
  }
})
