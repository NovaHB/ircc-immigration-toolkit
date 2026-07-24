// Shared visual pieces for dimension-shaped pages (admissions DimensionPage
// and the candidates InvitationsPage tabs) so both stay pixel-identical.

export const AXIS_TICK = { fontFamily: 'Inter', fontSize: 11, fill: '#5e5e5e' }
export const BAR_FILLS = ['bg-primary', 'bg-secondary', 'bg-primary', 'bg-secondary', 'bg-outline']

export function ChartTooltip({ active, payload, label }) {
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
export function RankedBarList({ items, maxTotal }) {
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

/** Suppression disclaimer bar — same copy pattern reused verbatim across pages. */
export function SuppressionNotice({ noun = 'admissions' }) {
  return (
    <div className="flex items-start gap-3 border-l-[3px] border-primary bg-surface-container-low px-4 py-3 sm:px-gutter">
      <span className="material-symbols-outlined mt-0.5 text-[18px] text-primary">info</span>
      <p className="font-caption text-caption text-on-surface-variant">
        Values under a specific threshold (typically under 5 {noun}) are suppressed for privacy. Totals may not match
        due to rounding.
      </p>
    </div>
  )
}
