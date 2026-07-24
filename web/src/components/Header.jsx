// Shared top app bar. Pages compose their own inline filter controls /
// action icons via children and actions, matching the way Stitch varied
// the bar's contents per screen while keeping the shell identical.
export default function Header({ title, meta = 'Data through April 2026', children, actions, onMenuClick }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-outline-variant bg-surface">
      <div className="flex min-h-header_height w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-gutter sm:py-0">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-stack_md">
          {onMenuClick && (
            <button
              type="button"
              className="material-symbols-outlined shrink-0 text-primary md:hidden"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              menu
            </button>
          )}
          <h2 className="truncate font-headline-md text-headline-md font-bold text-primary sm:text-headline-md">
            {title}
          </h2>
          {children && (
            <>
              <div className="mx-2 hidden h-6 w-px bg-outline-variant lg:block" />
              <div className="hidden items-center gap-6 lg:flex">{children}</div>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <span className="hidden font-label-sm text-label-sm text-secondary md:inline">{meta}</span>
          {actions}
        </div>
      </div>
      {/* Stacked filter meta row on small screens (children only) */}
      {children && (
        <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant px-4 py-2 lg:hidden">
          {children}
        </div>
      )}
    </header>
  )
}
