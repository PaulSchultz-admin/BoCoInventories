"""
location_photos.py

API routes for the sidebar inset map's geotagged photos (LocationPhotos).
These are standalone photos of a place (e.g. a lichen-covered boulder) with
a comment, distinct from the species Images table: they aren't attached to
a Wildlife record, just a latitude/longitude pulled from the photo's own
EXIF GPS data plus a hand-written comment.

Routes:
    - POST /api/create-location-photo/: Upload a photo, extracting its GPS location
    - GET /api/get-location-photos/: List all location photos for a dataset
    - GET /api/get-location-photo-image/<id>: Retrieve the photo file by ID
    - DELETE /api/delete-location-photo/: Delete a location photo
"""

import os
import logging
from flask import Blueprint, request, jsonify, send_from_directory
from exif import Image
from app import db_helpers
from app.utils import save_file

logger = logging.getLogger(__name__)

location_photos_bp = Blueprint("location_photos", __name__)


def _dms_to_decimal(dms, ref):
    """Convert an EXIF GPS (degrees, minutes, seconds) tuple + ref ('N'/'S'/'E'/'W') to decimal degrees."""
    degrees, minutes, seconds = dms
    decimal = float(degrees) + float(minutes) / 60 + float(seconds) / 3600
    if ref in ("S", "W"):
        decimal = -decimal
    return decimal


def _extract_gps(file_path):
    """Return (latitude, longitude) from a photo's EXIF GPS tags, or None if absent."""
    with open(file_path, "rb") as f:
        img = Image(f)
        if not img.has_exif:
            return None
        try:
            lat = _dms_to_decimal(img.gps_latitude, img.gps_latitude_ref)
            lon = _dms_to_decimal(img.gps_longitude, img.gps_longitude_ref)
            return lat, lon
        except AttributeError:
            return None


@location_photos_bp.route("/api/create-location-photo/", methods=["POST"])
def create_location_photo():
    """
    Uploads a geotagged photo for the inset map. Requires image_file; its GPS
    location is read from the photo's own EXIF data (there's no manual
    latitude/longitude override — if the photo has no GPS tags, this fails).
    'comment' is optional.

    Example request:
    POST /api/create-location-photo/?dataset=lichens
    Form Data: image_file=<file>, comment=Boulder with orange/yellow lichen

    Example output:
    {
        "message": "Location photo created successfully",
        "id": 1,
        "image_path": "...",
        "latitude": 40.01,
        "longitude": -105.27,
        "comment": "Boulder with orange/yellow lichen"
    }
    """
    image_file = request.files.get("image_file")
    comment = request.form.get("comment", "").strip()

    if not image_file:
        return jsonify({"error": "image_file is required"}), 400

    file_length = image_file.seek(0, os.SEEK_END)
    image_file.seek(0, os.SEEK_SET)
    if file_length > 10 * 1024 * 1024:
        return jsonify({"error": f"The image file {image_file.filename} is too large (max 10 MB)"}), 400
    if not image_file.mimetype.startswith("image/"):
        return (
            jsonify(
                {
                    "error": f"The file {image_file.filename} is not an image (its MIME type is {image_file.mimetype}, which doesn't start with 'image/')"
                }
            ),
            400,
        )

    upload_folder = db_helpers.get_active_image_upload_folder()
    saved_filename = save_file(image_file, upload_folder)
    file_path = os.path.join(upload_folder, saved_filename)

    gps = _extract_gps(file_path)
    if gps is None:
        os.remove(file_path)
        return (
            jsonify(
                {
                    "error": "This photo doesn't have GPS location data. Make sure location services were enabled when it was taken."
                }
            ),
            400,
        )
    latitude, longitude = gps

    location_photo_id = db_helpers.insert(
        "INSERT INTO LocationPhotos (image_path, latitude, longitude, comment) VALUES (?, ?, ?, ?)",
        (saved_filename, latitude, longitude, comment),
    )

    return (
        jsonify(
            {
                "message": "Location photo created successfully",
                "id": location_photo_id,
                "image_path": saved_filename,
                "latitude": latitude,
                "longitude": longitude,
                "comment": comment,
            }
        ),
        201,
    )


@location_photos_bp.route("/api/get-location-photos/", methods=["GET"])
def get_location_photos():
    """
    Lists all location photos for the active dataset.

    Example request:
    GET /api/get-location-photos/?dataset=lichens
    """
    photos = db_helpers.select_multiple(
        "SELECT id, image_path, latitude, longitude, comment FROM LocationPhotos"
    )
    return jsonify(photos), 200


@location_photos_bp.route("/api/get-location-photo-image/<int:location_photo_id>", methods=["GET"])
def get_location_photo_image(location_photo_id):
    """
    Retrieves a location photo's image file by its ID.

    Example request:
    GET /api/get-location-photo-image/1?dataset=lichens
    """
    photo = db_helpers.select_one(
        "SELECT image_path FROM LocationPhotos WHERE id = ?", [location_photo_id]
    )
    if not photo:
        return jsonify({"error": "Location photo not found"}), 404

    filename = photo["image_path"]
    image_folder = db_helpers.find_existing_image_folder(filename)
    if image_folder is None:
        return jsonify({"error": f"Image file '{filename}' not found"}), 404
    return send_from_directory(image_folder, filename)


@location_photos_bp.route("/api/delete-location-photo/", methods=["DELETE"])
def delete_location_photo():
    """
    Deletes a location photo and its image file.

    Example request:
    DELETE /api/delete-location-photo/?id=1&dataset=lichens
    """
    location_photo_id = request.args["id"]
    photo = db_helpers.select_one(
        "SELECT * FROM LocationPhotos WHERE id = ?", [location_photo_id]
    )
    if not photo:
        return jsonify({"error": "Location photo not found"}), 404

    upload_folder = db_helpers.get_active_image_upload_folder()
    file_path = os.path.join(upload_folder, photo["image_path"])
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception as e:
        logger.warning(f"Error deleting location photo file {file_path}: {e}")

    db_helpers.delete("DELETE FROM LocationPhotos WHERE id = ?", [location_photo_id])
    return jsonify({"message": "Location photo successfully deleted"}), 200
