import { useState } from 'react'

export interface RadarAxis {
  label: string
  /** percentile 0–100 per series; null = not enough data */
  values: (number | null)[]
  /** formatted raw values per series, for the hover readout */
  display: string[]
}

export interface RadarSeries {
  name: string
  color: string // CSS colour, e.g. var(--rm)
}

const SIZE = 360
const C = SIZE / 2
const R = 120
const RINGS = [25, 50, 75, 100]

function point(i: number, n: number, pct: number) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
  const r = (pct / 100) * R
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const
}

export default function Radar({ axes, series }: { axes: RadarAxis[]; series: RadarSeries[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = axes.length

  return (
    <div>
      {/* Padded viewBox leaves room for axis labels on every side */}
      <svg viewBox={`-60 -8 ${SIZE + 120} ${SIZE + 16}`} className="mx-auto w-full max-w-[460px]" role="img" aria-label="Percentile radar">
        {RINGS.map((r) => (
          <polygon
            key={r}
            points={axes.map((_, i) => point(i, n, r).join(',')).join(' ')}
            fill="none"
            stroke="var(--grid)"
            strokeWidth={1}
          />
        ))}
        {axes.map((ax, i) => {
          const [x, y] = point(i, n, 100)
          const [lx, ly] = point(i, n, 122)
          const anchor = Math.abs(lx - C) < 8 ? 'middle' : lx > C ? 'start' : 'end'
          return (
            <g key={ax.label}>
              <line x1={C} y1={C} x2={x} y2={y} stroke="var(--grid)" strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                dy={ly < C - 10 ? -2 : ly > C + 10 ? 10 : 4}
                textAnchor={anchor}
                fontSize={13}
                fill={hover === i ? 'var(--ink)' : 'var(--ink-2)'}
                fontWeight={hover === i ? 600 : 400}
              >
                {ax.label}
              </text>
            </g>
          )
        })}
        <text x={C + 3} y={C - R / 2 - 2} fontSize={9} fill="var(--muted)">
          50th
        </text>
        <text x={C + 3} y={C - R - 2} fontSize={9} fill="var(--muted)">
          100th
        </text>

        {series.map((s, si) => {
          const pts = axes.map((ax, i) => point(i, n, ax.values[si] ?? 0))
          return (
            <g key={s.name}>
              <polygon
                points={pts.map((p) => p.join(',')).join(' ')}
                fill={s.color}
                fillOpacity={0.14}
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {pts.map(([x, y], i) =>
                axes[i].values[si] == null ? null : (
                  <circle key={i} cx={x} cy={y} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                ),
              )}
            </g>
          )
        })}

        {/* Wide invisible hit areas, one wedge per axis */}
        {axes.map((ax, i) => {
          const [x, y] = point(i, n, 115)
          return (
            <circle
              key={`hit-${ax.label}`}
              cx={(x + C) / 2 + (x - C) / 4}
              cy={(y + C) / 2 + (y - C) / 4}
              r={34}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(i)}
            />
          )
        })}
      </svg>

      <div className="mt-2 min-h-[44px] rounded-xl bg-surface-2 px-3 py-2 text-sm" aria-live="polite">
        {hover == null ? (
          <p className="text-muted">Hover or tap an axis to see both players' numbers. Rings are percentiles among sold players in the same position.</p>
        ) : (
          <>
            <p className="font-medium text-ink">{axes[hover].label}</p>
            <div className="flex flex-wrap gap-x-5">
              {series.map((s, si) => (
                <span key={s.name} className="flex items-center gap-1.5 text-ink-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name}: <strong className="text-ink tabular">{axes[hover].display[si]}</strong>
                  {axes[hover].values[si] != null && (
                    <span className="text-muted">({Math.round(axes[hover].values[si]!)}th pct)</span>
                  )}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
