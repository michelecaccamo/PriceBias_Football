import { useCallback, useMemo, useState } from 'react'
import { signedPct, TRACKED, useData, type Group } from '../data'
import Plot, { type Data as PlotData, type Layout } from '../components/Plot'
import { Card, groupColor, Legend, PageHeader, Toggle } from '../components/ui'
import { token, useMode } from '../theme'

// Log-scale axis for actual/expected ratios, labelled as percentage premiums
export const RATIO_TICKS = {
  tickvals: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4],
  ticktext: ['−75%', '−50%', '−25%', '0', '+50%', '+100%', '+200%', '+300%'],
}

export default function Clubs() {
  return (
    <>
      <PageHeader eyebrow="Club by club" title="How much above or below the expected fee does each club sell?">
        For every sale we estimate an <em>expected fee</em>: what the market pays for a player with the same
        market value, age, position, recent form, buyer league and season when he is sold by a club that
        is neither Real Madrid nor Barcelona. The premium is how far the actual fee lands above or below
        that expectation.
      </PageHeader>
      <div className="grid gap-6">
        <ClubRanking />
        <Distribution />
      </div>
    </>
  )
}

function ClubRanking() {
  const { summary } = useData()
  const mode = useMode()
  const clubs = useMemo(
    () =>
      summary.clubs
        .filter((c) => c.residual_pct.median != null)
        .sort((a, b) => a.residual_pct.median! - b.residual_pct.median!),
    [summary],
  )

  const data = useMemo((): PlotData[] => {
    return TRACKED.map((g) => {
      const rows = clubs.map((c, i) => ({ c, i })).filter((d) => d.c.group === g)
      return {
        type: 'scatter',
        mode: 'markers',
        name: g,
        x: rows.map((d) => d.c.residual_pct.median! * 100),
        y: rows.map((d) => d.i),
        error_x: {
          type: 'data',
          symmetric: false,
          array: rows.map((d) => (d.c.residual_pct.ci_high! - d.c.residual_pct.median!) * 100),
          arrayminus: rows.map((d) => (d.c.residual_pct.median! - d.c.residual_pct.ci_low!) * 100),
          color: groupColor(g),
          thickness: 2,
          width: 0,
        },
        marker: { color: groupColor(g), size: 10, line: { color: token('surface'), width: 2 } },
        customdata: rows.map((d) => [
          d.c.club,
          d.c.n,
          signedPct(d.c.residual_pct.ci_low),
          signedPct(d.c.residual_pct.ci_high),
        ]),
        hovertemplate:
          '<b>%{customdata[0]}</b><br>Median premium %{x:+.0f}%<br>95% CI %{customdata[2]} to %{customdata[3]}' +
          '<br>%{customdata[1]} sales<extra></extra>',
      } as PlotData
    })
    // mode: re-resolve colours when the theme changes
  }, [clubs, mode])

  const layout = useCallback(
    (base: Partial<Layout>): Partial<Layout> => ({
      margin: { l: 8, r: 16, t: 8, b: 40 },
      xaxis: { ...base.xaxis, ticksuffix: '%', zeroline: true, zerolinewidth: 1.5, title: { text: 'Median premium over expected fee' } },
      yaxis: {
        ...base.yaxis,
        showgrid: false,
        tickvals: clubs.map((_, i) => i),
        ticktext: clubs.map((c) => `${c.club} (${c.n})`),
        tickfont: { ...base.yaxis?.tickfont, color: token('ink-2'), size: 12 },
      },
    }),
    [clubs],
  )

  return (
    <Card
      title="Median premium by selling club"
      subtitle="Dots are the median premium across each club's sales; bars are 95% bootstrap intervals. The number of sales is in brackets. Sales with no market value are left out."
    >
      <div className="mb-3">
        <Legend groups={TRACKED} />
      </div>
      <Plot data={data} layout={layout} height={60 + clubs.length * 34} ariaLabel="Median premium by selling club" />
    </Card>
  )
}

type AcademyFilter = 'all' | 'first' | 'academy'

function Distribution() {
  const { sales } = useData()
  const mode = useMode()
  const [academy, setAcademy] = useState<AcademyFilter>('all')

  const data = useMemo((): PlotData[] => {
    const rows = sales.filter(
      (s) =>
        s.residual != null &&
        (academy === 'all' || (academy === 'academy' ? s.academy : !s.academy)),
    )
    return TRACKED.map((g: Group) => {
      const d = rows.filter((s) => s.group === g)
      return {
        type: 'box',
        name: `${g} (${d.length})`,
        y: d.map((s) => Math.exp(s.residual!)),
        boxpoints: 'all',
        jitter: 0.45,
        pointpos: 0,
        marker: { color: groupColor(g), size: 6, opacity: 0.7, line: { color: token('surface'), width: 1 } },
        line: { color: groupColor(g), width: 1.5 },
        fillcolor: 'rgba(0,0,0,0)',
        customdata: d.map((s) => [s.player, s.from, s.to, s.date.slice(0, 4), signedPct(Math.expm1(s.residual!))]),
        hovertemplate:
          '<b>%{customdata[0]}</b><br>%{customdata[1]} → %{customdata[2]} (%{customdata[3]})<br>Premium %{customdata[4]}<extra></extra>',
      } as PlotData
    })
  }, [sales, academy, mode])

  const layout = useCallback(
    (base: Partial<Layout>): Partial<Layout> => ({
      margin: { l: 8, r: 8, t: 8, b: 32 },
      yaxis: { ...base.yaxis, type: 'log', ...RATIO_TICKS, title: { text: 'Premium over expected fee' } },
      xaxis: { ...base.xaxis, showgrid: false, tickfont: { ...base.xaxis?.tickfont, color: token('ink-2'), size: 12 } },
    }),
    [],
  )

  return (
    <Card
      title="Every sale, side by side"
      subtitle="Each dot is one sale. Boxes span the middle half of sales; the line inside is the median. Points above 0 were sold for more than expected."
    >
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Toggle<AcademyFilter>
          label="Which sales"
          value={academy}
          onChange={setAcademy}
          options={[
            { value: 'all', label: 'All sales' },
            { value: 'first', label: 'First team' },
            { value: 'academy', label: 'Academy / B team' },
          ]}
        />
      </div>
      <Plot data={data} layout={layout} height={440} ariaLabel="Distribution of premiums by seller group" />
    </Card>
  )
}
