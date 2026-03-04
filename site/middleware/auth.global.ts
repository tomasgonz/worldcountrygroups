export default defineNuxtRouteMiddleware(async (to) => {
  const publicPaths = ['/', '/about', '/sources', '/login', '/register', '/pending']
  if (publicPaths.includes(to.path)) return

  const { state, fetchStatus } = useAuth()

  if (!state.value.loaded) {
    await fetchStatus()
  }

  // Admin pages require admin role
  if (to.path.startsWith('/admin')) {
    if (!state.value.authenticated || state.value.role !== 'admin') {
      return navigateTo('/login')
    }
    return
  }

  // Public mode: everything accessible
  if (state.value.siteMode === 'public') return

  // Restricted mode: require authentication
  if (!state.value.authenticated) {
    return navigateTo('/login?redirect=' + encodeURIComponent(to.fullPath))
  }

  // Pending users can only see /pending
  if (state.value.status === 'pending') {
    return navigateTo('/pending')
  }

  // Rejected users
  if (state.value.status !== 'approved') {
    return navigateTo('/login')
  }
})
