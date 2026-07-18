"""
images.py

API routes for managing wildlife images and EXIF metadata in the Blueprint Wildlife Database.
Handles image uploads, retrieval, replacement, and thumbnail management.

Key Features:
    - Upload images for wildlife entries with automatic EXIF metadata extraction
    - Set and manage thumbnail images for wildlife display
    - Replace existing images while preserving database records
    - Retrieve images by filename or image ID
    - EXIF data normalization for consistent JSON serialization
    - File size validation (max 10MB) and MIME type checking

Routes include:
    - GET /api/get-image/<filename>: Retrieve image by filename
    - GET /api/get-image-by-image-id/<id>: Retrieve image by database ID
    - GET /api/get-images-by-wildlife-id/<id>: Get all images for a wildlife entry
    - POST /api/add-image/: Upload new image to wildlife entry
    - PUT /api/replace-image/<id>: Replace existing image file
    - PUT /api/set-thumbnail: Set thumbnail for wildlife display
    - DELETE /api/delete_image/: Delete image and associated file
"""
from flask import Blueprint, request, jsonify, send_from_directory
import logging
import os
import json
from app import db_helpers

# from .utils import save_file, get_parent_ids  # Adjust import if needed
from app.utils import save_file  # Adjust import if needed
import sqlite3
from exif import Image

logger = logging.getLogger(__name__)

images_bp = Blueprint("images", __name__)

DEFAULT_COPYRIGHT = "Boulder County Nature Association"


def normalize(value):
    """Recursively normalize EXIF metadata values to JSON-serializable types.
    
    EXIF data from PIL Image library includes special types (Rational, Flash, etc.)
    that don't serialize to JSON by default. This function converts them to standard types.
    
    Args:
        value: EXIF metadata value of unknown type
    
    Returns:
        JSON-serializable value (str, int, float, bool, None, or list/dict thereof)
    """
    # bytes → string
    if isinstance(value, bytes):
        return value.decode(errors="ignore")

    # rational numbers → float
    if hasattr(value, "numerator") and hasattr(value, "denominator"):
        try:
            return float(value)
        except Exception:
            return str(value)

    # iterables (e.g., tuples of rationals)
    if isinstance(value, (list, tuple)):
        return [normalize(v) for v in value]

    # fallback: convert unknown objects (like Flash) to string
    if not isinstance(value, (str, int, float, bool, type(None))):
        return str(value)

    return value


def exif_date_to_mmddyyyy(exif_datetime):
    """Convert an EXIF 'YYYY:MM:DD HH:MM:SS' timestamp to 'MM/DD/YYYY'."""
    date_part = (exif_datetime or "").split(" ")[0]
    year, _, rest = date_part.partition(":")
    month, _, day = rest.partition(":")
    if not (year and month and day):
        return ""
    return f"{month}/{day}/{year}"


@images_bp.route(
    "/api/get-image/<string:filename>/", strict_slashes=False, methods=["GET"]
)
def get_image(filename):
    """
    Gets a user-uploaded image file by its filename. Used for getting images associated with wildlife.

    Example request:
    GET /api/get-image/1234abcd.png

    Example output:
    (The image file)
    """
    image_folder = db_helpers.find_existing_image_folder(filename)
    if image_folder is None:
        return jsonify({"error": f"Image '{filename}' not found in any dataset"}), 404
    file_path = os.path.join(image_folder, filename)
    logger.debug(f"Serving image '{filename}' from {file_path}")
    return send_from_directory(image_folder, filename)


@images_bp.route("/api/add-image/", methods=["POST"])
def add_image():
    """
    Add an image to a wildlife instance.
    Requires wildlife_id and image_file
    """
    wildlife_id = request.form.get("wildlife_id")
    image_file = request.files.get("image_file")
    manual_copyright = request.form.get("copyright", "").strip()
    manual_date_taken = request.form.get("date_taken", "").strip()
    manual_location_taken = request.form.get("location_taken", "").strip()
    comment_value = request.form.get("comment", "").strip()
    if not wildlife_id or not image_file:
        return jsonify({"error": "Both wildlife_id and image_file are required"}), 400

    file_length = image_file.seek(0, os.SEEK_END)
    image_file.seek(0, os.SEEK_SET)
    logger.debug(f"Uploaded file length: {file_length}")
    if file_length > 10 * 1024 * 1024:
        return (
            jsonify(
                {
                    "error": f"The image file {image_file.filename} is too large (max 10 MB)"
                }
            ),
            400,
        )
    if not image_file.mimetype.startswith("image/"):
        return (
            jsonify(
                {
                    "error": f"The file {image_file.filename} is not an image (its MIME type is {image_file.mimetype}, which doesn't start with 'image/')"
                }
            ),
            400,
        )

    saved_filename = save_file(image_file, db_helpers.get_active_image_upload_folder())

    with open(
        os.path.join(db_helpers.get_active_image_upload_folder(), saved_filename), "rb"
    ) as f:
        img = Image(f)
        exif_dict = {}

        if img.has_exif:
            for tag in img.list_all():
                try:
                    raw = getattr(img, tag)
                    exif_dict[tag] = normalize(raw)
                except Exception:
                    continue

        logger.debug(f"Extracted EXIF data: {json.dumps(exif_dict)}")

    # Copyright defaults to a hand-entered value, then the image's EXIF
    # copyright tag, then the organization's name.
    exif_copyright = str(exif_dict.get("copyright", "")).strip()
    copyright_value = manual_copyright or exif_copyright or DEFAULT_COPYRIGHT

    # Date taken defaults to a hand-entered value, then the image's EXIF
    # "date taken" (DateTimeOriginal) tag, falling back to the modify-date
    # tag if that's the only timestamp present.
    exif_date_taken = exif_date_to_mmddyyyy(
        exif_dict.get("datetime_original") or exif_dict.get("datetime")
    )
    date_taken_value = manual_date_taken or exif_date_taken

    # Location taken has no equivalent EXIF text tag (only raw GPS
    # coordinates), so it's simply whatever was hand-entered, if anything.
    location_taken_value = manual_location_taken

    # Insert the image and get its ID
    image_id = db_helpers.insert(
        "INSERT INTO Images (wildlife_id, image_path, metadata, copyright, date_taken, location_taken, comment) VALUES (?, ?, JSONB(?), ?, ?, ?, ?)",
        (
            wildlife_id,
            saved_filename,
            json.dumps(exif_dict),
            copyright_value,
            date_taken_value,
            location_taken_value,
            comment_value,
        ),
    )

    return (
        jsonify(
            {
                "message": "Image added successfully",
                "image_id": image_id,
                "image_path": saved_filename,
                "copyright": copyright_value,
                "date_taken": date_taken_value,
                "location_taken": location_taken_value,
                "comment": comment_value,
            }
        ),
        201,
    )


@images_bp.route("/api/replace-image/<int:image_id>", methods=["PUT"])
def replace_image(image_id):
    """
    Replaces an existing image file and/or its copyright/date taken/location
    taken/comment while keeping the same DB row/ID. Requires image_file,
    copyright, date_taken, location_taken, and/or comment in form data.
    """
    image = db_helpers.select_one("SELECT * FROM Images WHERE id = ?", [image_id])
    if not image:
        return jsonify({"error": "Image not found"}), 404

    image_file = request.files.get("image_file")
    copyright_value = request.form.get("copyright")
    date_taken_value = request.form.get("date_taken")
    location_taken_value = request.form.get("location_taken")
    comment_value = request.form.get("comment")
    if (
        image_file is None
        and copyright_value is None
        and date_taken_value is None
        and location_taken_value is None
        and comment_value is None
    ):
        return (
            jsonify(
                {
                    "error": "image_file, copyright, date_taken, location_taken, or comment is required"
                }
            ),
            400,
        )

    saved_filename = image.get("image_path")

    if image_file:
        file_length = image_file.seek(0, os.SEEK_END)
        image_file.seek(0, os.SEEK_SET)
        if file_length > 10 * 1024 * 1024:
            return jsonify({"error": "Image too large (max 10MB)"}), 400
        if not image_file.mimetype.startswith("image/"):
            return jsonify({"error": "File is not an image"}), 400

        # Delete old file
        old_path = image.get("image_path")
        if old_path:
            upload_dir = db_helpers.get_active_image_upload_folder()
            old_file_path = os.path.join(upload_dir, old_path)
            try:
                if os.path.exists(old_file_path):
                    os.remove(old_file_path)
            except Exception as e:
                logger.warning(f"Error deleting old image file: {e}")

        # Save new file
        saved_filename = save_file(image_file, db_helpers.get_active_image_upload_folder())
        db_helpers.update(
            "UPDATE Images SET image_path = ? WHERE id = ?", (saved_filename, image_id)
        )

    if copyright_value is not None:
        db_helpers.update(
            "UPDATE Images SET copyright = ? WHERE id = ?",
            (copyright_value.strip() or DEFAULT_COPYRIGHT, image_id),
        )

    if date_taken_value is not None:
        db_helpers.update(
            "UPDATE Images SET date_taken = ? WHERE id = ?",
            (date_taken_value.strip(), image_id),
        )

    if location_taken_value is not None:
        db_helpers.update(
            "UPDATE Images SET location_taken = ? WHERE id = ?",
            (location_taken_value.strip(), image_id),
        )

    if comment_value is not None:
        db_helpers.update(
            "UPDATE Images SET comment = ? WHERE id = ?",
            (comment_value.strip(), image_id),
        )

    return (
        jsonify(
            {
                "message": "Image replaced successfully",
                "image_id": image_id,
                "image_path": saved_filename,
            }
        ),
        200,
    )


@images_bp.route("/api/set-thumbnail", methods=["PUT"])
def set_thumbnail():
    # Ensure both wildlife and image exist in the database
    wildlife_id = request.form.get("wildlife_id")
    thumbnail_id = request.form.get("thumbnail_id")

    # Validate input
    if not wildlife_id or not thumbnail_id:
        return jsonify({"error": "wildlife_id and thumbnail_id are required"}), 400

    # Check if wildlife exists
    wildlife = db_helpers.select_one(
        "SELECT id FROM Wildlife WHERE id = ?", [wildlife_id]
    )
    if not wildlife:
        return jsonify({"error": f"Wildlife with id {wildlife_id} does not exist"}), 404

    # Check if image exists and belongs to the wildlife
    if thumbnail_id != "null":
        image = db_helpers.select_one(
            "SELECT id FROM Images WHERE id = ? AND wildlife_id = ?",
            [thumbnail_id, wildlife_id],
        )
        if not image:
            return (
                jsonify(
                    {
                        "error": f"Image with id {thumbnail_id} does not exist for wildlife {wildlife_id}"
                    }
                ),
                404,
            )

    # Update the thumbnail_id in the Wildlife table
    db_helpers.mutate(
        "UPDATE Wildlife SET thumbnail_id = ? WHERE id = ?", (thumbnail_id, wildlife_id)
    )

    return (
        jsonify(
            {
                "message": "Thumbnail updated successfully",
                "wildlife_id": wildlife_id,
                "thumbnail_id": thumbnail_id,
            }
        ),
        200,
    )


@images_bp.route("/api/get-images-by-wildlife-id/<int:wildlife_id>", methods=["GET"])
def get_images_by_wildlife_id(wildlife_id):
    """
    Get all images for a wildlife instance.
    Requires wildlife_id.
    """
    logger.debug(f"get_images_by_wildlife_id: {wildlife_id}")
    try:
        images = db_helpers.select_multiple(
            "SELECT id, image_path, copyright, date_taken, location_taken, comment, JSON(metadata) AS metadata FROM Images WHERE wildlife_id = ?",
            [wildlife_id],
        )
        for image in images:
            if image["metadata"]:
                image["metadata"] = json.loads(image["metadata"])
        return jsonify(images), 200
    except Exception as e:
        logger.warning(f"Error in get_images_by_wildlife_id: {e}")
        return jsonify({"error": str(e)}), 500


@images_bp.route("/api/get-image-by-image-id/<int:image_id>", methods=["GET"])
def get_image_by_image_id(image_id):
    """
    Gets a user-uploaded image file by its image ID.
    Example request:
    GET /api/get-image-by-image-id/2
    """
    image = db_helpers.select_one(
        "SELECT image_path FROM Images WHERE id = ?", [image_id]
    )
    if image is None:
        return jsonify({"error": "Image not found"}), 404

    # Convert to dict if needed
    if isinstance(image, sqlite3.Row):
        image = dict(image)

    if "image_path" not in image:
        return jsonify({"error": "Image not found"}), 404

    filename = image["image_path"]
    image_folder = db_helpers.find_existing_image_folder(filename)
    if image_folder is None:
        return jsonify({"error": f"Image file '{filename}' not found"}), 404
    return send_from_directory(image_folder, filename)


def delete_image_by_id(image_id):
    image = db_helpers.select_one("SELECT * FROM Images WHERE id = ?", [image_id])
    if not image:
        return jsonify({"error": f"Image with id {image_id} not found"}), 404

    # Delete the image file from uploaded_images
    image_path = image.get("image_path")
    if image_path:
        upload_dir = db_helpers.get_active_image_upload_folder()
        file_path = os.path.join(upload_dir, image_path)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            # Log the error but continue with DB deletion
            logger.warning(f"Error deleting image file {file_path}: {e}")

    # Check if the image is the thumbnail for its wildlife
    wildlife = db_helpers.select_one(
        "SELECT id, thumbnail_id, name FROM Wildlife WHERE id = ?",
        [image["wildlife_id"]],
    )
    is_thumbnail = False
    if wildlife and wildlife["thumbnail_id"] is not None:
        is_thumbnail = str(wildlife["thumbnail_id"]) == str(image_id)

    # Delete the image from the database
    db_helpers.delete("DELETE FROM Images WHERE id = ?", [image_id])

    if is_thumbnail and wildlife:
        db_helpers.mutate(
            "UPDATE Wildlife SET thumbnail_id = NULL WHERE id = ?", [wildlife["id"]]
        )
        return (
            jsonify(
                {
                    "message": (
                        f"Image successfully deleted. Warning: this was the thumbnail for wildlife '{wildlife.get('name', '')}' "
                        f"(ID: {wildlife['id']}). Please set a new thumbnail."
                    )
                }
            ),
            200,
        )
    else:
        return jsonify({"message": "Image successfully deleted"}), 200


@images_bp.route("/api/delete_image/", methods=["DELETE"])
def delete_image():
    """
    Deletes an image. If that image is the thumbnail, sets thumbnail_id to null until a new thumbnail is assigned.
    Also deletes the image file from uploaded_images.

    Example request:
    DELETE /api/delete_image/?id=2
    """
    image_id = request.args["id"]
    return delete_image_by_id(image_id)
