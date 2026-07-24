import { NavLink } from 'react-router-dom'
import { DIMENSIONS } from '../data/mockData'

const navItemClass = ({ isActive }) =>
  [
    'flex items-center gap-3 px-6 py-3 font-label-sm text-label-sm transition-colors border-l-2',
    isActive
      ? 'text-on-primary border-on-primary bg-primary-container/10 opacity-100'
      : 'text-on-primary-container border-transparent hover:text-on-primary hover:bg-primary-container/5 opacity-70 hover:opacity-100',
  ].join(' ')

export default function Sidebar({ open = false, onClose }) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={[
          'fixed left-0 top-0 z-50 flex h-screen w-sidebar_width flex-col border-r border-outline-variant bg-primary py-stack_lg transition-transform duration-200',
          // Desktop: always visible. Mobile: slide drawer.
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="mb-8 flex items-start justify-between gap-2 px-6">
          <div className="mb-2 flex items-center gap-3">
            <img className="h-10 w-10 object-contain invert" src="/logo.png" alt="Canada Immigration Toolkit" />
            <div>
              <h1 className="font-headline-sm text-headline-sm font-bold leading-tight text-on-primary">
                Immigration Toolkit
              </h1>
              <p className="font-label-sm text-label-sm text-on-primary/70">Express Entry Admissions Data</p>
            </div>
          </div>
          <button
            type="button"
            className="material-symbols-outlined text-on-primary md:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            close
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto" onClick={onClose}>
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
      </aside>
    </>
  )
}
