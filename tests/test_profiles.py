import pandas as pd

from pricebias.profiles import build_profiles


def ts(s):
    return pd.Timestamp(s)


def test_profile_windows_and_results():
    sales = pd.DataFrame(
        {"sale_id": [7], "player_id": [1], "transfer_date": [ts("2020-07-01")]}
    )
    appearances = pd.DataFrame(
        {
            "game_id": [1, 2, 3, 4],
            "player_id": [1, 1, 1, 1],
            "player_club_id": [10, 10, 10, 10],
            # two old games, one within the last year, one after the sale (ignored)
            "date": [ts("2018-01-01"), ts("2018-06-01"), ts("2020-01-01"), ts("2020-08-01")],
            "goals": [1, 0, 2, 5],
            "assists": [0, 1, 1, 5],
            "minutes_played": [90, 30, 90, 90],
            "yellow_cards": [1, 0, 0, 0],
            "red_cards": [0, 0, 0, 0],
        }
    )
    games = pd.DataFrame(
        {
            "game_id": [1, 2, 3, 4],
            "home_club_id": [10, 20, 10, 10],
            "away_club_id": [20, 10, 30, 30],
            "home_club_goals": [2, 1, 0, 3],
            "away_club_goals": [0, 1, 1, 0],
            "competition_type": ["domestic_league", "international_cup", "domestic_league", "x"],
        }
    )
    lineups = pd.DataFrame(
        {"game_id": [1, 2, 3], "player_id": [1, 1, 1],
         "type": ["starting_lineup", "substitutes", "starting_lineup"]}
    )
    valuations = pd.DataFrame(
        {
            "player_id": [1, 1, 1],
            "date": [ts("2018-12-01"), ts("2019-12-01"), ts("2021-01-01")],
            "market_value_in_eur": [5e6, 8e6, 20e6],
        }
    )
    transfers = pd.DataFrame(
        {
            "player_id": [1, 1],
            "transfer_date": [ts("2020-07-01"), ts("2022-07-01")],
            "to_club_name": ["Buyer", "Next Club"],
            "transfer_fee": [10e6, 25e6],
        }
    )
    tables = {
        "appearances": appearances,
        "games": games,
        "game_lineups": lineups,
        "player_valuations": valuations,
        "transfers": transfers,
    }
    p = build_profiles(sales, tables).loc[7]

    assert p["career_apps"] == 3 and p["last12_apps"] == 1
    assert p["career_goals"] == 3 and p["career_assists"] == 2
    assert p["career_starts"] == 2
    assert p["career_wins"] == 1 and p["career_draws"] == 1
    # clean sheet only counts games of 60+ minutes: game 1 (2-0 win)
    assert p["career_clean_sheets"] == 1 and p["career_full_games"] == 2
    assert p["career_conceded"] == 1  # game 3, lost 0-1
    assert p["career_euro_minutes"] == 30
    assert p["mv_peak"] == 8e6  # the 2021 valuation is after the sale
    assert p["mv_year_before"] == 5e6
    assert p["next_to"] == "Next Club" and p["next_fee"] == 25e6
