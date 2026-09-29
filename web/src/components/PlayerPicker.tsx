import { useEffect, useMemo, useRef, useState } from 'react'
import { eur, seasonLabel, TRACKED, type Group, type Sale } from '../data'
import { Swatch } from './ui'

export type GroupFilter = Group | 'All'

interface Props {
  label: string
  sales: Sale[]
  value: Sale | null
  onChange: (s: Sale) => void
  group: GroupFilter
  onGroup: (g: GroupFilter) => void
}

/** Searchable list of sales, filtered by selling group. */
export default function PlayerPicker({ label, sales, value, onChange, group, onGroup }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sales
      .filter((s) => (group === 'All' || s.group === group) && (!q || `${s.player} ${s.from} ${s.to}`.toLowerCase().includes(q)))
      .sort((a, b) => (q ? a.player.localeCompare(b.player) : b.fee - a.fee))
      .slice(0, 60)
  }, [sales, group, query])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const pick = (s: Sale) => {
    onChange(s)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={box} className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{label}</span>
        <select
          aria-label={`${label}: selling club`}
          value={group}
          onChange={(e) => onGroup(e.target.value as GroupFilter)}
          className="ml-auto rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink"
        >
          {TRACKED.map((g) => (
            <option key={g}>{g}</option>
          ))}
          <option value="All">All clubs</option>
        </select>
      </div>
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${label}-list`}
        aria-label={`${label}: search player`}
        placeholder={value ? `${value.player} — search to change` : 'Search a player…'}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
          else if (e.key === 'Enter' && results[active]) pick(results[active])
          else if (e.key === 'Escape') setOpen(false)
        }}
        className="w-full rounded-xl border border-line bg-page px-3.5 py-2 text-sm text-ink placeholder:text-muted"
      />
      {open && (
        <ul
          id={`${label}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          {results.map((s, i) => (
            <li key={s.key} role="option" aria-selected={i === active}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${i === active ? 'bg-surface-2' : ''}`}
              >
                <Swatch group={s.group} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{s.player}</span>
                  <span className="block truncate text-xs text-muted">
                    {s.from} → {s.to} · {seasonLabel(s.season)} · {s.position ?? '–'}
                  </span>
                </span>
                <span className="text-xs text-ink-2 tabular">{eur(s.fee)}</span>
              </button>
            </li>
          ))}
          {!results.length && <li className="px-3 py-2 text-sm text-muted">No sale matches.</li>}
        </ul>
      )}
    </div>
  )
}
