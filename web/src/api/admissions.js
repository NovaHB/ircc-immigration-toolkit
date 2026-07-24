// Live API client for the IRCC Immigration Toolkit backend.
// Base URL comes from VITE_API_BASE_URL (Render in prod, same host in local .env).

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

// Maps each UI dimension key -> FastAPI path segment + BigQuery column that holds
// the dimension value. province_territory is always the shared province filter field.
export const DIMENSION_API = {
  category: { endpoint: 'category', valueField: 'immigration_category' },
  gender: { endpoint: 'gender', valueField: 'gender' },
  citizenship: { endpoint: 'citizenship', valueField: 'country_of_citizenship' },
  'birth-country': { endpoint: 'birth-country', valueField: 'country_of_birth' },
  'age-group': { endpoint: 'age-group', valueField: 'age_group' },
  occupation: { endpoint: 'occupation', valueField: 'occupation_noc2011' },
  'city-region': { endpoint: 'census-subdivision', valueField: 'census_subdivision' },
}

export function getApiBaseUrl() {
  return BASE_URL
}

/**
 * Normalize a raw BigQuery/API row into the shape components already expect:
 * { province, dimension_value, year, month, admissions_count, is_suppressed }
 */
export function normalizeRow(row, valueField) {
  let dimensionValue = row[valueField]
  // City/region: show subdivision, fall back to division if empty
  if (valueField === 'census_subdivision') {
    dimensionValue = row.census_subdivision || row.census_division || '—'
  }
  return {
    province: row.province_territory ?? row.province ?? '—',
    dimension_value: dimensionValue ?? '—',
    year: Number(row.year),
    month: Number(row.month),
    admissions_count: Number(row.admissions_count) || 0,
    is_suppressed: Boolean(row.is_suppressed),
  }
}

/**
 * Fetch one page from an admissions endpoint.
 * @param {string} endpoint path segment after /admissions/
 * @param {{ province?: string, year?: number, month?: number, limit?: number, offset?: number }} filters
 */
export async function fetchAdmissions(endpoint, filters = {}) {
  if (!BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not set')
  }

  const params = new URLSearchParams()
  if (filters.province) params.set('province', filters.province)
  if (filters.year != null && filters.year !== '') params.set('year', String(filters.year))
  if (filters.month != null && filters.month !== '') params.set('month', String(filters.month))
  params.set('limit', String(filters.limit ?? 1000))
  params.set('offset', String(filters.offset ?? 0))

  const url = `${BASE_URL}/admissions/${endpoint}?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  return res.json()
}

/**
 * Page through an endpoint until a short page or maxPages is hit.
 * Default maxPages=15 keeps citizenship-scale marts bounded (~15k rows) for UI use.
 */
export async function fetchAdmissionsPages(endpoint, filters = {}, { pageSize = 1000, maxPages = 15 } = {}) {
  const all = []
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchAdmissions(endpoint, {
      ...filters,
      limit: pageSize,
      offset: page * pageSize,
    })
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < pageSize) break
  }
  return all
}

export function mapRows(rawRows, valueField) {
  return (rawRows || []).map((row) => normalizeRow(row, valueField))
}

// --- Aggregations used by Overview + Dimension charts (pure client-side) ---

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

export function getYearlyTotals(rows) {
  const byYear = new Map()
  for (const row of rows) {
    byYear.set(row.year, (byYear.get(row.year) || 0) + row.admissions_count)
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, admissions]) => ({ year: String(year), admissions }))
}

export function getTopProvinces(rows, limit = 4) {
  const totals = new Map()
  for (const row of rows) {
    totals.set(row.province, (totals.get(row.province) || 0) + row.admissions_count)
  }
  return [...totals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export function getTopCategoriesShare(rows, limit = 5) {
  const totals = new Map()
  let grand = 0
  for (const row of rows) {
    const v = row.admissions_count
    grand += v
    totals.set(row.dimension_value, (totals.get(row.dimension_value) || 0) + v)
  }
  if (grand === 0) return []
  return [...totals.entries()]
    .map(([name, total]) => ({ name, share: (total / grand) * 100 }))
    .sort((a, b) => b.share - a.share)
    .slice(0, limit)
}

/**
 * Monthly share of the top dimension value vs national average (all values).
 * Built from the last 12 distinct year-month buckets present in the rows.
 */
export function getShareTrend(rows) {
  if (!rows.length) return []

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // Identify top dimension value overall
  const valueTotals = new Map()
  for (const row of rows) {
    valueTotals.set(row.dimension_value, (valueTotals.get(row.dimension_value) || 0) + row.admissions_count)
  }
  const topValue = [...valueTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!topValue) return []

  // Bucket by year-month
  const buckets = new Map()
  for (const row of rows) {
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`
    if (!buckets.has(key)) {
      buckets.set(key, { year: row.year, month: row.month, total: 0, top: 0 })
    }
    const b = buckets.get(key)
    b.total += row.admissions_count
    if (row.dimension_value === topValue) b.top += row.admissions_count
  }

  const ordered = [...buckets.values()].sort((a, b) => a.year - b.year || a.month - b.month)
  const last12 = ordered.slice(-12)

  // National avg = mean share of top value across those months
  const shares = last12.map((b) => (b.total > 0 ? (b.top / b.total) * 100 : 0))
  const nationalAvg =
    shares.length > 0 ? shares.reduce((s, v) => s + v, 0) / shares.length : 0

  return last12.map((b, i) => ({
    month: monthNames[(b.month - 1) % 12] || String(b.month),
    share: Math.round(shares[i] * 10) / 10,
    nationalAvg: Math.round(nationalAvg * 10) / 10,
  }))
}
