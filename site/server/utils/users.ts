import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto'

export interface UserPreferences {
  bookmarkedCountries: string[]
  bookmarkedGroups: string[]
  /** Watchlist email digest, sent by scripts/send_digests.py */
  emailDigest?: 'off' | 'daily' | 'weekly'
}

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  passwordHash: string
  salt: string
  role: 'admin' | 'user'
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  createdAt: string
  approvedAt?: string
  approvedBy?: string
  preferences?: UserPreferences
}

interface UsersData {
  siteMode: 'public' | 'restricted'
  sessionSecret: string
  disabledPages: string[]
  users: User[]
}

const DATA_DIR = process.env.WCG_SITE_DATA
  || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const DATA_PATH = join(DATA_DIR, 'users.json')

let cache: UsersData | null = null

function loadData(): UsersData {
  if (cache) return cache
  if (!existsSync(DATA_PATH)) {
    const initial: UsersData = {
      siteMode: 'restricted',
      sessionSecret: randomBytes(64).toString('hex'),
      disabledPages: [],
      users: [],
    }
    saveData(initial)
    return initial
  }
  try {
    const raw = readFileSync(DATA_PATH, 'utf-8')
    cache = JSON.parse(raw) as UsersData
    if (!cache!.disabledPages) cache!.disabledPages = []
    return cache!
  } catch {
    const initial: UsersData = {
      siteMode: 'restricted',
      sessionSecret: randomBytes(64).toString('hex'),
      disabledPages: [],
      users: [],
    }
    saveData(initial)
    return initial
  }
}

function saveData(data: UsersData): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 })
  cache = data
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(32).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

export function getUsers(): User[] {
  return loadData().users
}

export function getUserByUsername(username: string): User | undefined {
  return loadData().users.find((u) => u.username.toLowerCase() === username.toLowerCase())
}

export function getUserById(id: string): User | undefined {
  return loadData().users.find((u) => u.id === id)
}

export function addUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const data = loadData()
  const newUser: User = {
    ...user,
    id: randomBytes(16).toString('hex'),
    createdAt: new Date().toISOString(),
  }
  data.users.push(newUser)
  saveData(data)
  return newUser
}

export function updateUser(id: string, updates: Partial<User>): User | null {
  const data = loadData()
  const idx = data.users.findIndex((u) => u.id === id)
  if (idx === -1) return null
  data.users[idx] = { ...data.users[idx], ...updates }
  saveData(data)
  return data.users[idx]
}

export function deleteUser(id: string): boolean {
  const data = loadData()
  const idx = data.users.findIndex((u) => u.id === id)
  if (idx === -1) return false
  data.users.splice(idx, 1)
  saveData(data)
  return true
}

export function getSiteMode(): 'public' | 'restricted' {
  return loadData().siteMode
}

export function setSiteMode(mode: 'public' | 'restricted'): void {
  const data = loadData()
  data.siteMode = mode
  saveData(data)
}

export function getDisabledPages(): string[] {
  return loadData().disabledPages
}

export function setDisabledPages(pages: string[]): void {
  const data = loadData()
  data.disabledPages = pages
  saveData(data)
}

export function getSessionSecret(): string {
  return loadData().sessionSecret
}

export function getUserPreferences(id: string): UserPreferences {
  const user = getUserById(id)
  return user?.preferences ?? { bookmarkedCountries: [], bookmarkedGroups: [] }
}

export function updateUserPreferences(id: string, prefs: UserPreferences): UserPreferences | null {
  const data = loadData()
  const idx = data.users.findIndex((u) => u.id === id)
  if (idx === -1) return null
  data.users[idx].preferences = prefs
  saveData(data)
  return prefs
}

export function ensureAdminUser(): void {
  const data = loadData()
  const hasAdmin = data.users.some((u) => u.role === 'admin')
  if (hasAdmin) return

  // first start only: a password from the environment, or a random one printed once to the service log
  const initial = process.env.WCG_INITIAL_ADMIN_PASSWORD || randomBytes(12).toString('base64url')
  if (!process.env.WCG_INITIAL_ADMIN_PASSWORD) console.warn(`[users] created admin 'tomas' with one-time password: ${initial} (change it on the account page)`)
  const { hash, salt } = hashPassword(initial)
  const admin: User = {
    id: randomBytes(16).toString('hex'),
    username: 'tomas',
    displayName: 'Tomas',
    email: '',
    passwordHash: hash,
    salt,
    role: 'admin',
    status: 'approved',
    createdAt: new Date().toISOString(),
  }
  data.users.push(admin)
  saveData(data)
}

// Seed admin on module load
ensureAdminUser()
