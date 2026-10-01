import { createBriefingDoc, generateDocxBuffer } from '~/server/utils/docx-builder'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const type = (query.type as string) || 'country'
  const iso = ((query.iso as string) || '').toUpperCase()
  const a = ((query.a as string) || '').toUpperCase()
  const b = ((query.b as string) || '').toUpperCase()

  // Fetch cable content
  let cable: any
  try {
    cable = await $fetch('/api/intelligence/ai/cable', { query: { type, iso, a, b } })
  } catch (err: any) {
    throw createError({ statusCode: 500, message: `Failed to generate cable: ${err.message}` })
  }

  if (!cable?.content) {
    throw createError({ statusCode: 500, message: 'No cable content generated' })
  }

  const title = type === 'bilateral'
    ? `DIPLOMATIC CABLE: ${a} - ${b}`
    : `DIPLOMATIC CABLE: ${iso}`

  const doc = createBriefingDoc({
    title,
    subtitle: 'SITUATION REPORT',
    generatedAt: cable.generatedAt || new Date().toISOString(),
    sections: [
      { title: 'SITREP', content: cable.content },
    ],
  })

  const buffer = await generateDocxBuffer(doc)
  const filename = type === 'bilateral'
    ? `SITREP_${a}_${b}_${new Date().toISOString().slice(0, 10)}.docx`
    : `SITREP_${iso}_${new Date().toISOString().slice(0, 10)}.docx`

  setHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename="${filename}"`,
  })

  return buffer
})
