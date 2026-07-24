// Shared top app bar. Pages compose their own inline filter controls /
// action icons via children and actions, matching the way Stitch varied
// the bar's contents per screen while keeping the shell identical.
export default function Header({ title, meta = 'Data through April 2026', children, actions }) {
  return (
    <header className="sticky top-0 z-40 flex h-header_height w-full items-center justify-between border-b border-outline-variant bg-surface px-gutter">
      <div className="flex items-center gap-stack_md">
        <h2 className="font-headline-md text-headline-md font-bold text-primary">{title}</h2>
        {children && (
          <>
            <div className="mx-2 h-6 w-px bg-outline-variant" />
            <div className="hidden items-center gap-6 md:flex">{children}</div>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden font-label-sm text-label-sm text-secondary md:inline">{meta}</span>
        {actions}
      </div>
    </header>
  )
}
