export const THEME_COLORS: Record<string, string> = {
  'Nuclear & Disarmament': 'bg-red-50 text-red-700',
  'Palestine & Middle East': 'bg-orange-50 text-orange-700',
  'Human Rights': 'bg-purple-50 text-purple-700',
  'Colonialism & Self-Determination': 'bg-yellow-50 text-yellow-700',
  'Economic Development': 'bg-blue-50 text-blue-700',
  'Environment & Sustainability': 'bg-emerald-50 text-emerald-700',
  'Refugees & Migration': 'bg-teal-50 text-teal-700',
  'Apartheid & South Africa': 'bg-rose-50 text-rose-700',
  'Peacekeeping & Security': 'bg-indigo-50 text-indigo-700',
  'International Law': 'bg-sky-50 text-sky-700',
  'Outer Space': 'bg-violet-50 text-violet-700',
  'Health & Social': 'bg-pink-50 text-pink-700',
  'Information & Cyber': 'bg-cyan-50 text-cyan-700',
  'LDCs, LLDCs & SIDS': 'bg-lime-50 text-lime-700',
  'Budget & Administration': 'bg-slate-100 text-slate-600',
  'Country-Specific Situations': 'bg-amber-50 text-amber-700',
  'Other': 'bg-gray-50 text-gray-500',
}

export const THEME_CARD_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  'Nuclear & Disarmament': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', accent: 'text-red-500' },
  'Palestine & Middle East': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', accent: 'text-orange-500' },
  'Human Rights': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', accent: 'text-purple-500' },
  'Colonialism & Self-Determination': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', accent: 'text-yellow-500' },
  'Economic Development': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', accent: 'text-blue-500' },
  'Environment & Sustainability': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', accent: 'text-emerald-500' },
  'Refugees & Migration': { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', accent: 'text-teal-500' },
  'Apartheid & South Africa': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', accent: 'text-rose-500' },
  'Peacekeeping & Security': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', accent: 'text-indigo-500' },
  'International Law': { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', accent: 'text-sky-500' },
  'Outer Space': { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', accent: 'text-violet-500' },
  'Health & Social': { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800', accent: 'text-pink-500' },
  'Information & Cyber': { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', accent: 'text-cyan-500' },
  'LDCs, LLDCs & SIDS': { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-800', accent: 'text-lime-500' },
  'Budget & Administration': { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', accent: 'text-slate-400' },
  'Country-Specific Situations': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', accent: 'text-amber-500' },
  'Other': { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', accent: 'text-gray-400' },
}

export function themeBadgeClass(theme: string): string {
  return THEME_COLORS[theme] || 'bg-gray-50 text-gray-500'
}
