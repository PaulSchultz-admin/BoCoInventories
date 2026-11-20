"""
build_odonata_heatmap.py

Builds frontend26/public/data/odonata-sightings.json, the data behind the
dragonfly and damselfly heat map on the Dragonflies Science page
(frontend26/src/components/OdonataHeatMap.jsx).

It pulls every verifiable (research-grade and needs-ID) iNaturalist
observation of Odonata in Boulder County (iNat place 1733), skips obscured
locations, and looks up each one's elevation with build_flight_times.py's
cached OpenTopoData lookup. It also saves the county boundary from iNat.

Each sighting is stored as
    [lat, lng, month, day_of_year, elevation_ft, year, group, species_id]
where group is "A" (dragonfly, Anisoptera) or "Z" (damselfly, Zygoptera) and
species_id is the iNat species taxon id, or 0 if not identified to species.
Day of year is counted on a non-leap year so dates line up across years.

Rerun it periodically as iNaturalist data grows. The first run after many
new sightings may spend some of OpenTopoData's 1000 requests a day.

Usage:
    venv/Scripts/python.exe scripts/build_odonata_heatmap.py
"""

import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_flight_times as bft  # noqa: E402

ODONATA = 47792
ANISOPTERA = 47927
ZYGOPTERA = 47928
OUT_PATH = os.path.join(
    os.path.dirname(bft.BACKEND_ROOT), "frontend26", "public", "data", "odonata-sightings.json"
)


def fetch_sightings():
    sightings = []
    id_above = 0
    while True:
        results = bft.get_json(
            f"{bft.INAT_API}/observations",
            place_id=bft.BOULDER_COUNTY_PLACE_ID,
            taxon_id=ODONATA,
            verifiable="true",
            per_page=200,
            order_by="id",
            order="asc",
            id_above=id_above,
        )["results"]
        if not results:
            return sightings
        for obs in results:
            id_above = obs["id"]
            if obs.get("obscured") or not obs.get("location") or not obs.get("observed_on"):
                continue
            taxon = obs.get("taxon") or {}
            ancestors = taxon.get("ancestor_ids") or []
            group = "A" if ANISOPTERA in ancestors else "Z" if ZYGOPTERA in ancestors else None
            if group is None:
                continue
            if taxon.get("rank") == "species":
                species = taxon["id"]
            elif taxon.get("rank") in ("subspecies", "variety", "form") and len(ancestors) > 1:
                species = ancestors[-2]
            else:
                species = 0
            lat, lng = map(float, obs["location"].split(","))
            sightings.append((lat, lng, date.fromisoformat(obs["observed_on"]), group, species))
        print(f"  {len(sightings)} sightings so far")


def day_of_year(d):
    if d.month == 2 and d.day == 29:
        return 59
    return d.replace(year=2025).timetuple().tm_yday


def main():
    print("Fetching Odonata sightings from iNaturalist...")
    sightings = fetch_sightings()
    print(f"Looking up {len(sightings)} elevations...")
    elevations = bft.elevations_ft([(lat, lng) for lat, lng, *_ in sightings])
    rows = [
        [round(lat, 4), round(lng, 4), d.month, day_of_year(d), round(ft), d.year, group, species]
        for (lat, lng, d, group, species), ft in zip(sightings, elevations)
    ]
    place = bft.get_json(f"{bft.INAT_API}/places/{bft.BOULDER_COUNTY_PLACE_ID}")["results"][0]
    boundary = [
        [[[round(x, 4), round(y, 4)] for x, y in ring] for ring in polygon]
        for polygon in place["geometry_geojson"]["coordinates"]
    ]
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"pulled": date.today().isoformat(), "boundary": boundary, "sightings": rows}, f, separators=(",", ":"))
    print(f"Wrote {len(rows)} sightings to {OUT_PATH}")


if __name__ == "__main__":
    main()
