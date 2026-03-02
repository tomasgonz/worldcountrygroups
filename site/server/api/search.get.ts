import { getRegistry } from '~/server/utils/wcg'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const q = query.q as string | undefined
  const country = query.country as string | undefined
  const domain = query.domain as string | undefined

  const groups = getRegistry().searchGroups({ q, country, domain })
  return groups.map(g => getRegistry().getSummary(g))
})
