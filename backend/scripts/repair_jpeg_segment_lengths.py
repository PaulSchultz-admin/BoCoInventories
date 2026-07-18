"""
repair_jpeg_segment_lengths.py

Fixes a corruption introduced by set_copyright_from_camera.py: for some images
(mostly Nikon files, apparently anything with a MakerNote structure the
`exif` library warns "skipping bad IFD" about), rewriting the file via
`Image.get_file()` preserved all of the actual segment bytes correctly but
wrote the WRONG 2-byte length value in the first APP1 (EXIF) segment's
header. That single wrong length field desyncs every JPEG marker parser
(browsers included) from that point on, even though nothing else in the file
changed - the real next marker is still there, just at a different offset
than the (wrong) declared length points to.

IMPORTANT: an earlier version of this script patched the length field to
whatever position the FIRST successfully-parseable marker chain landed on.
For many files that turned out to be the small JPEG thumbnail embedded
inside the EXIF blob (commonly ~160px), not the real photo - both parse
"cleanly" (both have a valid SOI...SOS structure from the decoder's point of
view), so a naive "does it parse?" check can't tell them apart. This version
cross-checks the candidate's SOF (Start Of Frame) dimensions against the
EXIF PixelXDimension/PixelYDimension tags (readable independently of the
corrupted segment, since the `exif` library walks TIFF-internal offsets) and
only accepts a candidate whose real image dimensions match.

Usage:
    venv/Scripts/python.exe scripts/repair_jpeg_segment_lengths.py [--dry-run]
"""

import os
import sys

from exif import Image as ExifImage

DATA_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

MARKERS_NO_LENGTH = {0xD8, 0xD9, 0x01} | set(range(0xD0, 0xD8))
CANDIDATE_MARKERS = {0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9,
                     0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF, 0xDB, 0xC0, 0xC1, 0xC2,
                     0xC3, 0xC4, 0xDD, 0xDA, 0xFE}
SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3}


def walk_and_get_sof(data, start):
    """Walk the marker chain from `start`. Returns (reached_end, last_sof_wh)
    where last_sof_wh is the (width, height) of the last SOF segment seen
    before reaching SOS/EOI, or None if no SOF was seen."""
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


def get_expected_dimensions(path):
    """Read the EXIF-reported true pixel dimensions, independent of the
    corrupted outer JPEG segment structure. Returns (w, h) or None."""
    try:
        with open(path, "rb") as f:
            img = ExifImage(f)
        if not img.has_exif:
            return None
        for w_attr, h_attr in (
            ("pixel_x_dimension", "pixel_y_dimension"),
            ("image_width", "image_height"),
        ):
            try:
                w = getattr(img, w_attr, None)
                h = getattr(img, h_attr, None)
            except Exception:
                continue
            if w and h:
                return (int(w), int(h))
    except Exception:
        pass
    return None


def find_verified_resync_offset(data, length_field_offset, search_from, search_limit, expected_wh):
    """Search for a marker position after `search_from` such that patching the
    given length field to point there makes the WHOLE file parse cleanly.

    Prefers a candidate whose resulting SOF exactly matches the EXIF-reported
    dimensions (a confirmed correct fix). If none exists - which happens when
    the true full-resolution image data is no longer present in the file at
    all (apparently lost when the buggy `exif` library rewrote it) - falls
    back to the candidate with the LARGEST real image found, since that's a
    strict improvement over a tiny embedded thumbnail even though it isn't
    the original resolution.

    Returns (offset, is_exact_match) or (None, False) if nothing decodable
    was found at all.
    """
    best_fallback = None  # (offset, area)
    for offset in range(search_from, min(search_limit, len(data) - 1)):
        if data[offset] == 0xFF and data[offset + 1] in CANDIDATE_MARKERS:
            correct_length = offset - length_field_offset
            if correct_length <= 0 or correct_length > 0xFFFF:
                continue
            trial = bytearray(data)
            trial[length_field_offset] = (correct_length >> 8) & 0xFF
            trial[length_field_offset + 1] = correct_length & 0xFF
            ok, sof_wh = walk_and_get_sof(trial, 2)
            if not ok or sof_wh is None:
                continue
            if expected_wh is not None and sof_wh == expected_wh:
                return offset, True
            area = sof_wh[0] * sof_wh[1]
            if best_fallback is None or area > best_fallback[1]:
                best_fallback = (offset, area)
    if best_fallback is not None:
        return best_fallback[0], False
    return None, False


def needs_repair(path):
    """Returns (needs_fix: bool, expected_wh, current_wh) for a JPEG file."""
    with open(path, "rb") as f:
        data = f.read()
    if data[0:2] != b"\xff\xd8":
        return False, None, None

    expected_wh = get_expected_dimensions(path)
    ok, current_wh = walk_and_get_sof(data, 2)

    if not ok:
        return True, expected_wh, current_wh
    if expected_wh is not None and current_wh != expected_wh:
        return True, expected_wh, current_wh
    return False, expected_wh, current_wh


def repair_file(path):
    """Returns 'ok' (already fine), 'repaired' (confirmed original resolution
    recovered), 'repaired_approximate' (best real image found, but it doesn't
    match the EXIF-recorded original dimensions - the true full-resolution
    data appears to be gone), or 'unrepairable' (nothing decodable at all).
    """
    with open(path, "rb") as f:
        data = bytearray(f.read())

    if data[0:2] != b"\xff\xd8":
        return "not_jpeg"

    expected_wh = get_expected_dimensions(path)

    fix_needed, _, _ = needs_repair(path)
    if not fix_needed:
        return "ok"

    i = 2
    n = len(data)
    patched = False
    any_approximate = False

    while i < n - 1:
        if data[i] != 0xFF:
            return "unrepairable"

        marker = data[i + 1]
        if marker == 0xD9:
            break
        if marker in MARKERS_NO_LENGTH:
            i += 2
            continue
        if i + 4 > n:
            return "unrepairable"

        length_field_offset = i + 2
        declared_length = (data[length_field_offset] << 8) | data[length_field_offset + 1]
        next_marker_pos = i + 2 + declared_length

        if marker == 0xDA:
            break

        landed_on_marker = (
            next_marker_pos + 1 < n
            and data[next_marker_pos] == 0xFF
            and data[next_marker_pos + 1] != 0x00
        )

        # Even if the declared length lands on *a* marker, it might be the
        # wrong one (the embedded-thumbnail problem) - so for the segment(s)
        # before we've confirmed the whole file matches expected dimensions,
        # verify by walking from here and comparing SOF dimensions too.
        ok_so_far, sof_wh = walk_and_get_sof(data, i) if landed_on_marker else (False, None)
        good_match = ok_so_far and (expected_wh is None or sof_wh == expected_wh)

        if not good_match:
            resync_at, is_exact = find_verified_resync_offset(
                data, length_field_offset, i + 4, n, expected_wh
            )
            if resync_at is None:
                return "unrepairable"
            if not is_exact:
                any_approximate = True
            correct_length = resync_at - length_field_offset
            data[length_field_offset] = (correct_length >> 8) & 0xFF
            data[length_field_offset + 1] = correct_length & 0xFF
            patched = True
            next_marker_pos = resync_at

        i = next_marker_pos

    if not patched:
        return "ok"

    final_ok, final_sof_wh = walk_and_get_sof(data, 2)
    if not final_ok:
        return "unrepairable"

    with open(path, "wb") as f:
        f.write(data)

    if any_approximate or (expected_wh is not None and final_sof_wh != expected_wh):
        return "repaired_approximate"
    return "repaired"


def main():
    dry_run = "--dry-run" in sys.argv
    totals = {"ok": 0, "repaired": 0, "repaired_approximate": 0, "unrepairable": 0, "not_jpeg": 0}
    flagged_files = []
    approximate_files = []

    for dataset in sorted(os.listdir(DATA_FOLDER)):
        folder = os.path.join(DATA_FOLDER, dataset, "uploaded_images")
        if not os.path.isdir(folder):
            continue
        for fn in sorted(os.listdir(folder)):
            path = os.path.join(folder, fn)
            if not os.path.isfile(path):
                continue
            try:
                if dry_run:
                    fix_needed, expected_wh, current_wh = needs_repair(path)
                    if fix_needed:
                        print(f"  [{dataset}] {fn}: NEEDS REPAIR (expected={expected_wh}, current={current_wh})")
                        totals["repaired"] += 1  # reuse bucket name for count display
                    else:
                        totals["ok"] += 1
                    continue

                result = repair_file(path)
                totals[result] += 1
                if result == "repaired":
                    print(f"  [{dataset}] {fn}: repaired")
                elif result == "repaired_approximate":
                    print(f"  [{dataset}] {fn}: repaired (approximate - true resolution not found)")
                    approximate_files.append((dataset, fn))
                elif result == "unrepairable":
                    print(f"  [{dataset}] {fn}: UNREPAIRABLE")
                    flagged_files.append((dataset, fn))
            except Exception as e:
                print(f"  [{dataset}] {fn}: ERROR - {e}")

    print("\nTotals:", totals)
    if approximate_files:
        print("\nApproximate repairs (best real image found, not the original resolution):")
        for ds, fn in approximate_files:
            print(f"  {ds}/{fn}")
    if flagged_files:
        print("\nUnrepairable files (left untouched):")
        for ds, fn in flagged_files:
            print(f"  {ds}/{fn}")


if __name__ == "__main__":
    main()
