import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'sipri-arms.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'sipri-arms.json')

interface TransferYears {
  [year: string]: number
}

interface Transfer {
  supplier: string
  recipient: string
  tiv_total: number
  years: TransferYears
}

interface TopPartner {
  iso3: string
  tiv: number
}

interface CountrySIPRI {
  total_exports: number
  total_imports: number
  top_recipients: TopPartner[]
  top_suppliers: TopPartner[]
  export_rank: number
  import_rank: number
}

interface SIPRIMeta {
  updated_at: string
  source: string
  url: string
  years: string
  note: string
  transfer_count: number
  country_count: number
}

interface SIPRIData {
  _meta: SIPRIMeta
  transfers: Transfer[]
  countries: Record<string, CountrySIPRI>
}

let _data: SIPRIData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = {
      _meta: { updated_at: '', source: '', url: '', years: '', note: '', transfer_count: 0, country_count: 0 },
      transfers: [],
      countries: {},
    }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = {
      _meta: { updated_at: '', source: '', url: '', years: '', note: '', transfer_count: 0, country_count: 0 },
      transfers: [],
      countries: {},
    }
  }
}

export function getCountrySIPRI(iso3: string): CountrySIPRI | null {
  ensureLoaded()
  return _data!.countries[iso3.toUpperCase()] ?? null
}

export function getGroupSIPRIOverview(iso3Codes: string[]): {
  has_data: boolean
  total_exports: number
  total_imports: number
  top_exporters: Array<{ iso3: string; total_exports: number; export_rank: number }>
  top_importers: Array<{ iso3: string; total_imports: number; import_rank: number }>
  intra_group_transfers: Array<{ supplier: string; recipient: string; tiv_total: number }>
  top_external_suppliers: Array<{ iso3: string; tiv: number }>
  top_external_recipients: Array<{ iso3: string; tiv: number }>
} {
  ensureLoaded()
  const codeSet = new Set(iso3Codes.map(c => c.toUpperCase()))

  let totalExports = 0
  let totalImports = 0
  const exporterList: Array<{ iso3: string; total_exports: number; export_rank: number }> = []
  const importerList: Array<{ iso3: string; total_imports: number; import_rank: number }> = []
  const intraTransfers: Array<{ supplier: string; recipient: string; tiv_total: number }> = []
  const externalSupplierMap: Record<string, number> = {}
  const externalRecipientMap: Record<string, number> = {}

  // Aggregate country-level data
  for (const code of codeSet) {
    const d = _data!.countries[code]
    if (!d) continue
    totalExports += d.total_exports
    totalImports += d.total_imports
    exporterList.push({ iso3: code, total_exports: d.total_exports, export_rank: d.export_rank })
    importerList.push({ iso3: code, total_imports: d.total_imports, import_rank: d.import_rank })

    // External suppliers (countries outside the group that supply to this member)
    for (const s of d.top_suppliers) {
      if (!codeSet.has(s.iso3)) {
        externalSupplierMap[s.iso3] = (externalSupplierMap[s.iso3] || 0) + s.tiv
      }
    }

    // External recipients (countries outside the group that receive from this member)
    for (const r of d.top_recipients) {
      if (!codeSet.has(r.iso3)) {
        externalRecipientMap[r.iso3] = (externalRecipientMap[r.iso3] || 0) + r.tiv
      }
    }
  }

  // Find intra-group transfers
  for (const t of _data!.transfers) {
    if (codeSet.has(t.supplier) && codeSet.has(t.recipient)) {
      intraTransfers.push({
        supplier: t.supplier,
        recipient: t.recipient,
        tiv_total: t.tiv_total,
      })
    }
  }

  if (exporterList.length === 0 && importerList.length === 0) {
    return {
      has_data: false,
      total_exports: 0,
      total_imports: 0,
      top_exporters: [],
      top_importers: [],
      intra_group_transfers: [],
      top_external_suppliers: [],
      top_external_recipients: [],
    }
  }

  exporterList.sort((a, b) => b.total_exports - a.total_exports)
  importerList.sort((a, b) => b.total_imports - a.total_imports)
  intraTransfers.sort((a, b) => b.tiv_total - a.tiv_total)

  const topExternalSuppliers = Object.entries(externalSupplierMap)
    .map(([iso3, tiv]) => ({ iso3, tiv }))
    .sort((a, b) => b.tiv - a.tiv)
    .slice(0, 10)

  const topExternalRecipients = Object.entries(externalRecipientMap)
    .map(([iso3, tiv]) => ({ iso3, tiv }))
    .sort((a, b) => b.tiv - a.tiv)
    .slice(0, 10)

  return {
    has_data: true,
    total_exports: totalExports,
    total_imports: totalImports,
    top_exporters: exporterList.slice(0, 10),
    top_importers: importerList.slice(0, 10),
    intra_group_transfers: intraTransfers.slice(0, 15),
    top_external_suppliers: topExternalSuppliers,
    top_external_recipients: topExternalRecipients,
  }
}

export function getSIPRIMeta() {
  ensureLoaded()
  return _data!._meta
}

export function reloadSIPRI(): void {
  _data = null
  ensureLoaded()
}
