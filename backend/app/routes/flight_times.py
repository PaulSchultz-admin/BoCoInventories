"""
flight_times.py

API route for looking up which species are expected to be flying on a given
date, in a given life zone, based on a dataset's flight_times.csv reference
file. Two CSV shapes are supported:

    - Zoned (butterflies, wildflowers): Family, Species, Alpine, Montane,
      Foothills, Plains, where each zone cell holds MM-DD day ranges like
      "06-01 to 08-31", comma-separated when a species has a gap (e.g.
      "03-01 to 03-31, 06-01 to 08-31"). Butterflies' were hand-digitized
      from a BCNA field guide chart at month resolution (so they run from
      the 1st of the first month to the end of the last); wildflowers' are
      built from iNaturalist data by scripts/build_flight_times.py.
    - Dated: Family, Species, Start, End, where Start/End are MM-DD days of
      the year. No life zones.

A CSV with zone columns is matched by zone only, and a blank zone means "not
found there". Dragonflies' has both: zone ranges built from iNaturalist data by
scripts/build_flight_times.py, plus Start/End from Ann Cooper's field guide,
kept for reference but not used.

Routes include:
    - GET /api/expected-wildlife/: List species expected on a date, in a zone
"""

import csv
import os
from datetime import date as date_cls

from flask import Blueprint, request, jsonify

from app import db_helpers

flight_times_bp = Blueprint("flight_times", __name__)

ZONE_COLUMNS = ["Alpine", "Montane", "Foothills", "Plains"]
VALID_ZONE_PARAMS = ZONE_COLUMNS + ["All"]


def _parse_month_day(value):
    """Parse a dated flight_times.csv cell like '07-15' into a (month, day)
    tuple, or None if it's blank or malformed."""
    try:
        month, day = (int(p) for p in value.strip().split("-"))
        date_cls(2000, month, day)  # validate (2000 is a leap year, so 02-29 is allowed)
        return (month, day)
    except (ValueError, AttributeError):
        return None


def parse_day_ranges(value):
    """Expand a zoned flight_times.csv cell like '03-01 to 03-31, 06-01 to
    08-31' into a list of ((month, day), (month, day)) periods. Malformed
    fragments are skipped rather than raising, since this reads
    hand-maintained data."""
    periods = []
    for part in (value or "").split(","):
        start, _, end = part.partition(" to ")
        start, end = _parse_month_day(start), _parse_month_day(end)
        if start and end:
            periods.append((start, end))
    return periods


def _in_period(month_day, period):
    start, end = period
    # A period can wrap the new year (e.g. 11-01 to 02-15).
    return start <= month_day <= end if start <= end else month_day >= start or month_day <= end


def _format_period(period):
    return f"{_format_month_day(period[0])} – {_format_month_day(period[1])}"


def _format_month_day(month_day):
    """(7, 15) -> 'Jul 15'."""
    return f"{date_cls(2000, *month_day):%b} {month_day[1]}"


def _normalize_dataset_name(name):
    return name.strip().lower().replace(" ", "_")


@flight_times_bp.route("/api/expected-wildlife/", methods=["GET"])
def expected_wildlife():
    """
    Lists species from a dataset's flight_times.csv that are expected to be
    flying on a given date, in a given life zone. Each species carries the
    period it's expected in for each matched zone ("zone_periods"), and
    "flight_period" when that's a single period. For a dated CSV (no zone
    columns), the zone param is ignored, "zoned" is false, "zone" is null, and
    each species carries only its "flight_period" (e.g. "Jul 15 – Aug 10").

    Query params:
        dataset (required): dataset folder name, e.g. butterflies
        date (optional): YYYY-MM-DD, defaults to today
        zone (optional): Alpine | Montane | Foothills | Plains | All, defaults to All

    Example request:
    GET /api/expected-wildlife/?dataset=butterflies&date=2026-07-04&zone=Plains

    Example output:
    {
        "date": "2026-07-04",
        "zone": "Plains",
        "zoned": true,
        "species": [
            {
                "name": "Monarch",
                "scientific_name": "Danaus plexippus",
                "family": "Monarch and Viceroy",
                "zones": ["Plains"],
                "zone_periods": {"Plains": "Jun 1 – Sep 30"},
                "flight_period": "Jun 1 – Sep 30",
                "wildlife_id": 42,
                "thumbnail_id": 103
            },
            {
                "name": "Long Dash",
                "scientific_name": null,
                "family": "Skippers",
                "zones": ["Plains"],
                "zone_periods": {"Plains": "Jul 1 – Jul 31"},
                "flight_period": "Jul 1 – Jul 31",
                "wildlife_id": null,
                "thumbnail_id": null
            }
        ]
    }

    A null wildlife_id/thumbnail_id/scientific_name means the species is in
    the flight-times chart but doesn't yet have a matching entry (and photos)
    in this dataset's Wildlife table.

    With zone=All, a species' "zones" list can contain more than one entry,
    since it's expected in every zone it's active in on that date; with a
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

    csv_path = os.path.join(
        db_helpers.DATA_FOLDER, _normalize_dataset_name(dataset), "flight_times.csv"
    )
    if not os.path.isfile(csv_path):
        return jsonify({"error": f"No flight_times.csv for dataset '{dataset}'"}), 404

    zone_columns_to_check = ZONE_COLUMNS if zone == "All" else [zone]
    requested_month_day = (requested_date.month, requested_date.day)

    matches = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        zoned = any(z in (reader.fieldnames or []) for z in ZONE_COLUMNS)
        for row in reader:
            # In a zoned CSV, a blank zone means "not found there", even if the
            # row also has Start/End (dragonflies keep their field-guide dates
            # for reference), so a species with no zone data never matches.
            if zoned:
                zone_periods = {}
                for z in zone_columns_to_check:
                    for period in parse_day_ranges(row.get(z, "")):
                        if _in_period(requested_month_day, period):
                            zone_periods[z] = _format_period(period)
                            break
                if zone_periods:
                    periods = set(zone_periods.values())
                    matches.append(
                        {
                            "name": row["Species"],
                            "family": row["Family"],
                            "zones": list(zone_periods),
                            "zone_periods": zone_periods,
                            "flight_period": periods.pop() if len(periods) == 1 else None,
                        }
                    )
            else:
                start, end = _parse_month_day(row.get("Start", "")), _parse_month_day(row.get("End", ""))
                if start and end and _in_period(requested_month_day, (start, end)):
                    matches.append(
                        {
                            "name": row["Species"],
                            "family": row["Family"],
                            "zones": [],
                            "zone_periods": {},
                            "flight_period": _format_period((start, end)),
                        }
                    )

    # Match against the Wildlife table by name, normalizing apostrophe, hyphen
    # and space style (the CSV uses plain ASCII; scraped DB names sometimes use
    # curly quotes, non-breaking hyphens or non-breaking spaces) and case,
    # since otherwise e.g. "Weidemeyer's Admiral" wouldn't match "Weidemeyer’s Admiral".
    def normalize_name(name):
        return name.lower().replace("’", "'").replace("‑", "-").replace("\xa0", " ")

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
                "zone_periods": match["zone_periods"],
                "flight_period": match["flight_period"],
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
                "zone": zone if zoned else None,
                "zoned": zoned,
                "species": species,
            }
        ),
        200,
    )
