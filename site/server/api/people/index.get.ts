import { readDataFile } from '~/server/utils/data-file'

/** People directory. Query: q (name search), iso3, un=1 (UN officials), limit, sort=mentions|name */
const fold = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default defineEventHandler((event) => {
  const file = readDataFile<any>('people-index.json')
  const all: any[] = file?.people || []
  const q = fold(String(getQuery(event).q || '').trim())
  const iso3 = String(getQuery(event).iso3 || '').toUpperCase()
  const un = String(getQuery(event).un || '') === '1'
  const limit = Math.min(500, Math.max(1, Number(getQuery(event).limit) || 60))
  const sort = String(getQuery(event).sort || 'mentions')
  let list = all
  if (q) list = list.filter(p => fold(p.name).includes(q) || (p.aliases || []).some((a: string) => fold(a).includes(q)))
  if (iso3) list = list.filter(p => p.roles.some((r: any) => r.iso3 === iso3) || p.speeches.some((s: any) => s.iso3 === iso3))
  if (un) list = list.filter(p => p.roles.some((r: any) => r.iso3 == null))
  if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
  return {
    total: list.length,
    generated: file?._meta?.generated || null,
    people: list.slice(0, limit).map(p => ({
      slug: p.slug, name: p.name, image: p.image, imagePath: p.imagePath, imageUrl: p.imageUrl, description: p.description,
      roles: p.roles, speeches: p.speeches.length, quoteCount: p.quoteCount,
      mentions30d: p.mentions30d, mentionCount: p.mentionCount, delivered: p.delivered.length, lastSeen: p.lastSeen,
    })),
  }
})
