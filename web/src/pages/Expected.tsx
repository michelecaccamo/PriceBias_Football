import { useCallback, useMemo, useState } from 'react'
import { eur, premiumOf, seasonLabel, signedPct, TRACKED, useData, type Group, type Sale } from '../data'
import Plot, { type Data as PlotData, type Layout } from '../components/Plot'
import { Card, groupColor, PageHeader, Swatch, Toggle } from '../components/ui'
import { token, useMode } from '../theme'

type AcademyFilter = 'all' | 'first' | 'academy'
const EUR_TICKS = {
  tickvals: [1e5, 3e5, 1e6, 3e6, 1e7, 3e7, 1e8, 3e8],
  ticktext: ['€100k', '€300k', '€1m', '€3m', '€10m', '€30m', '€100m', '€300m'],
}
const POSITIONS = ['All', 'Goalkeeper', 'Defender', 'Midfield', 'Attack']

export default function Expected() {
  const { sales } = useData()
  const mode = useMode()
  const seasons = useMemo(() => [...new Set(sales.map((s) => s.season))].sort((a, b) => a - b), [sales])
  const [groups, setGroups] = useState<Group[]>(['Real Madrid', 'Barcelona'])
  const [academy, setAcademy] = useState<AcademyFilter>('all')
  const [position, setPosition] = useState('All')
  const [from, setFrom] = useState(seasons[0])
  const [to, setTo] = useState(seasons[seasons.length - 1])

  const rows = useMemo(
    () =>
      sales.filter(
        (s) =>
          s.expected_fee != null &&
          groups.includes(s.group) &&
          (academy === 'all' || (academy === 'academy' ? s.academy : !s.academy)) &&
          (position === 'All' || s.position === position) &&
          s.season >= from &&
          s.season <= to,
      ),
    [sales, groups, academy, position, from, to],
  )

  const data = useMemo((): PlotData[] => {
    const all = rows.flatMap((s) => [s.fee, s.expected_fee!])
    const lo = Math.min(...all, 1e6) / 1.5
    const hi = Math.max(...all, 1e7) * 1.5
    const diagonal: PlotData = {
      type: 'scatter',
      mode: 'lines',
      x: [lo, hi],
      y: [lo, hi],
      line: { color: token('axis'), width: 1.5 },
      hoverinfo: 'skip',
      name: 'Fee = expected',
    }
    // Draw other elite first so Real Madrid / Barça sit on top
    const order: Group[] = ['Other elite', 'Barcelona', 'Real Madrid']
    return [
      diagonal,
      ...order
        .filter((g) => groups.includes(g))
        .map((g) => {
          const d = rows.filter((s) => s.group === g)
          return {
            type: 'scatter',
            mode: 'markers',
            name: g,
            x: d.map((s) => s.expected_fee),
            y: d.map((s) => s.fee),
            marker: {
              color: groupColor(g),
              size: 9,
              opacity: g === 'Other elite' ? 0.55 : 0.9,
              line: { color: token('surface'), width: 1.5 },
            },
            customdata: d.map((s) => [
              s.player,
              s.from,
              s.to,
              seasonLabel(s.season),
              eur(s.fee),
              eur(s.expected_fee),
              signedPct(premiumOf(s)),
              eur(s.mv),
            ]),
            hovertemplate:
              '<b>%{customdata[0]}</b> · %{customdata[3]}<br>%{customdata[1]} → %{customdata[2]}' +
              '<br>Fee %{customdata[4]} · expected %{customdata[5]}<br>Premium <b>%{customdata[6]}</b>' +
              ' · market value %{customdata[7]}<extra></extra>',
          } as PlotData
        }),
    ]
  }, [rows, groups, mode])

  const layout = useCallback(
    (base: Partial<Layout>): Partial<Layout> => ({
      margin: { l: 8, r: 8, t: 8, b: 40 },
      xaxis: { ...base.xaxis, type: 'log', title: { text: 'Expected fee' }, ...EUR_TICKS },
      yaxis: { ...base.yaxis, type: 'log', title: { text: 'Actual fee' }, ...EUR_TICKS },
      annotations: [
        {
          xref: 'paper', yref: 'paper', x: 0.02, y: 0.98, showarrow: false, xanchor: 'left',
          text: 'Sold above expectation', font: { color: token('muted'), size: 12 },
        },
        {
          xref: 'paper', yref: 'paper', x: 0.98, y: 0.02, showarrow: false, xanchor: 'right',
          text: 'Sold below expectation', font: { color: token('muted'), size: 12 },
        },
      ],
    }),
    [],
  )

  const toggleGroup = (g: Group) =>
    setGroups((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]))

  const select = 'rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink'

  return (
    <>
      <PageHeader eyebrow="Fee vs. expected fee" title="Which sales beat the market?">
        Each dot is one sale. Its horizontal position is the fee a comparable player fetches when sold by
        other clubs; its vertical position is what was actually paid. Dots above the diagonal line were
        sold for more than expected.
      </PageHeader>

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Selling clubs">
            {TRACKED.map((g) => (
              <button
                key={g}
                aria-pressed={groups.includes(g)}
                onClick={() => toggleGroup(g)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${
                  groups.includes(g) ? 'border-ink/30 bg-surface-2 text-ink' : 'border-line text-muted'
                }`}
              >
                <span className={groups.includes(g) ? '' : 'opacity-30'}>
                  <Swatch group={g} />
                </span>
                {g}
              </button>
            ))}
          </div>
          <Toggle<AcademyFilter>
            label="Which sales"
            value={academy}
            onChange={setAcademy}
            options={[
              { value: 'all', label: 'All' },
              { value: 'first', label: 'First team' },
              { value: 'academy', label: 'Academy' },
            ]}
          />
          <select aria-label="Position" className={select} value={position} onChange={(e) => setPosition(e.target.value)}>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p === 'All' ? 'All positions' : p}
              </option>
            ))}
          </select>
          <span className="flex items-center gap-2 text-sm text-ink-2">
            <select aria-label="From season" className={select} value={from} onChange={(e) => setFrom(+e.target.value)}>
              {seasons.map((s) => (
                <option key={s} value={s} disabled={s > to}>
                  {seasonLabel(s)}
                </option>
              ))}
            </select>
            to
            <select aria-label="To season" className={select} value={to} onChange={(e) => setTo(+e.target.value)}>
              {seasons.map((s) => (
                <option key={s} value={s} disabled={s < from}>
                  {seasonLabel(s)}
                </option>
              ))}
            </select>
          </span>
        </div>

        <GroupMedians rows={rows} />
        <Plot data={data} layout={layout} height={520} ariaLabel="Actual fee against expected fee" />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Extremes title="Sold furthest above expectation" rows={rows} dir={-1} />
        <Extremes title="Sold furthest below expectation" rows={rows} dir={1} />
      </div>
    </>
  )
}

function GroupMedians({ rows }: { rows: Sale[] }) {
  const stats = TRACKED.map((g) => {
    const r = rows
      .filter((s) => s.group === g && s.residual != null)
      .map((s) => s.residual!)
      .sort((a, b) => a - b)
    if (!r.length) return null
    const m = r.length % 2 ? r[(r.length - 1) / 2] : (r[r.length / 2 - 1] + r[r.length / 2]) / 2
    return { g, n: r.length, median: Math.expm1(m) }
  }).filter(Boolean) as { g: Group; n: number; median: number }[]

  return (
    <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
      {stats.map((s) => (
        <div key={s.g} className="flex items-center gap-2">
          <Swatch group={s.g} />
          <dt className="text-ink-2">{s.g}</dt>
          <dd className="font-semibold text-ink tabular">
            median {signedPct(s.median)} <span className="font-normal text-muted">({s.n} sales)</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Extremes({ title, rows, dir }: { title: string; rows: Sale[]; dir: 1 | -1 }) {
  const top = [...rows]
    .filter((s) => s.residual != null)
    .sort((a, b) => dir * (a.residual! - b.residual!))
    .slice(0, 8)
  return (
    <Card title={title}>
      <ol className="divide-y divide-line">
        {top.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
            <Swatch group={s.group} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{s.player}</p>
              <p className="truncate text-xs text-muted">
                {s.from} → {s.to} · {seasonLabel(s.season)}
              </p>
            </div>
            <div className="text-right tabular">
              <p className="font-semibold text-ink">{signedPct(premiumOf(s))}</p>
              <p className="text-xs text-muted">
                {eur(s.fee)} vs {eur(s.expected_fee)}
              </p>
            </div>
          </li>
        ))}
        {!top.length && <li className="py-2 text-sm text-muted">No sales match these filters.</li>}
      </ol>
    </Card>
  )
}
