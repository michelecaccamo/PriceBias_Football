"""Synthetic dataset with the same schema as transfermarkt-datasets.

Used by the tests and for local development of the website. It contains a known
Real Madrid premium (TRUE_RM_PREMIUM) so the tests can check the pipeline finds it.
Never publish results computed from it: the export marks them `is_demo`.
"""

from pathlib import Path

import numpy as np
import pandas as pd

from pricebias.config import CLUBS

TRUE_RM_PREMIUM = 0.25  # +25% vs any other seller, all else equal

YOUTH_SIDES = [
    (6767, "Real Madrid Castilla"),
    (9999001, "Real Madrid U19"),
    (2464, "Barça Atlètic"),
    (9999002, "Barcelona U19"),
    (28, "Bayern Munich II"),
    (9999003, "Chelsea U21"),
]
LEAGUE_IDS = ["GB1", "ES1", "IT1", "L1", "FR1", "PO1", "NL1"]


def make_tables(n_players: int = 4000, n_sales: int = 6000, seed: int = 42) -> dict:
    rng = np.random.default_rng(seed)

    clubs = [{"club_id": i, "name": c, "domestic_competition_id": "ES1"}
             for c, s in CLUBS.items() for i in s["ids"]]
    for k in range(60):
        clubs.append({"club_id": 100_000 + k, "name": f"Club {k}",
                      "domestic_competition_id": LEAGUE_IDS[k % len(LEAGUE_IDS)]})
    clubs_df = pd.DataFrame(clubs)
    names = dict(zip(clubs_df["club_id"], clubs_df["name"]))
    names.update(dict(YOUTH_SIDES))

    players = pd.DataFrame(
        {
            "player_id": np.arange(1, n_players + 1),
            "name": [f"Player {i}" for i in range(1, n_players + 1)],
            "date_of_birth": pd.to_datetime("1980-01-01")
            + pd.to_timedelta(rng.integers(0, 365 * 25, n_players), unit="D"),
            "position": rng.choice(["Goalkeeper", "Defender", "Midfield", "Attack"],
                                   n_players, p=[0.1, 0.33, 0.33, 0.24]),
            "sub_position": "n/a",
            "country_of_citizenship": "Spain",
            "quality": rng.normal(0, 1, n_players),
        }
    )

    seller_pool = list(clubs_df["club_id"]) + [i for i, _ in YOUTH_SIDES]
    weights = np.array([6.0 if i in (418, 131) else 3.0 if i < 100_000 else 1.0
                        for i in seller_pool])
    weights[len(clubs_df):] = 2.0
    weights /= weights.sum()

    pid = rng.integers(1, n_players + 1, n_sales)
    from_id = rng.choice(seller_pool, n_sales, p=weights)
    to_id = rng.choice(clubs_df["club_id"].to_numpy()[-60:], n_sales)
    date = pd.to_datetime("2006-07-01") + pd.to_timedelta(
        rng.integers(0, 365 * 19, n_sales), unit="D"
    )
    p = players.set_index("player_id").loc[pid]
    age = ((date - p["date_of_birth"].to_numpy()).days / 365.25).to_numpy()
    quality = p["quality"].to_numpy()
    season = (date.year - (date.month < 7)).to_numpy()

    log_mv = 15 + 0.9 * quality - 0.02 * (age - 25) ** 2 + 0.06 * (season - 2009) \
        + rng.normal(0, 0.4, n_sales)
    premium = np.where(np.isin(from_id, [418, 6767, 9999001]), np.log1p(TRUE_RM_PREMIUM), 0.0)
    log_fee = 0.2 + log_mv + 0.3 * quality + premium + rng.normal(0, 0.5, n_sales)
    fee = np.round(np.exp(log_fee), -4)
    fee[rng.random(n_sales) < 0.05] = 0  # free transfers / loans

    transfers = pd.DataFrame(
        {
            "player_id": pid,
            "transfer_date": date.strftime("%Y-%m-%d"),
            "transfer_season": [f"{s % 100:02d}/{(s + 1) % 100:02d}" for s in season],
            "from_club_id": from_id,
            "to_club_id": to_id,
            "from_club_name": [names[i] for i in from_id],
            "to_club_name": [names[i] for i in to_id],
            "transfer_fee": fee,
            "market_value_in_eur": np.round(np.exp(log_mv), -4),
            "player_name": p["name"].to_numpy(),
        }
    )

    # One synthetic game per appearance, played by the selling club
    games = []
    for pl, d, q, club in zip(pid, date, quality, from_id):
        if d.year < 2013:
            continue
        k = rng.integers(0, 35)
        gd = d - pd.to_timedelta(rng.integers(1, 700, k), unit="D")
        games.append(pd.DataFrame({
            "player_id": pl, "player_club_id": club, "date": gd.strftime("%Y-%m-%d"),
            "goals": rng.poisson(max(0.05, 0.2 + 0.1 * q), k),
            "assists": rng.poisson(0.1, k), "minutes_played": rng.integers(10, 91, k),
            "yellow_cards": rng.poisson(0.15, k), "red_cards": rng.poisson(0.01, k),
        }))
    appearances = pd.concat(games, ignore_index=True)
    n = len(appearances)
    appearances.insert(0, "game_id", np.arange(1, n + 1))
    games_df = pd.DataFrame({
        "game_id": appearances["game_id"],
        "home_club_id": appearances["player_club_id"],
        "away_club_id": 100_000,
        "home_club_goals": rng.poisson(1.5, n),
        "away_club_goals": rng.poisson(1.1, n),
        "competition_type": rng.choice(["domestic_league", "international_cup"], n, p=[0.85, 0.15]),
    })
    lineups = pd.DataFrame({
        "game_id": appearances["game_id"],
        "player_id": appearances["player_id"],
        "type": np.where(appearances["minutes_played"] > 45, "starting_lineup", "substitutes"),
    })
    valuations = pd.DataFrame({
        "player_id": pid,
        "date": (date - pd.to_timedelta(400, unit="D")).strftime("%Y-%m-%d"),
        "market_value_in_eur": np.round(np.exp(log_mv - 0.2), -4),
    })

    players["foot"] = rng.choice(["right", "left", "both"], n_players, p=[0.7, 0.25, 0.05])
    players["height_in_cm"] = rng.integers(168, 196, n_players)
    players["international_caps"] = rng.poisson(8, n_players)

    return {
        "transfers": transfers,
        "players": players.drop(columns="quality"),
        "clubs": clubs_df,
        "appearances": appearances,
        "games": games_df,
        "game_lineups": lineups,
        "player_valuations": valuations,
    }


def write_fixture(raw_dir: Path, **kwargs) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    for name, df in make_tables(**kwargs).items():
        df.to_csv(raw_dir / f"{name}.csv.gz", index=False)
