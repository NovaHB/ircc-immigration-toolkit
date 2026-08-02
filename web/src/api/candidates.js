// Live API client for the Express Entry "Candidates (Invited)" marts.
// Base URL comes from VITE_API_BASE_URL, same convention as api/admissions.js.
// Candidates grain is annual (no month) and every mart also carries an
// invitation_category column, so the filter shape differs slightly from the
// admissions dimension pages this mirrors — otherwise same /top, /trend,
// /summary, and row-list sub-routes.

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

// Maps each tab key -> FastAPI path segment + BigQuery column holding the
// dimension value. invitation_category is the shared cross-filter field
// (and, on the invitation-category tab itself, the dimension being shown).
export const CANDIDATE_API = {
  'invitation-category': { endpoint: 'invitation-category', valueField: 'invitation_category' },
  'ita-score': { endpoint: 'ita-score', valueField: 'ita_score' },
  citizenship: { endpoint: 'citizenship', valueField: 'country_of_citizenship' },
  'field-of-study': { endpoint: 'field-of-study', valueField: 'field_of_study' },
  'first-language': { endpoint: 'first-language', valueField: 'first_official_language' },
  occupation: { endpoint: 'occupation', valueField: 'occupation_noc2011' },
}

function buildParams(filters = {}) {
  const params = new URLSearchParams()
  if (filters.province) params.set('province', filters.province)
  if (filters.year != null && filters.year !== '') params.set('year', String(filters.year))
  if (filters.invitation_category) params.set('invitation_category', filters.invitation_category)
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
 * Normalize a raw candidates row into the shape components expect:
 * { province, dimension_value, year, invitation_category, candidates_count, is_suppressed }
 */
export function normalizeRow(row, valueField) {
  return {
    province: row.province_territory ?? row.province ?? '—',
    dimension_value: row[valueField] ?? '—',
    year: Number(row.year),
    invitation_category: row.invitation_category ?? null,
    candidates_count: Number(row.candidates_count) || 0,
    is_suppressed: Boolean(row.is_suppressed),
  }
}

/**
 * True top-N dimension values from BigQuery GROUP BY … ORDER BY SUM DESC.
 * Not a partial first-page sample.
 */
export async function fetchTopValues(endpoint, filters = {}, limit = 10) {
  const rows = await apiGet(`/candidates/${endpoint}/top`, {
    province: filters.province,
    year: filters.year,
    invitation_category: filters.invitation_category,
    limit,
  })
  return (rows || []).map((r) => ({
    name: r.name ?? '—',
    total: Number(r.total) || 0,
  }))
}

/**
 * Combined page load: { top, trend, summary, rows } in a single request,
 * replacing 4 separate top/trend/summary/list calls with one round trip.
 */
export async function fetchPage(endpoint, filters = {}, topLimit = 8) {
  return apiGet(`/candidates/${endpoint}/page`, {
    province: filters.province,
    year: filters.year,
    invitation_category: filters.invitation_category,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
    sort: filters.sort ?? 'candidates',
    top_limit: topLimit,
  })
}

export function mapRows(rawRows, valueField) {
  return (rawRows || []).map((row) => normalizeRow(row, valueField))
}
