# The Madrid Premium

**Are Real Madrid players sold for more than they are worth?** This project tests the claim with data.
It compares every paid transfer since 2009/10 from Real Madrid, FC Barcelona (academy sides included)
and eleven other elite European clubs, like for like.

**Live site:** https://michelecaccamo.github.io/PriceBias_Football/

## How it works

1. **Data**: [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets):
   transfers, market values, players, clubs and appearances.
2. **Pipeline** (`src/pricebias`, Python):
   - builds one row per paid sale (≥ €250k), tags the seller (Real Madrid, Barcelona, other elite, other)
     and flags academy / B-team sales
   - fits a hedonic regression of log fee on market value, age, position, recent form, buyer league,
     season and window, then estimates the Real Madrid vs. Barcelona premium with robust 95% intervals
   - computes each sale's *expected fee* from a model trained on every other club's sales, plus
     bootstrap medians, a permutation test and robustness checks
   - writes the results as JSON for the site
3. **Site** (`web/`, React + TypeScript + Tailwind + Plotly): a static site on GitHub Pages. It has no
   server, so it costs nothing to run.
4. **CI** (`.github/workflows/site.yml`): on every push it runs the tests, downloads the data, runs the
   pipeline, builds the site and deploys it from the default branch.

The verdict follows a decision rule fixed in advance: the claim is *supported* only if the whole 95%
confidence interval of the Real Madrid vs. Barcelona premium is above zero. See the site's
Methodology page for limitations.

## Run it locally

```bash
# analysis
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
pytest
python -m pricebias.export --download          # real data → web/public/data
# or: python -m pricebias.export --demo        # synthetic data (site shows a "Demo data" banner)

# website
cd web && npm install && npm run dev
```

See [PLAN.md](PLAN.md) for the full project plan.
