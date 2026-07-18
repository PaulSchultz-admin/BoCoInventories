"""
set_copyright_from_camera.py

One-off data-cleanup script: fills in the EXIF Copyright tag (and the
matching database `copyright` column) for images that don't already have a
copyright, based on the camera Make/Model recorded in their EXIF data.

Rule:
    - If the image's EXIF Copyright tag already has a value, leave it alone.
    - If Make or Model mentions Canon, set copyright to "MarySue Schultz".
    - If Make or Model mentions Nikon, Pentax, or Sony, set copyright to
      "Paul Schultz".
    - Anything else (no EXIF, no Make/Model, or an unrecognized brand) is
      left untouched.

Safety check (added after a prior run corrupted a batch of images):
    The `exif` library's Image.get_file() rewrites the whole APP1/EXIF
    segment. For files with a MakerNote/IFD structure it can't fully parse
    (it warns "skipping bad IFD"), it has been observed to declare the WRONG
    2-byte segment length for the rewritten segment - the bytes it copies
    through are unchanged, but the wrong length desyncs every JPEG marker
    parser (browsers included) from that point on, sometimes making the file
    decode to a small embedded preview instead of the real photo. Nothing in
    the `exif` library flags this when it happens - the corruption is silent.

    So before overwriting a file, this script re-parses its OWN rewritten
    bytes with a plain JPEG marker walk (independent of the `exif` library)
    and confirms the image still decodes to the exact same pixel dimensions
    it had before the edit. If it doesn't - or the file no longer parses
    cleanly at all - the file is left untouched and only the database
    `copyright` column is updated, so the display still reflects the correct
    photographer even though the EXIF header wasn't touched. These files are
    reported separately at the end for manual follow-up.

Usage:
    venv/Scripts/python.exe scripts/set_copyright_from_camera.py [dataset]

    With no argument, processes every dataset folder under backend/data.
    Pass a dataset name (e.g. "wildflowers") to process just that one.
"""

import os
import sqlite3
import sys

from exif import Image

THIS_FOLDER = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(THIS_FOLDER)
DATA_FOLDER = os.path.join(BACKEND_ROOT, "data")

CANON_BRAND = "canon"
OTHER_BRANDS = ["nikon", "pentax", "sony"]

CANON_COPYRIGHT = "MarySue Schultz"
OTHER_COPYRIGHT = "Paul Schultz"

MARKERS_NO_LENGTH = {0xD8, 0xD9, 0x01} | set(range(0xD0, 0xD8))
SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3}


def walk_and_get_sof(data, start=2):
    """Walks the JPEG marker chain from `start`. Returns (reached_end, sof_wh)
    where sof_wh is the (width, height) of the last SOF segment seen before
    reaching SOS/EOI, or None if no SOF was seen or the chain desyncs."""
    i = start
    n = len(data)
    steps = 0
    sof_wh = None
    while i < n - 1:
        steps += 1
        if steps > 10000:
            return False, sof_wh
        if data[i] != 0xFF:
            return False, sof_wh
        marker = data[i + 1]
        if marker == 0xD9:
            return True, sof_wh
        if marker in MARKERS_NO_LENGTH:
            i += 2
            continue
        if i + 4 > n:
            return False, sof_wh
        length = (data[i + 2] << 8) | data[i + 3]
        if marker in SOF_MARKERS and i + 9 <= n:
            height = (data[i + 5] << 8) | data[i + 6]
            width = (data[i + 7] << 8) | data[i + 8]
            sof_wh = (width, height)
        if marker == 0xDA:
            return True, sof_wh
        i += 2 + length
    return False, sof_wh


def safe_get(img, attr):
    """Returns (value, ok). ok=False means the tag exists but couldn't be decoded."""
    try:
        return getattr(img, attr, "") or "", True
    except Exception:
        return "", False


def determine_new_copyright(img):
    """Returns the copyright to assign, or None if this image should be left alone."""
    if not img.has_exif:
        return None

    copyright_val, copyright_ok = safe_get(img, "copyright")
    if not copyright_ok:
        # Undecodable tag (e.g. non-ASCII bytes) - treat as already having something.
        return None
    if str(copyright_val).strip():
        return None

    make_val, make_ok = safe_get(img, "make")
    model_val, model_ok = safe_get(img, "model")
    make = str(make_val).lower() if make_ok else ""
    model = str(model_val).lower() if model_ok else ""
    combined = f"{make} {model}"

    is_canon = CANON_BRAND in combined
    is_other = any(b in combined for b in OTHER_BRANDS)

    if is_canon and not is_other:
        return CANON_COPYRIGHT
    if is_other and not is_canon:
        return OTHER_COPYRIGHT
    return None


def process_dataset(dataset_name):
    dataset_dir = os.path.join(DATA_FOLDER, dataset_name)
    image_folder = os.path.join(dataset_dir, "uploaded_images")
    db_path = os.path.join(dataset_dir, "database.db")

    if not os.path.isdir(image_folder) or not os.path.isfile(db_path):
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    updated = 0
    db_only = 0
    skipped = 0
    errors = 0
    db_only_files = []

    for fn in sorted(os.listdir(image_folder)):
        path = os.path.join(image_folder, fn)
        if not os.path.isfile(path):
            continue

        try:
            with open(path, "rb") as f:
                original_bytes = f.read()
            with open(path, "rb") as f:
                img = Image(f)
        except Exception as e:
            print(f"  [ERROR] {fn}: failed to read - {e}")
            errors += 1
            continue

        new_copyright = determine_new_copyright(img)
        if new_copyright is None:
            skipped += 1
            continue

        write_to_file = True
        try:
            original_ok, original_sof = walk_and_get_sof(original_bytes)

            img.copyright = new_copyright
            new_bytes = img.get_file()
            new_ok, new_sof = walk_and_get_sof(new_bytes)

            # Only trust the rewrite if it still decodes to the exact same
            # image dimensions it had before we touched it. If we can't even
            # establish what the original decoded to, we have no safe way to
            # confirm the rewrite - so don't risk it either.
            if not (original_ok and original_sof is not None):
                write_to_file = False
            elif not (new_ok and new_sof == original_sof):
                write_to_file = False

            if write_to_file:
                with open(path, "wb") as f:
                    f.write(new_bytes)
        except Exception as e:
            print(f"  [ERROR] {fn}: failed to write EXIF - {e}")
            errors += 1
            continue

        cursor.execute(
            "UPDATE Images SET copyright = ? WHERE image_path = ?",
            (new_copyright, fn),
        )
        if write_to_file:
            updated += 1
            print(f"  {fn}: copyright -> {new_copyright} ({cursor.rowcount} DB row(s) updated)")
        else:
            db_only += 1
            db_only_files.append(fn)
            print(
                f"  {fn}: copyright -> {new_copyright} in DB only "
                f"(EXIF rewrite would have changed the decoded image - left file untouched)"
            )

    conn.commit()
    conn.close()

    print(
        f"[{dataset_name}] updated={updated} db_only={db_only} "
        f"skipped={skipped} errors={errors}"
    )
    if db_only_files:
        print(f"[{dataset_name}] files needing manual EXIF follow-up:")
        for fn in db_only_files:
            print(f"    {fn}")


def main():
    only_dataset = sys.argv[1] if len(sys.argv) > 1 else None
    for entry in sorted(os.scandir(DATA_FOLDER), key=lambda e: e.name):
        if entry.is_dir():
            if only_dataset and entry.name != only_dataset:
                continue
            print(f"Processing dataset '{entry.name}'...")
            process_dataset(entry.name)


if __name__ == "__main__":
    main()
