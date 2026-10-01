import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, Packer, AlignmentType, BorderStyle, ShadingType } from 'docx'

export interface BriefingSection {
  title: string
  content: string // markdown-ish text
}

export interface BriefingDocOptions {
  title: string
  subtitle?: string
  generatedAt: string
  sections: BriefingSection[]
}

export function markdownToDocElements(md: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const lines = md.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Headings
    if (trimmed.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: trimmed.slice(4), bold: true, size: 22 })],
        spacing: { before: 200, after: 100 },
      }))
    } else if (trimmed.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: trimmed.slice(3), bold: true, size: 26 })],
        spacing: { before: 300, after: 100 },
      }))
    } else if (trimmed.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: trimmed.slice(2), bold: true, size: 32 })],
        spacing: { before: 400, after: 200 },
      }))
    }
    // Bullet points
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = trimmed.slice(2)
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        children: parseInlineFormatting(text),
        spacing: { before: 40, after: 40 },
      }))
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s/, '')
      paragraphs.push(new Paragraph({
        numbering: { reference: 'default-numbering', level: 0 },
        children: parseInlineFormatting(text),
        spacing: { before: 40, after: 40 },
      }))
    }
    // Regular paragraphs
    else {
      paragraphs.push(new Paragraph({
        children: parseInlineFormatting(trimmed),
        spacing: { before: 80, after: 80 },
      }))
    }
  }

  return paragraphs
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: 20 }))
    }
    runs.push(new TextRun({ text: match[1], bold: true, size: 20 }))
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size: 20 }))
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, size: 20 }))
  }

  return runs
}

export function dataToTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, size: 18, color: 'FFFFFF' })],
        alignment: AlignmentType.LEFT,
      })],
      shading: { type: ShadingType.SOLID, color: '1a1a2e' },
      width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
    })),
  })

  const dataRows = rows.map(row => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: cell || '', size: 18 })],
      })],
      borders: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      },
    })),
  }))

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 9000, type: WidthType.DXA },
  })
}

export function createBriefingDoc(options: BriefingDocOptions): Document {
  const children: Paragraph[] = []

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: options.title, bold: true, size: 40, color: '1a1a2e' })],
    spacing: { after: 100 },
  }))

  // Subtitle
  if (options.subtitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: options.subtitle, size: 24, color: '6B7280', italics: true })],
      spacing: { after: 100 },
    }))
  }

  // Generated at
  children.push(new Paragraph({
    children: [new TextRun({ text: `Generated: ${new Date(options.generatedAt).toLocaleString()}`, size: 18, color: '9CA3AF' })],
    spacing: { after: 400 },
  }))

  // Divider
  children.push(new Paragraph({
    children: [new TextRun({ text: '─'.repeat(60), color: 'E5E7EB', size: 16 })],
    spacing: { after: 300 },
  }))

  // Sections
  for (const section of options.sections) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: section.title, bold: true, size: 28, color: '1a1a2e' })],
      spacing: { before: 400, after: 200 },
    }))
    children.push(...markdownToDocElements(section.content))
  }

  return new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: AlignmentType.START,
        }],
      }],
    },
    sections: [{
      children,
    }],
  })
}

export async function generateDocxBuffer(doc: Document): Promise<Buffer> {
  return await Packer.toBuffer(doc) as Buffer
}
