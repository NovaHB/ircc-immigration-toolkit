import { useMemo } from 'react'
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
import { getOverviewSummary, getOverviewTimeSeries, getOverviewTopProvinces, getOverviewTopCategories } from '../data/mockData'

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
  const summary = useMemo(() => getOverviewSummary(), [])
  const timeSeries = useMemo(() => getOverviewTimeSeries(), [])
  const topProvinces = useMemo(() => getOverviewTopProvinces(), [])
  const topCategories = useMemo(() => getOverviewTopCategories(), [])

  const statCards = [
    { label: 'Total Admissions', value: summary.totalAdmissions.toLocaleString() },
    { label: 'Provinces Tracked', value: summary.provincesTracked },
    { label: 'Years of Data', value: summary.yearsOfData },
    { label: 'Dimensions Available', value: summary.dimensionsAvailable },
  ]

  return (
    <>
      <Header
        title="Overview"
        actions={
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container transition-colors hover:bg-surface-container-high">
            <span className="material-symbols-outlined">download</span>
          </button>
        }
      >
        <button className="flex items-center gap-2 font-body-md text-on-surface-variant transition-colors hover:text-primary">
          All Provinces <span className="material-symbols-outlined text-sm">expand_more</span>
        </button>
        <button className="flex items-center gap-2 font-body-md text-on-surface-variant transition-colors hover:text-primary">
          2015-2026 <span className="material-symbols-outlined text-sm">expand_more</span>
        </button>
        <button className="flex items-center gap-2 font-body-md text-on-surface-variant transition-colors hover:text-primary">
          All Months <span className="material-symbols-outlined text-sm">expand_more</span>
        </button>
      </Header>

      <main className="flex-1 space-y-stack_lg p-container_padding">
        {/* Disclaimer Bar */}
        <div className="border-l-[3px] border-primary bg-surface-container-low px-4 py-3">
          <p className="font-caption text-caption text-secondary">
            IRCC suppresses counts between 0 and 5 for privacy, shown here as 0. All other values are rounded to the
            nearest 5. Totals may not sum exactly.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-stack_md md:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="custom-shadow rounded-lg border border-outline-variant bg-white p-5">
              <p className="mb-2 font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                {card.label}
              </p>
              <p className="font-headline-lg text-headline-lg font-bold text-primary">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Full-width time series */}
        <section className="custom-shadow rounded-lg border border-outline-variant bg-white p-stack_lg">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h3 className="mb-1 font-headline-sm text-headline-sm">Admissions Over Time (2015–2026)</h3>
              <p className="font-body-md text-secondary">Yearly trends in landed permanent residents.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeSeries} margin={{ left: 0, right: 8 }}>
              <CartesianGrid stroke="#f5f5f5" />
              <XAxis dataKey="year" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="admissions" name="Admissions" stroke="#0a0a0a" strokeWidth={2} fill="#f5f5f5" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        {/* Two column charts */}
        <div className="grid grid-cols-1 gap-stack_md lg:grid-cols-10">
          <section className="custom-shadow rounded-lg border border-outline-variant bg-white p-stack_lg lg:col-span-6">
            <h3 className="mb-6 font-headline-sm text-headline-sm">Top Provinces by Admissions</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProvinces} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid stroke="#f5f5f5" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
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
              <BarChart data={topCategories} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid stroke="#f5f5f5" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
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
