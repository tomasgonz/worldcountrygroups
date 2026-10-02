import { readDataFile } from '~/server/utils/data-file'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  const p = (readDataFile<any>('people-index.json')?.people || []).find((x: any) => x.slug === slug)
  if (!p) throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  return p
})
