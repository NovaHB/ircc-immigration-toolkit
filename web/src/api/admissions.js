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

/** Distinct values + total admissions for current filters (server-side). */
export async function fetchSummary(endpoint, filters = {}) {
  return apiGet(`/admissions/${endpoint}/summary`, {
    province: filters.province,
    year: filters.year,
    month: filters.month,
  })
}

/**
 * Top 10 provinces by total admissions, all dimensions/years/months
 * combined — server-side GROUP BY, no filter params (Overview never filters).
 */
export async function fetchTopProvinces() {
  const rows = await apiGet('/admissions/top-provinces')
  return (rows || []).map((r) => ({ name: r.name ?? '—', total: Number(r.total) || 0 }))
}

/**
 * Full per-year admissions totals (2015-2026), all dimensions/provinces
 * combined — server-side GROUP BY, no filter params.
 */
export async function fetchYearlyTotals() {
  const rows = await apiGet('/admissions/yearly-totals')
  return (rows || []).map((r) => ({ year: String(r.year), admissions: Number(r.admissions) || 0 }))
}

/**
 * Combined page load: { top, trend, summary, rows } in a single request,
 * replacing 4 separate top/trend/summary/list calls with one round trip.
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

export function mapRows(rawRows, valueField) {
  return (rawRows || []).map((row) => normalizeRow(row, valueField))
}
