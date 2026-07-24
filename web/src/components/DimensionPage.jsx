import { useCallback, useEffect, useState } from 'react'
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts'
import Header from './Header'
import { useLayout } from '../layoutContext'
import { MONTHS, PROVINCES, YEARS } from '../data/mockData'
import {
  DIMENSION_API,
  fetchAdmissions,
  fetchShareTrend,
  fetchSummary,
  fetchTopValues,
  mapRows,
} from '../api/admissions'

const AXIS_TICK = { fontFamily: 'Inter', fontSize: 11, fill: '#5e5e5e' }
const MONTH_NAMES = MONTHS
const BAR_FILLS = ['bg-primary', 'bg-secondary', 'bg-primary', 'bg-secondary', 'bg-outline']

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

/**
 * Ranked horizontal bars — avoids Recharts Y-axis clipping of the first label
 * and keeps long NOC / country names fully readable (wrap, not jam).
 */
function RankedBarList({ items, maxTotal }) {
  const max = maxTotal > 0 ? maxTotal : 1
  return (
    <div className="space-y-5">
      {items.map((item, index) => {
        const pct = Math.max(2, Math.round((item.total / max) * 100))
        return (
          <div key={`${item.name}-${index}`} className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="mr-2 inline-block w-5 shrink-0 font-label-sm text-label-sm text-secondary">
                  {index + 1}.
                </span>
                <span className="font-body-md text-body-md font-medium leading-snug text-primary break-words">
                  {item.name}
                </span>
              </div>
              <span className="shrink-0 pt-0.5 font-data-mono text-data-mono font-bold tabular-nums text-primary">
                {item.total.toLocaleString()}
              </span>
            </div>
            <div className="h-3 w-full bg-surface-container-highest">
              <div
                className={`h-full ${BAR_FILLS[index % BAR_FILLS.length]} transition-[width] duration-300`}
                style={{ width: `${pct}%` }}
                title={`${item.name}: ${item.total.toLocaleString()}`}
              />
            </div>
          </div>
        )
      })}
      {items.length === 0 && (
        <p className="font-body-md text-secondary">No values for the current filters.</p>
      )}
    </div>
  )
}

function StatusBanner({ loading, error, summary, tableCount }) {
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
  const total = summary?.total_admissions
  const distinct = summary?.distinct_values
  return (
    <div className="border border-outline-variant bg-white px-4 py-2 font-caption text-caption text-secondary">
      Charts use full-mart top ranks (ORDER BY total admissions). Table shows the top{' '}
      {tableCount.toLocaleString()} individual rows by admissions
      {total != null ? ` · mart total ${Number(total).toLocaleString()} admissions` : ''}
      {distinct != null ? ` · ${Number(distinct).toLocaleString()} distinct values` : ''}.
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [topValues, setTopValues] = useState([])
  const [trend, setTrend] = useState([])
  const [tableRows, setTableRows] = useState([])
  const [summary, setSummary] = useState(null)
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

      // Parallel: true top-N + trend + summary (full-mart SQL) and highest rows for table.
      const [tops, trendRows, summaryRow, detailRaw] = await Promise.all([
        fetchTopValues(apiMeta.endpoint, filters, 8),
        fetchShareTrend(apiMeta.endpoint, filters),
        fetchSummary(apiMeta.endpoint, filters),
        fetchAdmissions(apiMeta.endpoint, {
          ...filters,
          limit: 50,
          offset: 0,
          sort: 'admissions',
        }),
      ])
      setTopValues(tops)
      setTrend(trendRows)
      setSummary(summaryRow)
      setTableRows(mapRows(detailRaw, apiMeta.valueField).slice(0, 12))
    } catch (err) {
      setTopValues([])
      setTrend([])
      setTableRows([])
      setSummary(null)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [apiMeta, applied, dimension.key])

  useEffect(() => {
    load()
  }, [load])

  const uniqueValues = summary?.distinct_values ?? 0
  const totalAdmissions = summary?.total_admissions ?? 0
  const maxTop = Math.max(...topValues.map((t) => t.total), 1)

  const applyFilters = () => {
    setApplied({ province, year, month })
    setFiltersOpen(false)
  }

  const filterControls = (
    <>
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="shrink-0 font-label-sm text-label-sm text-secondary">PROVINCE</span>
        <select
          className="w-full border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:ring-0 sm:w-auto sm:py-1"
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
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="shrink-0 font-label-sm text-label-sm text-secondary">YEAR</span>
        <select
          className="w-full border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:ring-0 sm:w-auto sm:py-1"
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
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="shrink-0 font-label-sm text-label-sm text-secondary">MONTH</span>
        <select
          className="w-full border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:ring-0 sm:w-auto sm:py-1"
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
      <button
        type="button"
        onClick={applyFilters}
        className="w-full bg-primary px-4 py-2 font-label-sm text-label-sm text-on-primary transition-opacity hover:bg-primary/90 sm:ml-auto sm:w-auto sm:py-1"
      >
        Apply Filters
      </button>
    </>
  )

  return (
    <>
      <Header
        title={dimension.pageTitle}
        meta="2026"
        onMenuClick={openMenu}
        actions={
          <>
            <button
              type="button"
              className="material-symbols-outlined text-primary md:hidden"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-label="Toggle filters"
              aria-expanded={filtersOpen}
            >
              filter_list
            </button>
            <button type="button" className="material-symbols-outlined hidden text-secondary hover:text-primary md:inline">
              download
            </button>
            <button type="button" className="material-symbols-outlined hidden text-secondary hover:text-primary md:inline">
              share
            </button>
          </>
        }
      >
        <span className="hidden font-body-md text-on-surface-variant lg:inline">{dimension.valueLabel}</span>
        <span className="hidden font-body-md text-on-surface-variant lg:inline">Year</span>
        <span className="hidden font-body-md text-on-surface-variant lg:inline">Month</span>
      </Header>

      {/* Mobile filter sheet (Stitch: filter icon in header) */}
      {filtersOpen && (
        <section className="space-y-3 border-b border-outline-variant bg-white px-4 py-4 md:hidden">
          {filterControls}
        </section>
      )}

      <div className="flex items-start gap-3 border-l-[3px] border-primary bg-surface-container-low px-4 py-3 sm:px-gutter">
        <span className="material-symbols-outlined mt-0.5 text-[18px] text-primary">info</span>
        <p className="font-caption text-caption text-on-surface-variant">
          Values under a specific threshold (typically under 5 admissions) are suppressed for privacy. Totals may not
          match due to rounding.
        </p>
      </div>

      <main className="flex-1 space-y-stack_md overflow-x-hidden p-4 sm:space-y-stack_lg sm:p-container_padding">
        {/* Desktop filter bar */}
        <section className="hidden flex-wrap items-center gap-stack_md border border-outline-variant bg-white p-4 md:flex">
          {filterControls}
        </section>

        <StatusBanner
          loading={loading}
          error={error}
          summary={summary}
          tableCount={tableRows.length}
        />

        {/* Mobile metric tiles (Stitch category mobile) */}
        <section className="grid grid-cols-2 gap-3 md:hidden">
          <div className="border border-outline-variant bg-surface-container-lowest p-4">
            <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              Distinct values
            </span>
            <span className="font-headline-sm text-headline-sm font-bold text-primary">
              {loading ? '…' : uniqueValues.toLocaleString()}
            </span>
          </div>
          <div className="border border-outline-variant bg-surface-container-lowest p-4">
            <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              Total admissions
            </span>
            <span className="font-headline-sm text-headline-sm font-bold text-primary">
              {loading ? '…' : totalAdmissions.toLocaleString()}
            </span>
          </div>
        </section>

        {/* Top ranks + trend — list bars (not Recharts category axis) so #1 label
            and long NOC names stay fully visible on every breakpoint. */}
        <section className="grid grid-cols-1 gap-stack_lg lg:grid-cols-12">
          <div className="border border-outline-variant bg-white p-4 sm:p-6 lg:col-span-7">
            <div className="mb-6 flex items-start justify-between gap-3">
              <h3 className="font-headline-sm text-headline-sm uppercase text-primary">
                Admissions by {dimension.valueLabel}
              </h3>
              <span className="material-symbols-outlined shrink-0 text-secondary">bar_chart</span>
            </div>
            <RankedBarList items={topValues} maxTotal={maxTop} />
          </div>

          <div className="flex flex-col border border-outline-variant bg-white p-4 sm:p-6 lg:col-span-5">
            <h3 className="font-headline-sm text-headline-sm uppercase text-primary">
              {dimension.valueLabel} Share Trend
            </h3>
            <p className="mb-4 font-caption text-caption text-secondary">
              Share of the #1 value vs average across recent months
              {topValues[0] ? ` (top: ${topValues[0].name})` : ''}
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                <span className="font-label-sm text-label-sm">Top value share</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 border border-secondary bg-white" />
                <span className="font-label-sm text-label-sm text-secondary">Period average</span>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile ledger cards (Stitch) */}
        <section className="border border-outline-variant bg-surface-container-lowest md:hidden">
          <div className="flex items-center justify-between border-b border-outline-variant p-4">
            <h3 className="font-headline-sm text-headline-sm text-primary">Detailed Ledger</h3>
            <span className="font-label-sm text-label-sm text-secondary">
              {applied.year || 'All years'}
            </span>
          </div>
          <div className="divide-y divide-outline-variant">
            {!loading && tableRows.length === 0 && (
              <div className="p-6 text-center font-body-md text-secondary">No rows for the current filters.</div>
            )}
            {tableRows.map((row, index) => (
              <div key={`${row.province}-${row.dimension_value}-${row.year}-${row.month}-${index}`} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex-1 pr-2 font-body-md font-bold leading-tight text-primary">
                    {row.dimension_value}
                  </span>
                  <span className="shrink-0 font-data-mono font-bold text-primary">
                    {row.admissions_count.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 font-label-sm text-label-sm text-secondary">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    {row.province}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    {MONTH_NAMES[(row.month - 1) % 12] || row.month} {row.year}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      row.is_suppressed
                        ? 'bg-surface-variant text-on-surface-variant'
                        : 'bg-surface-container text-primary'
                    }`}
                  >
                    {row.is_suppressed ? 'Suppressed' : 'Reported'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Desktop table */}
        <section className="hidden border border-outline-variant bg-white md:block">
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-6 py-4">
            <h3 className="font-headline-sm text-headline-sm uppercase text-primary">Detailed Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-white">
                  <th className="px-6 py-4 font-label-sm text-label-sm text-primary">PROVINCE</th>
                  <th className="px-6 py-4 font-label-sm text-label-sm text-primary">
                    {dimension.valueLabel.toUpperCase()}
                  </th>
                  <th className="px-6 py-4 font-label-sm text-label-sm text-primary">YEAR</th>
                  <th className="px-6 py-4 font-label-sm text-label-sm text-primary">MONTH</th>
                  <th className="px-6 py-4 text-right font-label-sm text-label-sm text-primary">ADMISSIONS</th>
                  <th className="px-6 py-4 text-center font-label-sm text-label-sm text-primary">SUPPRESSED</th>
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
                    <td className="px-6 py-4 font-body-md">{row.province}</td>
                    <td className="max-w-md px-6 py-4 font-body-md leading-snug break-words">
                      {row.dimension_value}
                    </td>
                    <td className="px-6 py-4 font-data-mono text-data-mono">{row.year}</td>
                    <td className="px-6 py-4 font-data-mono text-data-mono">{row.month}</td>
                    <td className="px-6 py-4 text-right font-data-mono text-data-mono">
                      {row.admissions_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
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
