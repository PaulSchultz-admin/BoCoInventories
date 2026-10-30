"""
build_offline_images.py

Makes the low-resolution (max 1000 px) photo copies that a dataset's
"Save for offline use" download fetches, in backend/data/<dataset>/offline_images/,
and deletes copies whose original photo is gone. See app/offline_images.py.

The backend also makes missing copies on demand, so this is optional, but
running it before upload_data.py means the first phone to download a dataset
on Render doesn't wait for every photo to be resized there.

Usage (from backend/):
    venv/Scripts/python.exe scripts/build_offline_images.py wildflowers
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.offline_images import ensure_offline_copy, offline_folder  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def mb(n):
    return f"{n / 1e6:.1f} MB"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dataset", help="dataset folder under backend/data, e.g. wildflowers")
    args = parser.parse_args()

    image_folder = os.path.join(DATA_DIR, args.dataset, "uploaded_images")
    if not os.path.isdir(image_folder):
        sys.exit(f"No uploaded_images folder for '{args.dataset}': {image_folder}")

    originals = sorted(
        f for f in os.listdir(image_folder)
        if not f.startswith(".") and os.path.isfile(os.path.join(image_folder, f))
    )
    full_bytes = small_bytes = failed = 0
    for i, filename in enumerate(originals, 1):
        source = os.path.join(image_folder, filename)
        full_bytes += os.path.getsize(source)
        try:
            small_bytes += os.path.getsize(ensure_offline_copy(image_folder, filename))
        except Exception as e:
            failed += 1
            print(f"  skipped {filename}: {e}")
        print(f"\r{i}/{len(originals)}", end="", flush=True)
    print()

    removed = 0
    copies_folder = offline_folder(image_folder)
    if os.path.isdir(copies_folder):
        keep = {f"{f}.jpg" for f in originals}
        for name in os.listdir(copies_folder):
            if name not in keep:
                os.remove(os.path.join(copies_folder, name))
                removed += 1

    print(f"{len(originals) - failed} photos: {mb(full_bytes)} full size -> {mb(small_bytes)} for offline")
    if removed:
        print(f"Removed {removed} copies whose original is gone")
    if failed:
        print(f"{failed} photos couldn't be resized (their originals will be downloaded instead)")


if __name__ == "__main__":
    main()
