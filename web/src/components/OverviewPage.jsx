import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import Header from './Header'
import { useLayout } from '../layoutContext'
import { DIMENSIONS, PROVINCES, YEARS } from '../data/mockData'
import {
  DIMENSION_API,
  fetchAdmissionsPages,
  getTopCategoriesShare,
  getTopProvinces,
  getYearlyTotals,
  mapRows,
} from '../api/admissions'

const AXIS_TICK = { fontFamily: 'Inter', fontSize: 11, fill: '#5e5e5e' }
const BAR_COLORS = ['#000000', '#5e5e5e', '#000000', '#5e5e5e', '#d4d4d4']

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-sm bg-primary px-3 py-2 text-on-primary">
      {label && <p className="font-label-sm text-label-sm opacity-70">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey} className="font-data-mono text-data-mono">
          {formatter ? formatter(entry.value) : Number(entry.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function OverviewPage() {
  const { openMenu } = useLayout()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Category mart is the smallest full-history slice useful for national overview.
        // Page through all ~6.4k rows (7 × 1000).
        const raw = await fetchAdmissionsPages(DIMENSION_API.category.endpoint, {}, {
          pageSize: 1000,
          maxPages: 10,
        })
        if (!cancelled) {
          setRows(mapRows(raw, DIMENSION_API.category.valueField))
        }
      } catch (err) {
        if (!cancelled) {
          setRows([])
          setError(err.message || String(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const timeSeries = useMemo(() => getYearlyTotals(rows), [rows])
  const topProvinces = useMemo(() => getTopProvinces(rows, 4), [rows])
  const topCategories = useMemo(() => getTopCategoriesShare(rows, 5), [rows])
  const totalAdmissions = useMemo(
    () => rows.reduce((sum, r) => sum + r.admissions_count, 0),
    [rows],
  )

  const summary = {
    totalAdmissions,
    provincesTracked: PROVINCES.length,
    yearsOfData: YEARS.length,
    dimensionsAvailable: DIMENSIONS.length,
  }

  const statCards = [
    {
      label: 'Total Admissions',
      value: loading ? '…' : summary.totalAdmissions.toLocaleString(),
    },
    { label: 'Provinces Tracked', value: summary.provincesTracked },
    { label: 'Years of Data', value: summary.yearsOfData },
    { label: 'Dimensions Available', value: summary.dimensionsAvailable },
  ]

  return (
    <>
      <Header
        title="Overview"
        onMenuClick={openMenu}
        actions={
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined">download</span>
          </button>
        }
      >
        <span className="font-body-md text-on-surface-variant">All Provinces</span>
        <span className="font-body-md text-on-surface-variant">2015–2026</span>
        <span className="font-body-md text-on-surface-variant">All Months</span>
      </Header>

      <main className="flex-1 space-y-stack_lg p-4 sm:p-container_padding">
        <div className="border-l-[3px] border-primary bg-surface-container-low px-4 py-3">
          <p className="font-caption text-caption text-secondary">
            IRCC suppresses counts between 0 and 5 for privacy, shown here as 0. All other values are rounded to the
            nearest 5. Totals may not sum exactly. Overview aggregates are built from the immigration-category mart.
          </p>
        </div>

        {error && (
          <div className="border border-error bg-error-container/30 px-4 py-3 font-body-md text-error">
            Failed to load overview data: {error}
          </div>
        )}
        {loading && (
          <div className="border border-outline-variant bg-white px-4 py-3 font-body-md text-secondary">
            Loading live overview from BigQuery via Render…
          </div>
        )}

        <div className="grid grid-cols-1 gap-stack_md sm:grid-cols-2 md:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="custom-shadow rounded-lg border border-outline-variant bg-white p-5">
              <p className="mb-2 font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                {card.label}
              </p>
              <p className="font-headline-lg text-headline-lg font-bold text-primary">{card.value}</p>
            </div>
          ))}
        </div>

        <section className="custom-shadow rounded-lg border border-outline-variant bg-white p-4 sm:p-stack_lg">
          <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="mb-1 font-headline-sm text-headline-sm">Admissions Over Time (2015–2026)</h3>
              <p className="font-body-md text-secondary">Yearly trends in landed permanent residents.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeSeries} margin={{ left: 0, right: 8 }}>
              <CartesianGrid stroke="#f5f5f5" />
              <XAxis dataKey="year" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="admissions"
                name="Admissions"
                stroke="#0a0a0a"
                strokeWidth={2}
                fill="#f5f5f5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <div className="grid grid-cols-1 gap-stack_md lg:grid-cols-10">
          <section className="custom-shadow rounded-lg border border-outline-variant bg-white p-4 sm:p-stack_lg lg:col-span-6">
            <h3 className="mb-6 font-headline-sm text-headline-sm">Top Provinces by Admissions</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProvinces} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="#f5f5f5" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={AXIS_TICK}
                  axisLine={{ stroke: '#c4c7c7' }}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f5f5' }} />
                <Bar dataKey="total" name="Admissions" radius={0}>
                  {topProvinces.map((_, index) => (
                    <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="custom-shadow rounded-lg border border-outline-variant bg-white p-4 sm:p-stack_lg lg:col-span-4">
            <h3 className="mb-6 font-headline-sm text-headline-sm">Top Immigration Categories</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topCategories} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="#f5f5f5" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={AXIS_TICK}
                  axisLine={{ stroke: '#c4c7c7' }}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip formatter={(v) => `${Math.round(v)}%`} />} cursor={{ fill: '#f5f5f5' }} />
                <Bar dataKey="share" name="Share" fill="#000000" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>
      </main>
    </>
  )
}
