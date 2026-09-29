import type { ReactNode } from 'react'
import type { Group } from '../data'
import { token } from '../theme'

export const GROUP_TOKEN: Record<Group, string> = {
  'Real Madrid': 'rm',
  Barcelona: 'fcb',
  'Other elite': 'elite',
  Other: 'muted',
}
export const groupColor = (g: Group) => token(GROUP_TOKEN[g])

export function Swatch({ group }: { group: Group }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: `var(--${GROUP_TOKEN[group]})` }}
    />
  )
}

export function Legend({ groups }: { groups: Group[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
      {groups.map((g) => (
        <li key={g} className="flex items-center gap-2">
          <Swatch group={g} />
          {g}
        </li>
      ))}
    </ul>
  )
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 max-w-3xl">
      <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-accent uppercase">{eyebrow}</p>
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
      {children && <div className="mt-4 text-base leading-relaxed text-ink-2">{children}</div>}
    </header>
  )
}

export function Card({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string
  subtitle?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>
      {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
      {subtitle && <div className="mt-1 text-sm leading-relaxed text-ink-2">{subtitle}</div>}
      {(title || subtitle) && <div className="mt-4" />}
      {children}
    </section>
  )
}

export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {note && <p className="mt-1 text-xs leading-relaxed text-muted">{note}</p>}
    </div>
  )
}

export function Toggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 text-sm transition-colors ${
            value === o.value ? 'bg-ink text-page' : 'text-ink-2 hover:bg-surface-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
