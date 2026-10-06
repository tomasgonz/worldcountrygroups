import { readDataFile } from '~/server/utils/data-file'

/** News for the Elections page: ?section=council | pga | national (all by default). */
export default defineEventHandler((event) => {
  const d = readDataFile<any>('election-news.json')
  if (!d) return { updated: null, council: null, pga: null, national: {} }
  const section = String(getQuery(event).section || '')
  const out: any = { updated: d._meta?.updated_at || null }
  for (const k of ['council', 'pga', 'national']) if (!section || section === k) out[k] = d[k]
  return out
})
