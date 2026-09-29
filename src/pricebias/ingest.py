"""Download and load the transfermarkt-datasets tables."""

import shutil
import urllib.request
from pathlib import Path

import pandas as pd

from pricebias.config import DATA_BASE_URL, DATA_FILES

# The data host rejects urllib's default user agent
USER_AGENT = "pricebias/0.1 (+https://github.com/michelecaccamo/PriceBias_Football)"
APPEARANCE_COLUMNS = ["player_id", "date", "goals", "assists", "minutes_played"]


def download(raw_dir: Path, force: bool = False) -> None:
    """Fetch the gzipped CSVs into raw_dir, skipping files already present."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    for name in DATA_FILES:
        target = raw_dir / f"{name}.csv.gz"
        if target.exists() and not force:
            continue
        url = f"{DATA_BASE_URL}/{name}.csv.gz"
        print(f"Downloading {url}")
        tmp = target.with_suffix(".part")
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=300) as resp, open(tmp, "wb") as fh:
            shutil.copyfileobj(resp, fh)
        tmp.rename(target)


def load(raw_dir: Path) -> dict[str, pd.DataFrame]:
    """Read the tables needed by the pipeline."""

    def read(name: str, **kwargs) -> pd.DataFrame:
        return pd.read_csv(raw_dir / f"{name}.csv.gz", **kwargs)

    return {
        "transfers": read("transfers", parse_dates=["transfer_date"]),
        "players": read("players", parse_dates=["date_of_birth"]),
        "clubs": read("clubs"),
        "appearances": read("appearances", usecols=APPEARANCE_COLUMNS, parse_dates=["date"]),
    }
