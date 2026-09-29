"""Turn raw transfers into one row per paid sale, with seller groups and features."""

import re
import unicodedata

import numpy as np
import pandas as pd

from pricebias.config import (
    ACADEMY_ALIASES,
    CLUBS,
    LEAGUES,
    MIN_FEE_EUR,
    OTHER,
    OTHER_LEAGUE,
    PERFORMANCE_COVERAGE_FROM,
    START_DATE,
    YOUTH_SUFFIX,
)


def normalise(name: str) -> str:
    """Lower-case, strip accents and punctuation: 'Barça Atlètic' -> 'barca atletic'."""
    if not isinstance(name, str):
        return ""
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9 \-]", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def _club_matchers() -> tuple[dict[int, str], list[tuple[re.Pattern, str]]]:
    by_id = {cid: club for club, spec in CLUBS.items() for cid in spec["ids"]}
    youth = []
    for club, spec in CLUBS.items():
        stems = "|".join(re.escape(s) for s in sorted(spec["stems"], key=len, reverse=True))
        youth.append((re.compile(rf"^(?:{stems}) {YOUTH_SUFFIX}$"), club))
    return by_id, youth


_CLUB_MATCHERS = _club_matchers()


def classify_club(club_id, club_name) -> tuple[str | None, bool]:
    """Return (tracked club name or None, is_academy) for a selling club."""
    by_id, youth = _CLUB_MATCHERS
    if pd.notna(club_id) and int(club_id) in by_id:
        return by_id[int(club_id)], False
    norm = normalise(club_name)
    if norm in ACADEMY_ALIASES:
        return ACADEMY_ALIASES[norm], True
    for pattern, club in youth:
        if pattern.match(norm):
            return club, True
    return None, False


def season_start_year(ts: pd.Series) -> pd.Series:
    """Season in which a transfer falls, e.g. 2015-08-01 and 2016-01-20 -> 2015."""
    return ts.dt.year - (ts.dt.month < 7).astype(int)


def performance_before(sales: pd.DataFrame, appearances: pd.DataFrame) -> pd.DataFrame:
    """Minutes, goals and assists in the 365 days before each sale."""
    keys = sales[["sale_id", "player_id", "transfer_date"]]
    app = appearances.merge(keys, on="player_id")
    window = (app["date"] < app["transfer_date"]) & (
        app["date"] >= app["transfer_date"] - pd.Timedelta(days=365)
    )
    agg = (
        app[window]
        .groupby("sale_id")
        .agg(
            minutes=("minutes_played", "sum"),
            goals=("goals", "sum"),
            assists=("assists", "sum"),
            apps=("minutes_played", "size"),
        )
    )
    return agg.reindex(sales["sale_id"]).fillna(0).reset_index()


def build_sales(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """One row per paid transfer since START_DATE, with seller group and model features."""
    t = tables["transfers"].copy()
    t["transfer_fee"] = pd.to_numeric(t["transfer_fee"], errors="coerce")
    t["market_value_in_eur"] = pd.to_numeric(t["market_value_in_eur"], errors="coerce")
    for col in ["from_club_id", "to_club_id"]:
        t[col] = pd.to_numeric(t[col], errors="coerce").astype("Int64")
    t = t[
        (t["transfer_date"] >= pd.Timestamp(START_DATE))
        & (t["transfer_fee"] >= MIN_FEE_EUR)
    ].copy()

    seller = [classify_club(i, n) for i, n in zip(t["from_club_id"], t["from_club_name"])]
    t["seller_club"] = [s[0] for s in seller]
    t["is_academy"] = [s[1] for s in seller]
    buyer = [classify_club(i, n)[0] for i, n in zip(t["to_club_id"], t["to_club_name"])]
    # Moves inside the same organisation (e.g. Castilla -> first team) are not sales
    t = t[~(t["seller_club"].notna() & (t["seller_club"] == pd.Series(buyer, index=t.index)))]
    group_of = {club: spec["group"] for club, spec in CLUBS.items()}
    t["seller_group"] = t["seller_club"].map(group_of).fillna(OTHER)

    players = tables["players"][
        ["player_id", "date_of_birth", "position", "sub_position", "country_of_citizenship"]
    ]
    t = t.merge(players, on="player_id", how="left")

    clubs = tables["clubs"][["club_id", "domestic_competition_id"]].drop_duplicates("club_id")
    clubs = clubs.assign(club_id=pd.to_numeric(clubs["club_id"], errors="coerce").astype("Int64"))
    t = t.merge(clubs, left_on="to_club_id", right_on="club_id", how="left")
    t["buyer_league"] = t["domestic_competition_id"].map(LEAGUES).fillna(OTHER_LEAGUE)
    t = t.drop(columns=["club_id", "domestic_competition_id"])

    t = t.sort_values(["transfer_date", "player_id"]).reset_index(drop=True)
    t["sale_id"] = np.arange(len(t))
    t["season"] = season_start_year(t["transfer_date"])
    t["window"] = np.where(t["transfer_date"].dt.month.between(5, 10), "summer", "winter")
    t["age"] = (t["transfer_date"] - t["date_of_birth"]).dt.days / 365.25
    t["position"] = t["position"].where(t["position"].isin(
        ["Goalkeeper", "Defender", "Midfield", "Attack"]
    ))

    perf = performance_before(t, tables["appearances"])
    t = t.merge(perf, on="sale_id", how="left")
    t["has_perf"] = t["transfer_date"] >= pd.Timestamp(PERFORMANCE_COVERAGE_FROM)
    t["log_minutes"] = np.where(t["has_perf"], np.log1p(t["minutes"]), 0.0)
    ga90 = (t["goals"] + t["assists"]) / t["minutes"].clip(lower=1) * 90
    t["ga90"] = np.where(t["has_perf"] & (t["minutes"] >= 450), ga90.clip(upper=2), 0.0)

    t["log_fee"] = np.log(t["transfer_fee"])
    mv = t["market_value_in_eur"].where(t["market_value_in_eur"] > 0)
    t["log_mv"] = np.log(mv)
    t["fee_to_mv"] = t["transfer_fee"] / mv
    return t
