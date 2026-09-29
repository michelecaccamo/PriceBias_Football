"""Run the full pipeline and write the JSON files the website reads.

    python -m pricebias.export --raw data/raw --out web/public/data --download
    python -m pricebias.export --demo --out web/public/data   # synthetic data
"""

import argparse
import json
import tempfile
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from pricebias import ingest
from pricebias.analysis import bootstrap_median, permutation_test
from pricebias.clean import build_sales
from pricebias.config import (
    BARCELONA,
    CLUBS,
    ELITE,
    GROUPS,
    MIN_FEE_EUR,
    OTHER,
    REAL_MADRID,
    START_DATE,
)
from pricebias.models import expected_fee, fit_premiums, price_index

PRIMARY_SPEC = "market_value"
TRACKED = [REAL_MADRID, BARCELONA, ELITE]


def verdict(p: dict | None) -> dict:
    """Pre-registered decision rule on the primary Real Madrid vs Barcelona estimate."""
    if p is None:
        return {"status": "insufficient_data"}
    if p["ci_low"] > 0:
        status = "supported"
    elif p["ci_high"] < 0:
        status = "reversed"
    else:
        status = "not_supported"
    return {"status": status, "spec": PRIMARY_SPEC, **p}


def pct(x):
    return None if x is None else float(np.expm1(x))


def residual_summary(res: pd.Series) -> dict:
    b = bootstrap_median(res)
    return {k: (pct(v) if k != "n" else v) for k, v in b.items()}


def summarise(sales: pd.DataFrame, is_demo: bool) -> tuple[dict, list[dict], dict]:
    premiums, primary_fit = {}, None
    for spec in ["market_value", "fundamentals"]:
        est, fit = fit_premiums(sales, spec)
        premiums[spec] = {k: v.as_dict() for k, v in est.items()}
        if spec == PRIMARY_SPEC:
            primary_fit = fit

    idx = price_index(primary_fit)
    latest = max(idx)
    sales["fee_adj"] = sales["transfer_fee"] * idx[latest] / sales["season"].map(idx)
    sales = sales.join(expected_fee(sales, PRIMARY_SPEC))

    robustness = []
    subsets = [
        ("All sales (primary)", PRIMARY_SPEC, sales),
        ("Without market value (fundamentals only)", "fundamentals", sales),
        ("First-team sales only", PRIMARY_SPEC, sales[~sales["is_academy"]]),
        ("2009/10 – 2016/17", PRIMARY_SPEC, sales[sales["season"] <= 2016]),
        ("2017/18 onward", PRIMARY_SPEC, sales[sales["season"] >= 2017]),
        (
            "Excluding the top 1% of fees",
            PRIMARY_SPEC,
            sales[sales["fee_adj"] < sales["fee_adj"].quantile(0.99)],
        ),
    ]
    for label, spec, df in subsets:
        try:
            est, _ = fit_premiums(df, spec)
        except (ValueError, np.linalg.LinAlgError) as exc:  # tiny subsets: report, don't crash
            print(f"Robustness '{label}' skipped: {exc}")
            continue
        robustness.append({"label": label, "spec": spec, **{k: v.as_dict() for k, v in est.items()}})

    groups = []
    for g in GROUPS:
        d = sales[sales["seller_group"] == g]
        groups.append(
            {
                "group": g,
                "n": len(d),
                "n_academy": int(d["is_academy"].sum()),
                "fee_to_mv": bootstrap_median(d["fee_to_mv"]),
                "residual_pct": residual_summary(d["residual"]),
                "median_fee_adj": float(d["fee_adj"].median()) if len(d) else None,
                "total_fee_adj": float(d["fee_adj"].sum()),
            }
        )

    clubs = []
    for club, spec in CLUBS.items():
        d = sales[sales["seller_club"] == club]
        if len(d) == 0:
            continue
        clubs.append(
            {
                "club": club,
                "group": spec["group"],
                "n": len(d),
                "residual_pct": residual_summary(d["residual"]),
                "fee_to_mv_median": float(d["fee_to_mv"].median()),
            }
        )

    rm = sales.loc[sales["seller_group"] == REAL_MADRID, "residual"]
    fcb = sales.loc[sales["seller_group"] == BARCELONA, "residual"]
    perm = permutation_test(rm, fcb)
    perm["diff_pct"] = pct(perm["diff"])

    by_season = (
        sales[sales["seller_group"].isin(TRACKED)]
        .groupby(["season", "seller_group"])
        .agg(n=("sale_id", "size"), median_residual=("residual", "median"))
        .reset_index()
    )
    by_season["median_residual_pct"] = np.expm1(by_season["median_residual"])

    summary = {
        "meta": {
            "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "data_snapshot": sales["transfer_date"].max().date().isoformat(),
            "is_demo": is_demo,
            "start_date": START_DATE.isoformat(),
            "min_fee_eur": MIN_FEE_EUR,
            "n_sales": len(sales),
            "n_tracked_sales": int(sales["seller_group"].isin(TRACKED).sum()),
            "price_index_base_season": latest,
            "primary_n": int(primary_fit.nobs),
            "primary_r2": round(float(primary_fit.rsquared), 3),
        },
        "verdict": verdict(premiums[PRIMARY_SPEC].get("rm_vs_barca")),
        "premiums": premiums,
        "robustness": robustness,
        "permutation_rm_vs_barca": perm,
        "groups": groups,
        "clubs": clubs,
        "by_season": json.loads(
            by_season[["season", "seller_group", "n", "median_residual_pct"]].to_json(
                orient="records"
            )
        ),
        "price_index": {str(k): round(v, 4) for k, v in idx.items()},
    }

    cols = {
        "sale_id": "id",
        "player_name": "player",
        "transfer_date": "date",
        "season": "season",
        "seller_group": "group",
        "seller_club": "club",
        "from_club_name": "from",
        "to_club_name": "to",
        "buyer_league": "buyer_league",
        "is_academy": "academy",
        "position": "position",
        "sub_position": "sub_position",
        "age": "age",
        "transfer_fee": "fee",
        "fee_adj": "fee_adj",
        "market_value_in_eur": "mv",
        "fee_to_mv": "fee_to_mv",
        "expected_fee": "expected_fee",
        "residual": "residual",
        "minutes": "minutes",
        "goals": "goals",
        "assists": "assists",
        "has_perf": "has_perf",
    }
    tracked = sales[sales["seller_group"].isin(TRACKED)][list(cols)].rename(columns=cols)
    tracked["date"] = tracked["date"].dt.strftime("%Y-%m-%d")
    for c in ["age", "fee_to_mv", "residual"]:
        tracked[c] = tracked[c].round(3)
    for c in ["fee_adj", "expected_fee"]:
        tracked[c] = tracked[c].round(-3)
    records = json.loads(tracked.to_json(orient="records"))

    mapping = (
        sales[sales["seller_group"] != OTHER]
        .groupby(["seller_club", "is_academy", "from_club_name"])
        .size()
        .rename("n")
        .reset_index()
    )
    # Unmatched sellers whose name looks like a tracked club: catches naming variants
    hint = r"madrid|castilla|barc|atl|bayern|juve|manch|man |chelsea|paris|psg|liverp|arsenal|milan|inter|dortm"
    other = sales[sales["seller_group"] == OTHER]
    suspects = (
        other[other["from_club_name"].str.lower().str.contains(hint, na=False)]
        .groupby("from_club_name")
        .size()
        .sort_values(ascending=False)
        .head(60)
    )
    diagnostics = {
        "seller_name_mapping": json.loads(mapping.to_json(orient="records")),
        "unmatched_lookalikes": {k: int(v) for k, v in suspects.items()},
    }
    return summary, records, diagnostics


def write(out_dir: Path, summary: dict, records: list[dict], diagnostics: dict) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=1))
    (out_dir / "sales.json").write_text(json.dumps(records, separators=(",", ":")))
    (out_dir / "diagnostics.json").write_text(json.dumps(diagnostics, indent=1))


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=Path("data/raw"))
    parser.add_argument("--out", type=Path, default=Path("web/public/data"))
    parser.add_argument("--download", action="store_true", help="fetch the dataset first")
    parser.add_argument("--demo", action="store_true", help="use synthetic data (for development)")
    args = parser.parse_args(argv)

    if args.demo:
        from pricebias.fixtures import write_fixture

        raw = Path(tempfile.mkdtemp())
        write_fixture(raw)
    else:
        raw = args.raw
        if args.download:
            ingest.download(raw)

    sales = build_sales(ingest.load(raw))
    summary, records, diagnostics = summarise(sales, is_demo=args.demo)
    write(args.out, summary, records, diagnostics)

    v = summary["verdict"]
    print(f"{summary['meta']['n_sales']} sales, {summary['meta']['n_tracked_sales']} tracked")
    for g in summary["groups"]:
        print(f"  {g['group']:<12} n={g['n']:<6} academy={g['n_academy']}")
    print(f"Verdict: {v['status']}  RM vs Barça premium: {v.get('pct')}")
    print("Premiums:", json.dumps(summary["premiums"], indent=1))
    print("Robustness:", json.dumps(summary["robustness"], indent=1))
    print("Groups:", json.dumps(summary["groups"], indent=1))
    print("Unmatched look-alike seller names:")
    for name, n in diagnostics["unmatched_lookalikes"].items():
        print(f"  {name}  ({n})")
    print("Seller name mapping:")
    for row in diagnostics["seller_name_mapping"]:
        print(f"  {row['seller_club']:<20} academy={row['is_academy']!s:<5} "
              f"{row['from_club_name']}  ({row['n']})")


if __name__ == "__main__":
    main()
