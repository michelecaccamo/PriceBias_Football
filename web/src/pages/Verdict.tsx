import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { pValue, signedPct, useData, type Premium } from '../data'
import Plot, { type Data as PlotData, type Layout } from '../components/Plot'
import { Card, PageHeader, StatTile } from '../components/ui'
import { token, useMode } from '../theme'

const HEADLINES = {
  supported: {
    title: 'Yes: Real Madrid sales carry a premium',
    body: 'After controlling for age, position, form, market value, buyer and season, Real Madrid sells players for significantly more than Barcelona does for comparable players.',
  },
  not_supported: {
    title: 'Not proven: no clear Madrid premium',
    body: 'Once comparable players are compared like for like, the gap between Real Madrid and Barcelona sale prices is not large enough to rule out chance.',
  },
  reversed: {
    title: 'No, if anything the reverse is true',
    body: 'After controlling for player characteristics, Barcelona actually sells comparable players for significantly more than Real Madrid.',
  },
  insufficient_data: {
    title: 'Not enough data yet',
    body: 'There are too few paid sales in the data to estimate the difference.',
  },
}

export default function Verdict() {
  const { summary } = useData()
  const v = summary.verdict
  const h = HEADLINES[v.status]
  const mv = summary.premiums.market_value
  const perm = summary.permutation_rm_vs_barca
  const rm = summary.groups.find((g) => g.group === 'Real Madrid')
  const fcb = summary.groups.find((g) => g.group === 'Barcelona')

  return (
    <>
      <PageHeader eyebrow="The question" title="Are Real Madrid players sold for more than they are worth?">
        A common complaint among Barça fans is that Real Madrid's name inflates the prices it gets for its players. This
        site tests that claim with {summary.meta.n_sales.toLocaleString()} paid transfers since the 2009/10 season,
        comparing Real Madrid with FC Barcelona and eleven other elite European clubs.
      </PageHeader>

      <section className="mb-6 grid gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Verdict</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{h.title}</h2>
          <p className="mt-3 leading-relaxed text-ink-2">{h.body}</p>
          <p className="mt-4 text-sm text-muted">
            Decision rule, fixed before looking at the results: the claim counts as supported only if the 95% confidence
            interval of the Real Madrid vs. Barcelona premium lies entirely above zero.
          </p>
        </div>
        {v.pct != null && (
          <div className="flex flex-col justify-center rounded-2xl bg-surface-2 p-6">
            <p className="text-sm text-ink-2">Real Madrid premium over comparable Barça sales</p>
            <p className="mt-1 text-6xl font-semibold tracking-tight">{signedPct(v.pct)}</p>
            <p className="mt-2 text-sm text-ink-2">
              95% CI {signedPct(v.ci_low)} to {signedPct(v.ci_high)} · {pValue(v.p_value)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Based on {v.n_a} Real Madrid and {v.n_b} Barcelona sales, academy included
            </p>
          </div>
        )}
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Real Madrid sales"
          value={rm?.n ?? '–'}
          note={`${rm?.n_academy ?? 0} from Castilla / youth teams`}
        />
        <StatTile
          label="Barcelona sales"
          value={fcb?.n ?? '–'}
          note={`${fcb?.n_academy ?? 0} from Barça Atlètic / youth teams`}
        />
        <StatTile
          label="Real Madrid vs. other elite clubs"
          value={signedPct(mv.rm_vs_elite?.pct)}
          note={
            mv.rm_vs_elite
              ? `95% CI ${signedPct(mv.rm_vs_elite.ci_low)} to ${signedPct(mv.rm_vs_elite.ci_high)}`
              : undefined
          }
        />
        <StatTile
          label="Shuffle test (RM vs. Barça)"
          value={pValue(perm.p_value)}
          note="How often randomly relabelled sales show a gap this large"
        />
      </div>

      <Context />

      <Card
        title="Does the answer survive other ways of slicing the data?"
        subtitle="Each row re-estimates the premium on a different sample or model. Bars are 95% confidence intervals; if a bar crosses zero, that estimate cannot rule out 'no difference'."
      >
        <Robustness />
      </Card>

      <p className="mt-8 text-sm text-ink-2">
        Next: see{' '}
        <Link className="text-accent underline" to="/clubs">
          how every elite club compares
        </Link>
        , or explore{' '}
        <Link className="text-accent underline" to="/transfers">
          individual transfers
        </Link>
        .
      </p>
    </>
  )
}

const significant = (p?: Premium) => (p ? p.ci_low > 0 || p.ci_high < 0 : false)

/** Is the gap about Madrid selling high, or Barcelona selling low? Compare both with the elite. */
function Context() {
  const { summary } = useData()
  const { rm_vs_elite: rm, barca_vs_elite: fcb } = summary.premiums.market_value
  if (!rm || !fcb) return null

  let reading: string
  if (!significant(rm) && fcb.ci_high < 0)
    reading =
      'Real Madrid sells roughly in line with the other elite clubs, while Barcelona sells below them. The gap between the two is therefore mostly about Barcelona selling cheaply, not Madrid selling dear.'
  else if (rm.ci_low > 0 && !significant(fcb))
    reading =
      'Real Madrid also sells above the other elite clubs, while Barcelona is in line with them. That points to a genuine Madrid premium.'
  else if (rm.ci_low > 0 && fcb.ci_high < 0)
    reading = 'Both effects are present: Madrid sells above the elite average and Barcelona below it.'
  else if (!significant(rm) && !significant(fcb))
    reading =
      'Neither club is clearly different from the other elite sellers on its own; the gap between them only shows up when the two are compared directly.'
  else reading = 'The comparison with the other elite clubs does not point clearly in one direction.'

  const rows: { label: string; p: Premium; color: string }[] = [
    { label: 'Real Madrid vs. other elite', p: rm, color: 'rm' },
    { label: 'Barcelona vs. other elite', p: fcb, color: 'fcb' },
  ]
  // Shared scale so the two intervals can be compared by eye
  const lo = Math.min(-0.5, ...rows.map((r) => r.p.ci_low))
  const hi = Math.max(0.5, ...rows.map((r) => r.p.ci_high))
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100

  return (
    <Card
      className="mb-6"
      title="Is it Madrid selling high, or Barça selling low?"
      subtitle="Both clubs measured against the eleven other elite sellers, like for like."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="space-y-5">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-ink-2">{r.label}</span>
                <span className="font-semibold text-ink tabular">
                  {signedPct(r.p.pct)}{' '}
                  <span className="font-normal text-muted">
                    ({signedPct(r.p.ci_low)} to {signedPct(r.p.ci_high)})
                  </span>
                </span>
              </div>
              <div className="relative h-4" aria-hidden>
                <div className="absolute top-1/2 h-px w-full bg-grid" />
                <div className="absolute top-0 h-full w-px bg-muted" style={{ left: `${x(0)}%` }} />
                <div
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${x(r.p.ci_low)}%`,
                    width: `${x(r.p.ci_high) - x(r.p.ci_low)}%`,
                    background: `var(--${r.color})`,
                  }}
                />
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                  style={{ left: `${x(r.p.pct)}%`, background: `var(--${r.color})` }}
                />
              </div>
            </div>
          ))}
          <div className="flex justify-between text-xs text-muted tabular" aria-hidden>
            <span>{signedPct(lo)}</span>
            <span>0 = same as elite</span>
            <span>{signedPct(hi)}</span>
          </div>
        </div>
        <p className="leading-relaxed text-ink">{reading}</p>
      </div>
    </Card>
  )
}

// Colour follows the comparison club: blue = vs Barça, aqua = vs other elite
const SERIES: { key: 'rm_vs_barca' | 'rm_vs_elite'; name: string; color: string; offset: number }[] = [
  { key: 'rm_vs_barca', name: 'Real Madrid vs. Barcelona', color: 'fcb', offset: 0.17 },
  { key: 'rm_vs_elite', name: 'Real Madrid vs. other elite', color: 'elite', offset: -0.17 },
]

function Robustness() {
  const { summary } = useData()
  const rows = summary.robustness
  const mode = useMode()
  const data = useMemo((): PlotData[] => {
    return SERIES.map((s) => {
      const pts = rows.map((r, i) => ({ r, i, p: r[s.key] as Premium | undefined })).filter((d) => d.p)
      return {
        type: 'scatter',
        mode: 'markers',
        name: s.name,
        x: pts.map((d) => d.p!.pct * 100),
        y: pts.map((d) => rows.length - 1 - d.i + s.offset),
        error_x: {
          type: 'data',
          symmetric: false,
          array: pts.map((d) => (d.p!.ci_high - d.p!.pct) * 100),
          arrayminus: pts.map((d) => (d.p!.pct - d.p!.ci_low) * 100),
          color: token(s.color),
          thickness: 2,
          width: 0,
        },
        marker: { color: token(s.color), size: 9, line: { color: token('surface'), width: 2 } },
        customdata: pts.map((d) => [d.r.label, signedPct(d.p!.ci_low), signedPct(d.p!.ci_high), d.p!.n_a, d.p!.n_b]),
        hovertemplate:
          `<b>%{customdata[0]}</b><br>${s.name}: %{x:+.0f}%<br>95% CI %{customdata[1]} to %{customdata[2]}` +
          '<br>n = %{customdata[3]} vs %{customdata[4]}<extra></extra>',
      } as PlotData
    })
  }, [rows, mode])

  const layout = useCallback(
    (base: Partial<Layout>): Partial<Layout> => ({
      margin: { l: 8, r: 16, t: 8, b: 40 },
      xaxis: {
        ...base.xaxis,
        title: { ...base.xaxis?.title, text: 'Fee premium (%)' },
        ticksuffix: '%',
        zeroline: true,
        zerolinewidth: 1.5,
      },
      // Row labels sit above each pair of intervals so they never squeeze the plot on phones
      yaxis: { ...base.yaxis, showticklabels: false, showgrid: false, range: [-0.5, rows.length - 0.1] },
      annotations: rows.map((r, i) => ({
        xref: 'paper',
        x: 0,
        y: rows.length - 1 - i + 0.45,
        xanchor: 'left',
        showarrow: false,
        text: r.label,
        font: { color: token('ink-2'), size: 12 },
      })),
    }),
    [rows],
  )

  return (
    <>
      <div className="mb-3">
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: `var(--${s.color})` }} />
              {s.name}
            </li>
          ))}
        </ul>
      </div>
      <Plot data={data} layout={layout} height={60 + rows.length * 64} ariaLabel="Robustness of the premium estimate" />
      <div className="sr-only">
        <table>
          <caption>Premium estimates by sample</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th>{r.label}</th>
                <td>vs Barcelona {signedPct(r.rm_vs_barca?.pct)}</td>
                <td>vs other elite {signedPct(r.rm_vs_elite?.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
