import { requireAdmin } from '~/server/utils/auth'
import { undlStatus } from '~/server/utils/undl'

export default defineEventHandler((event) => { requireAdmin(event); return undlStatus() })
