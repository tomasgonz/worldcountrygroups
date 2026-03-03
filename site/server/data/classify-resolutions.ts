/**
 * One-time script to classify UN resolutions by theme.
 * Run with: npx tsx site/server/data/classify-resolutions.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Import shared classification logic
import { THEME_RULES, COUNTRY_SITUATION_RE, ALL_THEMES, classify } from '../utils/classify'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = __dirname
const INPUT = join(DATA_DIR, 'un-votes-resolutions.json')
const OUTPUT = join(DATA_DIR, 'resolution-themes.json')

interface Resolution {
  id: string
  s: number
  d: string
  t: string
  v: Record<string, string>
}

// Main
const raw = JSON.parse(readFileSync(INPUT, 'utf-8'))
const resolutions: Resolution[] = raw.resolutions || []

const map: Record<string, string[]> = {}
const themeCounts: Record<string, number> = {}
for (const t of ALL_THEMES) themeCounts[t] = 0

for (const r of resolutions) {
  const themes = classify(r.t)
  map[r.id] = themes
  for (const t of themes) {
    themeCounts[t] = (themeCounts[t] || 0) + 1
  }
}

const output = {
  _meta: {
    generated_at: new Date().toISOString(),
    total_resolutions: resolutions.length,
    theme_counts: themeCounts,
  },
  themes: ALL_THEMES.filter(t => themeCounts[t] > 0),
  map,
}

writeFileSync(OUTPUT, JSON.stringify(output, null, 2))

console.log(`Classified ${resolutions.length} resolutions into ${output.themes.length} themes.`)
console.log('\nTheme distribution:')
for (const [theme, count] of Object.entries(themeCounts).sort((a, b) => b[1] - a[1])) {
  if (count > 0) {
    console.log(`  ${theme}: ${count} (${((count / resolutions.length) * 100).toFixed(1)}%)`)
  }
}
