import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { readDataFile } from './data-file'
import { getRegistry } from './wcg'

/**
 * UN leadership: office holders and their recent statements (un-leadership.json, from
 * scripts/fetch_un_leadership.py), with the official leadership-team list pasted by an admin
 * (un-leadership-roster.json) taking precedence until a newer appointment is announced.
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const ROSTER = join(DATA_DIR, 'un-leadership-roster.json')

export interface RosterEntry { name: string; title: string; section: string | null; entity?: string | null }
interface Roster { pastedAt: string; pastedBy: string; source: string; entries: RosterEntry[] }

const TITLE = /\b(Secretary-General|Under-Secretary-General|Assistant Secretary-General|Executive Director|Executive Secretary|High Commissioner|High Representative|Administrator|Director-General|Director General|Chef de Cabinet|Legal Counsel|Controller|Special (Adviser|Advisor|Envoy|Representative|Coordinator)|Emergency Relief Coordinator|President|Rector|Chair|Chief Executive|Head of|Secretary of|Coordinator|Commissioner-General|Force Commander|Ombudsman|Advocate|Officer|Registrar|Representative|Director|Envoy|Adviser|Executive Secretary|Commander)\b/i
const NOT_NAME = /\b(United Nations|Department|Office|Programme|Fund|Commission|Council|Organization|Agency|Secretariat|Funds|Regional|Leadership|Team|Read more|Biography|Bio|Menu|Search|Home)\b/i

function looksLikeName(s: string) {
  const t = s.replace(/^(H\.?E\.?|Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Prof\.?|Ambassador)\s+/i, '').trim()
  const words = t.split(/\s+/)
  return words.length >= 2 && words.length <= 7 && t.length <= 60 && !TITLE.test(t) && !NOT_NAME.test(t) && /^[A-ZÀ-ÖØ-Þ]/.test(t) && !/[:;!?]/.test(t)
}
const cleanName = (s: string) => s.replace(/^(H\.?E\.?|Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Prof\.?|Ambassador)\s+/i, '').replace(/\s+/g, ' ').trim()

/** Read the text of the "Leadership team" page as copied from a browser: names followed by titles. */
export function parseRoster(text: string): RosterEntry[] {
  const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const out: RosterEntry[] = []
  let section: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    // "Name, Title" or "Name – Title" on one line
    const one = l.match(/^(.{4,60}?)\s*(?:,|–|—| - )\s*(.+)$/)
    if (one && looksLikeName(one[1]) && TITLE.test(one[2])) { out.push({ name: cleanName(one[1]), title: one[2].trim(), section }); continue }
    if (TITLE.test(l) && l.length <= 220 && i > 0) {
      // title line: the name is the nearest preceding name-like line (photo captions sometimes sit between)
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        if (looksLikeName(lines[j])) {
          // the UN page puts the entity (OCHA, DPPA - DPO, SCR 2792…) on the line before the name
          const ent = j > 0 && /^[A-Z0-9][A-Z0-9 \-\/&]{1,24}$/.test(lines[j - 1]) ? lines[j - 1] : null
          if (!out.some(e => e.name === cleanName(lines[j]) && e.title === l)) out.push({ name: cleanName(lines[j]), title: l, section, entity: ent })
          break
        }
        if (TITLE.test(lines[j])) break
      }
      continue
    }
    if (!looksLikeName(l) && l.length < 80 && !TITLE.test(l) && /^[A-Z]/.test(l) && !/[.:]$/.test(l)) section = l
  }
  return out
}

function loadRoster(): Roster | null {
  try { return existsSync(ROSTER) ? JSON.parse(readFileSync(ROSTER, 'utf-8')) : null } catch { return null }
}
export function saveRoster(text: string, by: string) {
  const entries = parseRoster(text)
  if (entries.length < 5) throw new Error(`Only ${entries.length} names found: copy the whole page (Ctrl+A, Ctrl+C) and paste it again`)
  const r: Roster = { pastedAt: new Date().toISOString(), pastedBy: by, source: 'https://www.un.org/sg/en/leadership-team', entries }
  const data = JSON.stringify(r, null, 1)
  writeFileSync(ROSTER + '.tmp', data)
  renameSync(ROSTER + '.tmp', ROSTER)
  return r
}

// department or agency names, for titles written "Under-Secretary-General, Department of …" or "Executive Director, … Fund"
const UNIT: Record<string, RegExp> = {
  dppa: /Political and Peacebuilding|Political Affairs/i, dpo: /Peace Operations|Peacekeeping/i, oda: /Disarmament/i, oct: /Office of Counter-Terrorism|UNOCT/i,
  ocha: /Humanitarian Affairs|Emergency Relief|OCHA/i, ohchr: /Human Rights|OHCHR/i, unhcr: /Refugees|UNHCR/i,
  desa: /Economic and Social Affairs|DESA/i, undp: /Development Programme|UNDP/i, unicef: /Children's Fund|Children’s Fund|UNICEF/i,
  wfp: /World Food Programme|WFP/i, unfpa: /Population Fund|UNFPA/i, unwomen: /UN[- ]Women|Gender Equality and the Empowerment of Women/i,
  unep: /Environment Programme|UNEP/i, dmspc: /Management Strategy|DMSPC/i, dos: /Operational Support/i, dgc: /Global Communications/i,
  dss: /Safety and Security/i, ola: /Legal Affairs|Legal Counsel/i,
}
const HEAD = /Under-Secretary-General|Executive Director|Administrator|High Commissioner|High Representative|Legal Counsel|Emergency Relief Coordinator/i

function matchOffice(o: any, e: RosterEntry): boolean {
  const t = e.title
  if (UNIT[o.id] && HEAD.test(t) && UNIT[o.id].test(t) && !/^(Deputy|Assistant|Associate)\b/i.test(t) && !/\b(Deputy|Assistant) (Executive|High|Secretary)/i.test(t)) return true
  if (/^(Deputy|Assistant|Associate)\b/i.test(t) && o.id !== 'dsg') return false
  if (o.id === 'sg') return /^Secretary-General\b/i.test(t)
  if (o.id === 'dsg') return /^Deputy Secretary-General\b/i.test(t)
  if (o.postRe && new RegExp(o.postRe, 'i').test(t)) return true
  if (o.peopleRole && t.toLowerCase().includes(o.peopleRole.toLowerCase())) return true
  return (o.terms || []).some((x: string) => x.length > 12 && t.toLowerCase().includes(x.toLowerCase()))
}

function country(iso3: string | null) {
  if (!iso3) return null
  const m: any = getRegistry().getCountryMembership(iso3)
  return { iso3, name: m?.name || iso3, iso2: m?.iso2 || null }
}

/** Offices with holders: official list first, unless a newer appointment has been announced since it was pasted. */
export function leadership(o: { roster?: RosterEntry[] | null } = {}) {
  const f = readDataFile<any>('un-leadership.json')
  if (!f) return null
  const roster = o.roster ? { pastedAt: new Date().toISOString(), entries: o.roster } as any : loadRoster()
  const used = new Set<number>()
  const offices = (f.offices || []).map((off: any) => {
    let holder = off.holder ? { ...off.holder } : null
    let note: string | null = null
    const idx = roster ? roster.entries.findIndex((e: RosterEntry, i: number) => !used.has(i) && matchOffice(off, e)) : -1
    if (idx >= 0) {
      used.add(idx)
      const e = roster!.entries[idx]
      const evidence = holder
      const newer = evidence && evidence.kind === 'appointment' && evidence.since > roster!.pastedAt.slice(0, 10) && evidence.name.toLowerCase() !== e.name.toLowerCase()
      if (newer) {
        note = `Newer appointment announced on ${evidence!.since}; the UN leadership list (pasted ${roster!.pastedAt.slice(0, 10)}) named ${e.name}.`
      } else {
        const same = evidence && evidence.name.toLowerCase().split(' ').pop() === e.name.toLowerCase().split(' ').pop()
        holder = { name: e.name, title: e.title, entity: e.entity || null, acting: /^(Acting|Ad Interim)\b/i.test(e.title), kind: 'official', source: 'UN leadership team page', url: roster!.source, since: same ? evidence!.since : null,
          iso3: same ? evidence!.iso3 : null, nationality: same ? evidence!.nationality : null, slug: same ? evidence!.slug : null, image: same ? evidence!.image : null, listedOn: roster!.pastedAt.slice(0, 10), stale: false }
      }
    }
    return { ...off, holder: holder ? { ...holder, country: country(holder.iso3) } : null, note, statements: off.statements || [] }
  })
  const others = roster ? roster.entries.filter((_: any, i: number) => !used.has(i)) : []
  return { updatedAt: f._meta?.updated_at, groups: f._meta?.groups || {}, offices, roster: roster ? { pastedAt: roster.pastedAt, count: roster.entries.length, others } : null, rosterStatus: f._meta?.roster || null }
}
