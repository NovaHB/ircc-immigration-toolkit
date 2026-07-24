import { useMemo } from 'react'
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
import { generateDimensionRows, getTopValues, getTrendSeries } from '../data/mockData'

// Alternating black / gray / light-gray bars, matching the Stitch mock's
// hand-set per-bar shading (Ontario black, Quebec gray, BC black, ...).
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

// Shared template for every dimension route (category, citizenship,
// birth-country, occupation, age-group, gender, city-region). Each route
// passes its own `dimension` config from src/data/mockData.js; everything
// else here is identical across all 7 screens. `province` is not a
// dimension of its own — it's a shared field present on every mart and
// surfaced via the header filter instead.
export default function DimensionPage({ dimension }) {
  const rows = useMemo(() => generateDimensionRows(dimension), [dimension])
  const topValues = useMemo(() => getTopValues(rows), [rows])
  const trend = useMemo(() => getTrendSeries(dimension), [dimension])

  const tableRows = useMemo(
    () => [...rows].sort((a, b) => b.admissions_count - a.admissions_count).slice(0, 12),
    [rows],
  )

  return (
    <>
      <Header
        title={dimension.pageTitle}
        actions={
          <>
            <button className="material-symbols-outlined text-secondary transition-colors hover:text-primary">
              download
            </button>
            <button className="material-symbols-outlined text-secondary transition-colors hover:text-primary">
              share
            </button>
          </>
        }
      >
        <span className="font-body-md text-on-surface-variant">{dimension.valueLabel}</span>
        <span className="font-body-md text-on-surface-variant">Year</span>
        <span className="font-body-md text-on-surface-variant">Month</span>
      </Header>

      {/* Suppression Disclaimer Bar */}
      <div className="flex items-center gap-3 border-l-[3px] border-primary bg-surface-container-low px-gutter py-2">
        <span className="material-symbols-outlined scale-75 text-primary">info</span>
        <p className="font-caption text-caption uppercase tracking-wider text-secondary">
          Note: values under 5 are suppressed to protect individual privacy. Totals may not match due to rounding.
        </p>
      </div>

      <main className="flex-1 space-y-stack_lg p-container_padding">
        {/* Filters row */}
        <section className="flex flex-wrap items-center gap-stack_md border border-outline-variant bg-white p-4">
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-secondary">TIME PERIOD:</span>
            <select className="border border-outline-variant bg-white px-3 py-1 text-sm focus:border-primary focus:ring-0">
              <option>Annual (2025)</option>
              <option>Q1 2026</option>
              <option>Month over Month</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-secondary">
              {dimension.valueLabel.toUpperCase()}:
            </span>
            <select className="border border-outline-variant bg-white px-3 py-1 text-sm focus:border-primary focus:ring-0">
              <option>All {dimension.valueLabel}</option>
              {dimension.values.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto">
            <button className="bg-primary px-4 py-1 font-label-sm text-label-sm text-on-primary transition-opacity hover:bg-primary/90">
              Apply Filters
            </button>
          </div>
        </section>

        {/* 60/40 split: top values bar chart + share trend line chart */}
        <section className="grid grid-cols-12 gap-stack_lg">
          <div className="col-span-12 border border-outline-variant bg-white p-6 lg:col-span-7">
            <div className="mb-6 flex items-start justify-between">
              <h3 className="font-headline-sm text-headline-sm uppercase text-primary">
                Admissions by {dimension.valueLabel}
              </h3>
              <span className="material-symbols-outlined text-secondary">more_horiz</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topValues} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid stroke="#f5f5f5" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
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

          <div className="col-span-12 flex flex-col border border-outline-variant bg-white p-6 lg:col-span-5">
            <h3 className="font-headline-sm text-headline-sm uppercase text-primary">
              {dimension.valueLabel} Share Trend
            </h3>
            <p className="mb-4 font-caption text-caption text-secondary">
              Percentage of total admissions over 12 months
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
            <div className="mt-4 flex gap-4">
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

        {/* Data table — raw row shape, unmodified from the mock/API contract */}
        <section className="border border-outline-variant bg-white">
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-6 py-4">
            <h3 className="font-headline-sm text-headline-sm uppercase text-primary">Detailed Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
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
                    <td className="px-6 py-4 font-body-md">{row.dimension_value}</td>
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
