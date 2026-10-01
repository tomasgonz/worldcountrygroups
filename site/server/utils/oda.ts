import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'oecd-oda.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'oecd-oda.json')

interface YearlyAmounts {
  [year: string]: number
}

interface FlowEntry {
  donor: string
  recipient: string
  total_usd: number
  years: YearlyAmounts
}

interface TopPartner {
  iso3: string
  total: number
}

interface CountryODA {
  is_donor: boolean
  total_given: number
  total_received: number
  top_recipients: TopPartner[]
  top_donors: TopPartner[]
  oda_gni_ratio?: number
  donor_rank?: number
  recipient_rank?: number
}

interface ODAMeta {
  updated_at: string
  source: string
  years: string
  note?: string
}

interface ODAData {
  _meta: ODAMeta
  flows: FlowEntry[]
  countries: Record<string, CountryODA>
}

const DEFAULT_DATA: ODAData = {
  _meta: { updated_at: '', source: '', years: '' },
  flows: [],
  countries: {},
}

let _data: ODAData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = DEFAULT_DATA
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = DEFAULT_DATA
  }
}

export function getCountryODA(iso3: string): CountryODA | null {
  ensureLoaded()
  return _data!.countries[iso3.toUpperCase()] ?? null
}

export function getGroupODAOverview(iso3Codes: string[]): {
  has_data: boolean
  total_given: number
  total_received: number
  donor_count: number
  recipient_count: number
  top_donors: Array<{ iso3: string; total_given: number; oda_gni_ratio?: number; donor_rank?: number }>
  top_recipients: Array<{ iso3: string; total_received: number; recipient_rank?: number }>
  intra_group_flows: Array<{ donor: string; recipient: string; total_usd: number }>
  external_donors: Array<{ iso3: string; total: number }>
  external_recipients: Array<{ iso3: string; total: number }>
  aid_dependency_ratio: number
} {
  ensureLoaded()
  const codeSet = new Set(iso3Codes.map(c => c.toUpperCase()))

  let totalGiven = 0
  let totalReceived = 0
  let donorCount = 0
  let recipientCount = 0
  const donorList: Array<{ iso3: string; total_given: number; oda_gni_ratio?: number; donor_rank?: number }> = []
  const recipientList: Array<{ iso3: string; total_received: number; recipient_rank?: number }> = []
  const intraFlows: Array<{ donor: string; recipient: string; total_usd: number }> = []
  const externalDonorTotals: Record<string, number> = {}
  const externalRecipientTotals: Record<string, number> = {}

  // Gather per-country stats
  for (const code of codeSet) {
    const c = _data!.countries[code]
    if (!c) continue

    if (c.is_donor) {
      donorCount++
      totalGiven += c.total_given
      donorList.push({
        iso3: code,
        total_given: c.total_given,
        oda_gni_ratio: c.oda_gni_ratio,
        donor_rank: c.donor_rank,
      })
    } else {
      recipientCount++
      totalReceived += c.total_received
      recipientList.push({
        iso3: code,
        total_received: c.total_received,
        recipient_rank: c.recipient_rank,
      })
    }
  }

  // Find intra-group flows and external dependencies
  for (const flow of _data!.flows) {
    const donorInGroup = codeSet.has(flow.donor)
    const recipInGroup = codeSet.has(flow.recipient)

    if (donorInGroup && recipInGroup) {
      intraFlows.push({
        donor: flow.donor,
        recipient: flow.recipient,
        total_usd: flow.total_usd,
      })
    } else if (!donorInGroup && recipInGroup) {
      // External donor giving to group member
      externalDonorTotals[flow.donor] = (externalDonorTotals[flow.donor] || 0) + flow.total_usd
    } else if (donorInGroup && !recipInGroup) {
      // Group donor giving externally
      externalRecipientTotals[flow.recipient] = (externalRecipientTotals[flow.recipient] || 0) + flow.total_usd
    }
  }

  if (donorList.length === 0 && recipientList.length === 0) {
    return {
      has_data: false,
      total_given: 0,
      total_received: 0,
      donor_count: 0,
      recipient_count: 0,
      top_donors: [],
      top_recipients: [],
      intra_group_flows: [],
      external_donors: [],
      external_recipients: [],
      aid_dependency_ratio: 0,
    }
  }

  donorList.sort((a, b) => b.total_given - a.total_given)
  recipientList.sort((a, b) => b.total_received - a.total_received)
  intraFlows.sort((a, b) => b.total_usd - a.total_usd)

  const externalDonors = Object.entries(externalDonorTotals)
    .map(([iso3, total]) => ({ iso3, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const externalRecipients = Object.entries(externalRecipientTotals)
    .map(([iso3, total]) => ({ iso3, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Aid dependency ratio: how much the group's recipients depend on external donors
  const totalExternalAid = Object.values(externalDonorTotals).reduce((s, v) => s + v, 0)
  const aidDependencyRatio = totalReceived > 0 ? totalExternalAid / totalReceived : 0

  return {
    has_data: true,
    total_given: totalGiven,
    total_received: totalReceived,
    donor_count: donorCount,
    recipient_count: recipientCount,
    top_donors: donorList.slice(0, 10),
    top_recipients: recipientList.slice(0, 10),
    intra_group_flows: intraFlows.slice(0, 15),
    external_donors: externalDonors,
    external_recipients: externalRecipients,
    aid_dependency_ratio: Math.round(aidDependencyRatio * 1000) / 1000,
  }
}

export function getODAMeta(): ODAMeta {
  ensureLoaded()
  return _data!._meta
}

export function reloadODA(): void {
  _data = null
  ensureLoaded()
}
