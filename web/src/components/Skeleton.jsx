/** Lightweight skeleton primitives + page-level placeholders (black/white/gray). */

export function Skeleton({ className = '' }) {
  return <div className={`skeleton-pulse rounded-sm bg-surface-container-high ${className}`} aria-hidden />
}

export function ErrorBanner({ message = 'Failed to load Data' }) {
  return (
    <div
      role="alert"
      className="border border-error bg-error-container/30 px-4 py-3 font-body-md text-error"
    >
      {message}
    </div>
  )
}

/** Overview dashboard loading state — mirrors stat cards + chart blocks. */
export function OverviewSkeleton() {
  return (
    <div className="space-y-stack_lg" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex flex-col gap-stack_sm md:grid md:grid-cols-4 md:gap-stack_md">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-outline-variant bg-white p-5">
            <Skeleton className="mb-3 h-3 w-28" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="mt-3 h-2 w-16" />
          </div>
        ))}
      </div>

      <div className="border border-outline-variant bg-white p-5 sm:p-stack_lg">
        <Skeleton className="mb-2 h-5 w-48" />
        <Skeleton className="mb-8 h-3 w-64" />
        <Skeleton className="h-[220px] w-full" />
      </div>

      <div className="flex flex-col gap-stack_md lg:grid lg:grid-cols-10">
        <div className="border border-outline-variant bg-white p-5 sm:p-stack_lg lg:col-span-6">
          <Skeleton className="mb-6 h-5 w-56" />
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="border border-outline-variant bg-white p-5 sm:p-stack_lg lg:col-span-4">
          <Skeleton className="mb-6 h-5 w-48" />
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Dimension page loading state — metrics, ranked list, trend, table. */
export function DimensionSkeleton() {
  return (
    <div className="space-y-stack_md sm:space-y-stack_lg" aria-busy="true" aria-label="Loading data">
      <div className="grid grid-cols-2 gap-3 md:hidden">
        <div className="border border-outline-variant bg-white p-4">
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="border border-outline-variant bg-white p-4">
          <Skeleton className="mb-2 h-3 w-28" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-stack_lg lg:grid-cols-12">
        <div className="border border-outline-variant bg-white p-4 sm:p-6 lg:col-span-7">
          <Skeleton className="mb-6 h-5 w-52" />
          <div className="space-y-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between gap-4">
                  <Skeleton className="h-4 w-2/3 max-w-xs" />
                  <Skeleton className="h-4 w-14" />
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="border border-outline-variant bg-white p-4 sm:p-6 lg:col-span-5">
          <Skeleton className="mb-2 h-5 w-40" />
          <Skeleton className="mb-6 h-3 w-56" />
          <Skeleton className="h-[220px] w-full" />
        </div>
      </div>

      <div className="border border-outline-variant bg-white">
        <div className="border-b border-outline-variant bg-surface-container-low px-4 py-4 sm:px-6">
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="divide-y divide-outline-variant">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 max-w-sm" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
