import { useMemo, useState } from 'react'
import { eur, premiumOf, seasonLabel, signedPct, TRACKED, useData, type Group, type Sale } from '../data'
import { Card, PageHeader, Swatch } from '../components/ui'

type SortKey = 'date' | 'fee' | 'premium' | 'player'
const PAGE = 40

export default function Transfers() {
  const { sales } = useData()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<Group | 'All'>('Real Madrid')
  const [sort, setSort] = useState<SortKey>('date')
  const [desc, setDesc] = useState(true)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Sale | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = sales.filter(
      (s) =>
        (group === 'All' || s.group === group) &&
        (!q || `${s.player} ${s.from} ${s.to}`.toLowerCase().includes(q)),
    )
    const val = (s: Sale): number | string =>
      sort === 'date' ? s.date : sort === 'fee' ? s.fee : sort === 'player' ? s.player : (s.residual ?? -Infinity)
    return filtered.sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      const c = va < vb ? -1 : va > vb ? 1 : 0
      return desc ? -c : c
    })
  }, [sales, query, group, sort, desc])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE)

  const header = (key: SortKey, label: string, align = 'text-left') => (
    <th scope="col" className={`px-3 py-2 font-medium ${align}`}>
      <button
        className="inline-flex items-center gap-1 hover:text-ink"
        onClick={() => {
          if (sort === key) setDesc(!desc)
          else {
            setSort(key)
            setDesc(key !== 'player')
          }
          setPage(0)
        }}
      >
        {label}
        <span aria-hidden className="text-[10px]">{sort === key ? (desc ? '▼' : '▲') : ''}</span>
      </button>
    </th>
  )

  return (
    <>
      <PageHeader eyebrow="Transfer explorer" title="Every sale, and its closest rival">
        Search any Real Madrid, Barcelona or other elite-club sale since 2009/10. Pick one to see the most
        similar sales by the rival club: same position, similar age, market value and era.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              type="search"
              placeholder="Search player or club…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              className="min-w-0 flex-1 rounded-full border border-line bg-page px-4 py-1.5 text-sm text-ink placeholder:text-muted"
            />
            <select
              aria-label="Selling club group"
              value={group}
              onChange={(e) => {
                setGroup(e.target.value as Group | 'All')
                setPage(0)
              }}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink"
            >
              <option value="All">All sellers</option>
              {TRACKED.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  {header('player', 'Player')}
                  <th scope="col" className="px-3 py-2 text-left font-medium">Move</th>
                  {header('date', 'Season')}
                  {header('fee', 'Fee', 'text-right')}
                  <th scope="col" className="px-3 py-2 text-right font-medium">Expected</th>
                  {header('premium', 'Premium', 'text-right')}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className={`cursor-pointer transition-colors hover:bg-surface-2 ${selected?.id === s.id ? 'bg-surface-2' : ''}`}
                  >
                    <td className="px-3 py-2.5">
                      <button className="flex items-center gap-2 text-left font-medium text-ink" onClick={() => setSelected(s)}>
                        <Swatch group={s.group} />
                        {s.player}
                        {s.academy && <span className="rounded bg-surface-2 px-1.5 text-[10px] text-ink-2">academy</span>}
                      </button>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-ink-2">
                      {s.from} → {s.to}
                    </td>
                    <td className="px-3 py-2.5 text-ink-2 tabular">{seasonLabel(s.season)}</td>
                    <td className="px-3 py-2.5 text-right text-ink tabular">{eur(s.fee)}</td>
                    <td className="px-3 py-2.5 text-right text-ink-2 tabular">{eur(s.expected_fee)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-ink tabular">{signedPct(premiumOf(s))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-ink-2">
            <span>{rows.length} sales</span>
            <span className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-full px-3 py-1 hover:bg-surface-2 disabled:opacity-30">
                ← Prev
              </button>
              {page + 1} / {pages}
              <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-full px-3 py-1 hover:bg-surface-2 disabled:opacity-30">
                Next →
              </button>
            </span>
          </div>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          {selected ? (
            <Detail sale={selected} onPick={setSelected} />
          ) : (
            <Card title="Pick a sale">
              <p className="text-sm text-ink-2">Click any row to see its details and the most comparable sales by the rival club.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

/** Distance between two sales on the features that drive price. Same position required. */
function distance(a: Sale, b: Sale): number {
  if (a.position !== b.position || a.mv == null || b.mv == null || a.age == null || b.age == null) return Infinity
  return (
    ((a.age - b.age) / 2) ** 2 +
    (Math.log(a.mv / b.mv) / 0.5) ** 2 +
    ((a.season - b.season) / 4) ** 2 +
    (a.academy !== b.academy ? 1 : 0)
  )
}

function rivalsOf(g: Group): Group[] {
  if (g === 'Real Madrid') return ['Barcelona']
  if (g === 'Barcelona') return ['Real Madrid']
  return ['Real Madrid', 'Barcelona']
}

function Detail({ sale, onPick }: { sale: Sale; onPick: (s: Sale) => void }) {
  const { sales } = useData()
  const comps = useMemo(() => {
    const rivals = rivalsOf(sale.group)
    return sales
      .filter((s) => rivals.includes(s.group) && s.id !== sale.id)
      .map((s) => ({ s, d: distance(sale, s) }))
      .filter((x) => Number.isFinite(x.d))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
  }, [sale, sales])

  const facts: [string, string][] = [
    ['Season', seasonLabel(sale.season)],
    ['Age at sale', sale.age != null ? sale.age.toFixed(1) : '–'],
    ['Position', sale.sub_position ?? sale.position ?? '–'],
    ['Buyer league', sale.buyer_league],
    ['Market value', eur(sale.mv)],
    ['Fee', eur(sale.fee)],
    ['Expected fee', eur(sale.expected_fee)],
    ['Fee in today’s money', eur(sale.fee_adj)],
    [
      'Last 12 months',
      sale.has_perf ? `${sale.minutes.toLocaleString()} min · ${sale.goals} G · ${sale.assists} A` : 'not covered (pre-2013)',
    ],
  ]

  return (
    <Card>
      <div className="flex items-start gap-2">
        <span className="mt-1.5">
          <Swatch group={sale.group} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink">{sale.player}</h2>
          <p className="text-sm text-ink-2">
            {sale.from} → {sale.to}
          </p>
        </div>
      </div>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-ink">{signedPct(premiumOf(sale))}</p>
      <p className="text-sm text-muted">premium over expected fee</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right text-ink tabular">{v}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-6 mb-2 text-sm font-semibold text-ink">
        Most similar {rivalsOf(sale.group).join(' / ')} sales
      </h3>
      {comps.length ? (
        <ol className="divide-y divide-line">
          {comps.map(({ s }) => (
            <li key={s.id}>
              <button onClick={() => onPick(s)} className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-surface-2">
                <Swatch group={s.group} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{s.player}</span>
                  <span className="block truncate text-xs text-muted">
                    {seasonLabel(s.season)} · age {s.age?.toFixed(0)} · MV {eur(s.mv)} · fee {eur(s.fee)}
                  </span>
                </span>
                <span className="font-medium text-ink tabular">{signedPct(premiumOf(s))}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">No comparable sale with a market value in the same position.</p>
      )}
    </Card>
  )
}
