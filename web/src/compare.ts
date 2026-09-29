import type { Group, Sale, StatWindow, WindowStats } from './data'

/** Rate stats need a minimum sample before they mean anything. */
export const MIN_MINUTES = 450
export const MIN_FULL_GAMES = 5

export interface Metric {
  key: string
  label: string
  short: string
  /** null when the sample is too small for the stat to be meaningful */
  value: (w: WindowStats) => number | null
  format: (v: number) => string
  higherIsBetter: boolean
}

const per90 = (n: number, w: WindowStats) => (w.minutes >= MIN_MINUTES ? (n / w.minutes) * 90 : null)
const fixed = (d: number) => (v: number) => v.toFixed(d)
const pct = (v: number) => `${Math.round(v * 100)}%`
const int = (v: number) => Math.round(v).toLocaleString()

export const METRICS: Record<string, Metric> = {
  goals90: { key: 'goals90', label: 'Goals per 90', short: 'Goals/90', value: (w) => per90(w.goals, w), format: fixed(2), higherIsBetter: true },
  assists90: { key: 'assists90', label: 'Assists per 90', short: 'Assists/90', value: (w) => per90(w.assists, w), format: fixed(2), higherIsBetter: true },
  ga90: { key: 'ga90', label: 'Goals + assists per 90', short: 'G+A/90', value: (w) => per90(w.goals + w.assists, w), format: fixed(2), higherIsBetter: true },
  minutes: { key: 'minutes', label: 'Minutes played', short: 'Minutes', value: (w) => w.minutes, format: int, higherIsBetter: true },
  startRate: { key: 'startRate', label: 'Start rate', short: 'Starts', value: (w) => (w.apps >= 5 ? w.starts / w.apps : null), format: pct, higherIsBetter: true },
  winRate: { key: 'winRate', label: 'Win rate when playing', short: 'Wins', value: (w) => (w.results >= 5 ? w.wins / w.results : null), format: pct, higherIsBetter: true },
  euroMinutes: { key: 'euroMinutes', label: 'European minutes', short: 'Europe', value: (w) => w.euro_minutes, format: int, higherIsBetter: true },
  cleanSheetRate: {
    key: 'cleanSheetRate',
    label: 'Clean-sheet rate (60+ min games)',
    short: 'Clean sheets',
    value: (w) => (w.full_games >= MIN_FULL_GAMES ? w.clean_sheets / w.full_games : null),
    format: pct,
    higherIsBetter: true,
  },
  concededPerGame: {
    key: 'concededPerGame',
    label: 'Team goals conceded per game (60+ min)',
    short: 'Conceded',
    value: (w) => (w.full_games >= MIN_FULL_GAMES ? w.conceded / w.full_games : null),
    format: fixed(2),
    higherIsBetter: false,
  },
  discipline: {
    key: 'discipline',
    label: 'Cards per 90 (red = 2)',
    short: 'Discipline',
    value: (w) => per90(w.yellow + 2 * w.red, w),
    format: fixed(2),
    higherIsBetter: false,
  },
}

/** Radar axes per position: what matters for the role, within what the data has. */
export const RADAR: Record<string, string[]> = {
  Attack: ['goals90', 'assists90', 'minutes', 'startRate', 'winRate', 'euroMinutes'],
  Midfield: ['assists90', 'goals90', 'minutes', 'startRate', 'winRate', 'euroMinutes', 'discipline'],
  Defender: ['cleanSheetRate', 'concededPerGame', 'ga90', 'minutes', 'startRate', 'winRate', 'discipline'],
  Goalkeeper: ['cleanSheetRate', 'concededPerGame', 'minutes', 'startRate', 'winRate', 'euroMinutes'],
}
export const DEFAULT_RADAR = RADAR.Midfield

export function radarMetrics(position: string | null | undefined): Metric[] {
  return (RADAR[position ?? ''] ?? DEFAULT_RADAR).map((k) => METRICS[k])
}

/**
 * Percentile (0–100) of a value among the same-position pool; "better" is always higher,
 * so lower-is-better stats are flipped. Ties count half.
 */
export function percentile(metric: Metric, value: number | null, pool: (number | null)[]): number | null {
  if (value == null) return null
  const vals = pool.filter((v): v is number => v != null)
  if (!vals.length) return null
  let below = 0
  let equal = 0
  for (const v of vals) {
    if (v < value) below++
    else if (v === value) equal++
  }
  const p = ((below + equal / 2) / vals.length) * 100
  return metric.higherIsBetter ? p : 100 - p
}

export function samePosition(sales: Sale[], position: string | null): Sale[] {
  return sales.filter((s) => s.position === position)
}

// ---------- similarity ----------

function features(s: Sale): (number | null)[] {
  const c = s.stats.career
  const l = s.stats.last12
  const gk = s.position === 'Goalkeeper' || s.position === 'Defender'
  return [
    s.age,
    s.mv != null && s.mv > 0 ? Math.log(s.mv) : null,
    s.season,
    Math.log1p(c.minutes),
    Math.log1p(l.minutes),
    gk ? METRICS.cleanSheetRate.value(c) : METRICS.ga90.value(c),
    METRICS.startRate.value(c),
    Math.log1p(c.euro_minutes),
    s.academy ? 1 : 0,
  ]
}
// Market value and output weigh most; era and academy status matter less
const WEIGHTS = [1, 1.6, 0.6, 1, 0.8, 1.2, 0.6, 0.5, 0.5]

export interface Suggestion {
  sale: Sale
  similarity: number
}

/** Rival sales in the same position closest to `target`, by standardised weighted distance. */
export function mostSimilar(target: Sale, candidates: Sale[], all: Sale[], n = 5): Suggestion[] {
  const pool = samePosition(all, target.position)
  const f = pool.map(features)
  const dims = WEIGHTS.length
  const sd = Array.from({ length: dims }, (_, i) => {
    const xs = f.map((r) => r[i]).filter((v): v is number => v != null)
    const m = xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
    const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length || 1)
    return Math.sqrt(v) || 1
  })
  const ft = features(target)
  return candidates
    .filter((s) => s.position === target.position && s.key !== target.key)
    .map((s) => {
      const fs = features(s)
      let num = 0
      let den = 0
      for (let i = 0; i < dims; i++) {
        if (ft[i] == null || fs[i] == null) continue
        num += WEIGHTS[i] * ((ft[i]! - fs[i]!) / sd[i]) ** 2
        den += WEIGHTS[i]
      }
      const d = den ? Math.sqrt(num / den) : Infinity
      return { sale: s, similarity: Math.round(100 * Math.exp(-d)) }
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, n)
}

export function rivalGroups(g: Group): Group[] {
  if (g === 'Real Madrid') return ['Barcelona']
  if (g === 'Barcelona') return ['Real Madrid']
  return ['Real Madrid', 'Barcelona']
}

export const WINDOW_LABEL: Record<StatWindow, string> = {
  career: 'Career before the sale',
  last12: 'Last 12 months before the sale',
}
