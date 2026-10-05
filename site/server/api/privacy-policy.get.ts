import { getPolicy } from '~/server/utils/privacy-policy'

/** The current privacy policy (public). */
export default defineEventHandler(() => {
  const p = getPolicy()
  return { markdown: p.markdown, updatedAt: p.updatedAt }
})
