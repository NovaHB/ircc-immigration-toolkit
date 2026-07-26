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

function buildParams(filters = {}) {
  const params = new URLSearchParams()
  if (filters.province) params.set('province', filters.province)
  if (filters.year != null && filters.year !== '') params.set('year', String(filters.year))
  if (filters.month != null && filters.month !== '') params.set('month', String(filters.month))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.top_limit != null) params.set('top_limit', String(filters.top_limit))
  return params
}

async function apiGet(path, filters = {}) {
  if (!BASE_URL) throw new Error('Failed to load Data')
  const params = buildParams(filters)
  const qs = params.toString()
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`
  let res
  try {
    res = await fetch(url)
  } catch {
    throw new Error('Failed to load Data')
  }
  if (!res.ok) {
    throw new Error('Failed to load Data')
  }
  return res.json()
}

/**
 * Normalize a raw BigQuery/API row into the shape components already expect:
 * { province, dimension_value, year, month, admissions_count, is_suppressed }
 */
export function normalizeRow(row, valueField) {
  let dimensionValue = row[valueField]
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
 * Row-level page. sort=admissions returns highest admissions first (true tops
 * for the detailed table); sort=key is the deterministic pagination order.
 */
export async function fetchAdmissions(endpoint, filters = {}) {
  return apiGet(`/admissions/${endpoint}`, {
    limit: filters.limit ?? 1000,
    offset: filters.offset ?? 0,
    sort: filters.sort ?? 'key',
    province: filters.province,
    year: filters.year,
    month: filters.month,
  })
}

/**
 * True top-N dimension values from BigQuery GROUP BY … ORDER BY SUM DESC.
 * Not a partial first-page sample.
 */
export async function fetchTopValues(endpoint, filters = {}, limit = 10) {
  const rows = await apiGet(`/admissions/${endpoint}/top`, {
    province: filters.province,
    year: filters.year,
    month: filters.month,
    limit,
  })
  return (rows || []).map((r) => ({
    name: r.name ?? '—',
    total: Number(r.total) || 0,
  }))
}

/** Monthly share trend for the overall top dimension value (server-side). */
export async function fetchShareTrend(endpoint, filters = {}) {
  const rows = await apiGet(`/admissions/${endpoint}/trend`, {
    province: filters.province,
    year: filters.year,
    month: filters.month,
  })
  return rows || []
}

/** Distinct values + total admissions for current filters (server-side). */
export async function fetchSummary(endpoint, filters = {}) {
  return apiGet(`/admissions/${endpoint}/summary`, {
    province: filters.province,
    year: filters.year,
    month: filters.month,
  })
}

/**
 * Combined page load: { top, trend, summary, rows } in a single request,
 * replacing 4 separate fetchTopValues/fetchShareTrend/fetchSummary/
 * fetchAdmissions calls with one round trip.
 */
export async function fetchPage(endpoint, filters = {}, topLimit = 8) {
  return apiGet(`/admissions/${endpoint}/page`, {
    province: filters.province,
    year: filters.year,
    month: filters.month,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
    sort: filters.sort ?? 'admissions',
    top_limit: topLimit,
  })
}

/**
 * Page through an endpoint until a short page or maxPages is hit.
 * Used by Overview (category mart is only ~6.4k rows).
 */
export async function fetchAdmissionsPages(endpoint, filters = {}, { pageSize = 1000, maxPages = 15 } = {}) {
  const all = []
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchAdmissions(endpoint, {
      ...filters,
      limit: pageSize,
      offset: page * pageSize,
      sort: filters.sort ?? 'key',
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

// --- Client-side aggregations (Overview still pages the full category mart) ---

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
