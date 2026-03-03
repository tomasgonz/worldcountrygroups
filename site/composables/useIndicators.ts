export interface IndicatorDef {
  key: string
  label: string
  valueKey: string
  pctKey?: string
  type: 'numeric' | 'text'
  aggregate?: 'sum' | 'average'
  format: (v: any) => string
}

export interface IndicatorCollection {
  id: string
  label: string
  indicators: string[]
}

export interface AggregateResult {
  value: number
  count: number
  total: number
}

const INDICATORS: IndicatorDef[] = [
  {
    key: 'gdp', label: 'GDP', valueKey: 'gdp', pctKey: 'gdpPct',
    type: 'numeric', aggregate: 'sum',
    format: (v) => {
      if (v == null) return '\u2014'
      if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T'
      if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B'
      if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M'
      if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K'
      return '$' + v.toLocaleString()
    },
  },
  {
    key: 'population', label: 'Population', valueKey: 'population', pctKey: 'populationPct',
    type: 'numeric', aggregate: 'sum',
    format: (v) => {
      if (v == null) return '\u2014'
      if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
      if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
      if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'
      return v.toLocaleString()
    },
  },
  {
    key: 'co2', label: 'CO2 Emissions', valueKey: 'co2', pctKey: 'co2Pct',
    type: 'numeric', aggregate: 'sum',
    format: (v) => {
      if (v == null) return '\u2014'
      if (v >= 1e3) return (v / 1e3).toFixed(1) + ' Gt'
      if (v >= 1) return v.toFixed(1) + ' Mt'
      return (v * 1e3).toFixed(0) + ' kt'
    },
  },
  {
    key: 'gdp_per_capita', label: 'GDP/capita', valueKey: 'gdp_per_capita',
    type: 'numeric', aggregate: 'average',
    format: (v) => {
      if (v == null) return '\u2014'
      if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K'
      return '$' + Math.round(v)
    },
  },
  {
    key: 'life_expectancy', label: 'Life Expectancy', valueKey: 'life_expectancy',
    type: 'numeric', aggregate: 'average',
    format: (v) => v != null ? v.toFixed(1) + 'y' : '\u2014',
  },
  {
    key: 'hdi', label: 'HDI', valueKey: 'hdi',
    type: 'numeric', aggregate: 'average',
    format: (v) => v != null ? v.toFixed(3) : '\u2014',
  },
  {
    key: 'area_km2', label: 'Area', valueKey: 'area_km2',
    type: 'numeric', aggregate: 'sum',
    format: (v) => {
      if (v == null) return '\u2014'
      if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M km\u00B2'
      if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K km\u00B2'
      return v.toLocaleString() + ' km\u00B2'
    },
  },
  {
    key: 'income_group', label: 'Income Group', valueKey: 'income_group',
    type: 'text',
    format: (v) => v ?? '\u2014',
  },
  {
    key: 'region', label: 'Region', valueKey: 'region',
    type: 'text',
    format: (v) => v ?? '\u2014',
  },
  {
    key: 'military_expenditure', label: 'Military Spending', valueKey: 'military_expenditure',
    type: 'numeric', aggregate: 'sum',
    format: (v) => {
      if (v == null) return '\u2014'
      if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T'
      if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B'
      if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M'
      return '$' + v.toLocaleString()
    },
  },
  {
    key: 'military_pct_gdp', label: 'Mil. % GDP', valueKey: 'military_pct_gdp',
    type: 'numeric', aggregate: 'average',
    format: (v) => v != null ? v.toFixed(1) + '%' : '\u2014',
  },
]

const COLLECTIONS: IndicatorCollection[] = [
  { id: 'overview', label: 'Overview', indicators: ['gdp', 'population', 'co2'] },
  { id: 'economic', label: 'Economic', indicators: ['gdp', 'gdp_per_capita', 'income_group'] },
  { id: 'development', label: 'Development', indicators: ['hdi', 'life_expectancy', 'gdp_per_capita'] },
  { id: 'geography', label: 'Geography', indicators: ['area_km2', 'population', 'region'] },
  { id: 'military', label: 'Military', indicators: ['military_expenditure', 'military_pct_gdp'] },
]

const indicatorMap = new Map(INDICATORS.map(i => [i.key, i]))

function computeAggregate(
  countries: any[],
  indicatorKey: string,
  method: 'sum' | 'average',
): AggregateResult | null {
  const values = countries
    .map(c => c[indicatorKey])
    .filter((v): v is number => v != null && typeof v === 'number')
  if (values.length === 0) return null
  const total = values.reduce((a, b) => a + b, 0)
  return {
    value: method === 'sum' ? total : total / values.length,
    count: values.length,
    total: countries.length,
  }
}

export function useIndicators() {
  return {
    indicators: INDICATORS,
    collections: COLLECTIONS,
    getIndicator: (key: string) => indicatorMap.get(key),
    getIndicators: (keys: string[]) => keys.map(k => indicatorMap.get(k)).filter(Boolean) as IndicatorDef[],
    computeAggregate,
  }
}
