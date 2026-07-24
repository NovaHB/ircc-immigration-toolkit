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
import { ErrorBanner, OverviewSkeleton } from './Skeleton'
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

function MobileProgressList({ title, items, valueKey = 'total', format = 'number' }) {
  const max = Math.max(...items.map((i) => i[valueKey] || 0), 1)
  return (
    <section className="border border-outline-variant bg-surface-container-lowest p-5">
      <h3 className="mb-6 font-headline-sm text-headline-sm">{title}</h3>
      <div className="space-y-5">
        {items.map((item, index) => {
          const raw = item[valueKey] || 0
          const width = `${Math.max(4, Math.round((raw / max) * 100))}%`
          const fill = index === 0 ? 'bg-primary' : index === 1 ? 'bg-secondary' : 'bg-outline'
          return (
            <div key={item.name} className="space-y-2">
              <div className="flex justify-between gap-3 font-label-sm text-label-sm">
                <span className="truncate font-bold">{item.name}</span>
                <span className="shrink-0 font-data-mono">
                  {format === 'percent' ? `${Math.round(raw)}%` : raw.toLocaleString()}
                </span>
              </div>
              <div className="h-4 bg-surface-container">
                <div className={`h-full ${fill}`} style={{ width }} />
              </div>
            </div>
          )
        })}
        {items.length === 0 && (
          <p className="font-body-md text-secondary">No data available.</p>
        )}
      </div>
    </section>
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
        const raw = await fetchAdmissionsPages(DIMENSION_API.category.endpoint, {}, {
          pageSize: 1000,
          maxPages: 10,
        })
        if (!cancelled) setRows(mapRows(raw, DIMENSION_API.category.valueField))
      } catch {
        if (!cancelled) {
          setRows([])
          setError('Failed to load Data')
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
      value: summary.totalAdmissions.toLocaleString(),
      hint: 'All categories',
      bar: true,
    },
    {
      label: 'Provinces Tracked',
      value: summary.provincesTracked,
      hint: 'Coverage: 100%',
    },
    {
      label: 'Years of Data',
      value: summary.yearsOfData,
      hint: '2015 – 2026',
    },
    {
      label: 'Dimensions Available',
      value: summary.dimensionsAvailable,
      hint: 'Filterable sets',
    },
  ]

  return (
    <>
      <Header
        title="Overview"
        meta="2026 Data"
        onMenuClick={openMenu}
        actions={
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container transition-colors hover:bg-surface-container-high"
            aria-label="Download"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
          </button>
        }
      />

      <main className="flex-1 overflow-x-hidden p-4 sm:p-gutter md:p-container_padding">
        <div className="mb-stack_lg md:hidden">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-block bg-primary px-2 py-1 font-label-sm text-[10px] uppercase tracking-tighter text-on-primary">
              Live System
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Updated April 2026</span>
          </div>
          <h2 className="mb-2 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Admissions Overview
          </h2>
          <p className="font-body-md text-body-md leading-relaxed text-secondary">
            Aggregated performance metrics for Canada&apos;s Express Entry program across all primary dimensions.
          </p>
        </div>

        <div className="mb-stack_lg hidden border-l-[3px] border-primary bg-surface-container-low px-4 py-3 md:block">
          <p className="font-caption text-caption text-secondary">
            IRCC suppresses counts between 0 and 5 for privacy, shown here as 0. All other values are rounded to the
            nearest 5. Totals may not sum exactly.
          </p>
        </div>

        {error && (
          <div className="mb-stack_md">
            <ErrorBanner message="Failed to load Data" />
          </div>
        )}

        {loading ? (
          <OverviewSkeleton />
        ) : (
          !error && (
            <>
              <div className="mb-stack_lg flex flex-col gap-stack_sm md:grid md:grid-cols-4 md:gap-stack_md">
                {statCards.map((card) => (
                  <div
                    key={card.label}
                    className="border border-outline-variant bg-surface-container-lowest p-5 custom-shadow md:rounded-lg"
                  >
                    <p className="mb-1 font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                      {card.label}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-[32px] font-bold leading-none text-primary md:font-headline-lg md:text-headline-lg">
                        {card.value}
                      </span>
                    </div>
                    {card.hint && (
                      <p className="mt-1 font-data-mono text-[12px] text-secondary md:mt-2">{card.hint}</p>
                    )}
                    {card.bar && (
                      <div className="relative mt-4 h-[2px] w-full bg-surface-container-highest md:hidden">
                        <div className="absolute inset-y-0 left-0 w-3/4 bg-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <section className="mb-stack_lg border border-outline-variant bg-surface-container-lowest p-5 custom-shadow md:rounded-lg md:p-stack_lg">
                <div className="mb-6 flex items-center justify-between sm:mb-8">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm">Admissions Over Time</h3>
                    <p className="hidden font-body-md text-secondary md:block">
                      Yearly trends in landed permanent residents.
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-secondary">analytics</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={timeSeries} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#f5f5f5" />
                    <XAxis dataKey="year" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} width={56} />
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

              <div className="mb-stack_lg flex flex-col gap-stack_lg md:hidden">
                <MobileProgressList title="Top Provinces" items={topProvinces} valueKey="total" />
                <MobileProgressList title="Top Categories" items={topCategories} valueKey="share" format="percent" />
              </div>

              <div className="mb-stack_lg hidden grid-cols-1 gap-stack_md lg:grid lg:grid-cols-10">
                <section className="custom-shadow rounded-lg border border-outline-variant bg-white p-stack_lg lg:col-span-6">
                  <h3 className="mb-6 font-headline-sm text-headline-sm">Top Provinces by Admissions</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topProvinces} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid stroke="#f5f5f5" horizontal={false} />
                      <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={AXIS_TICK}
                        interval={0}
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

                <section className="custom-shadow rounded-lg border border-outline-variant bg-white p-stack_lg lg:col-span-4">
                  <h3 className="mb-6 font-headline-sm text-headline-sm">Top Immigration Categories</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topCategories} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid stroke="#f5f5f5" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={AXIS_TICK}
                        axisLine={{ stroke: '#c4c7c7' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={AXIS_TICK}
                        interval={0}
                        axisLine={{ stroke: '#c4c7c7' }}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip formatter={(v) => `${Math.round(v)}%`} />}
                        cursor={{ fill: '#f5f5f5' }}
                      />
                      <Bar dataKey="share" name="Share" fill="#000000" radius={0} />
                    </BarChart>
                  </ResponsiveContainer>
                </section>
              </div>

              <div className="border-l-[3px] border-primary bg-surface-container-low p-4 md:hidden">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-[18px] text-primary">info</span>
                  <p className="font-caption text-caption italic leading-relaxed text-on-surface-variant">
                    To prevent identifying individuals, values between 1 and 5 are suppressed. Aggregated totals may not
                    match the sum of individual dimensions due to rounding and suppression protocols.
                  </p>
                </div>
              </div>
            </>
          )
        )}
      </main>
    </>
  )
}
