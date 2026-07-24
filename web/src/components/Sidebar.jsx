import { NavLink } from 'react-router-dom'
import { DIMENSIONS } from '../data/mockData'

const navItemClass = ({ isActive }) =>
  [
    'flex items-center gap-3 px-6 py-3 font-label-sm text-label-sm transition-colors border-l-2',
    isActive
      ? 'text-on-primary border-on-primary bg-primary-container/10 opacity-100'
      : 'text-on-primary-container border-transparent hover:text-on-primary hover:bg-primary-container/5 opacity-70 hover:opacity-100',
  ].join(' ')

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-sidebar_width flex-col border-r border-outline-variant bg-primary py-stack_lg">
      <div className="mb-8 px-6">
        <div className="mb-2 flex items-center gap-3">
          <img className="h-10 w-10 object-contain invert" src="/logo.png" alt="Canada Immigration Toolkit" />
          <div>
            <h1 className="font-headline-sm text-headline-sm font-bold leading-tight text-on-primary">
              Immigration Toolkit
            </h1>
            <p className="font-label-sm text-label-sm text-on-primary/70">Express Entry Admissions Data</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto">
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
  )
}
