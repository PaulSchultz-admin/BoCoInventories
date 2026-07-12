"""
import_front_range_butterflies.py

One-off / re-runnable importer that scrapes species pages from
https://coloradofrontrangebutterflies.com/ and loads them into the
'butterflies' dataset (backend/data/butterflies/).

Text content (species accounts) is reproduced from the site's own field
guide text, attributed to Boulder County Nature Association (the same
organization this app is built for). Photos are attributed to the
individual photographer credited in each image's caption on the source
site, per that site's copyright notice, and downloaded only because BCNA
has confirmed it holds reuse rights for its own published photos.

Usage:
    venv/Scripts/python.exe scripts/import_front_range_butterflies.py

Run from the backend/ directory (or adjust the sys.path insert below).
Safe to re-run: species already present (matched by scientific name) are
skipped rather than duplicated.
"""

import html
import json
import os
import re
import sys
import time
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import db_helpers  # noqa: E402

DATASET_DIR = os.path.join(db_helpers.DATA_FOLDER, "butterflies")
DB_PATH = os.path.join(DATASET_DIR, "database.db")
IMAGE_DIR = os.path.join(DATASET_DIR, "uploaded_images")

BASE_URL = "https://coloradofrontrangebutterflies.com"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
DEFAULT_COPYRIGHT = "Boulder County Nature Association"

# Full species manifest: (url slug, taxonomic family in Latin), extracted from
# https://coloradofrontrangebutterflies.com/butterfly-families/ by mapping each
# species link to the nearest preceding subgroup anchor (e.g. id="sulphurs")
# and that subgroup's known parent family. The subfamily/common group name
# ("Sulphurs", "Blues", etc.) shown per-species is scraped from the species
# page itself, not from this manifest.
ALL_SPECIES = [
    ("rocky-mountain-parnassian", "Papilionidae"),
    ("pipevine-swallowtail", "Papilionidae"),
    ("black-swallowtail", "Papilionidae"),
    ("anise-swallowtail", "Papilionidae"),
    ("indra-swallowtail", "Papilionidae"),
    ("western-tiger-swallowtail", "Papilionidae"),
    ("pale-swallowtail", "Papilionidae"),
    ("two-tailed-swallowtail", "Papilionidae"),
    ("pine-white", "Pieridae"),
    ("spring-white", "Pieridae"),
    ("checkered-white", "Pieridae"),
    ("western-white", "Pieridae"),
    ("cabbage-white", "Pieridae"),
    ("large-marble", "Pieridae"),
    ("olympia-marble", "Pieridae"),
    ("julia-orangetip", "Pieridae"),
    ("clouded-sulphur", "Pieridae"),
    ("orange-sulphur", "Pieridae"),
    ("queen-alexandras-sulphur", "Pieridae"),
    ("southern-dogface", "Pieridae"),
    ("sleepy-orange", "Pieridae"),
    ("mexican-yellow", "Pieridae"),
    ("meads-sulphur", "Pieridae"),
    ("dainty-sulphur", "Pieridae"),
    ("gray-copper", "Lycaenidae"),
    ("ediths-copper", "Lycaenidae"),
    ("blue-copper", "Lycaenidae"),
    ("ruddy-copper", "Lycaenidae"),
    ("lustrous-copper", "Lycaenidae"),
    ("bronze-copper", "Lycaenidae"),
    ("purplish-copper", "Lycaenidae"),
    ("tailed-copper", "Lycaenidae"),
    ("thicket-hairstreak", "Lycaenidae"),
    ("colorado-hairstreak", "Lycaenidae"),
    ("brown-elfin", "Lycaenidae"),
    ("moss-elfin", "Lycaenidae"),
    ("hoary-elfin", "Lycaenidae"),
    ("western-pine-elfin", "Lycaenidae"),
    ("behrs-hairstreak", "Lycaenidae"),
    ("coral-hairstreak", "Lycaenidae"),
    ("striped-hairstreak", "Lycaenidae"),
    ("banded-hairstreak", "Lycaenidae"),
    ("hedgerow-hairstreak", "Lycaenidae"),
    ("gray-hairstreak", "Lycaenidae"),
    ("marine-blue", "Lycaenidae"),
    ("western-tailed-blue", "Lycaenidae"),
    ("echo-azure", "Lycaenidae"),
    ("hops-azure", "Lycaenidae"),
    ("arrowhead-blue", "Lycaenidae"),
    ("silvery-blue", "Lycaenidae"),
    ("rocky-mountain-dotted-blue", "Lycaenidae"),
    ("reakirts-blue", "Lycaenidae"),
    ("melissa-blue", "Lycaenidae"),
    ("greenish-blue", "Lycaenidae"),
    ("boisduvals-blue", "Lycaenidae"),
    ("shasta-blue", "Lycaenidae"),
    ("lupine-blue", "Lycaenidae"),
    ("arctic-blue", "Lycaenidae"),
    ("western-pygmy-blue", "Lycaenidae"),
    ("nais-metalmark", "Riodinidae"),
    ("monarch", "Nymphalidae"),
    ("queen", "Nymphalidae"),
    ("american-snout", "Nymphalidae"),
    ("variegated-fritillary", "Nymphalidae"),
    ("aphrodite-fritillary", "Nymphalidae"),
    ("edwards-fritillary", "Nymphalidae"),
    ("coronis-fritillary", "Nymphalidae"),
    ("zerene-fritillary", "Nymphalidae"),
    ("callippe-fritillary", "Nymphalidae"),
    ("northwestern-fritillary", "Nymphalidae"),
    ("mormon-fritillary", "Nymphalidae"),
    ("silver-bordered-fritillary", "Nymphalidae"),
    ("arctic-fritillary", "Nymphalidae"),
    ("fulvia-checkerspot", "Nymphalidae"),
    ("gorgone-checkerspot", "Nymphalidae"),
    ("silvery-checkerspot", "Nymphalidae"),
    ("northern-checkerspot", "Nymphalidae"),
    ("arachne-checkerspot", "Nymphalidae"),
    ("variable-checkerspot", "Nymphalidae"),
    ("rockslide-checkerspot", "Nymphalidae"),
    ("pearl-crescent", "Nymphalidae"),
    ("northern-crescent", "Nymphalidae"),
    ("field-crescent", "Nymphalidae"),
    ("texan-crescent", "Nymphalidae"),
    ("green-comma", "Nymphalidae"),
    ("satyr-comma", "Nymphalidae"),
    ("hoary-comma", "Nymphalidae"),
    ("common-buckeye", "Nymphalidae"),
    ("milberts-tortoiseshell", "Nymphalidae"),
    ("mourning-cloak", "Nymphalidae"),
    ("california-tortoiseshell", "Nymphalidae"),
    ("painted-lady", "Nymphalidae"),
    ("american-lady", "Nymphalidae"),
    ("west-coast-lady", "Nymphalidae"),
    ("red-admiral", "Nymphalidae"),
    ("viceroy", "Nymphalidae"),
    ("weidemeyers-admiral", "Nymphalidae"),
    ("hackberry-emperor", "Nymphalidae"),
    ("common-ochre-ringlet", "Nymphalidae"),
    ("common-wood-nymph", "Nymphalidae"),
    ("small-wood-nymph", "Nymphalidae"),
    ("canyonland-satyr", "Nymphalidae"),
    ("ridings-satyr", "Nymphalidae"),
    ("common-alpine", "Nymphalidae"),
    ("chryxus-arctic", "Nymphalidae"),
    ("uhlers-arctic", "Nymphalidae"),
    ("jutta-arctic", "Nymphalidae"),
    ("silver-spotted-skipper", "Hesperiidae"),
    ("mexican-cloudywing", "Hesperiidae"),
    ("dreamy-duskywing", "Hesperiidae"),
    ("rocky-mountain-duskywing", "Hesperiidae"),
    ("mottled-duskywing", "Hesperiidae"),
    ("pacuvius-duskywing", "Hesperiidae"),
    ("afranius-duskywing", "Hesperiidae"),
    ("persius-duskywing", "Hesperiidae"),
    ("grizzled-skipper", "Hesperiidae"),
    ("common-checkered-skipper", "Hesperiidae"),
    ("common-sootywing", "Hesperiidae"),
    ("russet-skipperling", "Hesperiidae"),
    ("garita-skipperling", "Hesperiidae"),
    ("least-skipper", "Hesperiidae"),
    ("leonards-pawnee-skipper", "Hesperiidae"),
    ("juba-skipper", "Hesperiidae"),
    ("western-branded-skipper", "Hesperiidae"),
    ("pahaska-skipper", "Hesperiidae"),
    ("green-skipper", "Hesperiidae"),
    ("nevada-skipper", "Hesperiidae"),
    ("fiery-skipper", "Hesperiidae"),
    ("sandhill-skipper", "Hesperiidae"),
    ("draco-skipper", "Hesperiidae"),
    ("tawny-edged-skipper", "Hesperiidae"),
    ("sonoran-skipper", "Hesperiidae"),
    ("arogos-skipper", "Hesperiidae"),
    ("delaware-skipper", "Hesperiidae"),
    ("woodland-skipper", "Hesperiidae"),
    ("taxiles-skipper", "Hesperiidae"),
    ("snows-skipper", "Hesperiidae"),
    ("two-spotted-skipper", "Hesperiidae"),
    ("dun-skipper", "Hesperiidae"),
    ("dusted-skipper", "Hesperiidae"),
]

# Fields captured per species, in display order. Maps the scraped page
# label to the Field name stored in the database.
FIELD_LABEL_MAP = [
    ("Appearance", "Appearance"),
    ("Wingspan", "Wingspan"),
    ("Habitat", "Habitat"),
    ("Larval Foodplant", "Host plants"),
    ("Flight Times", "Life cycle"),
    ("Did You Know", "Did you know"),
]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def download(url, dest_path):
    req = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Referer": BASE_URL + "/"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    with open(dest_path, "wb") as f:
        f.write(data)


def strip_style_script(src):
    src = re.sub(r"<style\b.*?</style>", "", src, flags=re.DOTALL)
    src = re.sub(r"<script\b.*?</script>", "", src, flags=re.DOTALL)
    return src


def strip_tags(s):
    s = html.unescape(s)
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(s).strip()


def text_block(src, n):
    pat = re.compile(
        r'et_pb_text_%d[^"]*".*?et_pb_text_inner">(.*?)</div>\s*</div>' % n,
        re.DOTALL,
    )
    m = pat.search(src)
    return m.group(1).strip() if m else None


def parse_fields(raw_block2):
    fields = {}
    parts = re.split(r"</p>\s*<p>", raw_block2.strip())
    parts = [re.sub(r"^<p>|</p>$", "", p).strip() for p in parts]
    current_label = None
    for p in parts:
        m = re.match(r"<b[^>]*>(.*?):?</b>\s*(.*)", p, re.DOTALL)
        if m:
            label = strip_tags(m.group(1)).strip().rstrip(":").rstrip(".").rstrip("…")
            value = strip_tags(m.group(2)).strip()
            fields[label] = value
            current_label = label
        elif current_label:
            addition = strip_tags(p).strip()
            if addition:
                fields[current_label] = (
                    (fields[current_label] + " " + addition).strip()
                    if fields[current_label]
                    else addition
                )
    return fields


def parse_gallery(src):
    images = []
    for m in re.finditer(
        r'<a href="(https://coloradofrontrangebutterflies\.com/wp-content/uploads/[^"]+)" '
        r'title="([^"]*)">\s*<img[^>]*src="[^"]+"',
        src,
    ):
        full_url, title = m.groups()
        title_text = strip_tags(title)
        lines = [l.strip() for l in title_text.split("\n") if l.strip()]
        credit, location_parts = "", []
        for l in lines[1:]:
            if l.startswith("©"):
                credit = l.lstrip("©").strip()
            else:
                location_parts.append(l)
        images.append(
            {
                "full_url": full_url,
                "credit": credit,
                "location": ", ".join(location_parts),
            }
        )
    return images


def parse_species_page(slug):
    src = strip_style_script(fetch(f"{BASE_URL}/{slug}"))
    name = strip_tags(text_block(src, 0) or "")
    header_text = strip_tags(text_block(src, 1) or "")
    lines = [l.strip() for l in header_text.split("\n") if l.strip()]
    scientific_name = lines[0].strip("()") if lines else ""
    # Some entries read "Current name – formerly Old name"; keep only the
    # currently accepted binomial in scientific_name.
    scientific_name = re.split(r"\s*[–—-]\s*formerly", scientific_name)[0].strip()
    family_common = lines[1] if len(lines) > 1 else ""
    fields = parse_fields(text_block(src, 2) or "")
    images = parse_gallery(src)
    return {
        "name": name,
        "scientific_name": scientific_name,
        "family_common": family_common,
        "fields": fields,
        "images": images,
    }


def get_or_create_field(cur, name, field_type="TEXT"):
    cur.execute("SELECT id FROM Fields WHERE name = ?", (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO Fields (name, type) VALUES (?, ?)", (name, field_type)
    )
    return cur.lastrowid


def get_or_create_category(cur, name, field_ids_in_order):
    cur.execute("SELECT id FROM Categories WHERE name = ?", (name,))
    row = cur.fetchone()
    if row:
        category_id = row[0]
    else:
        cur.execute(
            "INSERT INTO Categories (parent_id, name, field_order) VALUES (NULL, ?, ?)",
            (name, json.dumps(field_ids_in_order)),
        )
        category_id = cur.lastrowid

    for field_id in field_ids_in_order:
        cur.execute(
            "INSERT OR IGNORE INTO FieldsToCategories (field_id, category_id) VALUES (?, ?)",
            (field_id, category_id),
        )
    return category_id


def import_species(cur, category_id, field_ids, slug, family_latin):
    data = parse_species_page(slug)

    cur.execute(
        "SELECT id FROM Wildlife WHERE scientific_name = ?",
        (data["scientific_name"],),
    )
    if cur.fetchone():
        print(f"  skip (already imported): {data['name']}")
        return

    cur.execute(
        "INSERT INTO Wildlife (category_id, name, scientific_name) VALUES (?, ?, ?)",
        (category_id, data["name"], data["scientific_name"]),
    )
    wildlife_id = cur.lastrowid

    family_value = (
        f"{family_latin} ({data['family_common']})"
        if data["family_common"]
        else family_latin
    )
    cur.execute(
        "INSERT INTO FieldValues (wildlife_id, field_id, value) VALUES (?, ?, ?)",
        (wildlife_id, field_ids["family"], family_value),
    )
    for scraped_label, db_field_name in FIELD_LABEL_MAP:
        value = data["fields"].get(scraped_label, "").strip()
        if not value:
            continue
        cur.execute(
            "INSERT INTO FieldValues (wildlife_id, field_id, value) VALUES (?, ?, ?)",
            (wildlife_id, field_ids[db_field_name], value),
        )

    first_image_id = None
    for image in data["images"]:
        ext = os.path.splitext(image["full_url"])[1].lstrip(".").lower() or "jpg"
        filename = f"{uuid.uuid4().hex}.{ext}"
        dest_path = os.path.join(IMAGE_DIR, filename)
        try:
            download(image["full_url"], dest_path)
        except Exception as e:
            print(f"    ! failed to download {image['full_url']}: {e}")
            continue

        copyright_value = image["credit"] or DEFAULT_COPYRIGHT
        cur.execute(
            """INSERT INTO Images
               (wildlife_id, image_path, metadata, copyright, date_taken, location_taken)
               VALUES (?, ?, NULL, ?, NULL, ?)""",
            (wildlife_id, filename, copyright_value, image["location"]),
        )
        image_id = cur.lastrowid
        if first_image_id is None:
            first_image_id = image_id
        time.sleep(0.2)

    if first_image_id is not None:
        cur.execute(
            "UPDATE Wildlife SET thumbnail_id = ? WHERE id = ?",
            (first_image_id, wildlife_id),
        )

    print(f"  imported: {data['name']} ({len(data['images'])} images)")


def main():
    os.makedirs(IMAGE_DIR, exist_ok=True)
    db_helpers.init_all_dbs()

    import sqlite3

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    field_ids = {"family": get_or_create_field(cur, "family")}
    for _, db_field_name in FIELD_LABEL_MAP:
        field_ids[db_field_name] = get_or_create_field(cur, db_field_name)
    conn.commit()

    field_order = [field_ids["family"]] + [
        field_ids[db_field_name] for _, db_field_name in FIELD_LABEL_MAP
    ]
    category_id = get_or_create_category(cur, "Butterflies", field_order)
    conn.commit()

    failures = []
    total = len(ALL_SPECIES)
    for i, (slug, family_latin) in enumerate(ALL_SPECIES, 1):
        print(f"[{i}/{total}] Fetching {slug}...")
        try:
            import_species(cur, category_id, field_ids, slug, family_latin)
            conn.commit()
        except Exception as e:
            print(f"  ! failed to import {slug}: {e}")
            failures.append(slug)
        time.sleep(0.5)

    conn.close()
    print("Done.")
    if failures:
        print(f"{len(failures)} species failed: {', '.join(failures)}")


if __name__ == "__main__":
    main()
