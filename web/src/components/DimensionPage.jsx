import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from 'recharts'
import Header from './Header'
import { useLayout } from '../layoutContext'
import { MONTHS, PROVINCES, YEARS } from '../data/mockData'
import {
  DIMENSION_API,
  fetchAdmissionsPages,
  getShareTrend,
  getTopValues,
  mapRows,
} from '../api/admissions'

const BAR_COLORS = ['#000000', '#5e5e5e', '#000000', '#5e5e5e', '#d4d4d4']
const AXIS_TICK = { fontFamily: 'Inter', fontSize: 11, fill: '#5e5e5e' }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-sm bg-primary px-3 py-2 text-on-primary">
      {label && <p className="font-label-sm text-label-sm opacity-70">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey} className="font-data-mono text-data-mono">
          {entry.name}: {Number(entry.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

function StatusBanner({ loading, error, rowCount }) {
  if (loading) {
    return (
      <div className="border border-outline-variant bg-white px-4 py-3 font-body-md text-secondary">
        Loading live admissions data…
      </div>
    )
  }
  if (error) {
    return (
      <div className="border border-error bg-error-container/30 px-4 py-3 font-body-md text-error">
        Failed to load data: {error}
      </div>
    )
  }
  return (
    <div className="border border-outline-variant bg-white px-4 py-2 font-caption text-caption text-secondary">
      Showing {rowCount.toLocaleString()} rows from the live API
      {rowCount >= 1000 ? ' (paginated sample — refine filters for a full slice)' : ''}.
    </div>
  )
}

export default function DimensionPage({ dimension }) {
  const { openMenu } = useLayout()
  const apiMeta = DIMENSION_API[dimension.key]
  const [province, setProvince] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [applied, setApplied] = useState({ province: '', year: '', month: '' })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!apiMeta) {
      setError(`No API mapping for dimension "${dimension.key}"`)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const filters = {}
      if (applied.province) filters.province = applied.province
      if (applied.year !== '') filters.year = Number(applied.year)
      if (applied.month !== '') filters.month = Number(applied.month)

      // Unfiltered large marts: one page is enough for charts/table.
      // With filters: page a bit more so charts fill out.
      const maxPages = applied.province || applied.year || applied.month ? 5 : 1
      const raw = await fetchAdmissionsPages(apiMeta.endpoint, filters, {
        pageSize: 1000,
        maxPages,
      })
      setRows(mapRows(raw, apiMeta.valueField))
    } catch (err) {
      setRows([])
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [apiMeta, applied, dimension.key])

  useEffect(() => {
    load()
  }, [load])

  const topValues = useMemo(() => getTopValues(rows, 8), [rows])
  const trend = useMemo(() => getShareTrend(rows), [rows])
  const tableRows = useMemo(
    () => [...rows].sort((a, b) => b.admissions_count - a.admissions_count).slice(0, 12),
    [rows],
  )

  const applyFilters = () => {
    setApplied({ province, year, month })
  }

  return (
    <>
      <Header
        title={dimension.pageTitle}
        onMenuClick={openMenu}
        actions={
          <>
            <button type="button" className="material-symbols-outlined text-secondary transition-colors hover:text-primary">
              download
            </button>
            <button type="button" className="material-symbols-outlined text-secondary transition-colors hover:text-primary">
              share
            </button>
          </>
        }
      >
        <span className="font-body-md text-on-surface-variant">{dimension.valueLabel}</span>
        <span className="font-body-md text-on-surface-variant">Year</span>
        <span className="font-body-md text-on-surface-variant">Month</span>
      </Header>

      <div className="flex items-start gap-3 border-l-[3px] border-primary bg-surface-container-low px-gutter py-2 sm:items-center">
        <span className="material-symbols-outlined scale-75 text-primary">info</span>
        <p className="font-caption text-caption uppercase tracking-wider text-secondary">
          Note: values under 5 are suppressed to protect individual privacy. Totals may not match due to rounding.
        </p>
      </div>

      <main className="flex-1 space-y-stack_lg p-4 sm:p-container_padding">
        <section className="flex flex-col gap-stack_md border border-outline-variant bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="shrink-0 font-label-sm text-label-sm text-secondary">PROVINCE:</span>
            <select
              className="w-full border border-outline-variant bg-white px-3 py-1 text-sm focus:border-primary focus:ring-0 sm:w-auto"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">All Provinces</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="shrink-0 font-label-sm text-label-sm text-secondary">YEAR:</span>
            <select
              className="w-full border border-outline-variant bg-white px-3 py-1 text-sm focus:border-primary focus:ring-0 sm:w-auto"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="">All Years</option>
              {[...YEARS].reverse().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="shrink-0 font-label-sm text-label-sm text-secondary">MONTH:</span>
            <select
              className="w-full border border-outline-variant bg-white px-3 py-1 text-sm focus:border-primary focus:ring-0 sm:w-auto"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="">All Months</option>
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:ml-auto">
            <button
              type="button"
              onClick={applyFilters}
              className="w-full bg-primary px-4 py-2 font-label-sm text-label-sm text-on-primary transition-opacity hover:bg-primary/90 sm:w-auto sm:py-1"
            >
              Apply Filters
            </button>
          </div>
        </section>

        <StatusBanner loading={loading} error={error} rowCount={rows.length} />

        <section className="grid grid-cols-1 gap-stack_lg lg:grid-cols-12">
          <div className="border border-outline-variant bg-white p-4 sm:p-6 lg:col-span-7">
            <div className="mb-6 flex items-start justify-between">
              <h3 className="font-headline-sm text-headline-sm uppercase text-primary">
                Admissions by {dimension.valueLabel}
              </h3>
              <span className="material-symbols-outlined text-secondary">more_horiz</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topValues} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="#f5f5f5" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={AXIS_TICK}
                  axisLine={{ stroke: '#c4c7c7' }}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f5f5' }} />
                <Bar dataKey="total" name="Admissions" radius={0}>
                  {topValues.map((_, index) => (
                    <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col border border-outline-variant bg-white p-4 sm:p-6 lg:col-span-5">
            <h3 className="font-headline-sm text-headline-sm uppercase text-primary">
              {dimension.valueLabel} Share Trend
            </h3>
            <p className="mb-4 font-caption text-caption text-secondary">
              Percentage of total admissions over recent months (from loaded rows)
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend}>
                <CartesianGrid stroke="#f5f5f5" vertical={false} />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="share" name="Top value" stroke="#000000" strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  dataKey="nationalAvg"
                  name="National avg"
                  stroke="#5e5e5e"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 bg-primary" />
                <span className="font-label-sm text-label-sm">Top value</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 border border-secondary bg-white" />
                <span className="font-label-sm text-label-sm text-secondary">National Avg</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border border-outline-variant bg-white">
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 py-4 sm:px-6">
            <h3 className="font-headline-sm text-headline-sm uppercase text-primary">Detailed Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-white">
                  <th className="px-4 py-4 font-label-sm text-label-sm text-primary sm:px-6">PROVINCE</th>
                  <th className="px-4 py-4 font-label-sm text-label-sm text-primary sm:px-6">
                    {dimension.valueLabel.toUpperCase()}
                  </th>
                  <th className="px-4 py-4 font-label-sm text-label-sm text-primary sm:px-6">YEAR</th>
                  <th className="px-4 py-4 font-label-sm text-label-sm text-primary sm:px-6">MONTH</th>
                  <th className="px-4 py-4 text-right font-label-sm text-label-sm text-primary sm:px-6">ADMISSIONS</th>
                  <th className="px-4 py-4 text-center font-label-sm text-label-sm text-primary sm:px-6">SUPPRESSED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {!loading && tableRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center font-body-md text-secondary">
                      No rows for the current filters.
                    </td>
                  </tr>
                )}
                {tableRows.map((row, index) => (
                  <tr
                    key={`${row.province}-${row.dimension_value}-${row.year}-${row.month}-${index}`}
                    className={
                      index % 2 === 1
                        ? 'bg-surface-container-lowest transition-colors hover:bg-surface-container-low'
                        : 'transition-colors hover:bg-surface-container-low'
                    }
                  >
                    <td className="px-4 py-4 font-body-md sm:px-6">{row.province}</td>
                    <td className="px-4 py-4 font-body-md sm:px-6">{row.dimension_value}</td>
                    <td className="px-4 py-4 font-data-mono text-data-mono sm:px-6">{row.year}</td>
                    <td className="px-4 py-4 font-data-mono text-data-mono sm:px-6">{row.month}</td>
                    <td className="px-4 py-4 text-right font-data-mono text-data-mono sm:px-6">
                      {row.admissions_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-center sm:px-6">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          row.is_suppressed ? 'bg-outline-variant' : 'bg-primary'
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  )
}
