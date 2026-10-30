"""
offline_images.py

Low-resolution copies of dataset photos for the frontend's "Save for offline
use" download (see frontend26/src/services/offline.js). Full-size photos are
too big to put on a phone for datasets like wildflowers, so the image routes
serve a copy no larger than MAX_DIMENSION pixels when asked with
?size=offline.

Copies live next to a dataset's uploaded_images folder, in offline_images/,
named after the original file plus ".jpg" (e.g. abc123.png -> abc123.png.jpg).
They're made on first request and kept, so they sync to Render along with the
rest of the dataset folder (upload_data.py). scripts/build_offline_images.py
makes them all in advance and removes copies whose original is gone.

Originals that are already small JPEGs are served as-is instead of copied.
"""
import os
import logging
import tempfile

from flask import request, send_file, send_from_directory
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

MAX_DIMENSION = 1000
JPEG_QUALITY = 80
OFFLINE_FOLDER_NAME = "offline_images"


def offline_folder(image_folder):
    """The offline_images folder that sits beside a dataset's uploaded_images folder."""
    return os.path.join(os.path.dirname(os.path.normpath(image_folder)), OFFLINE_FOLDER_NAME)


def offline_copy_path(image_folder, filename):
    return os.path.join(offline_folder(image_folder), f"{filename}.jpg")


def ensure_offline_copy(image_folder, filename):
    """
    Returns the path of the low-resolution file to serve for an original
    photo: an up-to-date copy in offline_images/ (made now if missing or
    older than the original), or the original itself if it's already a JPEG
    within MAX_DIMENSION.
    """
    source = os.path.join(image_folder, filename)
    copy = offline_copy_path(image_folder, filename)
    if os.path.exists(copy) and os.path.getmtime(copy) >= os.path.getmtime(source):
        return copy

    with Image.open(source) as img:
        if img.format == "JPEG" and max(img.size) <= MAX_DIMENSION:
            return source

        # Bake in the camera's rotation, since the copy drops the EXIF data
        # browsers would otherwise use to rotate it.
        small = ImageOps.exif_transpose(img)
        if small.mode in ("RGBA", "LA", "P"):
            rgba = small.convert("RGBA")
            small = Image.new("RGB", rgba.size, "white")
            small.paste(rgba, mask=rgba.split()[-1])
        else:
            small = small.convert("RGB")
        small.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

        # Write to a temp file and rename, so two workers making the same copy
        # at once never serve a half-written file.
        os.makedirs(os.path.dirname(copy), exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(copy), suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as tmp:
                small.save(tmp, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
            os.replace(tmp_path, copy)
        except BaseException:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise

    logger.debug(f"Made offline copy of '{filename}' at {copy}")
    return copy


def send_image(image_folder, filename):
    """Sends a photo, or its low-resolution copy when the request has ?size=offline."""
    if request.args.get("size") == "offline":
        try:
            return send_file(ensure_offline_copy(image_folder, filename), mimetype="image/jpeg")
        except Exception as e:
            # Fall back to the original rather than failing the download.
            logger.warning(f"Couldn't make offline copy of '{filename}': {e}")
    return send_from_directory(image_folder, filename)
