// Theme keyword definitions — order matters for priority
export const THEME_RULES: { theme: string; patterns: RegExp[] }[] = [
  {
    theme: 'Nuclear & Disarmament',
    patterns: [
      /\bnuclear\b/i,
      /\bdisarmament\b/i,
      /\bweapons?\s+(of\s+mass\s+)?destruct/i,
      /\barms\s+(race|control|trade|limitation)\b/i,
      /\bfissile\b/i,
      /\bmissile/i,
      /\bballistic\b/i,
      /\bchemical\s+weapon/i,
      /\bbiological\s+weapon/i,
      /\batomic\s+energy\b/i,
      /\bnon-proliferation\b/i,
      /\bcomprehensive.*test.*ban\b/i,
      /\blandmine/i,
      /\bcluster\s+munition/i,
      /\bconventional\s+arm/i,
      /\bsmall\s+arms\b/i,
      /\blight\s+weapons\b/i,
    ],
  },
  {
    theme: 'Palestine & Middle East',
    patterns: [
      /\bpalestin/i,
      /\bisrael/i,
      /\bjerusalem\b/i,
      /\bmiddle\s+east\b/i,
      /\bgolan\b/i,
      /\bwest\s+bank\b/i,
      /\bgaza\b/i,
      /\bunrwa\b/i,
      /\blebanese?\b.*\bterritories?\b/i,
      /\boccupied\s+(arab|syrian)\s+/i,
    ],
  },
  {
    theme: 'Human Rights',
    patterns: [
      /\bhuman\s+rights?\b/i,
      /\bright\s+to\s+(food|development|peace|self-determination|water|health|education)\b/i,
      /\brights?\s+of\s+the\s+child\b/i,
      /\btorture\b/i,
      /\bdiscrimination\b/i,
      /\bextrajudicial\b/i,
      /\bexecution/i,
      /\breligious\s+intolerance\b/i,
      /\bracism\b/i,
      /\bracial\b/i,
      /\bxenophob/i,
      /\bgenocid/i,
    ],
  },
  {
    theme: 'Colonialism & Self-Determination',
    patterns: [
      /\bself-determination\b/i,
      /\bdecoloniz/i,
      /\bnon-self-governing\b/i,
      /\bcolonial/i,
      /\btrusteeship\b/i,
      /\bindependence\b.*\b(territor|people|countr)/i,
      /\b(Western\s+Sahara|Gibraltar|Falkland|Malvinas|New\s+Caledonia|French\s+Polynesia|Guam|American\s+Samoa|Bermuda|Turks\s+and\s+Caicos|Cayman|Anguilla|Montserrat|Pitcairn|Tokelau|Saint\s+Helena|U\.S\.\s+Virgin)\b/i,
    ],
  },
  {
    theme: 'Economic Development',
    patterns: [
      /\beconomic\b.*\b(development|cooperation|order|growth)\b/i,
      /\bdevelopment\b.*\b(decade|strateg|cooperation|programme)\b/i,
      /\btrade\b.*\b(development|preferenc|barriers)\b/i,
      /\bdebt\b.*\b(crisis|relief|developing)\b/i,
      /\bglobalization\b/i,
      /\bpoverty\b/i,
      /\bnew\s+international\s+economic\s+order\b/i,
      /\bunctad\b/i,
      /\btechnology\s+transfer\b/i,
      /\bsouth-south\b/i,
    ],
  },
  {
    theme: 'LDCs, LLDCs & SIDS',
    patterns: [
      /\bleast\s+developed\s+countr/i,
      /\bland-?locked\s+developing\s+countr/i,
      /\bsmall\s+island\s+developing\s+state/i,
      /\bLDC/,
      /\bLLDC/,
      /\bSIDS\b/,
      /\bvulnerable\s+developing\s+countr/i,
      /\bspecial\s+needs\s+of\s+(least\s+developed|land-?locked|small\s+island)/i,
      /\bIstanbul\s+Programme\s+of\s+Action\b/i,
      /\bVienna\s+Programme\s+of\s+Action\b/i,
      /\bSAMOA\s+Pathway\b/i,
      /\bBarbados\s+Programme\s+of\s+Action\b/i,
      /\bAlmaty\s+Programme\s+of\s+Action\b/i,
    ],
  },
  {
    theme: 'Environment & Sustainability',
    patterns: [
      /\benvironment/i,
      /\bclimate\b/i,
      /\bsustainable\s+development\b/i,
      /\bbiodiversity\b/i,
      /\bdesertification\b/i,
      /\bozone\b/i,
      /\bglobal\s+warming\b/i,
      /\bnatural\s+disaster/i,
      /\btsunami\b/i,
      /\bchernobyl\b/i,
    ],
  },
  {
    theme: 'Refugees & Migration',
    patterns: [
      /\brefugee/i,
      /\bmigrant/i,
      /\basylum\b/i,
      /\bdisplaced\s+person/i,
      /\bunhcr\b/i,
      /\bhigh\s+commissioner\s+for\s+refugees\b/i,
    ],
  },
  {
    theme: 'Apartheid & South Africa',
    patterns: [
      /\bapartheid\b/i,
      /\bracist\s+reg/i,
      /\bnamibia\b/i,
      /\bsouth\s+africa\b/i,
      /\bsouth\s+west\s+africa\b/i,
    ],
  },
  {
    theme: 'Peacekeeping & Security',
    patterns: [
      /\bpeace-?keeping\b/i,
      /\bpeace\s+(and|&)\s+security\b/i,
      /\bsecurity\s+council\b/i,
      /\bconflict\b.*\b(prevention|resolution)\b/i,
      /\baggression\b/i,
      /\bterrorism\b/i,
      /\bterrorist\b/i,
      /\bpeaceful\s+(settlement|resolution)\b/i,
      /\buse\s+of\s+force\b/i,
      /\bnon-interference\b/i,
      /\bsovereignty\b/i,
    ],
  },
  {
    theme: 'International Law',
    patterns: [
      /\binternational\s+law\b/i,
      /\blaw\s+of\s+the\s+sea\b/i,
      /\binternational\s+court\b/i,
      /\binternational\s+criminal\b/i,
      /\btreaty\b/i,
      /\bconvention\b/i,
      /\binternational\s+law\s+commission\b/i,
      /\bcharter\s+of\s+the\s+united\s+nations\b/i,
      /\bjurisdictional\s+immunit/i,
      /\bstate\s+responsibility\b/i,
    ],
  },
  {
    theme: 'Outer Space',
    patterns: [
      /\bouter\s+space\b/i,
      /\bspace\s+activit/i,
      /\bsatellite/i,
      /\bgeostati?onary\b/i,
      /\bpeaceful\s+uses?\s+of\s+outer\s+space\b/i,
    ],
  },
  {
    theme: 'Health & Social',
    patterns: [
      /\bhealth\b/i,
      /\bdisease\b/i,
      /\bhiv\b/i,
      /\baids\b/i,
      /\bdrug\s+(abuse|control|trafficking)\b/i,
      /\bwomen\b/i,
      /\bgender\b/i,
      /\beducation\b/i,
      /\bliteracy\b/i,
      /\bageing\b/i,
      /\bdisabilit/i,
      /\bfamily\b/i,
      /\byouth\b/i,
      /\bsocial\s+development\b/i,
    ],
  },
  {
    theme: 'Information & Cyber',
    patterns: [
      /\binformation\s+(and|&)\s+communication/i,
      /\btelecommunication/i,
      /\bcyber/i,
      /\binternet\b/i,
      /\binformation\s+security\b/i,
      /\bnew\s+world\s+information/i,
    ],
  },
  {
    theme: 'Budget & Administration',
    patterns: [
      /\bbudget\b/i,
      /\bfinancial?\b.*\breport/i,
      /\bappropriation/i,
      /\bsecretariat\b/i,
      /\bsecretary-general\b.*\breport/i,
      /\bcredentials\b/i,
      /\bprocedur(e|al)\b.*\brule/i,
      /\bworking\s+capital\b/i,
      /\bscale\s+of\s+assessment/i,
      /\bstaff\s+(regulation|rule|composition)\b/i,
      /\brules?\s+of\s+procedure\b/i,
      /\badmission\s+of\s+new\s+member/i,
      /\belection\b.*\b(council|court|member)\b/i,
      /\bagenda\b.*\bitem/i,
      /\bgeneral\s+committee\b/i,
    ],
  },
]

// Country-specific situations pattern
export const COUNTRY_SITUATION_RE = /\b(situation|question)\s+(in|of|concerning)\s+/i

export const ALL_THEMES = [
  ...THEME_RULES.map(r => r.theme),
  'Country-Specific Situations',
  'Other',
]

export function classify(title: string): string[] {
  const themes: string[] = []

  for (const rule of THEME_RULES) {
    if (themes.length >= 2) break
    for (const pattern of rule.patterns) {
      if (pattern.test(title)) {
        themes.push(rule.theme)
        break
      }
    }
  }

  // Check for country-specific situations (but not if already classified into >=2)
  if (themes.length < 2 && COUNTRY_SITUATION_RE.test(title)) {
    // Only add if not already covered by Palestine/Middle East or Apartheid themes
    if (!themes.includes('Palestine & Middle East') && !themes.includes('Apartheid & South Africa')) {
      themes.push('Country-Specific Situations')
    }
  }

  if (themes.length === 0) {
    themes.push('Other')
  }

  return themes
}
