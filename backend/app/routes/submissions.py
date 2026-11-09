"""
submissions.py

API routes for photo submissions from the public: someone agrees to the
Contributor License Agreement on the home Submissions and permissions page,
then uploads a photo for an admin to review.

Submissions live in their own folder, data/submissions/ (a submissions.db
plus a photos/ folder), not in a dataset. upload_data.py replaces a whole
dataset folder on Render when it syncs one, so anything stored in a dataset
(e.g. "home") would wipe the submissions made on the live site. The photos
are not served by /api/get-image either: until an admin reviews them, only
an admin can see them.

Routes include:
    - POST /api/submissions/: Submit a photo (public)
    - GET /api/submissions/: List submissions, newest first (admin only)
    - GET /api/submissions/<id>/photo: The submitted photo file (admin only)
    - DELETE /api/submissions/<id>: Delete a submission and its photo (admin only)
"""

import os
import sqlite3
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_from_directory
from app import db_helpers
from app.routes.auth import is_valid_token
from app.utils import save_file

submissions_bp = Blueprint("submissions", __name__)

SUBMISSIONS_FOLDER = os.path.join(db_helpers.DATA_FOLDER, "submissions")
PHOTOS_FOLDER = os.path.join(SUBMISSIONS_FOLDER, "photos")
DB_PATH = os.path.join(SUBMISSIONS_FOLDER, "submissions.db")

MAX_PHOTO_BYTES = 25 * 1024 * 1024
# Text fields are trimmed to these lengths, so a bad request can't store
# arbitrarily large strings.
FIELD_LIMITS = {
    "name": 200,
    "email": 200,
    "species": 200,
    "location": 300,
    "date_taken": 50,
    "notes": 2000,
}
# The agreement text itself can be long; it's kept as a record of exactly
# what the contributor agreed to.
MAX_AGREEMENT_CHARS = 20000


def _connect():
    """Opens submissions.db, creating the folder and table on first use (the
    production server never runs init_all_dbs, so this can't rely on it)."""
    os.makedirs(PHOTOS_FOLDER, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS Submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          submitted_at TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          species TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL DEFAULT '',
          date_taken TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          filename TEXT NOT NULL,
          original_filename TEXT NOT NULL DEFAULT '',
          agreement_text TEXT NOT NULL,
          agreed_at TEXT NOT NULL
        )
        """
    )
    return conn


def _require_admin():
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[len("Bearer "):] if auth_header.startswith("Bearer ") else request.args.get("admin_token")
    if not is_valid_token(token):
        return jsonify({"error": "Admin authentication required"}), 401
    return None


@submissions_bp.route("/api/submissions/", methods=["POST"])
def create_submission():
    """
    Submits a photo. The contributor must have agreed to the Contributor
    License Agreement; its text is stored with the submission.

    Example request:
    POST /api/submissions/
    Form Data: photo=<file>, name, email, species, location, date_taken, notes,
               agreed=true, agreement_text=<the agreement as shown>

    Example output:
    {
        "id": 12,
        "message": "Thank you! Your photo was submitted."
    }
    """
    form = request.form
    fields = {key: (form.get(key) or "").strip()[:limit] for key, limit in FIELD_LIMITS.items()}

    if form.get("agreed") != "true":
        return jsonify({"error": "You must agree to the Contributor License Agreement"}), 400
    agreement_text = (form.get("agreement_text") or "").strip()[:MAX_AGREEMENT_CHARS]
    if not agreement_text:
        return jsonify({"error": "agreement_text is required"}), 400
    if not fields["name"]:
        return jsonify({"error": "Please enter your name"}), 400
    if "@" not in fields["email"]:
        return jsonify({"error": "Please enter a valid email address"}), 400

    photo = request.files.get("photo")
    if not photo or not photo.filename:
        return jsonify({"error": "Please choose a photo to submit"}), 400
    size = photo.seek(0, os.SEEK_END)
    photo.seek(0, os.SEEK_SET)
    if size > MAX_PHOTO_BYTES:
        return jsonify({"error": "That photo is too large (max 25 MB)"}), 400
    if not photo.mimetype.startswith("image/"):
        return jsonify({"error": "That file isn't an image"}), 400

    conn = _connect()
    filename = save_file(photo, PHOTOS_FOLDER)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    cursor = conn.execute(
        """
        INSERT INTO Submissions (submitted_at, name, email, species, location, date_taken,
                                 notes, filename, original_filename, agreement_text, agreed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            now,
            fields["name"],
            fields["email"],
            fields["species"],
            fields["location"],
            fields["date_taken"],
            fields["notes"],
            filename,
            photo.filename[:300],
            agreement_text,
            now,
        ),
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return jsonify({"id": new_id, "message": "Thank you! Your photo was submitted."}), 201


@submissions_bp.route("/api/submissions/", methods=["GET"])
def list_submissions():
    """
    Lists all submissions, newest first, without the stored agreement text.
    Admin only.
    """
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    conn = _connect()
    rows = conn.execute(
        """
        SELECT id, submitted_at, name, email, species, location, date_taken, notes,
               original_filename, agreed_at
        FROM Submissions ORDER BY id DESC
        """
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows]), 200


@submissions_bp.route("/api/submissions/<int:submission_id>/photo", methods=["GET"])
def get_submission_photo(submission_id):
    """
    Returns a submission's photo. Admin only; the token may be sent as an
    admin_token query param so the URL works in an <img> tag.
    """
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    conn = _connect()
    row = conn.execute("SELECT filename FROM Submissions WHERE id = ?", (submission_id,)).fetchone()
    conn.close()
    if row is None:
        return jsonify({"error": "Submission not found"}), 404
    return send_from_directory(PHOTOS_FOLDER, row["filename"])


@submissions_bp.route("/api/submissions/<int:submission_id>", methods=["DELETE"])
def delete_submission(submission_id):
    """Deletes a submission and its photo file. Admin only."""
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    conn = _connect()
    row = conn.execute("SELECT filename FROM Submissions WHERE id = ?", (submission_id,)).fetchone()
    if row is None:
        conn.close()
        return jsonify({"error": "Submission not found"}), 404
    conn.execute("DELETE FROM Submissions WHERE id = ?", (submission_id,))
    conn.commit()
    conn.close()

    photo_path = os.path.join(PHOTOS_FOLDER, row["filename"])
    if os.path.exists(photo_path):
        os.remove(photo_path)
    return jsonify({"message": "Submission deleted"}), 200
