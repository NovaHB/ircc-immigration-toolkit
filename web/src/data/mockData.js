// Placeholder data only. Shape mirrors the dbt marts under
// ircc_pipeline/models/marts/ircc/mart_admissions_*.sql:
//   province_territory, <dimension column>, year, month, admissions_count, is_suppressed
// Every row exposed to components uses the generic field names
// { province, dimension_value, year, month, admissions_count, is_suppressed }
// so the real API response can be dropped in later without reshaping.

export const PROVINCES = [
  'Ontario',
  'Quebec',
  'British Columbia',
  'Alberta',
  'Manitoba',
  'Saskatchewan',
  'Nova Scotia',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Prince Edward Island',
  'Yukon',
  'Northwest Territories',
  'Nunavut',
]

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export const YEARS = Array.from({ length: 2026 - 2015 + 1 }, (_, i) => 2015 + i)

// One config entry per dbt mart -> one entry per DimensionPage route.
// `mart` is documented here only to trace back to the real model; it is
// not read by the UI.
export const DIMENSIONS = [
  {
    key: 'category',
    path: '/category',
    navLabel: 'By Category',
    pageTitle: 'By Category',
    icon: 'category',
    valueLabel: 'Immigration Category',
    mart: 'mart_admissions_immcat',
    values: [
      'Skilled Worker',
      'Experience Class',
      'Family Class',
      'Provincial Nominee',
      'Refugee / Humanitarian',
      'Caregivers',
      'Business / Investor',
    ],
  },
  {
    key: 'citizenship',
    path: '/citizenship',
    navLabel: 'By Citizenship',
    pageTitle: 'By Citizenship',
    icon: 'flag',
    valueLabel: 'Citizenship',
    mart: 'mart_admissions_citz',
    values: ['India', 'Philippines', 'China', 'Nigeria', 'France', 'United States', 'Pakistan', 'Iran'],
  },
  {
    key: 'birth-country',
    path: '/birth-country',
    navLabel: 'By Birth Country',
    pageTitle: 'By Birth Country',
    icon: 'public',
    valueLabel: 'Country of Birth',
    mart: 'mart_admissions_cob',
    values: ['India', 'Philippines', 'Nigeria', 'China', 'Vietnam', 'Iran', 'United Kingdom', 'Brazil'],
  },
  {
    key: 'occupation',
    path: '/occupation',
    navLabel: 'By Occupation',
    pageTitle: 'By Occupation',
    icon: 'work',
    valueLabel: 'Occupation (NOC)',
    mart: 'mart_admissions_occ',
    values: [
      'Software Engineers',
      'Registered Nurses',
      'Truck Drivers',
      'Financial Auditors',
      'Civil Engineers',
      'Retail Supervisors',
      'Elementary Teachers',
    ],
  },
  {
    key: 'age-group',
    path: '/age-group',
    navLabel: 'By Age Group',
    pageTitle: 'By Age Group',
    icon: 'cake',
    valueLabel: 'Age Group',
    mart: 'mart_admissions_agegroup',
    values: ['0-14', '15-24', '25-34', '35-44', '45-54', '55-64', '65+'],
  },
  {
    key: 'gender',
    path: '/gender',
    navLabel: 'By Gender',
    pageTitle: 'By Gender',
    icon: 'transgender',
    valueLabel: 'Gender',
    mart: 'mart_admissions_gender',
    values: ['Men', 'Women', 'Another Gender'],
  },
  {
    key: 'city-region',
    path: '/city-region',
    navLabel: 'By City / Region',
    pageTitle: 'By City / Region',
    icon: 'location_city',
    valueLabel: 'Census Subdivision',
    mart: 'mart_admissions_csd',
    values: ['Toronto', 'Montréal', 'Vancouver', 'Calgary', 'Edmonton', 'Winnipeg', 'Halifax'],
  },
]

// Deterministic PRNG (mulberry32) so mock numbers are stable across
// re-renders instead of jittering on every mount.
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromKey(key) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return h
}

// Generates raw rows in the exact backend shape for a given dimension,
// applying the same suppression rule as the dbt marts:
// case when is_suppressed then 0 else admissions_count end.
export function generateDimensionRows(dimension, rowCount = 60) {
  const rand = mulberry32(seedFromKey(dimension.key))
  const rows = []
  for (let i = 0; i < rowCount; i++) {
    const province = PROVINCES[Math.floor(rand() * PROVINCES.length)]
    const dimension_value = dimension.values[Math.floor(rand() * dimension.values.length)]
    const year = YEARS[YEARS.length - 1 - Math.floor(rand() * 3)] // last 3 years
    const month = MONTHS[Math.floor(rand() * MONTHS.length)]
    const rawCount = Math.floor(rand() * rand() * 40000)
    const is_suppressed = rawCount <= 5
    rows.push({
      province,
      dimension_value,
      year,
      month,
      admissions_count: is_suppressed ? 0 : rawCount,
      is_suppressed,
    })
  }
  return rows
}

// Aggregates rows -> total admissions per dimension_value, sorted desc.
export function getTopValues(rows, limit = 5) {
  const totals = new Map()
  for (const row of rows) {
    totals.set(row.dimension_value, (totals.get(row.dimension_value) || 0) + row.admissions_count)
  }
  return [...totals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

// Mock 24-month share-trend for the top value vs. a flat national average,
// used by the small trend line chart on each DimensionPage.
export function getTrendSeries(dimension) {
  const rand = mulberry32(seedFromKey(dimension.key + '-trend'))
  const points = []
  let value = 20 + rand() * 20
  for (let i = 0; i < 12; i++) {
    value += (rand() - 0.45) * 6
    value = Math.max(5, Math.min(90, value))
    points.push({
      month: MONTHS[i],
      share: Math.round(value * 10) / 10,
      nationalAvg: 18,
    })
  }
  return points
}

// Relative province weights so the Overview's "Top Provinces" chart shows
// a realistic Ontario-dominant skew instead of flat random noise.
const PROVINCE_WEIGHTS = {
  Ontario: 1,
  'British Columbia': 0.41,
  Quebec: 0.34,
  Alberta: 0.32,
  Manitoba: 0.12,
  Saskatchewan: 0.08,
  'Nova Scotia': 0.06,
  'New Brunswick': 0.04,
  'Newfoundland and Labrador': 0.02,
  'Prince Edward Island': 0.015,
  Yukon: 0.005,
  'Northwest Territories': 0.004,
  Nunavut: 0.002,
}

// Yearly national admissions trend, 2015-2026, for the Overview's
// full-width area/line chart.
export function getOverviewTimeSeries() {
  const rand = mulberry32(seedFromKey('overview-timeseries'))
  let value = 260000
  return YEARS.map((year) => {
    value += value * (0.06 + (rand() - 0.5) * 0.05)
    return { year: String(year), admissions: Math.round(value) }
  })
}

export function getOverviewSummary() {
  const totalAdmissions = getOverviewTimeSeries().reduce((sum, point) => sum + point.admissions, 0)
  return {
    totalAdmissions,
    provincesTracked: PROVINCES.length,
    yearsOfData: YEARS.length,
    dimensionsAvailable: DIMENSIONS.length,
  }
}

// Top provinces by total admissions (weighted mock, not derived from a
// specific dimension mart — the Overview aggregates across all of them).
export function getOverviewTopProvinces(limit = 4) {
  const rand = mulberry32(seedFromKey('overview-top-provinces'))
  const base = 1600000 + rand() * 200000
  return Object.entries(PROVINCE_WEIGHTS)
    .map(([name, weight]) => ({ name, total: Math.round(base * weight * (0.9 + rand() * 0.2)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

// Top immigration categories as a % share of total admissions, matching
// the category dimension's own value list (mart_admissions_immcat).
export function getOverviewTopCategories(limit = 5) {
  const categoryDimension = DIMENSIONS.find((d) => d.key === 'category')
  const rand = mulberry32(seedFromKey('overview-top-categories'))
  return categoryDimension.values
    .map((name, index) => ({ name, share: Math.max(15, 90 - index * 14 + (rand() - 0.5) * 8) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, limit)
}
