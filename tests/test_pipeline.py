import json

import pandas as pd
import pytest

from pricebias import ingest
from pricebias.clean import build_sales, classify_club, normalise
from pricebias.config import BARCELONA, ELITE, OTHER, REAL_MADRID
from pricebias.export import main, summarise, verdict
from pricebias.fixtures import TRUE_RM_PREMIUM, write_fixture


@pytest.fixture(scope="module")
def sales(tmp_path_factory):
    raw = tmp_path_factory.mktemp("raw")
    write_fixture(raw)
    return build_sales(ingest.load(raw))


@pytest.mark.parametrize(
    "club_id,name,expected",
    [
        (418, "Real Madrid", ("Real Madrid", False)),
        (6767, "Real Madrid Castilla", ("Real Madrid", True)),
        (None, "Real Madrid U19", ("Real Madrid", True)),
        (131, "FC Barcelona", ("Barcelona", False)),
        (2464, "Barça Atlètic", ("Barcelona", True)),
        (None, "Barcelona B", ("Barcelona", True)),
        (None, "Barcelona SC", (None, False)),
        (None, "Inter Turku II", (None, False)),
        (None, "Real Madrid", (None, False)),  # first team is matched by id only
        (28, "Bayern Munich II", ("Bayern Munich", True)),
    ],
)
def test_classify_club(club_id, name, expected):
    assert classify_club(club_id, name) == expected


def test_normalise():
    assert normalise("Barça Atlètic") == "barca atletic"


def test_sales_filtering(sales):
    assert sales["transfer_date"].min() >= pd.Timestamp("2009-07-01")
    assert (sales["transfer_fee"] >= 250_000).all()
    assert set(sales["seller_group"]) == {REAL_MADRID, BARCELONA, ELITE, OTHER}
    rm = sales[sales["seller_group"] == REAL_MADRID]
    assert rm["is_academy"].any() and (~rm["is_academy"]).any()


def test_performance_window(sales):
    early = sales[~sales["has_perf"]]
    assert (early["log_minutes"] == 0).all()
    assert sales.loc[sales["has_perf"], "minutes"].gt(0).mean() > 0.8


def test_recovers_injected_premium(sales):
    summary, records, _ = summarise(sales.copy(), is_demo=True)
    est = summary["premiums"]["market_value"]["rm_vs_barca"]
    assert est["ci_low"] < TRUE_RM_PREMIUM < est["ci_high"]
    assert summary["verdict"]["status"] == "supported"
    barca = summary["premiums"]["market_value"]["barca_vs_elite"]
    assert barca["ci_low"] < 0 < barca["ci_high"]
    assert {r["group"] for r in records} == {REAL_MADRID, BARCELONA, ELITE}


def test_verdict_rule():
    assert verdict({"ci_low": 0.01, "ci_high": 0.3})["status"] == "supported"
    assert verdict({"ci_low": -0.3, "ci_high": -0.01})["status"] == "reversed"
    assert verdict({"ci_low": -0.1, "ci_high": 0.2})["status"] == "not_supported"
    assert verdict(None)["status"] == "insufficient_data"


def test_cli_demo(tmp_path):
    main(["--demo", "--out", str(tmp_path)])
    summary = json.loads((tmp_path / "summary.json").read_text())
    assert summary["meta"]["is_demo"] is True
    assert json.loads((tmp_path / "sales.json").read_text())
