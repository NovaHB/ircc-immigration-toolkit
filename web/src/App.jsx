import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import OverviewPage from './components/OverviewPage'
import DimensionPage from './components/DimensionPage'
import InvitationsPage from './components/InvitationsPage'
import { DIMENSIONS } from './data/mockData'
import { LayoutProvider } from './layoutContext'

function Footer() {
  return (
    <footer className="mt-auto flex flex-col items-center justify-center gap-stack_sm border-t border-outline-variant bg-background px-4 py-stack_md text-center sm:px-gutter">
      <p className="font-caption text-caption text-secondary">
        IRCC Data Attribution - 2026. This toolkit is for analytical purposes and subject to the official project
        disclaimer.
      </p>
      <div className="flex flex-wrap justify-center gap-stack_md">
        <a className="font-label-sm text-label-sm text-secondary transition-colors hover:text-primary" href="#">
          Privacy Policy
        </a>
        <a className="font-label-sm text-label-sm text-secondary transition-colors hover:text-primary" href="#">
          Terms of Use
        </a>
        <a className="font-label-sm text-label-sm text-secondary transition-colors hover:text-primary" href="#">
          Methodology
        </a>
      </div>
    </footer>
  )
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <LayoutProvider openMenu={() => setMenuOpen(true)}>
      <div className="flex min-h-screen overflow-x-hidden">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col md:ml-sidebar_width">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            {DIMENSIONS.map((dimension) => (
              <Route
                key={dimension.key}
                path={dimension.path}
                element={<DimensionPage dimension={dimension} />}
              />
            ))}
            <Route path="/invitations" element={<InvitationsPage />} />
          </Routes>
          <Footer />
        </div>
      </div>
    </LayoutProvider>
  )
}
