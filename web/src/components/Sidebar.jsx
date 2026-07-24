import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { DIMENSIONS } from '../data/mockData'

// Matches Stitch mobile drawer (Overview/Category mobile HTML):
// fixed black 280px panel + dim overlay; desktop keeps permanent 260px rail.

const navItemClass = ({ isActive }) =>
  [
    'flex items-center gap-3 px-6 py-3 font-label-sm text-label-sm transition-colors border-l-2',
    isActive
      ? 'text-on-primary border-on-primary bg-primary-container/10 opacity-100'
      : 'text-on-primary-container border-transparent hover:text-on-primary hover:bg-primary-container/5 opacity-70 hover:opacity-100',
  ].join(' ')

export default function Sidebar({ open = false, onClose }) {
  // Lock body scroll while the mobile drawer is open (Stitch pattern).
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={[
          'fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-outline-variant bg-primary py-stack_lg transition-transform duration-300 ease-out md:w-sidebar_width',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        aria-label="Primary"
      >
        <div className="mb-8 flex items-start justify-between gap-2 px-6">
          <div className="flex items-center gap-3">
            <img className="h-10 w-10 object-contain invert" src="/logo.png" alt="" />
            <div>
              <h1 className="font-headline-sm text-headline-sm font-bold leading-tight text-on-primary">
                Immigration Toolkit
              </h1>
              <p className="font-label-sm text-[10px] uppercase tracking-widest text-on-primary/60">
                Express Entry Admissions
              </p>
            </div>
          </div>
          <button
            type="button"
            className="material-symbols-outlined -mr-1 p-1 text-on-primary md:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            close
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto" onClick={onClose}>
          <NavLink to="/" end className={navItemClass}>
            <span className="material-symbols-outlined">dashboard</span>
            <span>Overview</span>
          </NavLink>
          {DIMENSIONS.map((dimension) => (
            <NavLink key={dimension.key} to={dimension.path} className={navItemClass}>
              <span className="material-symbols-outlined">{dimension.icon}</span>
              <span>{dimension.navLabel}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-on-primary/10 px-6 pt-6 md:hidden">
          <p className="font-caption text-caption leading-relaxed text-on-primary/40">
            IRCC Data Attribution - 2026. This toolkit is for analytical purposes.
          </p>
        </div>
      </aside>
    </>
  )
}
