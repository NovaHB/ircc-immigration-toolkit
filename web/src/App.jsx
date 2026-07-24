import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import OverviewPage from './components/OverviewPage'
import DimensionPage from './components/DimensionPage'
import { DIMENSIONS } from './data/mockData'

function Footer() {
  return (
    <footer className="mt-auto flex flex-col items-center justify-center gap-stack_sm border-t border-outline-variant bg-background px-gutter py-stack_md text-center">
      <p className="font-caption text-caption text-secondary">
        IRCC Data Attribution - 2026. This toolkit is for analytical purposes and subject to the official project
        disclaimer.
      </p>
      <div className="flex gap-stack_md">
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
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col ml-sidebar_width">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          {DIMENSIONS.map((dimension) => (
            <Route key={dimension.key} path={dimension.path} element={<DimensionPage dimension={dimension} />} />
          ))}
        </Routes>
        <Footer />
      </div>
    </div>
  )
}
