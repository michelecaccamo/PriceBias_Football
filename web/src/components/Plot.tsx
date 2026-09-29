import { useEffect, useRef, useState } from 'react'
import { token, useMode } from '../theme'

// Plotly's option objects are large and loosely typed; we keep our own light aliases.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Layout = Record<string, any>
export type Data = Record<string, unknown>
type Config = Record<string, unknown>

// Loaded on first use so the ~1 MB charting library doesn't delay the first paint
interface PlotlyApi {
  react: (el: HTMLElement, data: Data[], layout: Partial<Layout>, config: Partial<Config>) => Promise<unknown>
  purge: (el: HTMLElement) => void
}
let plotlyPromise: Promise<PlotlyApi> | null = null
const loadPlotly = () =>
  (plotlyPromise ??= import('plotly.js-cartesian-dist-min').then((m) => ((m as { default?: unknown }).default ?? m) as PlotlyApi))

export function baseLayout(): Partial<Layout> {
  const ink2 = token('ink-2')
  const grid = token('grid')
  const axis = {
    gridcolor: grid,
    linecolor: token('axis'),
    zeroline: false,
    zerolinecolor: token('axis'),
    tickfont: { color: token('muted'), size: 11 },
    title: { font: { color: ink2, size: 12 } },
    automargin: true,
  }
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: ink2, size: 12 },
    margin: { l: 8, r: 8, t: 8, b: 8 },
    xaxis: axis,
    yaxis: axis,
    hoverlabel: {
      bgcolor: token('surface'),
      bordercolor: token('axis'),
      font: { color: token('ink'), size: 12 },
      align: 'left',
    },
    legend: { orientation: 'h', x: 0, y: 1.08, font: { color: ink2 } },
    showlegend: false,
  }
}

interface Props {
  data: Data[]
  layout?: (base: Partial<Layout>) => Partial<Layout>
  height?: number
  ariaLabel: string
}

export default function Plot({ data, layout, height = 380, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mode = useMode()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadPlotly()
      .then((Plotly) => {
        if (cancelled || !ref.current) return
        const base = baseLayout()
        const full = { ...base, height, ...(layout ? layout(base) : {}) }
        const config: Partial<Config> = { displayModeBar: false, responsive: true }
        return Plotly.react(ref.current, data, full, config)
      })
      .catch((e) => setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [data, layout, height, mode])

  useEffect(() => {
    const el = ref.current
    return () => {
      if (el) loadPlotly().then((P) => P.purge(el))
    }
  }, [])

  if (error) return <p className="text-sm text-critical">Chart failed to load: {error}</p>
  return <div ref={ref} role="img" aria-label={ariaLabel} style={{ minHeight: height }} />
}
