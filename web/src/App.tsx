import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { DataContext, loadData, type Data } from './data'
import { ModeContext, useThemeState, type ThemeChoice } from './theme'
import { Toggle } from './components/ui'
import Verdict from './pages/Verdict'
import Clubs from './pages/Clubs'
import Expected from './pages/Expected'
import Transfers from './pages/Transfers'
import Compare from './pages/Compare'
import Methodology from './pages/Methodology'

const NAV = [
  { to: '/', label: 'Verdict' },
  { to: '/clubs', label: 'Clubs' },
  { to: '/expected', label: 'Fee vs expected' },
  { to: '/transfers', label: 'Transfers' },
  { to: '/compare', label: 'Compare' },
  { to: '/methodology', label: 'Methodology' },
]

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

function Shell({ data, error }: { data: Data | null; error: string | null }) {
  const { choice, setChoice, mode } = useThemeState()
  return (
    <ModeContext.Provider value={mode}>
      <div className="min-h-screen bg-page text-ink">
        <header className="sticky top-0 z-20 border-b border-line bg-page/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
            <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-6 w-6" />
              The Madrid Premium
            </NavLink>
            <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto text-sm" aria-label="Main">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1.5 whitespace-nowrap transition-colors ${
                      isActive ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:text-ink'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <Toggle<ThemeChoice>
              label="Colour theme"
              value={choice}
              onChange={setChoice}
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
        </header>

        {data?.summary.meta.is_demo && (
          <div className="border-b border-line bg-surface-2 px-4 py-2 text-center text-sm text-ink-2">
            <strong className="text-critical">Demo data.</strong> These numbers come from a synthetic dataset
            used for development, not from real transfers.
          </div>
        )}

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          {error ? (
            <p className="text-critical">Could not load the analysis data ({error}).</p>
          ) : !data ? (
            <p className="text-ink-2">Loading the analysis…</p>
          ) : (
            <DataContext.Provider value={data}>
              <Routes>
                <Route path="/" element={<Verdict />} />
                <Route path="/clubs" element={<Clubs />} />
                <Route path="/expected" element={<Expected />} />
                <Route path="/transfers" element={<Transfers />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/methodology" element={<Methodology />} />
              </Routes>
            </DataContext.Provider>
          )}
        </main>

        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted sm:px-6">
            Data:{' '}
            <a className="underline hover:text-ink" href="https://github.com/dcaribou/transfermarkt-datasets">
              transfermarkt-datasets
            </a>{' '}
            (Transfermarkt){data && <> · snapshot up to {data.summary.meta.data_snapshot}</>} · Code:{' '}
            <a className="underline hover:text-ink" href="https://github.com/michelecaccamo/PriceBias_Football">
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </ModeContext.Provider>
  )
}

export default function App() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadData().then(setData).catch((e) => setError(String(e.message ?? e)))
  }, [])
  return (
    <HashRouter>
      <ScrollToTop />
      <Shell data={data} error={error} />
    </HashRouter>
  )
}
