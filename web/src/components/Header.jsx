// Shared top app bar — Stitch mobile: 64px sticky bar with menu + title + meta/actions.
// Desktop keeps inline children (filter chips) to the right of the title.
export default function Header({
  title,
  meta = 'Data through April 2026',
  children,
  actions,
  onMenuClick,
  showMobileFilters = false,
}) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-outline-variant bg-surface">
      <div className="flex h-header_height w-full items-center justify-between px-4 sm:px-gutter">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          {onMenuClick && (
            <button
              type="button"
              className="material-symbols-outlined -ml-1 shrink-0 p-1 text-primary md:hidden"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              menu
            </button>
          )}
          <h2 className="truncate font-headline-sm text-headline-sm font-bold text-primary md:font-headline-md md:text-headline-md">
            {title}
          </h2>
          {children && (
            <>
              <div className="mx-2 hidden h-6 w-px bg-outline-variant lg:block" />
              <div className="hidden items-center gap-6 lg:flex">{children}</div>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <span className="hidden font-label-sm text-label-sm text-secondary sm:inline md:inline">{meta}</span>
          {actions}
        </div>
      </div>

      {/* Optional stacked controls row — used by DimensionPage filters on mobile */}
      {showMobileFilters && children && (
        <div className="space-y-2 border-t border-outline-variant px-4 py-3 lg:hidden">{children}</div>
      )}
    </header>
  )
}
