import type { ReactNode } from 'react'
import { eur, useData } from '../data'
import { Card, PageHeader } from '../components/ui'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <div className="space-y-3 text-sm leading-relaxed text-ink-2 [&_strong]:text-ink">{children}</div>
    </Card>
  )
}

export default function Methodology() {
  const { summary } = useData()
  const m = summary.meta
  return (
    <>
      <PageHeader eyebrow="Methodology" title="How the test works, and where it can go wrong">
        The question was written down, and the decision rule fixed, before the results were computed. This
        page explains every step so the answer can be checked, and challenged.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="1 · Data">
          <p>
            All transfers come from the open{' '}
            <a className="text-accent underline" href="https://github.com/dcaribou/transfermarkt-datasets">
              transfermarkt-datasets
            </a>{' '}
            project, which republishes Transfermarkt data (snapshot up to {m.data_snapshot}). Performance
            (minutes, goals, assists) comes from the same source.
          </p>
          <p>
            We keep <strong>permanent transfers with a fee of at least {eur(m.min_fee_eur)}</strong> made on or
            after {m.start_date}: {m.n_sales.toLocaleString()} sales in total. Loans, free transfers and
            undisclosed fees are excluded.
          </p>
          <p>
            <strong>Academy sales count.</strong> Sales from Real Madrid Castilla and the youth teams, and from
            Barça Atlètic and La Masia teams, are attributed to their club and flagged, so they can be filtered
            out.
          </p>
        </Section>

        <Section title="2 · Who is compared with whom">
          <p>
            Sellers fall into four groups: <strong>Real Madrid</strong>, <strong>Barcelona</strong>,{' '}
            <strong>eleven other elite clubs</strong> (Bayern, Juventus, Manchester United, Chelsea, PSG,
            Atlético, Manchester City, Liverpool, Arsenal, Milan, Inter, Dortmund) and{' '}
            <strong>every other club</strong>.
          </p>
          <p>
            The elite group is the control: if Real Madrid's premium over Barcelona is also a premium over every
            other elite club, it is about Madrid. If it isn't, it may be about Barcelona.
          </p>
        </Section>

        <Section title="3 · Expected fee">
          <p>
            A regression on the log of the fee, trained on every sale <em>except</em> Real Madrid's and
            Barcelona's, predicts what a player should fetch from:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Transfermarkt market value at the time of the sale</li>
            <li>age (and age squared), position</li>
            <li>minutes, and goals + assists per 90, in the 12 months before the sale (from 2013/14)</li>
            <li>buyer league (the Premier League pays more), season, summer or winter window</li>
            <li>whether the player came from an academy side</li>
          </ul>
          <p>
            The <strong>premium</strong> of a sale is how far the actual fee is above or below that prediction.
            The model explains {Math.round(m.primary_r2 * 100)}% of the variation in (log) fees.
          </p>
        </Section>

        <Section title="4 · The test">
          <p>
            The main estimate adds the seller group to the same regression, fitted on all{' '}
            {m.primary_n.toLocaleString()} sales with complete data. The Real Madrid vs. Barcelona premium is the
            difference between the two clubs' coefficients, with robust (HC3) 95% confidence intervals.
          </p>
          <p>
            <strong>Decision rule:</strong> the claim is <em>supported</em> if the whole interval is above zero,{' '}
            <em>reversed</em> if it is below zero, and <em>not proven</em> otherwise.
          </p>
          <p>
            A shuffle (permutation) test gives a second opinion that makes no distributional assumptions: it
            relabels Real Madrid and Barcelona sales at random 10,000 times and counts how often the gap is as
            large as the real one.
          </p>
        </Section>

        <Section title="5 · Known limitations">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Small samples.</strong> Real Madrid and Barcelona each make only a few paid sales a year,
              so intervals are wide. Treat single-season numbers with care.
            </li>
            <li>
              <strong>Market values may already carry the bias.</strong> If Transfermarkt rates Madrid players
              higher <em>because</em> they play for Madrid, controlling for market value hides part of the
              premium. The “without market value” check addresses this, but it controls less for player
              quality.
            </li>
            <li>
              <strong>Clauses are not in the data.</strong> Buy-back options (common at Real Madrid), sell-on
              percentages, add-ons and player swaps change the headline fee and aren't modelled yet.
            </li>
            <li>
              <strong>Forced sales.</strong> Barcelona's 2020–2023 financial crisis may have pushed its prices
              down. That would make Madrid look expensive by comparison, which is why the elite control group
              matters.
            </li>
            <li>
              <strong>Coverage.</strong> The dataset records transfers of players who appeared in the leagues it
              covers, so some small academy sales abroad may be missing.
            </li>
          </ul>
        </Section>

        <Section title="6 · Reproduce it">
          <p>
            Everything is open source. The Python pipeline downloads the data, fits the models and writes the
            JSON files this site reads; a GitHub Action rebuilds the site on every change.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs text-ink">
{`pip install -e .
python -m pricebias.export --download`}
          </pre>
          <p className="text-muted">Results generated {m.generated_at.replace('T', ' ').replace('+00:00', ' UTC')}.</p>
        </Section>
      </div>
    </>
  )
}
