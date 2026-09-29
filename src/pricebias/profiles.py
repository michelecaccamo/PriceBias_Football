"""Player profiles at the moment of each sale, for the player comparison page.

Everything here only uses information dated *before* the transfer: appearances,
results, market-value history. Appearances are limited to the competitions the
dataset covers (top-flight leagues, UEFA cups, main domestic cups), so reserve
and youth football is mostly missing.
"""

import numpy as np
import pandas as pd

WINDOWS = {"career": None, "last12": 365}
# A game counts for clean sheets / goals conceded when the player was on the pitch this long
FULL_GAME_MINUTES = 60


def _player_games(appearances: pd.DataFrame, tables: dict, player_ids) -> pd.DataFrame:
    """Appearances of the given players, enriched with result, conceded goals and start."""
    app = appearances[appearances["player_id"].isin(player_ids)].copy()

    games = tables["games"]
    app = app.merge(games, on="game_id", how="left")
    home = app["player_club_id"] == app["home_club_id"]
    app["goals_for"] = np.where(home, app["home_club_goals"], app["away_club_goals"])
    app["goals_against"] = np.where(home, app["away_club_goals"], app["home_club_goals"])
    known = app["goals_for"].notna() & app["goals_against"].notna()
    app["win"] = known & (app["goals_for"] > app["goals_against"])
    app["draw"] = known & (app["goals_for"] == app["goals_against"])
    app["result_known"] = known
    app["euro"] = app["competition_type"].eq("international_cup")

    lineups = tables["game_lineups"]
    starters = lineups[lineups["type"] == "starting_lineup"][["game_id", "player_id"]]
    starters = starters.drop_duplicates().assign(started=True)
    app = app.merge(starters, on=["game_id", "player_id"], how="left")
    app["started"] = app["started"].fillna(False).astype(bool)

    full = app["minutes_played"] >= FULL_GAME_MINUTES
    app["full_known"] = full & known
    app["clean_sheet"] = app["full_known"] & (app["goals_against"] == 0)
    app["conceded_full"] = np.where(app["full_known"], app["goals_against"], 0)
    app["euro_minutes"] = np.where(app["euro"], app["minutes_played"], 0)
    return app


def _window_stats(app: pd.DataFrame, keys: pd.DataFrame, days: int | None) -> pd.DataFrame:
    df = app.merge(keys, on="player_id")
    mask = df["date"] < df["transfer_date"]
    if days is not None:
        mask &= df["date"] >= df["transfer_date"] - pd.Timedelta(days=days)
    agg = (
        df[mask]
        .groupby("sale_id")
        .agg(
            apps=("minutes_played", "size"),
            starts=("started", "sum"),
            minutes=("minutes_played", "sum"),
            goals=("goals", "sum"),
            assists=("assists", "sum"),
            yellow=("yellow_cards", "sum"),
            red=("red_cards", "sum"),
            results=("result_known", "sum"),
            wins=("win", "sum"),
            draws=("draw", "sum"),
            full_games=("full_known", "sum"),
            clean_sheets=("clean_sheet", "sum"),
            conceded=("conceded_full", "sum"),
            euro_minutes=("euro_minutes", "sum"),
        )
    )
    return agg.reindex(keys["sale_id"]).fillna(0).astype(int)


def _valuation_history(keys: pd.DataFrame, valuations: pd.DataFrame) -> pd.DataFrame:
    """Peak market value before the sale and the value about a year earlier."""
    v = valuations.merge(keys, on="player_id")
    v = v[v["date"] < v["transfer_date"]]
    peak = v.groupby("sale_id")["market_value_in_eur"].max().rename("mv_peak")
    year_ago = v[v["date"] <= v["transfer_date"] - pd.Timedelta(days=365)]
    last = year_ago.sort_values("date").groupby("sale_id")["market_value_in_eur"].last()
    out = pd.concat([peak, last.rename("mv_year_before")], axis=1)
    return out.reindex(keys["sale_id"])


def _next_move(sales: pd.DataFrame, transfers: pd.DataFrame) -> pd.DataFrame:
    """The player's next paid transfer after this one (hindsight on the buyer's side)."""
    t = transfers[pd.to_numeric(transfers["transfer_fee"], errors="coerce") > 0]
    t = t[["player_id", "transfer_date", "to_club_name", "transfer_fee"]]
    keys = sales[["sale_id", "player_id", "transfer_date"]]
    m = keys.merge(t, on="player_id", suffixes=("", "_next"))
    m = m[m["transfer_date_next"] > m["transfer_date"]].sort_values("transfer_date_next")
    first = m.groupby("sale_id").first()
    return pd.DataFrame(
        {
            "next_date": first["transfer_date_next"].dt.strftime("%Y-%m-%d"),
            "next_to": first["to_club_name"],
            "next_fee": pd.to_numeric(first["transfer_fee"], errors="coerce"),
        }
    ).reindex(sales["sale_id"])


def build_profiles(sales: pd.DataFrame, tables: dict) -> pd.DataFrame:
    """Per-sale profile columns, indexed by sale_id. Prefixes: career_*, last12_*."""
    keys = sales[["sale_id", "player_id", "transfer_date"]].reset_index(drop=True)
    app = _player_games(tables["appearances"], tables, keys["player_id"].unique())
    parts = []
    for name, days in WINDOWS.items():
        parts.append(_window_stats(app, keys, days).add_prefix(f"{name}_"))
    parts.append(_valuation_history(keys, tables["player_valuations"]))
    parts.append(_next_move(sales, tables["transfers"]))
    return pd.concat(parts, axis=1)
