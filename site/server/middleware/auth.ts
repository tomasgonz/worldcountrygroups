import { requireAuth, requireAdmin } from '~/server/utils/auth'
import { getSiteMode } from '~/server/utils/users'

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  // Only protect API routes
  if (!path.startsWith('/api/')) return

  // Auth endpoints always pass through
  if (path.startsWith('/api/auth/')) return

  // Admin endpoints require admin role
  if (path.startsWith('/api/admin/')) {
    requireAdmin(event)
    return
  }

  // Public APIs needed by homepage, about, sources
  const publicPaths = ['/api/groups', '/api/search', '/api/meta', '/api/countries']
  if (publicPaths.some((p) => path === p || path === p + '/')) return

  // If site is in public mode, allow everything
  if (getSiteMode() === 'public') return

  // Everything else requires authenticated + approved user
  requireAuth(event)
})
