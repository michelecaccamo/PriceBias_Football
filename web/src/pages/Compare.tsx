import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { eur, premiumOf, seasonLabel, signedPct, useData, type Group, type Sale, type StatWindow } from '../data'
import {
  METRICS,
  MIN_MINUTES,
  mostSimilar,
  percentile,
  radarMetrics,
  rivalGroups,
  samePosition,
  WINDOW_LABEL,
  type Metric,
} from '../compare'
import PlayerPicker, { type GroupFilter } from '../components/PlayerPicker'
import Radar from '../components/Radar'
import { Card, GROUP_TOKEN, PageHeader, Swatch, Toggle } from '../components/ui'

const SLOT_TOKENS = ['rm', 'fcb', 'elite']

/** Colour follows the club; if both players share a club, B takes the next free slot. */
function slotColors(a: Sale | null, b: Sale | null): [string, string] {
  const ta = a ? GROUP_TOKEN[a.group] : 'fcb'
  let tb = b ? GROUP_TOKEN[b.group] : 'rm'
  if (tb === ta) tb = SLOT_TOKENS.find((t) => t !== ta)!
  return [`var(--${ta})`, `var(--${tb})`]
}

export default function Compare() {
  const { sales } = useData()
  const [params, setParams] = useSearchParams()
  const byKey = useMemo(() => new Map(sales.map((s) => [s.key, s])), [sales])
  const a = byKey.get(params.get('a') ?? '') ?? null
  const b = byKey.get(params.get('b') ?? '') ?? null
  const [groupA, setGroupA] = useState<GroupFilter>(a?.group ?? 'Barcelona')
  const [groupB, setGroupB] = useState<GroupFilter>(b?.group ?? 'Real Madrid')
  const [win, setWin] = useState<StatWindow>('career')

  const set = (slot: 'a' | 'b', s: Sale | null) => {
    const next = new URLSearchParams(params)
    if (s) next.set(slot, s.key)
    else next.delete(slot)
    setParams(next, { replace: true })
  }

  const suggestions = useMemo(() => {
    if (!a) return []
    const pool: Group[] = groupB === 'All' ? rivalGroups(a.group) : [groupB]
    return mostSimilar(a, sales.filter((s) => pool.includes(s.group)), sales, 5)
  }, [a, groupB, sales])

  const pickA = (s: Sale) => {
    set('a', s)
    setGroupA(s.group)
  }

  const starters = useMemo(
    () => sales.filter((s) => s.group === 'Barcelona' && !s.academy).sort((x, y) => y.fee - x.fee).slice(0, 4),
    [sales],
  )
  const [colorA, colorB] = slotColors(a, b)

  return (
    <>
      <PageHeader eyebrow="Head to head" title="Compare any two sales">
        Pick a player sold by Barcelona and one sold by Real Madrid (or any elite club) to see the deal and
        what they had done on the pitch <em>before</em> they were sold. When you pick the first player, the page
        suggests the most similar players from the other club.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <PlayerPicker label="Player A" sales={sales} value={a} onChange={pickA} group={groupA} onGroup={setGroupA} />
          {a ? (
            <PlayerHeader sale={a} color={colorA} />
          ) : (
            <div className="mt-4 text-sm text-ink-2">
              <p className="mb-2">Start with a player. Some of Barcelona's biggest sales:</p>
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button key={s.key} onClick={() => pickA(s)} className="rounded-full border border-line px-3 py-1 hover:bg-surface-2">
                    {s.player} · {eur(s.fee)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <PlayerPicker label="Player B" sales={sales} value={b} onChange={(s) => set('b', s)} group={groupB} onGroup={setGroupB} />
          {b && <PlayerHeader sale={b} color={colorB} />}
          {a && (
            <div className={b ? 'mt-5 border-t border-line pt-4' : 'mt-4'}>
              <p className="mb-2 text-sm font-semibold text-ink">
                Most similar to {a.player}
                <span className="font-normal text-muted">
                  {' '}
                  · {groupB === 'All' ? rivalGroups(a.group).join(' / ') : groupB}, {a.position?.toLowerCase() ?? 'same position'}
                </span>
              </p>
              {suggestions.length ? (
                <ol className="divide-y divide-line">
                  {suggestions.map(({ sale, similarity }) => (
                    <li key={sale.key}>
                      <button
                        onClick={() => set('b', sale)}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2 ${
                          b?.key === sale.key ? 'bg-surface-2' : ''
                        }`}
                      >
                        <Swatch group={sale.group} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">{sale.player}</span>
                          <span className="block truncate text-xs text-muted">
                            {seasonLabel(sale.season)} · age {sale.age?.toFixed(0) ?? '–'} · MV {eur(sale.mv)} ·{' '}
                            {sale.stats.career.minutes.toLocaleString()} min
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-semibold text-ink tabular">{similarity}%</span>
                          <span className="block text-[10px] text-muted">match</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">No sale in that group plays the same position.</p>
              )}
              <p className="mt-2 text-xs text-muted">
                Match is based on position, age, market value, era, minutes, output, starts and European
                experience before the sale.
              </p>
            </div>
          )}
        </Card>
      </div>

      {a && b && (
        <>
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                const next = new URLSearchParams(params)
                next.set('a', b.key)
                next.set('b', a.key)
                setParams(next, { replace: true })
                setGroupA(b.group)
                setGroupB(a.group)
              }}
              className="rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:bg-surface-2"
            >
              ⇄ Swap players
            </button>
          </div>
          <TransferTable a={a} b={b} colors={[colorA, colorB]} />
          <Pitch a={a} b={b} colors={[colorA, colorB]} win={win} setWin={setWin} />
        </>
      )}
    </>
  )
}

function PlayerHeader({ sale, color }: { sale: Sale; color: string }) {
  const facts = [
    sale.sub_position ?? sale.position,
    sale.age != null ? `${sale.age.toFixed(1)} years` : null,
    sale.foot ? `${sale.foot} foot` : null,
    sale.height_in_cm ? `${sale.height_in_cm} cm` : null,
    sale.country_of_citizenship,
  ].filter(Boolean)
  return (
    <div className="mt-4 flex items-start gap-3">
      <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{sale.player}</h2>
        <p className="text-sm text-ink-2">
          {sale.from} → {sale.to} · {seasonLabel(sale.season)}
          {sale.academy && <span className="ml-2 rounded bg-surface-2 px-1.5 text-[11px] text-ink-2">academy</span>}
        </p>
        <p className="mt-1 text-xs text-muted">{facts.join(' · ')}</p>
        <dl className="mt-3 grid grid-cols-3 gap-4">
          {[
            ['Fee', eur(sale.fee)],
            ['Expected', eur(sale.expected_fee)],
            ['Premium', signedPct(premiumOf(sale))],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="text-lg font-semibold text-ink tabular">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function Head({ a, b, colors }: { a: Sale; b: Sale; colors: [string, string] }) {
  return (
    <thead>
      <tr className="border-b border-line text-xs text-muted">
        <th className="w-[40%] py-2 pr-2 text-left font-medium" />
        {[a, b].map((s, i) => (
          <th key={s.key} className="py-2 pl-2 text-right align-bottom font-medium">
            <span className="inline-flex items-start justify-end gap-1.5">
              <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors[i] }} />
              <span className="text-ink">{s.player}</span>
            </span>
          </th>
        ))}
      </tr>
    </thead>
  )
}

function Row({ label, a, b, hint }: { label: string; a: ReactNode; b: ReactNode; hint?: string }) {
  return (
    <tr>
      <th scope="row" className="py-2 pr-2 text-left font-normal text-ink-2">
        {label}
        {hint && <span className="block text-[11px] text-muted">{hint}</span>}
      </th>
      <td className="py-2 pl-2 text-right break-words text-ink tabular">{a}</td>
      <td className="py-2 pl-2 text-right break-words text-ink tabular">{b}</td>
    </tr>
  )
}

function trend(s: Sale): string {
  if (!s.mv || !s.mv_year_before) return '–'
  return `${eur(s.mv_year_before)} (${signedPct(s.mv / s.mv_year_before - 1)})`
}

function TransferTable({ a, b, colors }: { a: Sale; b: Sale; colors: [string, string] }) {
  const next = (s: Sale) =>
    s.next_move ? `${s.next_move.to}, ${eur(s.next_move.fee)} (${s.next_move.date.slice(0, 4)})` : '–'
  const rows: [string, (s: Sale) => ReactNode, string?][] = [
    ['Sold by', (s) => s.from],
    ['Sold to', (s) => s.to],
    ['Buyer league', (s) => s.buyer_league],
    ['Date', (s) => s.date],
    ['Age at sale', (s) => (s.age != null ? s.age.toFixed(1) : '–')],
    ['Academy product', (s) => (s.academy ? 'Yes' : 'No')],
    ['Fee', (s) => <strong>{eur(s.fee)}</strong>],
    ['Fee in today’s money', (s) => eur(s.fee_adj), 'adjusted for transfer-market inflation'],
    ['Expected fee', (s) => eur(s.expected_fee), 'what other clubs get for a comparable player'],
    ['Premium over expected', (s) => <strong>{signedPct(premiumOf(s))}</strong>],
    ['Market value at sale', (s) => eur(s.mv), 'Transfermarkt'],
    ['Fee ÷ market value', (s) => (s.fee_to_mv != null ? `${s.fee_to_mv.toFixed(2)}×` : '–')],
    ['Market value a year earlier', trend],
    ['Peak market value before sale', (s) => eur(s.mv_peak)],
    ['Next paid transfer', next, 'hindsight: what the buyer later sold him for'],
    ['International caps', (s) => s.international_caps ?? '–', 'career total as of today, not at the sale'],
  ]
  return (
    <Card className="mt-3" title="The transfer">
      <div>
        <table className="w-full table-fixed text-sm">
          <Head a={a} b={b} colors={colors} />
          <tbody className="divide-y divide-line">
            {rows.map(([label, f, hint]) => (
              <Row key={label} label={label} hint={hint} a={f(a)} b={f(b)} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Pitch({
  a,
  b,
  colors,
  win,
  setWin,
}: {
  a: Sale
  b: Sale
  colors: [string, string]
  win: StatWindow
  setWin: (w: StatWindow) => void
}) {
  const { sales } = useData()
  const metrics = radarMetrics(a.position)
  const pool = useMemo(() => samePosition(sales, a.position), [sales, a.position])

  const axes = metrics.map((m) => {
    const poolVals = pool.map((s) => m.value(s.stats[win]))
    return {
      label: m.short,
      values: [a, b].map((s) => percentile(m, m.value(s.stats[win]), poolVals)),
      display: [a, b].map((s) => fmt(m, s, win)),
    }
  })

  const wa = a.stats[win]
  const wb = b.stats[win]
  const lowCoverage = [a, b].filter((s) => s.stats.career.apps < 10)

  // Every stat relevant to the position first, then the raw totals
  const rateRows = metrics
  const extra = Object.values(METRICS).filter((m) => !metrics.includes(m))

  return (
    <Card className="mt-6" title="On the pitch before the sale">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Toggle<StatWindow>
          label="Time window"
          value={win}
          onChange={setWin}
          options={[
            { value: 'career', label: 'Career before sale' },
            { value: 'last12', label: 'Last 12 months' },
          ]}
        />
        <p className="text-xs text-muted">
          {a.position !== b.position
            ? `Different positions: radar uses ${a.position ?? 'generic'} metrics.`
            : `${a.position ?? 'Generic'} metrics · ${WINDOW_LABEL[win].toLowerCase()}`}
        </p>
      </div>

      {lowCoverage.length > 0 && (
        <p className="mb-4 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2">
          <strong className="text-ink">Limited data for {lowCoverage.map((s) => s.player).join(' and ')}.</strong>{' '}
          Only games in top-flight leagues, UEFA competitions and main domestic cups are recorded, so most
          reserve-team football (Castilla, Barça Atlètic) is missing. Per-90 stats need at least {MIN_MINUTES}{' '}
          minutes.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <Radar
          axes={axes}
          series={[
            { name: a.player, color: colors[0] },
            { name: b.player, color: colors[1] },
          ]}
        />
        <div>
          <table className="w-full table-fixed text-sm">
            <Head a={a} b={b} colors={colors} />
            <tbody className="divide-y divide-line">
              <Row label="Appearances" a={wa.apps} b={wb.apps} />
              <Row label="Starts" a={wa.starts} b={wb.starts} />
              <Row label="Goals" a={wa.goals} b={wb.goals} />
              <Row label="Assists" a={wa.assists} b={wb.assists} />
              {[...rateRows, ...extra].map((m) => (
                <MetricRow key={m.key} m={m} a={a} b={b} win={win} />
              ))}
              <Row label="Wins / draws / losses" a={wdl(wa)} b={wdl(wb)} />
              <Row label="Yellow / red cards" a={`${wa.yellow} / ${wa.red}`} b={`${wb.yellow} / ${wb.red}`} />
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Chances created, xG, passing and defensive actions aren't in the open Transfermarkt data this site uses,
        so they can't be shown. Goals conceded and clean sheets are the team's, in games the player played at least
        60 minutes.
      </p>
    </Card>
  )
}

function wdl(w: { wins: number; draws: number; results: number }) {
  return `${w.wins} / ${w.draws} / ${w.results - w.wins - w.draws}`
}

function fmt(m: Metric, s: Sale, win: StatWindow): string {
  const v = m.value(s.stats[win])
  return v == null ? 'too few games' : m.format(v)
}

function MetricRow({ m, a, b, win }: { m: Metric; a: Sale; b: Sale; win: StatWindow }) {
  const va = m.value(a.stats[win])
  const vb = m.value(b.stats[win])
  const better =
    va == null || vb == null || va === vb ? null : (m.higherIsBetter ? va > vb : va < vb) ? 'a' : 'b'
  const cell = (v: number | null, me: 'a' | 'b') =>
    v == null ? <span className="text-muted">–</span> : <span className={better === me ? 'font-semibold' : ''}>{m.format(v)}</span>
  return <Row label={m.label} a={cell(va, 'a')} b={cell(vb, 'b')} hint={m.higherIsBetter ? undefined : 'lower is better'} />
}
