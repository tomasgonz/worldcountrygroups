export default defineNuxtRouteMiddleware(async (to) => {
  const publicPaths = ['/', '/about', '/sources', '/pulse', '/today', '/login', '/register', '/pending', '/shared']
  if (publicPaths.includes(to.path)) return

  const { state, fetchStatus } = useAuth()

  if (!state.value.loaded) {
    await fetchStatus()
  }

  // Visitors with a share link may open only the shared page (any filters or tabs on it;
  // for an Ask answer, only that answer)
  if (!state.value.authenticated && state.value.share) {
    const target = new URL(state.value.share.path, 'http://x')
    const samePage = to.path === target.pathname
    const sameAnswer = target.pathname !== '/ask' || String(to.query.id || '') === (target.searchParams.get('id') || '')
    if (samePage && sameAnswer) return
    return navigateTo('/shared?reason=scope')
  }

  // Admin pages require admin role
  if (to.path.startsWith('/admin')) {
    if (!state.value.authenticated || state.value.role !== 'admin') {
      return navigateTo('/login')
    }
    return
  }

  // Auth-required pages (even in public mode)
  const authRequiredPaths = ['/account', '/dashboard']
  if (authRequiredPaths.some(p => to.path.startsWith(p))) {
    if (!state.value.authenticated) return navigateTo('/login?redirect=' + encodeURIComponent(to.fullPath))
    if (state.value.status !== 'approved') return navigateTo('/login')
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
