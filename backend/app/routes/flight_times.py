"""
flight_times.py

API route for looking up which species are expected to be flying on a given
date, in a given life zone, based on a dataset's flight_times.csv reference
file (currently hand-digitized from a BCNA field guide chart; expected to be
replaced by BCNA's own flight-times export in the same CSV shape later).

Routes include:
    - GET /api/expected-wildlife/: List species expected on a date, in a zone
"""

import csv
import os
from datetime import date as date_cls

from flask import Blueprint, request, jsonify

from app import db_helpers

flight_times_bp = Blueprint("flight_times", __name__)

MONTH_ORDER = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]
MONTH_INDEX = {m: i for i, m in enumerate(MONTH_ORDER)}
ZONE_COLUMNS = ["Alpine", "Montane", "Foothills", "Plains"]
VALID_ZONE_PARAMS = ZONE_COLUMNS + ["All"]


def parse_month_ranges(value):
    """Expand a flight_times.csv cell like 'Jun-Aug' or 'Mar, Jun-Aug' into
    the set of month abbreviations it covers. Unrecognized fragments are
    skipped rather than raising, since this reads hand-transcribed data."""
    months = set()
    if not value:
        return months
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = (p.strip() for p in part.split("-", 1))
            if start not in MONTH_INDEX or end not in MONTH_INDEX:
                continue
            for i in range(MONTH_INDEX[start], MONTH_INDEX[end] + 1):
                months.add(MONTH_ORDER[i])
        elif part in MONTH_INDEX:
            months.add(part)
    return months


def _normalize_dataset_name(name):
    return name.strip().lower().replace(" ", "_")


@flight_times_bp.route("/api/expected-wildlife/", methods=["GET"])
def expected_wildlife():
    """
    Lists species from a dataset's flight_times.csv that are expected to be
    flying on a given date, in a given life zone.

    Query params:
        dataset (required): dataset folder name, e.g. butterflies
        date (optional): YYYY-MM-DD, defaults to today
        zone (optional): Alpine | Montane | Foothills | Plains | All, defaults to All

    Example request:
    GET /api/expected-wildlife/?dataset=butterflies&date=2026-07-04&zone=Plains

    Example output:
    {
        "date": "2026-07-04",
        "month": "Jul",
        "zone": "Plains",
        "species": [
            {
                "name": "Monarch",
                "scientific_name": "Danaus plexippus",
                "family": "Monarch and Viceroy",
                "zones": ["Plains"],
                "wildlife_id": 42,
                "thumbnail_id": 103
            },
            {
                "name": "Long Dash",
                "scientific_name": null,
                "family": "Skippers",
                "zones": ["Plains"],
                "wildlife_id": null,
                "thumbnail_id": null
            }
        ]
    }

    A null wildlife_id/thumbnail_id/scientific_name means the species is in
    the flight-times chart but doesn't yet have a matching entry (and photos)
    in this dataset's Wildlife table.

    With zone=All, a species' "zones" list can contain more than one entry,
    since it's expected in every zone it's active in that month; with a
    specific zone, "zones" is always just that one zone.
    """
    dataset = request.args.get("dataset")
    if not dataset:
        return jsonify({"error": "dataset is required"}), 400

    date_param = request.args.get("date")
    if date_param:
        try:
            requested_date = date_cls.fromisoformat(date_param)
        except ValueError:
            return jsonify({"error": f"Invalid date '{date_param}', expected YYYY-MM-DD"}), 400
    else:
        requested_date = date_cls.today()

    zone = request.args.get("zone", "All").strip().title()
    if zone not in VALID_ZONE_PARAMS:
        return jsonify({"error": f"Invalid zone '{zone}', expected one of {VALID_ZONE_PARAMS}"}), 400

    month = requested_date.strftime("%b")

    csv_path = os.path.join(
        db_helpers.DATA_FOLDER, _normalize_dataset_name(dataset), "flight_times.csv"
    )
    if not os.path.isfile(csv_path):
        return jsonify({"error": f"No flight_times.csv for dataset '{dataset}'"}), 404

    zone_columns_to_check = ZONE_COLUMNS if zone == "All" else [zone]

    matches = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            matched_zones = [
                z for z in zone_columns_to_check if month in parse_month_ranges(row.get(z, ""))
            ]
            if matched_zones:
                matches.append({"name": row["Species"], "family": row["Family"], "zones": matched_zones})

    # Match against the Wildlife table by name, normalizing apostrophe style
    # (the CSV uses straight quotes; scraped DB names use curly ones) and
    # case, since otherwise e.g. "Weidemeyer's Admiral" wouldn't match
    # "Weidemeyer’s Admiral".
    def normalize_name(name):
        return name.lower().replace("’", "'")

    wildlife_by_name = {
        normalize_name(w["name"]): w
        for w in db_helpers.select_multiple("SELECT id, name, scientific_name, thumbnail_id FROM Wildlife")
    }

    species = []
    for match in matches:
        wildlife = wildlife_by_name.get(normalize_name(match["name"]))
        species.append(
            {
                "name": match["name"],
                "family": match["family"],
                "zones": match["zones"],
                "scientific_name": wildlife["scientific_name"] if wildlife else None,
                "wildlife_id": wildlife["id"] if wildlife else None,
                "thumbnail_id": wildlife["thumbnail_id"] if wildlife else None,
            }
        )

    species.sort(key=lambda s: (s["family"], s["name"]))

    return (
        jsonify(
            {
                "date": requested_date.isoformat(),
                "month": month,
                "zone": zone,
                "species": species,
            }
        ),
        200,
    )
