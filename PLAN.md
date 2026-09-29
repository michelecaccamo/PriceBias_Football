# PriceBias Football — Project Plan

**Hypothesis (H1):** When Real Madrid sells a player, the fee is higher than the player's
"expected value", and higher than what FC Barcelona got for a comparable player.

**Null hypothesis (H0):** After controlling for player characteristics and market conditions,
the selling club (Real Madrid vs. Barcelona vs. other elite clubs) has no effect on the fee.

The goal is to **test** the claim honestly, not to confirm it. The dashboard should show the
result whichever way it comes out.

---

## 1. Define what "overvalued" means

"Overvalued" needs a number before we can test it. We'll measure it three ways and check
whether they agree:

| Metric | Definition | Pros / cons |
|---|---|---|
| **Market-value premium** | `fee / Transfermarkt market value at time of sale` | Simple and intuitive. But the TM value may *already* include a "Madrid brand" bump, which would hide the effect (circularity). |
| **Model residual** (main metric) | `log(fee) − log(predicted fee)`, where the predicted fee comes from a model trained on *all* transfers using only player attributes (age, position, performance, contract, league, year) and **not** the selling club | Measures the "unexplained" part of the fee. This is the most defensible metric. |
| **Post-transfer return** | Fee per minute played or per goal contribution at the buying club over the next 2 seasons | Answers a different question: did the buyer overpay in hindsight? |

## 2. Data sources

| Source | What it gives us | Access |
|---|---|---|
| **transfermarkt-datasets** (GitHub `dcaribou/transfermarkt-datasets`, also on Kaggle) | Transfers with fees, market-value history, players (age, position, foot, height), clubs, appearances, contract dates | Free CSV/Parquet, updated weekly. **Main source.** |
| **FBref / Opta via `soccerdata`** Python package | Performance stats: minutes, xG, xA, progressive actions, per-90 metrics | Scraping, so it needs caching and rate limits |
| **Transfermarkt (manual top-up)** | Add-ons, buy-back clauses, sell-on percentages for the RM and Barça samples | Manual annotation. The samples are small enough to do this. |
| **Inflation index** | Adjusts fees for football's price inflation (e.g., yearly median top-5-league fee, or the CIES/KPMG index) | Built from the transfers data itself |

**Scope:** outgoing transfers with a fee, from the **2009/10 season** to today. Real Madrid,
FC Barcelona, and a **control group** of elite sellers (Bayern, Juventus, Man Utd, Chelsea, PSG,
Atlético, Man City, Liverpool, Arsenal, Milan, Inter, Dortmund). **Academy and B-team sales
(Castilla / Barça Atlètic, plus the youth teams) are included** and carry an `is_academy` flag,
so every result can also be shown for first-team sales only. For seasons before about 2017,
when FBref's advanced stats (xG, xA) are thin, the model falls back to basic stats (minutes,
goals, assists, starts).

## 3. Data cleaning and feature engineering

- Keep only permanent transfers with a fee > 0. Handle loans with an obligation to buy as sales;
  drop pure loans and free transfers (keep them for context only).
- **Inflation-adjust** every fee and market value to euros of 2025 or 2026.
- Features for each sale:
  - Age at sale, position (GK/DEF/MID/FWD plus sub-position), nationality group
  - Months left on the contract (a strong driver of price)
  - Performance over the last 1–2 seasons: minutes share, per-90 G+A, xG+xA, starts
  - Senior international caps (a proxy for reputation)
  - Peak market value to date, and market value 6 months before the sale
  - Buying club's league and financial tier (Premier League buyers pay more)
  - Transfer window (summer/winter) and year
  - **Contract clauses**: buy-back option and sell-on percentage. Real Madrid uses buy-back
    clauses often (Hakimi, Reguilón, Morata, Nico Paz…). Barça has had its own
    financial-distress sales (2020–2023). Both affect the price and need flags.
  - Barça "financial crisis" dummy (2020–2023), since distressed sellers usually get less

## 4. Statistical analysis

1. **Descriptive comparison:** distributions of the premium and the residual for RM, Barça, and
   the control group (box/violin plots, medians, bootstrap 95% CIs).
2. **Hedonic regression (main test):**
   `log(fee) ~ age + age² + position + contract_months + performance + log(prev_market_value) + buyer_league + year FE + seller_club`
   The coefficient on `seller = Real Madrid` (with Barça as the reference, and also with
   "other elite" as the reference) is the "Madrid premium". Use robust standard errors.
3. **Out-of-sample ML check:** train a gradient-boosting model (LightGBM/XGBoost) *without* the
   seller feature on non-RM/Barça transfers, predict the RM and Barça sales, and compare
   residuals. Use SHAP to explain individual cases.
4. **Matched pairs:** for each RM sale, find the k nearest Barça sales on age, position,
   performance, contract, and year (nearest-neighbour or propensity matching). Compare fees
   pair by pair. This drives the "RM player vs. similar Barça player" view in the dashboard.
5. **Robustness:**
   - Permutation test: shuffle the club labels and see how often a premium this large shows up
     by chance.
   - Exclude outliers (for example, the €100M+ deals).
   - Split by era (pre-2017 vs. post-Neymar inflation) and by academy vs. signed players.
   - Repeat with Atlético or Bayern as the "treated" club to check whether the effect is unique
     to Madrid.
6. **Report effect sizes with confidence intervals**, not only p-values. Samples are small
   (roughly 60–120 paid sales per club), so be explicit about statistical power.

### Known pitfalls to address openly
- **Selection bias:** Real Madrid may sell players at a different career stage (young players
  with buy-back clauses) than Barça.
- **Circularity:** Transfermarkt values may already carry a brand bias. This is why the main
  metric is model-based.
- **Hidden fee components:** add-ons, player swaps, and undisclosed fees. Flag them and run a
  sensitivity analysis.
- **Confirmation bias:** we have a favoured answer, so fix the metrics and tests *before*
  looking at the results, and write them in this document.

## 5. Web app / dashboard

**Architecture: a static site with the analysis done ahead of time.**
The Python pipeline runs all the analysis and exports the results as JSON files. A React
front end reads those files in the browser. There is no server to run, so the site can be hosted
for free and never "sleeps".

- **Analysis:** Python, pandas, DuckDB/Parquet, statsmodels, scikit-learn/LightGBM, SHAP
- **Front end:** Vite + React + TypeScript, Tailwind CSS, Plotly.js / Recharts for charts,
  React Router for pages
- **Hosting:** GitHub Pages, deployed automatically by a GitHub Actions workflow on every push to
  `main`. It's free because the repository is public. URL:
  **https://michelecaccamo.github.io/PriceBias_Football/**
- **Data refresh:** a scheduled GitHub Action (e.g., monthly) re-downloads the data, reruns the
  pipeline, and redeploys

**Pages:**
1. **Verdict / overview:** headline answer ("Real Madrid sales carry a +X% premium vs. Barça,
   95% CI [a, b]"), sample sizes, and a short methodology note.
2. **Distributions:** premium and residual by club, with filters for era, position, age, and
   buyer league.
3. **Player vs. player:** pick a Real Madrid sale and see its closest Barça matches side by side
   (stats radar, fee, predicted fee).
4. **Fee vs. expected fee scatter:** every sale on one chart, with RM and Barça highlighted.
   Points above the diagonal are "overpaid". Hovering shows the player.
5. **Model explorer:** regression table, SHAP explanation for any single transfer, and
   robustness checks shown as toggles.
6. **Hindsight:** did buyers of RM players get their money's worth (post-transfer performance
   per € spent)?
7. **Data and caveats:** sources, cleaning rules, known limitations, and downloadable data.

## 6. Repository structure

```
PriceBias_Football/
├── data/
│   ├── raw/            # downloaded datasets (git-ignored)
│   ├── manual/         # hand-annotated clauses/add-ons (versioned CSV)
│   └── processed/      # cleaned parquet tables
├── src/pricebias/
│   ├── ingest/         # download transfermarkt-datasets, fbref via soccerdata
│   ├── clean.py        # filters, inflation adjustment
│   ├── features.py     # feature engineering
│   ├── models/         # hedonic regression, GBM, matching
│   └── analysis.py     # tests, bootstrap, permutation
├── pipeline/
│   └── export.py       # writes results as JSON into web/public/data/
├── web/                # Vite + React + TypeScript front end
│   ├── public/data/    # generated JSON (the analysis results)
│   └── src/pages/      # the dashboard pages above
├── .github/workflows/  # deploy-to-Pages + scheduled data refresh
├── notebooks/          # exploration
├── tests/              # unit tests for cleaning/features/stats
├── pyproject.toml
└── README.md
```

## 7. Milestones

| # | Milestone | Deliverable |
|---|---|---|
| 1 | Setup + ingestion | Repo skeleton; script that downloads the Transfermarkt data and filters it to the clubs in scope |
| 2 | Exploratory analysis | Notebook with raw RM vs. Barça fee/market-value comparisons (first rough answer) |
| 3 | Features + performance data | Clean feature table joined with FBref stats, inflation-adjusted |
| 4 | Models + tests | Hedonic regression, GBM residuals, matching, robustness suite |
| 5 | Dashboard v1 | React site with the Verdict, Distributions, and Scatter pages, live on GitHub Pages |
| 6 | Dashboard v2 | Player-vs-player matching, SHAP explorer, Hindsight page |
| 7 | Polish + write-up | Scheduled data refresh, mobile layout, and a README summarising the findings and limitations |

## 8. Decisions made
- Time window: **2009/10 season onward**.
- **Academy/B-team sales included**, with a flag so they can be filtered out.
- Front end: **polished custom React site** on GitHub Pages (free), not Streamlit.
