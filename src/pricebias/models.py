"""Statistical models: expected fee, club premium regressions, price index."""

from dataclasses import dataclass

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

from pricebias.config import BARCELONA, ELITE, OTHER, REAL_MADRID

# Performance terms are zero before appearance data exists (mid-2013); the season
# fixed effects absorb that coverage break, so no separate indicator is needed.
CONTROLS = (
    "age + I(age ** 2) + C(position) + C(buyer_league) + C(season) + C(window)"
    " + is_academy + log_minutes + ga90"
)
SELLER = f"C(seller_group, Treatment('{OTHER}'))"

# Spec A controls for the market value at the time of the sale; spec B leaves it out
# (so it can't hide a brand premium already baked into Transfermarkt's valuation).
SPECS = {
    "market_value": f"log_fee ~ log_mv + {CONTROLS}",
    "fundamentals": f"log_fee ~ {CONTROLS}",
}

CONTRASTS = [
    ("rm_vs_barca", REAL_MADRID, BARCELONA),
    ("rm_vs_elite", REAL_MADRID, ELITE),
    ("barca_vs_elite", BARCELONA, ELITE),
]


def formula(spec: str, df: pd.DataFrame) -> str:
    """Model formula, dropping terms that are constant in this sample (e.g. subsets)."""
    f = SPECS[spec]
    for term in ["is_academy", "log_minutes", "ga90"]:
        if df[term].nunique() < 2:
            f = f.replace(f" + {term}", "")
    return f


def model_frame(sales: pd.DataFrame, spec: str) -> pd.DataFrame:
    needed = ["log_fee", "age", "position", "seller_group"]
    if spec == "market_value":
        needed.append("log_mv")
    return sales.dropna(subset=needed)


def _term(group: str) -> str:
    return f"{SELLER}[T.{group}]"


@dataclass
class Premium:
    """exp(beta_a - beta_b) - 1: fee premium of group a over group b, all else equal."""

    pct: float
    ci_low: float
    ci_high: float
    p_value: float
    n_a: int
    n_b: int

    def as_dict(self) -> dict:
        return {k: round(float(v), 4) for k, v in self.__dict__.items()}


def fit_premiums(sales: pd.DataFrame, spec: str) -> tuple[dict[str, Premium], object]:
    """Hedonic regression of log fee on controls + seller group, HC3 robust errors."""
    df = model_frame(sales, spec)
    res = smf.ols(f"{formula(spec, df)} + {SELLER}", data=df).fit(cov_type="HC3")
    counts = df["seller_group"].value_counts()
    out = {}
    for key, a, b in CONTRASTS:
        if counts.get(a, 0) < 3 or counts.get(b, 0) < 3:
            continue
        vec = pd.Series(0.0, index=res.params.index)
        vec[_term(a)] = 1.0
        vec[_term(b)] = -1.0
        test = res.t_test(vec.values)
        est = float(np.squeeze(test.effect))
        lo, hi = np.squeeze(test.conf_int())
        out[key] = Premium(
            pct=np.expm1(est),
            ci_low=np.expm1(lo),
            ci_high=np.expm1(hi),
            p_value=float(np.squeeze(test.pvalue)),
            n_a=int(counts[a]),
            n_b=int(counts[b]),
        )
    return out, res


def expected_fee(sales: pd.DataFrame, spec: str = "market_value") -> pd.DataFrame:
    """Fee the market pays for a comparable player sold by any *other* club.

    Trained without the seller variable on every sale except Real Madrid's and
    Barcelona's, then applied to all sales (out-of-sample for RM and Barça).
    Returns expected fee in EUR (Duan smearing) and the log residual.
    """
    df = model_frame(sales, spec)
    train = df[~df["seller_group"].isin([REAL_MADRID, BARCELONA])]
    res = smf.ols(formula(spec, train), data=train).fit()
    smear = float(np.mean(np.exp(res.resid)))
    # Levels unseen in training (rare) would break predict; keep those rows NaN.
    pred = pd.Series(np.nan, index=df.index)
    ok = df["season"].isin(train["season"].unique()) & df["position"].isin(train["position"])
    pred[ok] = res.predict(df[ok])
    return pd.DataFrame(
        {
            "expected_fee": np.exp(pred) * smear,
            "residual": df["log_fee"] - pred,
        },
        index=df.index,
    )


def price_index(result) -> dict[int, float]:
    """Quality-adjusted fee level per season (first season = 1) from season fixed effects."""
    params = result.params
    seasons = {}
    for name, value in params.items():
        if name.startswith("C(season)[T."):
            seasons[int(name.split("[T.")[1].rstrip("]"))] = float(np.exp(value))
    base = min(result.model.data.frame["season"])
    seasons[int(base)] = 1.0
    return dict(sorted(seasons.items()))
