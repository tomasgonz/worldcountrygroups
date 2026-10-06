/**
 * Ask desk exports: one answer (or a whole conversation) as a Word document or a PDF,
 * ready to hand out in a meeting. Both formats are built from the same pieces:
 * a cover page, the answer Markdown (marked.lexer tokens), superscript citation numbers
 * and a numbered "Sources" list with absolute links.
 *
 * Self-contained on purpose (no Nuxt auto-imports) so it can be exercised from a plain node script.
 */
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { createRequire } from 'module'
import { marked, type Token, type Tokens } from 'marked'
import {
  AlignmentType, BorderStyle, Bookmark, Document, ExternalHyperlink, Footer, Header, HeadingLevel,
  InternalHyperlink, LevelFormat, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableRow, TabStopType, TextRun, WidthType, type ParagraphChild,
} from 'docx'
// pdfmake (server build) is CommonJS exporting a ready-made instance
import pdfmake from 'pdfmake'

export const SITE_URL = 'https://www.worldcountrygroups.org'
const SITE_NAME = 'World Country Groups'

/** The parts of an Ask record the export uses (deliberately no user fields). */
export interface ExportTurn {
  id: string
  question: string
  mode?: string
  template?: string
  createdAt: string
  finishedAt?: string
  answer?: string
  sources?: { ref: string; title: string; url: string; kind?: string }[]
}

const TEMPLATE_LABELS: Record<string, string> = {
  country: 'Country briefing', bilateral: 'Bilateral meeting brief', issue: 'Issue briefing',
  group: 'Group briefing', free: 'Briefing',
}

function subtitleFor(turns: ExportTurn[], thread: boolean): string {
  const first = turns[0]
  const kind = first.mode === 'briefing' ? (TEMPLATE_LABELS[first.template || ''] || 'Briefing') : 'Research answer'
  return thread && turns.length > 1 ? `${kind} — conversation of ${turns.length} questions` : kind
}

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '')
const latestDate = (turns: ExportTurn[]) => turns.map(t => t.finishedAt || t.createdAt).sort().pop() || new Date().toISOString()

export function absoluteUrl(u: string): string {
  if (!u) return SITE_URL
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('//')) return 'https:' + u
  return SITE_URL + (u.startsWith('/') ? u : '/' + u)
}

/** "brazil-united-states-bilateral-meeting-2026-10-02.docx" */
export function exportFilename(question: string, date: string, ext: 'docx' | 'pdf'): string {
  let slug = (question || 'briefing').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (slug.length > 60) slug = slug.slice(0, 60).replace(/-[^-]*$/, '') || slug.slice(0, 60)
  return `${slug || 'briefing'}-${(date || new Date().toISOString()).slice(0, 10)}.${ext}`
}

// ---------------------------------------------------------------------------
// Markdown -> neutral inline runs (shared by both renderers)
// ---------------------------------------------------------------------------

interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  strike?: boolean
  code?: boolean
  link?: string
  cite?: string[]   // citation refs, e.g. ['S8', 'S26']; rendered as superscript numbers
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m])

const CITE_RE = /\s*\[(S\d+)\]/g

/** Split plain text into text and citation runs. */
function splitCites(text: string, fmt: Omit<Run, 'text'>): Run[] {
  const out: Run[] = []
  let last = 0
  for (const m of text.matchAll(CITE_RE)) {
    if (m.index! > last) out.push({ ...fmt, text: text.slice(last, m.index) })
    out.push({ text: '', cite: [m[1]] })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ ...fmt, text: text.slice(last) })
  return out
}

function inlineRuns(tokens: Token[] | undefined, fmt: Omit<Run, 'text'> = {}): Run[] {
  const out: Run[] = []
  for (const t of tokens || []) {
    const tk = t as any
    switch (t.type) {
      case 'strong': out.push(...inlineRuns(tk.tokens, { ...fmt, bold: true })); break
      case 'em': out.push(...inlineRuns(tk.tokens, { ...fmt, italic: true })); break
      case 'del': out.push(...inlineRuns(tk.tokens, { ...fmt, strike: true })); break
      case 'codespan': out.push({ ...fmt, code: true, text: decode(tk.text) }); break
      case 'link': out.push(...inlineRuns(tk.tokens, { ...fmt, link: absoluteUrl(tk.href) })); break
      case 'image': out.push({ ...fmt, text: tk.text || '' }); break
      case 'br': out.push({ ...fmt, text: '\n' }); break
      case 'html': out.push(...splitCites(decode(String(tk.text || tk.raw).replace(/<[^>]+>/g, '')), fmt)); break
      case 'text':
      case 'escape':
        if (tk.tokens?.length) out.push(...inlineRuns(tk.tokens, fmt))
        else out.push(...splitCites(decode(tk.text), fmt))
        break
      default:
        if (tk.tokens) out.push(...inlineRuns(tk.tokens, fmt))
        else if (typeof tk.text === 'string') out.push(...splitCites(decode(tk.text), fmt))
    }
  }
  // merge neighbouring citations ([S8][S26] -> one superscript "8,26") and drop empty text
  const merged: Run[] = []
  for (const r of out) {
    const prev = merged[merged.length - 1]
    if (r.cite && prev?.cite) prev.cite.push(...r.cite)
    else if (r.cite || r.text) merged.push(r)
  }
  return merged
}

const citeNum = (ref: string) => ref.replace(/^S/i, '')
const anchorId = (turnIdx: number, ref: string) => `src_${turnIdx}_${citeNum(ref)}`

function sortedSources(t: ExportTurn) {
  return [...(t.sources || [])].sort((a, b) => (parseInt(citeNum(a.ref)) || 0) - (parseInt(citeNum(b.ref)) || 0))
}

/** The Markdown of an answer as block tokens. */
function lex(md: string): Token[] {
  return marked.lexer(md || '', { gfm: true })
}

/** The answer often repeats the question as its own "# Title"; drop that when it is the first token. */
function dropLeadingTitle(tokens: Token[]): Token[] {
  const i = tokens.findIndex(t => t.type !== 'space')
  return i >= 0 && tokens[i].type === 'heading' && (tokens[i] as Tokens.Heading).depth === 1 ? tokens.slice(i + 1) : tokens
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

const D = {
  heading: 'Cambria', body: 'Calibri', mono: 'Consolas',
  ink: '1F2937', muted: '6B7280', accent: '1E3A5F', rule: 'CBD5E1', tableHead: 'EEF2F7',
}
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1300
const CONTENT_W = PAGE_W - 2 * MARGIN

function docxRuns(runs: Run[], turnIdx: number, size?: number): ParagraphChild[] {
  const kids: ParagraphChild[] = []
  for (const r of runs) {
    if (r.cite) {
      r.cite.forEach((ref, i) => {
        if (i) kids.push(new TextRun({ text: ',', superScript: true, color: D.accent, size }))
        kids.push(new InternalHyperlink({ anchor: anchorId(turnIdx, ref), children: [new TextRun({ text: citeNum(ref), superScript: true, color: D.accent, size })] }))
      })
      continue
    }
    const parts = r.text.split('\n')
    parts.forEach((p, i) => {
      const run = new TextRun({
        text: p, break: i > 0 ? 1 : undefined, bold: r.bold, italics: r.italic, strike: r.strike, size,
        font: r.code ? D.mono : undefined, style: r.link ? 'Hyperlink' : undefined,
      })
      kids.push(r.link ? new ExternalHyperlink({ link: r.link, children: [run] }) : run)
    })
  }
  return kids
}

interface DocxCtx { turnIdx: number; headingOffset: number; numberingInstance: number }

const DOCX_HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4]

function docxBlocks(tokens: Token[], ctx: DocxCtx, opts: { quote?: boolean } = {}): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []
  const quote = opts.quote ? { indent: { left: 567 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: D.rule, space: 8 } } } : {}
  for (const t of tokens) {
    const tk = t as any
    switch (t.type) {
      case 'heading': {
        const lvl = Math.min(3, tk.depth - 1 + ctx.headingOffset)
        out.push(new Paragraph({ heading: DOCX_HEADINGS[lvl], keepNext: true, children: docxRuns(inlineRuns(tk.tokens), ctx.turnIdx) }))
        break
      }
      case 'paragraph':
        out.push(new Paragraph({ ...quote, children: docxRuns(inlineRuns(tk.tokens, opts.quote ? { italic: true } : {}), ctx.turnIdx) }))
        break
      case 'text':
        out.push(new Paragraph({ ...quote, children: docxRuns(inlineRuns(tk.tokens || [tk]), ctx.turnIdx) }))
        break
      case 'list':
        out.push(...docxList(tk as Tokens.List, ctx, 0))
        break
      case 'blockquote':
        out.push(...docxBlocks(tk.tokens, ctx, { quote: true }))
        break
      case 'code':
        for (const line of String(tk.text).split('\n')) {
          out.push(new Paragraph({ spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F4F6' }, children: [new TextRun({ text: line || ' ', font: D.mono, size: 18 })] }))
        }
        break
      case 'table':
        out.push(docxTable(tk as Tokens.Table, ctx))
        out.push(new Paragraph({ spacing: { after: 60 }, children: [] }))
        break
      case 'hr':
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: D.rule, space: 1 } }, children: [] }))
        break
      case 'html': {
        const txt = decode(String(tk.text || '').replace(/<[^>]+>/g, '')).trim()
        if (txt) out.push(new Paragraph({ children: docxRuns(splitCites(txt, {}), ctx.turnIdx) }))
        break
      }
    }
  }
  return out
}

function docxList(list: Tokens.List, ctx: DocxCtx, level: number): Paragraph[] {
  const out: Paragraph[] = []
  const ref = list.ordered ? 'numbers' : 'bullets'
  const instance = list.ordered && level === 0 ? ++ctx.numberingInstance : ctx.numberingInstance
  for (const item of list.items) {
    let first = true
    for (const t of item.tokens) {
      const tk = t as any
      if (t.type === 'list') { out.push(...docxList(tk, ctx, Math.min(level + 1, 2))); continue }
      if (t.type !== 'text' && t.type !== 'paragraph') { out.push(...(docxBlocks([t], ctx) as Paragraph[])); continue }
      const kids = docxRuns(inlineRuns(tk.tokens || [tk]), ctx.turnIdx)
      out.push(first
        ? new Paragraph({ numbering: { reference: ref, level, instance }, spacing: { after: 60 }, children: kids })
        : new Paragraph({ indent: { left: 720 * (level + 1) }, spacing: { after: 60 }, children: kids }))
      first = false
    }
  }
  return out
}

function docxTable(tb: Tokens.Table, ctx: DocxCtx): Table {
  const n = tb.header.length || 1
  const colW = Math.floor(CONTENT_W / n)
  const align = (a: string | null) => (a === 'right' ? AlignmentType.RIGHT : a === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT)
  const cell = (c: Tokens.TableCell, i: number, head: boolean) => new TableCell({
    width: { size: colW, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: D.tableHead } : undefined,
    children: [new Paragraph({ spacing: { after: 0, line: 252 }, alignment: align(tb.align[i]), children: docxRuns(inlineRuns(c.tokens, head ? { bold: true } : {}), ctx.turnIdx, 19) })],
  })
  const border = { style: BorderStyle.SINGLE, size: 4, color: D.rule }
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: Array(n).fill(colW),
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: tb.header.map((c, i) => cell(c, i, true)) }),
      ...tb.rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })),
    ],
  })
}

function docxSources(t: ExportTurn, turnIdx: number, headingLevel: number): Paragraph[] {
  const src = sortedSources(t)
  if (!src.length) return []
  const out: Paragraph[] = [new Paragraph({ heading: DOCX_HEADINGS[headingLevel], keepNext: true, children: [new TextRun('Sources')] })]
  for (const s of src) {
    const url = absoluteUrl(s.url)
    out.push(new Paragraph({
      indent: { left: 454, hanging: 454 }, spacing: { after: 80 },
      children: [
        new Bookmark({ id: anchorId(turnIdx, s.ref), children: [new TextRun({ text: `${citeNum(s.ref)}.`, bold: true, color: D.accent, size: 19 })] }),
        new TextRun({ text: '\t' }),
        new TextRun({ text: s.title || url, size: 19 }),
        new TextRun({ text: ' ', size: 19 }),
        new ExternalHyperlink({ link: url, children: [new TextRun({ text: url, style: 'Hyperlink', size: 17 })] }),
      ],
      tabStops: [{ type: TabStopType.LEFT, position: 454 }],
    }))
  }
  return out
}

function docxCover(turns: ExportTurn[], thread: boolean): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 2600, after: 240 }, children: [new TextRun({ text: SITE_NAME.toUpperCase(), font: D.body, size: 20, bold: true, color: D.accent, characterSpacing: 40 })] }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: D.accent, space: 12 } }, spacing: { after: 480 }, children: [] }),
    new Paragraph({ spacing: { after: 360, line: 300 }, children: [new TextRun({ text: turns[0].question, font: D.heading, size: 48, bold: true, color: D.ink })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: subtitleFor(turns, thread), font: D.heading, size: 30, italics: true, color: D.accent })] }),
    new Paragraph({ spacing: { after: 2400 }, children: [new TextRun({ text: fmtDate(latestDate(turns)), size: 24, color: D.muted })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `Prepared with ${SITE_NAME}`, size: 22, bold: true, color: D.ink })] }),
    new Paragraph({
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: D.rule, space: 8 } }, indent: { left: 200 },
      children: [new TextRun({ text: 'Facts in this document are cited to their sources (superscript numbers refer to the Sources list). It was drafted with AI assistance from the site’s datasets and news; check key facts against the sources before relying on them.', size: 19, color: D.muted })],
    }),
  ]
}

export async function buildDocx(turns: ExportTurn[], opts: { thread?: boolean } = {}): Promise<Buffer> {
  if (!turns.length) throw new Error('Nothing to export')
  const thread = !!opts.thread && turns.length > 1
  const body: (Paragraph | Table)[] = []
  const ctx: DocxCtx = { turnIdx: 0, headingOffset: thread ? 1 : 0, numberingInstance: 0 }
  turns.forEach((t, i) => {
    ctx.turnIdx = i
    if (thread) {
      body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: i > 0, keepNext: true, children: [new TextRun(`${i + 1}. ${t.question}`)] }))
      body.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: fmtDate(t.finishedAt || t.createdAt), color: D.muted, size: 19 })] }))
    }
    body.push(...docxBlocks(thread ? lex(t.answer || '') : dropLeadingTitle(lex(t.answer || '')), ctx))
    body.push(...docxSources(t, i, thread ? 1 : 0))
  })

  const bulletLevels = ['•', '–', '◦'].map((text, level) => ({
    level, format: LevelFormat.BULLET, text, alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360 * (level + 1) + 0, hanging: 280 } } },
  }))
  const numberLevels = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN].map((format, level) => ({
    level, format, text: `%${level + 1}.`, alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360 * (level + 1) + 40, hanging: 320 } } },
  }))
  const page = { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 600, footer: 600 } }

  const doc = new Document({
    creator: SITE_NAME,
    title: turns[0].question,
    description: subtitleFor(turns, thread),
    styles: {
      default: {
        document: { run: { font: D.body, size: 21, color: D.ink }, paragraph: { spacing: { after: 140, line: 288 } } },
        heading1: { run: { font: D.heading, size: 34, bold: true, color: D.accent }, paragraph: { spacing: { before: 360, after: 160 } } },
        heading2: { run: { font: D.heading, size: 28, bold: true, color: D.accent }, paragraph: { spacing: { before: 320, after: 120 } } },
        heading3: { run: { font: D.heading, size: 24, bold: true, color: D.ink }, paragraph: { spacing: { before: 240, after: 100 } } },
        heading4: { run: { font: D.heading, size: 22, bold: true, italics: true, color: D.ink }, paragraph: { spacing: { before: 200, after: 80 } } },
        hyperlink: { run: { color: '1D4ED8', underline: {} } },
      },
    },
    numbering: { config: [{ reference: 'bullets', levels: bulletLevels }, { reference: 'numbers', levels: numberLevels }] },
    sections: [
      { properties: { page }, children: docxCover(turns, thread) },
      {
        properties: { page: { ...page, pageNumbers: { start: 1 } } },
        headers: {
          default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: D.rule, space: 4 } }, children: [new TextRun({ text: SITE_NAME, size: 16, color: D.muted, characterSpacing: 20 })] })] }),
        },
        footers: {
          default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: D.muted })] })] }),
        },
        children: body,
      },
    ],
  })
  return Packer.toBuffer(doc)
}

// ---------------------------------------------------------------------------
// PDF (pdfmake, pure JS: no headless browser)
// ---------------------------------------------------------------------------

type FontSet = { normal: string; bold: string; italics: string; bolditalics: string }

/** Liberation (metric-compatible with Arial/Times) when installed, else pdfmake's bundled Roboto, else the PDF standard fonts. */
function pdfFonts(): { fonts: Record<string, FontSet>; dirs: string[] } {
  const lib = '/usr/share/fonts/truetype/liberation'
  const fam = (dir: string, base: string, n: string, b: string, i: string, bi: string): FontSet =>
    ({ normal: join(dir, `${base}-${n}.ttf`), bold: join(dir, `${base}-${b}.ttf`), italics: join(dir, `${base}-${i}.ttf`), bolditalics: join(dir, `${base}-${bi}.ttf`) })
  const ok = (f: FontSet) => Object.values(f).every(p => existsSync(p))

  const sans = fam(lib, 'LiberationSans', 'Regular', 'Bold', 'Italic', 'BoldItalic')
  const serif = fam(lib, 'LiberationSerif', 'Regular', 'Bold', 'Italic', 'BoldItalic')
  const mono = fam(lib, 'LiberationMono', 'Regular', 'Bold', 'Italic', 'BoldItalic')

  const robotoDirs: string[] = []
  try { robotoDirs.push(join(dirname(createRequire(import.meta.url).resolve('pdfmake/package.json')), 'fonts/Roboto')) } catch {}
  robotoDirs.push(join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto'))
  robotoDirs.push(join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/node_modules/pdfmake/fonts/Roboto'))
  const roboto = robotoDirs.map(d => fam(d, 'Roboto', 'Regular', 'Medium', 'Italic', 'MediumItalic')).find(ok)

  const helvetica: FontSet = { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' }
  const times: FontSet = { normal: 'Times-Roman', bold: 'Times-Bold', italics: 'Times-Italic', bolditalics: 'Times-BoldItalic' }
  const courier: FontSet = { normal: 'Courier', bold: 'Courier-Bold', italics: 'Courier-Oblique', bolditalics: 'Courier-BoldOblique' }

  const Body = ok(sans) ? sans : roboto || helvetica
  const Head = ok(serif) ? serif : roboto || times
  const Mono = ok(mono) ? mono : (roboto ? Body : courier)
  const dirs = [lib, ...robotoDirs]
  return { fonts: { Body, Head, Mono }, dirs }
}

const P = { ink: '#1F2937', muted: '#6B7280', accent: '#1E3A5F', rule: '#CBD5E1', tableHead: '#EEF2F7', link: '#1D4ED8' }

function pdfRuns(runs: Run[], turnIdx: number): any[] {
  const out: any[] = []
  for (const r of runs) {
    if (r.cite) {
      r.cite.forEach((ref, i) => {
        if (i) out.push({ text: ',', sup: true, color: P.accent })
        out.push({ text: citeNum(ref), sup: true, color: P.accent, linkToDestination: anchorId(turnIdx, ref) })
      })
      continue
    }
    const n: any = { text: r.text }
    if (r.bold) n.bold = true
    if (r.italic) n.italics = true
    if (r.strike) n.decoration = 'lineThrough'
    if (r.code) { n.font = 'Mono'; n.fontSize = 9 }
    if (r.link) { n.link = r.link; n.color = P.link; n.decoration = 'underline' }
    out.push(n)
  }
  return out.length ? out : ['']
}

interface PdfCtx { turnIdx: number; headingOffset: number }

function pdfBlocks(tokens: Token[], ctx: PdfCtx, opts: { quote?: boolean } = {}): any[] {
  const out: any[] = []
  for (const t of tokens) {
    const tk = t as any
    switch (t.type) {
      case 'heading': {
        const lvl = Math.min(3, tk.depth - 1 + ctx.headingOffset)
        out.push({ text: pdfRuns(inlineRuns(tk.tokens), ctx.turnIdx), style: `h${lvl + 1}`, headlineLevel: 1 })
        break
      }
      case 'paragraph':
        out.push({ text: pdfRuns(inlineRuns(tk.tokens, opts.quote ? { italic: true } : {}), ctx.turnIdx), style: 'p' })
        break
      case 'text':
        out.push({ text: pdfRuns(inlineRuns(tk.tokens || [tk]), ctx.turnIdx), style: 'p' })
        break
      case 'list':
        out.push({ ...pdfList(tk as Tokens.List, ctx), margin: [0, 0, 0, 8] })
        break
      case 'blockquote':
        out.push({
          table: { widths: ['*'], body: [[{ stack: pdfBlocks(tk.tokens, ctx, { quote: true }), color: P.muted }]] },
          layout: { hLineWidth: () => 0, vLineWidth: (i: number) => (i === 0 ? 2 : 0), vLineColor: () => P.rule, paddingLeft: () => 10, paddingTop: () => 2, paddingBottom: () => 0 },
          margin: [0, 2, 0, 8],
        })
        break
      case 'code':
        out.push({ table: { widths: ['*'], body: [[{ text: tk.text, font: 'Mono', fontSize: 8.5, preserveLeadingSpaces: true }]] }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#F3F4F6', paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4, paddingBottom: () => 4 }, margin: [0, 0, 0, 8] })
        break
      case 'table':
        out.push(pdfTable(tk as Tokens.Table, ctx))
        break
      case 'hr':
        out.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 0.6, lineColor: P.rule }], margin: [0, 4, 0, 10] })
        break
      case 'html': {
        const txt = decode(String(tk.text || '').replace(/<[^>]+>/g, '')).trim()
        if (txt) out.push({ text: pdfRuns(splitCites(txt, {}), ctx.turnIdx), style: 'p' })
        break
      }
    }
  }
  return out
}

function pdfList(list: Tokens.List, ctx: PdfCtx): any {
  const items = list.items.map((item) => {
    const parts: any[] = []
    for (const t of item.tokens) {
      const tk = t as any
      if (t.type === 'list') parts.push({ ...pdfList(tk, ctx), margin: [0, 2, 0, 0] })
      else if (t.type === 'text' || t.type === 'paragraph') parts.push({ text: pdfRuns(inlineRuns(tk.tokens || [tk]), ctx.turnIdx), margin: [0, 0, 0, 3] })
      else parts.push(...pdfBlocks([t], ctx))
    }
    return parts.length === 1 ? parts[0] : { stack: parts }
  })
  return list.ordered
    ? { ol: items, start: typeof list.start === 'number' ? list.start : 1, markerColor: P.accent }
    : { ul: items, markerColor: P.accent }
}

function pdfTable(tb: Tokens.Table, ctx: PdfCtx): any {
  const n = tb.header.length || 1
  const al = (a: string | null) => (a === 'right' ? 'right' : a === 'center' ? 'center' : 'left')
  // short numeric-looking columns get 'auto' width; text columns share the rest
  const numeric = tb.header.map((_, i) => tb.rows.every(r => (r[i]?.text || '').trim().length <= 12))
  const widths = numeric.every(Boolean) ? Array(n).fill('*') : numeric.map(x => (x ? 'auto' : '*'))
  return {
    table: {
      headerRows: 1, dontBreakRows: true, widths,
      body: [
        tb.header.map((c, i) => ({ text: pdfRuns(inlineRuns(c.tokens, { bold: true }), ctx.turnIdx), alignment: al(tb.align[i]), fillColor: P.tableHead })),
        ...tb.rows.map(r => r.map((c, i) => ({ text: pdfRuns(inlineRuns(c.tokens), ctx.turnIdx), alignment: al(tb.align[i]) }))),
      ],
    },
    layout: {
      hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => P.rule, vLineColor: () => P.rule,
      paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3, paddingBottom: () => 3,
    },
    fontSize: 9, margin: [0, 2, 0, 10],
  }
}

/** Zero-width spaces after URL punctuation (and inside very long segments) so long links wrap instead of overflowing. */
function breakableUrl(u: string): string {
  return u.split(/(?<=[/?&=#])/).map(seg => seg.replace(/([^/?&=#]{28})(?=[^/?&=#])/g, '$1\u200b')).join('\u200b')
}

function pdfSources(t: ExportTurn, turnIdx: number, style: string): any[] {
  const src = sortedSources(t)
  if (!src.length) return []
  const rows = src.map((s) => {
    const url = absoluteUrl(s.url)
    return {
      columns: [
        { width: 22, text: `${citeNum(s.ref)}.`, bold: true, color: P.accent, id: anchorId(turnIdx, s.ref) },
        { width: '*', stack: [{ text: s.title || url }, { text: breakableUrl(url), link: url, color: P.link, fontSize: 8 }] },
      ],
      fontSize: 9, margin: [0, 0, 0, 4],
    }
  })
  return [{ text: 'Sources', style, headlineLevel: 1 }, ...rows]
}

export async function buildPdf(turns: ExportTurn[], opts: { thread?: boolean } = {}): Promise<Buffer> {
  if (!turns.length) throw new Error('Nothing to export')
  const thread = !!opts.thread && turns.length > 1
  const { fonts, dirs } = pdfFonts()

  const cover = {
    stack: [
      { text: SITE_NAME.toUpperCase(), bold: true, fontSize: 10, color: P.accent, characterSpacing: 2, margin: [0, 150, 0, 8] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 1.5, lineColor: P.accent }], margin: [0, 0, 0, 28] },
      { text: turns[0].question, font: 'Head', bold: true, fontSize: 24, lineHeight: 1.1, color: P.ink, margin: [0, 0, 0, 16] },
      { text: subtitleFor(turns, thread), font: 'Head', italics: true, fontSize: 15, color: P.accent, margin: [0, 0, 0, 6] },
      { text: fmtDate(latestDate(turns)), fontSize: 12, color: P.muted, margin: [0, 0, 0, 160] },
      { text: `Prepared with ${SITE_NAME}`, bold: true, fontSize: 11, margin: [0, 0, 0, 6] },
      {
        table: { widths: ['*'], body: [[{ text: 'Facts in this document are cited to their sources (superscript numbers refer to the Sources list). It was drafted with AI assistance from the site’s datasets and news; check key facts against the sources before relying on them.', fontSize: 9.5, color: P.muted }]] },
        layout: { hLineWidth: () => 0, vLineWidth: (i: number) => (i === 0 ? 2 : 0), vLineColor: () => P.rule, paddingLeft: () => 10 },
      },
    ],
    pageBreak: 'after',
  }

  const content: any[] = [cover]
  const ctx: PdfCtx = { turnIdx: 0, headingOffset: thread ? 1 : 0 }
  turns.forEach((t, i) => {
    ctx.turnIdx = i
    if (thread) {
      content.push({ text: `${i + 1}. ${t.question}`, style: 'h1', pageBreak: i > 0 ? 'before' : undefined, headlineLevel: 1 })
      content.push({ text: fmtDate(t.finishedAt || t.createdAt), color: P.muted, fontSize: 9.5, margin: [0, 0, 0, 10] })
    }
    content.push(...pdfBlocks(thread ? lex(t.answer || '') : dropLeadingTitle(lex(t.answer || '')), ctx))
    content.push(...pdfSources(t, i, thread ? 'h2' : 'h1'))
  })

  const docDef: any = {
    pageSize: 'A4',
    pageMargins: [56, 64, 56, 60],
    info: { title: turns[0].question, subject: subtitleFor(turns, thread), creator: SITE_NAME, producer: SITE_NAME },
    defaultStyle: { font: 'Body', fontSize: 10.5, lineHeight: 1.25, color: P.ink },
    styles: {
      p: { margin: [0, 0, 0, 8] },
      h1: { font: 'Head', fontSize: 17, bold: true, color: P.accent, margin: [0, 14, 0, 6] },
      h2: { font: 'Head', fontSize: 14, bold: true, color: P.accent, margin: [0, 12, 0, 5] },
      h3: { font: 'Head', fontSize: 12, bold: true, color: P.ink, margin: [0, 10, 0, 4] },
      h4: { font: 'Head', fontSize: 11, bold: true, italics: true, color: P.ink, margin: [0, 8, 0, 3] },
    },
    header: (page: number) => (page === 1 ? null : {
      stack: [
        { text: SITE_NAME, alignment: 'right', fontSize: 8, color: P.muted, characterSpacing: 1 },
        { canvas: [{ type: 'line', x1: 0, y1: 3, x2: 483, y2: 3, lineWidth: 0.5, lineColor: P.rule }] },
      ],
      margin: [56, 30, 56, 0],
    }),
    footer: (page: number) => (page === 1 ? null : { text: String(page - 1), alignment: 'center', fontSize: 9, color: P.muted, margin: [0, 24, 0, 0] }),
    // keep headings with what follows
    pageBreakBefore: (node: any, nodeQueries: any) => node.headlineLevel === 1 && nodeQueries.getFollowingNodesOnPage().length === 0,
    content,
  }

  const pm: any = pdfmake
  pm.setFonts(fonts)
  pm.setUrlAccessPolicy(() => false)
  pm.setLocalAccessPolicy((p: string) => dirs.some(d => p.startsWith(d)))
  return pm.createPdf(docDef).getBuffer()
}
