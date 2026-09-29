import { createContext, useContext } from 'react'

export type Group = 'Real Madrid' | 'Barcelona' | 'Other elite' | 'Other'
export const TRACKED: Group[] = ['Real Madrid', 'Barcelona', 'Other elite']

export interface Premium {
  pct: number
  ci_low: number
  ci_high: number
  p_value: number
  n_a: number
  n_b: number
}
type Contrasts = Partial<Record<'rm_vs_barca' | 'rm_vs_elite' | 'barca_vs_elite', Premium>>

export interface Interval {
  median: number | null
  ci_low: number | null
  ci_high: number | null
  n: number
}

export interface Summary {
  meta: {
    generated_at: string
    data_snapshot: string
    is_demo: boolean
    start_date: string
    min_fee_eur: number
    n_sales: number
    n_tracked_sales: number
    price_index_base_season: number
    primary_n: number
    primary_r2: number
  }
  verdict: { status: 'supported' | 'reversed' | 'not_supported' | 'insufficient_data' } & Partial<Premium>
  premiums: Record<'market_value' | 'fundamentals', Contrasts>
  robustness: ({ label: string; spec: string } & Contrasts)[]
  permutation_rm_vs_barca: { diff_pct: number | null; p_value: number | null; n_a: number; n_b: number }
  groups: {
    group: Group
    n: number
    n_academy: number
    fee_to_mv: Interval
    residual_pct: Interval
    median_fee_adj: number | null
    total_fee_adj: number
  }[]
  clubs: { club: string; group: Group; n: number; residual_pct: Interval; fee_to_mv_median: number }[]
  by_season: { season: number; seller_group: Group; n: number; median_residual_pct: number | null }[]
  price_index: Record<string, number>
}

export interface Sale {
  id: number
  player: string
  date: string
  season: number
  group: Group
  club: string
  from: string
  to: string
  buyer_league: string
  academy: boolean
  position: string | null
  sub_position: string | null
  age: number | null
  fee: number
  fee_adj: number
  mv: number | null
  fee_to_mv: number | null
  expected_fee: number | null
  residual: number | null
  minutes: number
  goals: number
  assists: number
  has_perf: boolean
}

export interface Data {
  summary: Summary
  sales: Sale[]
}

export async function loadData(): Promise<Data> {
  const base = `${import.meta.env.BASE_URL}data/`
  const [summary, sales] = await Promise.all([
    fetch(`${base}summary.json`).then((r) => {
      if (!r.ok) throw new Error(`summary.json: HTTP ${r.status}`)
      return r.json()
    }),
    fetch(`${base}sales.json`).then((r) => {
      if (!r.ok) throw new Error(`sales.json: HTTP ${r.status}`)
      return r.json()
    }),
  ])
  return { summary, sales }
}

export const DataContext = createContext<Data | null>(null)

export function useData(): Data {
  const d = useContext(DataContext)
  if (!d) throw new Error('useData outside provider')
  return d
}

// ---------- formatting ----------

export function eur(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return '–'
  if (Math.abs(x) >= 1e6) return `€${(x / 1e6).toFixed(x >= 1e8 ? 0 : 1)}m`
  if (Math.abs(x) >= 1e3) return `€${Math.round(x / 1e3)}k`
  return `€${Math.round(x)}`
}

export function signedPct(x: number | null | undefined, digits = 0): string {
  if (x == null || Number.isNaN(x)) return '–'
  const v = x * 100
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`
}

export function pValue(p: number | null | undefined): string {
  if (p == null) return '–'
  return p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`
}

export function seasonLabel(s: number): string {
  return `${s}/${String((s + 1) % 100).padStart(2, '0')}`
}

/** Premium of the actual fee over the expected fee, as a fraction. */
export function premiumOf(s: Sale): number | null {
  return s.residual == null ? null : Math.expm1(s.residual)
}
