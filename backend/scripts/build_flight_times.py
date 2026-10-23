"""
build_flight_times.py

Builds a dataset's backend/data/<dataset>/flight_times.csv life-zone columns
(Alpine, Montane, Foothills, Plains, each a day range like "04-25 to 06-10")
from iNaturalist observations, so routes/flight_times.py, the Flight/Bloom
Calendar, and offline mode can show when a species is out in each zone.

Supported datasets (see DATASETS):

  - wildflowers: bloom times. The species list comes from the database, and
    the CSV is entirely generated.
  - dragonflies: flight times. The species list (and Family, Start, End) come
    from the existing CSV, hand-entered from Ann Cooper's field guide. Those
    columns are kept for reference, but the app only uses the zone ranges: a
    species without any is treated as not found in Boulder County.

For each species:

  1. Looks up its iNaturalist taxon by scientific name (accepting an iNat
     synonym or a near-identical spelling, which it reports), or by common
     name if the database doesn't have the species.
  2. Pulls its research-grade and needs-ID observations in Boulder County
     (iNat place 1733), all years, in one pass. If at least MIN_ANNOTATED are
     annotated as being in the relevant state (flowering; adult), uses only
     those. Otherwise (the common case - few people annotate) it uses every
     observation, minus any annotated as being in a state that doesn't count
     (fruiting; nymph, larva, egg, exuvia). Obscured locations are skipped,
     since their elevation would be meaningless.
  3. Looks up each observation's elevation (OpenTopoData's public API, USGS
     10 m NED) and sorts it into a life zone by ZONE_FLOORS_FT.
  4. For each zone with at least MIN_ZONE_OBS observations, folds the days
     onto one calendar year, takes the LOW_PCT to HIGH_PCT percentile days
     (trimming stray early/late sightings), and writes them as that zone's
     range.

Species already in the CSV but not processed this run are kept as-is, so
--only can refresh a single species without dropping the rest.

Usage:
    venv/Scripts/python.exe scripts/build_flight_times.py wildflowers --dry-run
    venv/Scripts/python.exe scripts/build_flight_times.py wildflowers --only "Golden Banner"
    venv/Scripts/python.exe scripts/build_flight_times.py dragonflies
"""

import argparse
import csv
import difflib
import json
import os
import sqlite3
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date as date_cls

THIS_FOLDER = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(THIS_FOLDER)
DATA_FOLDER = os.path.join(BACKEND_ROOT, "data")

INAT_API = "https://api.inaturalist.org/v1"
ELEVATION_API = "https://api.opentopodata.org/v1/ned10m"
ELEVATION_CACHE_PATH = os.path.join(tempfile.gettempdir(), "bocoinventories_ned10m_elevation_cache.json")
BOULDER_COUNTY_PLACE_ID = 1733

# Lowest elevation (feet) of each life zone, highest first. Subalpine is
# folded into Montane, matching the butterflies chart's four zones.
ZONE_FLOORS_FT = [("Alpine", 11000), ("Montane", 8000), ("Foothills", 6000), ("Plains", 0)]
ZONES = ["Alpine", "Montane", "Foothills", "Plains"]
FEET_PER_METER = 3.28084

MIN_ANNOTATED = 30
MIN_ZONE_OBS = 5
LOW_PCT = 0.10
HIGH_PCT = 0.90

GENERATED_FIELDS = ["iNat Taxon", "Observations", "Basis"]

# Annotations are (iNat controlled term, value) pairs. "keep" is the state
# that counts; "drop" are states that don't.
DATASETS = {
    "wildflowers": {
        "species_from": "database",
        "basis": "flowering",
        # Plant Phenology: Flowering / Fruiting, No Flowers or Fruits.
        "keep": {(12, 13)},
        "drop": {(12, 14), (12, 21)},
        "fields": ["Family", "Species", *ZONES, *GENERATED_FIELDS],
    },
    "dragonflies": {
        "species_from": "csv",
        "basis": "adult",
        # Life Stage: Adult, Teneral / Nymph, Larva, Egg; Evidence of
        # Presence: Molt (exuviae), Egg.
        "keep": {(1, 2), (1, 3)},
        "drop": {(1, 5), (1, 6), (1, 7), (22, 28), (22, 30)},
        "fields": ["Family", "Species", *ZONES, "Start", "End", *GENERATED_FIELDS],
    },
}


def get_json(url, **params):
    req = urllib.request.Request(
        f"{url}?{urllib.parse.urlencode(params)}", headers={"User-Agent": "BoCoInventories flight-times script"}
    )
    # Both APIs rate-limit (429) under sustained use; back off and retry.
    for wait in (15, 60, 120, 300, None):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.load(resp)
            break
        except urllib.error.HTTPError as e:
            if wait is None or (e.code != 429 and e.code < 500):
                raise
            print(f"      HTTP {e.code}; retrying in {wait}s")
            time.sleep(wait)
    time.sleep(1)  # iNat asks API users to stay around 1 request/second
    return data


def find_taxon(scientific_name):
    """(taxon id, iNat name) for scientific_name, or None. Falls back to an
    iNat synonym (e.g. Padus virginiana -> Prunus virginiana), then to a
    near-identical spelling (e.g. Physaria belli -> Physaria bellii)."""
    # "Erigeron spp." means the whole genus.
    if scientific_name.endswith(" spp."):
        scientific_name = scientific_name.removesuffix(" spp.")
        ranks = "genus"
    else:
        ranks = "species,variety,subspecies"
    results = get_json(f"{INAT_API}/taxa", q=scientific_name, rank=ranks)["results"]
    wanted = scientific_name.lower()
    for key in ("name", "matched_term"):
        for taxon in results:
            if (taxon.get(key) or "").lower() == wanted:
                return taxon["id"], taxon["name"]
    best = max(
        results,
        key=lambda t: difflib.SequenceMatcher(None, wanted, (t.get("matched_term") or t["name"]).lower()).ratio(),
        default=None,
    )
    if best and difflib.SequenceMatcher(None, wanted, (best.get("matched_term") or best["name"]).lower()).ratio() >= 0.9:
        return best["id"], best["name"]
    return None


def find_taxon_by_common_name(common_name):
    """(taxon id, iNat name) for an exact iNat English common name, or None."""
    results = get_json(f"{INAT_API}/taxa", q=common_name, rank="species")["results"]
    for taxon in results:
        if (taxon.get("preferred_common_name") or "").lower() == common_name.lower():
            return taxon["id"], taxon["name"]
    return None


def fetch_observations(taxon_id):
    """(observed date, lat, lng, annotations) for every un-obscured, dated
    observation, where annotations is the set of (term, value) annotation
    pairs nobody has voted down."""
    observations = []
    id_above = 0
    while True:
        results = get_json(
            f"{INAT_API}/observations",
            taxon_id=taxon_id,
            place_id=BOULDER_COUNTY_PLACE_ID,
            quality_grade="research,needs_id",
            per_page=200,
            order_by="id",
            order="asc",
            id_above=id_above,
        )["results"]
        for obs in results:
            if obs.get("observed_on") and obs.get("location") and not obs.get("obscured"):
                lat, lng = (float(p) for p in obs["location"].split(","))
                annotations = {
                    (a["controlled_attribute_id"], a["controlled_value_id"])
                    for a in obs.get("annotations") or []
                    if a.get("vote_score", 0) >= 0
                }
                observations.append((date_cls.fromisoformat(obs["observed_on"]), lat, lng, annotations))
        # A short page is the last one, so there's no need to ask for an empty one.
        if len(results) < 200:
            return observations
        id_above = results[-1]["id"]


def choose_observations(observations, config):
    """(observations, basis): the ones annotated with a "keep" state if there
    are at least MIN_ANNOTATED, else all of them minus any annotated with a
    "drop" state."""
    kept = [o for o in observations if o[3] & config["keep"]]
    if len(kept) >= MIN_ANNOTATED:
        return kept, config["basis"]
    return [o for o in observations if not o[3] & config["drop"]], "all"


def elevations_ft(points):
    """Elevations for (lat, lng) points, cached across runs in the system temp
    folder so re-runs don't re-query (and get rate-limited by) OpenTopoData,
    which allows 100 points per request, 1 request/second, 1000 a day."""
    try:
        with open(ELEVATION_CACHE_PATH, encoding="utf-8") as f:
            cache = json.load(f)
    except (OSError, ValueError):
        cache = {}
    keys = [f"{lat:.5f},{lng:.5f}" for lat, lng in points]
    missing = sorted(set(keys) - cache.keys())
    for i in range(0, len(missing), 100):
        batch = missing[i : i + 100]
        results = get_json(ELEVATION_API, locations="|".join(batch))["results"]
        meters = [r["elevation"] for r in results]
        cache.update(zip(batch, meters))
        with open(ELEVATION_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache, f)
    return [cache[k] * FEET_PER_METER for k in keys]


def zone_for(elevation_ft):
    return next(zone for zone, floor in ZONE_FLOORS_FT if elevation_ft >= floor)


def day_range(dates):
    """'04-25 to 06-10', spanning the LOW_PCT to HIGH_PCT percentile days of the year."""
    days = sorted(f"{d:%m-%d}" for d in dates)
    return f"{days[int(LOW_PCT * (len(days) - 1))]} to {days[int(HIGH_PCT * (len(days) - 1))]}"


def normalize_name(name):
    # Same as routes/flight_times.py: the CSV uses plain ASCII apostrophes,
    # hyphens and spaces; scraped database names sometimes use curly or
    # non-breaking ones.
    return name.lower().replace("’", "'").replace("‑", "-").replace("\xa0", " ")


def load_database_species(db_path):
    """{normalized common name: (name, scientific name, family field)}."""
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        """
        SELECT w.name, w.scientific_name, fv.value
        FROM Wildlife w
        LEFT JOIN FieldValues fv ON fv.wildlife_id = w.id
            AND fv.field_id = (SELECT id FROM Fields WHERE name = 'family')
        ORDER BY w.name
        """
    ).fetchall()
    conn.close()
    return {normalize_name(name): (name, scientific_name, family) for name, scientific_name, family in rows}


def load_existing_csv(csv_path):
    if not os.path.isfile(csv_path):
        return {}
    with open(csv_path, newline="", encoding="utf-8") as f:
        return {row["Species"]: row for row in csv.DictReader(f)}


def write_csv(csv_path, fields, rows):
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields, lineterminator="\n", restval="", extrasaction="ignore")
        writer.writeheader()
        for row in sorted(rows.values(), key=lambda r: (r["Family"], r["Species"])):
            writer.writerow(row)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dataset", choices=DATASETS)
    parser.add_argument("--only", action="append", help="Common name to process (repeatable)")
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing the CSV")
    args = parser.parse_args()

    config = DATASETS[args.dataset]
    dataset_folder = os.path.join(DATA_FOLDER, args.dataset)
    csv_path = os.path.join(dataset_folder, "flight_times.csv")
    rows = load_existing_csv(csv_path)
    database = load_database_species(os.path.join(dataset_folder, "database.db"))

    # (common name, scientific name or None, family) for each species.
    if config["species_from"] == "database":
        species = sorted(database.values())
    else:
        species = [
            (row["Species"], (database.get(normalize_name(row["Species"])) or (None, None))[1], row["Family"])
            for row in rows.values()
        ]
    if args.only:
        wanted = {name.lower() for name in args.only}
        species = [s for s in species if s[0].lower() in wanted]
        if not species:
            sys.exit(f"No {args.dataset} named {args.only}")

    # Elevation lookups run on their own thread, so OpenTopoData requests for
    # one species overlap the iNat requests for the next (each service is still
    # held to 1 request/second by get_json). Finished species are written in
    # order as their elevations come back.
    pending = []

    def finish(name, family, taxon_id, observations, basis, elevations_future):
        by_zone = {zone: [] for zone in ZONES}
        for (observed, *_), elevation in zip(observations, elevations_future.result()):
            by_zone[zone_for(elevation)].append(observed)
        zone_ranges = {zone: day_range(dates) if len(dates) >= MIN_ZONE_OBS else "" for zone, dates in by_zone.items()}

        summary = ", ".join(f"{zone} {zone_ranges[zone] or '-'} ({len(by_zone[zone])})" for zone in ZONES)
        print(f"OK    {name}: {summary} [{basis}]")
        rows[name] = {
            **rows.get(name, {}),
            "Family": family or "",
            "Species": name,
            **zone_ranges,
            "iNat Taxon": taxon_id,
            "Observations": len(observations),
            "Basis": basis,
        }
        # Saved after every species, so a failure partway keeps what's done.
        if not args.dry_run:
            write_csv(csv_path, config["fields"], rows)

    with ThreadPoolExecutor(max_workers=1) as elevation_pool:
        for name, scientific_name, family in species:
            if scientific_name:
                taxon = find_taxon(scientific_name)
                if not taxon:
                    print(f"SKIP  {name}: no iNat taxon for '{scientific_name}'")
                    continue
            else:
                taxon = find_taxon_by_common_name(name)
                if not taxon:
                    print(f"SKIP  {name}: not in the database, and no iNat species by that common name")
                    continue
            taxon_id, inat_name = taxon
            if not scientific_name:
                print(f"NOTE  {name}: not in the database; matched iNat's '{inat_name}' by common name")
            elif inat_name.lower() != scientific_name.lower():
                print(f"NOTE  {name}: '{scientific_name}' matched iNat's '{inat_name}'")

            observations, basis = choose_observations(fetch_observations(taxon_id), config)
            if not observations:
                print(f"SKIP  {name}: no Boulder County observations")
                continue

            points = [(lat, lng) for _, lat, lng, _ in observations]
            pending.append((name, family, taxon_id, observations, basis, elevation_pool.submit(elevations_ft, points)))
            while pending and pending[0][-1].done():
                finish(*pending.pop(0))

        while pending:
            finish(*pending.pop(0))

    if not args.dry_run:
        print(f"Wrote {len(rows)} species to {csv_path}")


if __name__ == "__main__":
    main()
