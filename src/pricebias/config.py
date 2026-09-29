"""Project-wide constants: data source, scope and club definitions."""

from datetime import date

# Public snapshot of github.com/dcaribou/transfermarkt-datasets
DATA_BASE_URL = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data"
DATA_FILES = ["transfers", "players", "clubs", "appearances"]

# Analysis window: 2009/10 season onward
START_DATE = date(2009, 7, 1)

# Fees below this are treated as nominal/solidarity amounts and excluded
MIN_FEE_EUR = 250_000

# Appearances data in the dataset starts with the 2012/13 season, so per-player
# performance in the 12 months before a sale is only reliable from mid-2013.
PERFORMANCE_COVERAGE_FROM = date(2013, 7, 1)

# Seller groups
REAL_MADRID = "Real Madrid"
BARCELONA = "Barcelona"
ELITE = "Other elite"
OTHER = "Other"
GROUPS = [REAL_MADRID, BARCELONA, ELITE, OTHER]

# Transfermarkt club ids of the first teams, and name stems used to recognise
# their academy / reserve sides (e.g. "Real Madrid Castilla", "Barcelona U19").
CLUBS = {
    "Real Madrid": {"group": REAL_MADRID, "ids": [418], "stems": ["real madrid"]},
    "Barcelona": {
        "group": BARCELONA,
        "ids": [131],
        "stems": ["fc barcelona", "barcelona", "barca"],
    },
    "Bayern Munich": {"group": ELITE, "ids": [27], "stems": ["bayern munich", "fc bayern", "bayern"]},
    "Juventus": {"group": ELITE, "ids": [506], "stems": ["juventus"]},
    "Manchester United": {"group": ELITE, "ids": [985], "stems": ["manchester united", "man utd"]},
    "Chelsea": {"group": ELITE, "ids": [631], "stems": ["chelsea"]},
    "Paris Saint-Germain": {
        "group": ELITE,
        "ids": [583],
        "stems": ["paris saint-germain", "paris sg", "psg"],
    },
    "Atletico Madrid": {
        "group": ELITE,
        "ids": [13],
        "stems": ["atletico madrid", "atletico de madrid", "atleti"],
    },
    "Manchester City": {"group": ELITE, "ids": [281], "stems": ["manchester city", "man city"]},
    "Liverpool": {"group": ELITE, "ids": [31], "stems": ["liverpool", "liverpool fc"]},
    "Arsenal": {"group": ELITE, "ids": [11], "stems": ["arsenal", "arsenal fc"]},
    "AC Milan": {"group": ELITE, "ids": [5], "stems": ["ac milan", "milan"]},
    "Inter": {"group": ELITE, "ids": [46], "stems": ["inter milan", "inter"]},
    "Borussia Dortmund": {
        "group": ELITE,
        "ids": [16],
        "stems": ["borussia dortmund", "dortmund", "bvb"],
    },
}

# Suffixes that identify an academy / reserve / youth side of a club
YOUTH_SUFFIX = (
    r"(ii|b|c|u\d{2}|youth|reserves?|academy|castilla|atletic|next ?gen|primavera"
    r"|juvenil( [ab])?|b team|under ?\d{2})"
)

LEAGUES = {
    "GB1": "Premier League",
    "ES1": "LaLiga",
    "IT1": "Serie A",
    "L1": "Bundesliga",
    "FR1": "Ligue 1",
}
OTHER_LEAGUE = "Other / outside big 5"
