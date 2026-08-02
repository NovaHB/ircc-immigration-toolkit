import { useCallback, useEffect, useState } from 'react'
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, BarChart, Bar, Legend } from 'recharts'
import Header from './Header'
import { DimensionSkeleton, ErrorBanner } from './Skeleton'
import { AXIS_TICK, ChartTooltip, RankedBarList, SuppressionNotice } from './DimensionVisuals'
import { useLayout } from '../layoutContext'
import { PROVINCES, YEARS } from '../data/mockData'
import { CANDIDATE_API, fetchPage, fetchTopValues, mapRows } from '../api/candidates'
import { fetchTopValues as fetchAdmissionsTopValues } from '../api/admissions'

// One tab per candidates mart. valueLabel drives chart/table headings;
// only "occupation" exposes the extra invitation_category cross-filter.
const TABS = [
  { key: 'invitation-category', label: 'Invitation Category', valueLabel: 'Invitation Category' },
  { key: 'ita-score', label: 'ITA Score', valueLabel: 'ITA Score' },
  { key: 'citizenship', label: 'Citizenship', valueLabel: 'Citizenship' },
  { key: 'field-of-study', label: 'Field of Study', valueLabel: 'Field of Study' },
  { key: 'first-language', label: 'First Language', valueLabel: 'First Language' },
  { key: 'occupation', label: 'Occupation', valueLabel: 'Occupation (NOC)', hasInvitationFilter: true },
]

const OCCUPATION_CATEGORIES = ['CEC', 'FST', 'FSW', 'PNP']

// Normalizes the three different label sets used for "invitation category"
// across marts (full names on the invitation-category/citizenship marts,
// abbreviations on the occupation mart) to one shared code for comparisons.
const CATEGORY_CODE = {
  'Canadian Experience Class': 'CEC',
  'Federal Skilled Trades': 'FST',
  'Federal Skilled Worker': 'FSW',
  'Provincial Nominee Program': 'PNP',
  'Canadian Experience': 'CEC',
  'Skilled Trade': 'FST',
  'Skilled Worker': 'FSW',
  CEC: 'CEC',
  FST: 'FST',
  FSW: 'FSW',
  PNP: 'PNP',
}
const CATEGORY_ORDER = ['CEC', 'FSW', 'FST', 'PNP']

function TabRow({ tabs, active, onSelect }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-outline-variant bg-white px-2 sm:px-gutter" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onSelect(tab.key)}
          className={[
            'border-b-2 px-3 py-3 font-label-sm text-label-sm transition-colors sm:px-4',
            active === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary hover:text-primary',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/** Grouped bar chart comparing two totals-by-label series (Invited vs Admitted). */
function ComparisonChart({ data, loading }) {
  if (loading) {
    return <div className="skeleton-pulse h-[220px] w-full bg-surface-container-high" aria-hidden />
  }
  if (!data.length) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <p className="font-body-md text-secondary">No overlapping values for the current filters.</p>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#f5f5f5" vertical={false} />
        <XAxis dataKey="name" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
        <YAxis hide />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          wrapperStyle={{ fontFamily: 'Inter', fontSize: 11, color: '#5e5e5e' }}
          formatter={(value) => <span className="text-secondary">{value}</span>}
        />
        <Bar dataKey="invited" name="Invited" fill="#000000" />
        <Bar dataKey="admitted" name="Admitted" fill="#c4c7c7" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function InvitationsPage() {
  const { openMenu } = useLayout()
  const [activeTab, setActiveTab] = useState(TABS[0].key)
  const apiMeta = CANDIDATE_API[activeTab]
  const tabConfig = TABS.find((t) => t.key === activeTab)

  const [province, setProvince] = useState('')
  const [year, setYear] = useState('')
  const [invitationCategory, setInvitationCategory] = useState('')
  const [applied, setApplied] = useState({ province: '', year: '', invitationCategory: '' })
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [topValues, setTopValues] = useState([])
  const [trend, setTrend] = useState([])
  const [tableRows, setTableRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // isCancelled is checked before every state update so a slower, stale
  // request can't overwrite a newer one's results — same pattern
  // OverviewPage uses. Matters more here than on DimensionPage: switching
  // tabs re-triggers this effect too (apiMeta/tabConfig change with
  // activeTab), and tab clicks happen faster than most people re-apply
  // filters.
  const load = useCallback(async (isCancelled) => {
    if (!apiMeta) {
      if (!isCancelled()) {
        setError('Failed to load Data')
        setLoading(false)
      }
      return
    }
    setLoading(true)
    setError(null)
    try {
      const filters = {}
      if (applied.province) filters.province = applied.province
      if (applied.year !== '') filters.year = Number(applied.year)
      if (tabConfig?.hasInvitationFilter && applied.invitationCategory) {
        filters.invitation_category = applied.invitationCategory
      }

      // Single combined request: top + trend + summary + rows in one round trip.
      const page = await fetchPage(
        apiMeta.endpoint,
        { ...filters, limit: 50, offset: 0, sort: 'candidates' },
        8
      )
      if (!isCancelled()) {
        setTopValues(page.top)
        setTrend(page.trend)
        setSummary(page.summary)
        setTableRows(mapRows(page.rows, apiMeta.valueField).slice(0, 12))
      }
    } catch {
      if (!isCancelled()) {
        setTopValues([])
        setTrend([])
        setTableRows([])
        setSummary(null)
        setError('Failed to load Data')
      }
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [apiMeta, applied, tabConfig])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  // --- Fixed "Invited vs Admitted" comparison section (independent of the active tab) ---
  const [categoryComparison, setCategoryComparison] = useState([])
  const [citizenshipComparison, setCitizenshipComparison] = useState([])
  const [comparisonLoading, setComparisonLoading] = useState(true)

  const loadComparisons = useCallback(async (isCancelled) => {
    setComparisonLoading(true)
    const filters = {}
    if (applied.province) filters.province = applied.province
    if (applied.year !== '') filters.year = Number(applied.year)

    try {
      const [invitedByCategory, admittedByCategory, invitedByCitizenship, admittedByCitizenship] = await Promise.all([
        fetchTopValues('invitation-category', filters, 10),
        fetchAdmissionsTopValues('category', filters, 10),
        fetchTopValues('citizenship', filters, 20),
        fetchAdmissionsTopValues('citizenship', filters, 20),
      ])
      if (isCancelled()) return

      const categoryTotals = new Map()
      for (const { name, total } of invitedByCategory) {
        const code = CATEGORY_CODE[name]
        if (!code) continue
        const bucket = categoryTotals.get(code) || { invited: 0, admitted: 0 }
        bucket.invited += total
        categoryTotals.set(code, bucket)
      }
      for (const { name, total } of admittedByCategory) {
        const code = CATEGORY_CODE[name]
        if (!code) continue
        const bucket = categoryTotals.get(code) || { invited: 0, admitted: 0 }
        bucket.admitted += total
        categoryTotals.set(code, bucket)
      }
      setCategoryComparison(
        CATEGORY_ORDER.filter((code) => categoryTotals.has(code)).map((code) => ({
          name: code,
          ...categoryTotals.get(code),
        }))
      )

      const citizenshipTotals = new Map()
      for (const { name, total } of invitedByCitizenship) {
        const bucket = citizenshipTotals.get(name) || { invited: 0, admitted: 0 }
        bucket.invited = total
        citizenshipTotals.set(name, bucket)
      }
      for (const { name, total } of admittedByCitizenship) {
        const bucket = citizenshipTotals.get(name)
        if (!bucket) continue // only compare countries present on both sides
        bucket.admitted = total
      }
      setCitizenshipComparison(
        [...citizenshipTotals.entries()]
          .filter(([, v]) => v.admitted > 0)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.invited + b.admitted - (a.invited + a.admitted))
          .slice(0, 8)
      )
    } catch {
      if (!isCancelled()) {
        setCategoryComparison([])
        setCitizenshipComparison([])
      }
    } finally {
      if (!isCancelled()) setComparisonLoading(false)
    }
  }, [applied])

  useEffect(() => {
    let cancelled = false
    loadComparisons(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadComparisons])

  const maxTop = Math.max(...topValues.map((t) => t.total), 1)
  const uniqueValues = summary?.distinct_values ?? 0
  const totalCandidates = summary?.total_candidates ?? 0

  const applyFilters = () => {
    setApplied({ province, year, invitationCategory })
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
      {tabConfig?.hasInvitationFilter && (
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="shrink-0 font-label-sm text-label-sm text-secondary">INVITATION CATEGORY</span>
          <select
            className="w-full border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:ring-0 sm:w-auto sm:py-1"
            value={invitationCategory}
            onChange={(e) => setInvitationCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {OCCUPATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}
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
        title="By Invitation"
        meta="2026"
        onMenuClick={openMenu}
        actions={
          <button
            type="button"
            className="material-symbols-outlined text-primary md:hidden"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label="Toggle filters"
            aria-expanded={filtersOpen}
          >
            filter_list
          </button>
        }
      >
        <span className="hidden font-body-md text-on-surface-variant lg:inline">
          Express Entry invited candidates, prior to admission
        </span>
      </Header>

      <TabRow tabs={TABS} active={activeTab} onSelect={setActiveTab} />

      {filtersOpen && (
        <section className="space-y-3 border-b border-outline-variant bg-white px-4 py-4 md:hidden">
          {filterControls}
        </section>
      )}

      <SuppressionNotice noun="candidates" />

      <main className="flex-1 space-y-stack_md overflow-x-hidden p-4 sm:space-y-stack_lg sm:p-container_padding">
        <section className="hidden flex-wrap items-center gap-stack_md border border-outline-variant bg-white p-4 md:flex">
          {filterControls}
        </section>

        {error && <ErrorBanner message="Failed to load Data" />}

        {loading ? (
          <DimensionSkeleton />
        ) : (
          !error && (
            <>
              <section className="grid grid-cols-2 gap-3 md:hidden">
                <div className="border border-outline-variant bg-surface-container-lowest p-4">
                  <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                    Distinct values
                  </span>
                  <span className="font-headline-sm text-headline-sm font-bold text-primary">
                    {uniqueValues.toLocaleString()}
                  </span>
                </div>
                <div className="border border-outline-variant bg-surface-container-lowest p-4">
                  <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                    Total candidates
                  </span>
                  <span className="font-headline-sm text-headline-sm font-bold text-primary">
                    {totalCandidates.toLocaleString()}
                  </span>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-stack_lg lg:grid-cols-12">
                <div className="border border-outline-variant bg-white p-4 sm:p-6 lg:col-span-7">
                  <div className="mb-6 flex items-start justify-between gap-3">
                    <h3 className="font-headline-sm text-headline-sm uppercase text-primary">
                      Invited Candidates by {tabConfig.valueLabel}
                    </h3>
                    <span className="material-symbols-outlined shrink-0 text-secondary">bar_chart</span>
                  </div>
                  <RankedBarList items={topValues} maxTotal={maxTop} />
                </div>

                <div className="flex flex-col border border-outline-variant bg-white p-4 sm:p-6 lg:col-span-5">
                  <h3 className="font-headline-sm text-headline-sm uppercase text-primary">
                    {tabConfig.valueLabel} Share Trend
                  </h3>
                  <p className="mb-4 font-caption text-caption text-secondary">
                    Share of the #1 value vs average across recent years
                    {topValues[0] ? ` (top: ${topValues[0].name})` : ''}
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#f5f5f5" vertical={false} />
                      <XAxis dataKey="year" tick={AXIS_TICK} axisLine={{ stroke: '#c4c7c7' }} tickLine={false} />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="share" name="Top value" stroke="#000000" strokeWidth={2} dot={false} />
                      <Line
                        type="monotone"
                        dataKey="nationalAvg"
                        name="Period avg"
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

              <section className="border border-outline-variant bg-surface-container-lowest md:hidden">
                <div className="flex items-center justify-between border-b border-outline-variant p-4">
                  <h3 className="font-headline-sm text-headline-sm text-primary">Detailed Ledger</h3>
                  <span className="font-label-sm text-label-sm text-secondary">{applied.year || 'All years'}</span>
                </div>
                <div className="divide-y divide-outline-variant">
                  {tableRows.length === 0 && (
                    <div className="p-6 text-center font-body-md text-secondary">No rows for the current filters.</div>
                  )}
                  {tableRows.map((row, index) => (
                    <div
                      key={`${row.province}-${row.dimension_value}-${row.year}-${index}`}
                      className="flex flex-col gap-2 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex-1 pr-2 font-body-md font-bold leading-tight text-primary">
                          {row.dimension_value}
                        </span>
                        <span className="shrink-0 font-data-mono font-bold text-primary">
                          {row.candidates_count.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 font-label-sm text-label-sm text-secondary">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          {row.province}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                          {row.year}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            row.is_suppressed ? 'bg-surface-variant text-on-surface-variant' : 'bg-surface-container text-primary'
                          }`}
                        >
                          {row.is_suppressed ? 'Suppressed' : 'Reported'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

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
                          {tabConfig.valueLabel.toUpperCase()}
                        </th>
                        <th className="px-6 py-4 font-label-sm text-label-sm text-primary">YEAR</th>
                        {activeTab !== 'invitation-category' && (
                          <th className="px-6 py-4 font-label-sm text-label-sm text-primary">CATEGORY</th>
                        )}
                        <th className="px-6 py-4 text-right font-label-sm text-label-sm text-primary">CANDIDATES</th>
                        <th className="px-6 py-4 text-center font-label-sm text-label-sm text-primary">SUPPRESSED</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {tableRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center font-body-md text-secondary">
                            No rows for the current filters.
                          </td>
                        </tr>
                      )}
                      {tableRows.map((row, index) => (
                        <tr
                          key={`${row.province}-${row.dimension_value}-${row.year}-${index}`}
                          className={
                            index % 2 === 1
                              ? 'bg-surface-container-lowest transition-colors hover:bg-surface-container-low'
                              : 'transition-colors hover:bg-surface-container-low'
                          }
                        >
                          <td className="px-6 py-4 font-body-md">{row.province}</td>
                          <td className="max-w-md px-6 py-4 font-body-md leading-snug break-words">{row.dimension_value}</td>
                          <td className="px-6 py-4 font-data-mono text-data-mono">{row.year}</td>
                          {activeTab !== 'invitation-category' && (
                            <td className="px-6 py-4 font-body-md">{row.invitation_category ?? '—'}</td>
                          )}
                          <td className="px-6 py-4 text-right font-data-mono text-data-mono">
                            {row.candidates_count.toLocaleString()}
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
            </>
          )
        )}

        {/* Fixed comparison block — does not change when tabs switch. */}
        <section className="border border-outline-variant bg-white p-4 sm:p-6">
          <div className="mb-6">
            <h3 className="font-headline-sm text-headline-sm uppercase text-primary">Invited vs Admitted</h3>
            <p className="font-caption text-caption text-secondary">
              Express Entry invitations compared against confirmed admissions, same province/year filter. Only
              category and citizenship have a directly comparable admissions dimension.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-stack_lg lg:grid-cols-2">
            <div>
              <h4 className="mb-3 font-label-sm text-label-sm uppercase tracking-wider text-secondary">By Category</h4>
              <ComparisonChart data={categoryComparison} loading={comparisonLoading} />
            </div>
            <div>
              <h4 className="mb-3 font-label-sm text-label-sm uppercase tracking-wider text-secondary">By Citizenship</h4>
              <ComparisonChart data={citizenshipComparison} loading={comparisonLoading} />
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
