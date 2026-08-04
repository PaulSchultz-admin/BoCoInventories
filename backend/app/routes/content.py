"""
content.py

API routes for each dataset's editable content: the About/Resources/Contact
page bodies and the Glossary term list. Like wildlife.py, these are scoped
per-dataset via the `?dataset=` query param (see db_helpers.get_connection).
Unlike wildlife.py, mutations here require a valid admin token (see auth.py)
sent as `Authorization: Bearer <token>`.

Routes include:
    - GET /api/page-content/<page>: Retrieve a page's markdown body
    - PUT /api/page-content/<page>: Replace a page's markdown body (admin only)
    - POST /api/content-images/: Upload an image to embed in page content (admin only)
    - GET /api/glossary/: List all glossary terms, alphabetically
    - POST /api/glossary/: Create a new glossary term (admin only)
    - PUT /api/glossary/<id>: Edit an existing glossary term (admin only)
    - DELETE /api/glossary/<id>: Delete a glossary term (admin only)
"""

import os
import sqlite3
from flask import Blueprint, request, jsonify
from app import db_helpers
from app.content_defaults import VALID_PAGES
from app.routes.auth import is_valid_token
from app.utils import save_file

content_bp = Blueprint("content", __name__)


def _require_admin():
    """Returns a (response, status) error tuple if the request lacks a valid
    admin token, otherwise None."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[len("Bearer "):] if auth_header.startswith("Bearer ") else None
    if not is_valid_token(token):
        return jsonify({"error": "Admin authentication required"}), 401
    return None


@content_bp.route("/api/page-content/<page>", methods=["GET"])
def get_page_content(page):
    """
    Retrieves the markdown body for a static page.

    Example request:
    GET /api/page-content/about

    Example output:
    {
        "page": "about",
        "content": "## About This Site\\n\\n..."
    }
    """
    if page not in VALID_PAGES:
        return jsonify({"error": f"Unknown page '{page}'"}), 404

    conn = db_helpers.get_connection()
    row = conn.execute(
        "SELECT content FROM PageContent WHERE page = ?", (page,)
    ).fetchone()
    conn.close()

    return jsonify({"page": page, "content": row["content"] if row else ""}), 200


@content_bp.route("/api/page-content/<page>", methods=["PUT"])
def update_page_content(page):
    """
    Replaces the markdown body for a static page. Requires admin authentication.

    Example request:
    PUT /api/page-content/about
    JSON body: {"content": "## New heading\\n\\nNew body text"}

    Example output:
    {
        "message": "Page content updated"
    }
    """
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    if page not in VALID_PAGES:
        return jsonify({"error": f"Unknown page '{page}'"}), 404

    content = (request.json or {}).get("content")
    if content is None:
        return jsonify({"error": "content is required"}), 400

    conn = db_helpers.get_connection()
    conn.execute(
        """
        INSERT INTO PageContent (page, content) VALUES (?, ?)
        ON CONFLICT(page) DO UPDATE SET content = excluded.content
        """,
        (page, content),
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Page content updated"}), 200


@content_bp.route("/api/content-images/", methods=["POST"])
def upload_content_image():
    """
    Uploads an image to embed in a page's markdown body. Requires admin
    authentication. The returned filename is served the same way wildlife
    photos are, via GET /api/get-image/<filename>?dataset=<dataset>.

    Example request:
    POST /api/content-images/?dataset=butterflies
    Form Data: image_file=<file>

    Example output:
    {
        "filename": "3f9c2a1b4e7d4f0a9c6e1a2b3c4d5e6f.jpg"
    }
    """
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    image_file = request.files.get("image_file")
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

    db_helpers.ensure_upload_folder_exists()
    filename = save_file(image_file, db_helpers.get_active_image_upload_folder())

    return jsonify({"filename": filename}), 201


@content_bp.route("/api/glossary/", methods=["GET"])
def get_glossary_terms():
    """
    Retrieves all glossary terms, sorted alphabetically.

    Example request:
    GET /api/glossary/

    Example output:
    [
        {"id": 1, "term": "Abdomen", "description": "The terminal (third) body segment of an adult insect."}
    ]
    """
    conn = db_helpers.get_connection()
    rows = conn.execute(
        "SELECT id, term, description FROM GlossaryTerms ORDER BY term COLLATE NOCASE"
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows]), 200


@content_bp.route("/api/glossary/", methods=["POST"])
def create_glossary_term():
    """
    Creates a new glossary term. Requires admin authentication.

    Example request:
    POST /api/glossary/
    JSON body: {"term": "Instar", "description": "The stage between molts."}

    Example output:
    {
        "id": 62,
        "term": "Instar",
        "description": "The stage between molts."
    }
    """
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    term = ((request.json or {}).get("term") or "").strip()
    description = ((request.json or {}).get("description") or "").strip()
    if not term or not description:
        return jsonify({"error": "term and description are required"}), 400

    conn = db_helpers.get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO GlossaryTerms (term, description) VALUES (?, ?)",
            (term, description),
        )
        conn.commit()
        term_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": f"Term '{term}' already exists"}), 400
    conn.close()

    return jsonify({"id": term_id, "term": term, "description": description}), 201


@content_bp.route("/api/glossary/<int:term_id>", methods=["PUT"])
def update_glossary_term(term_id):
    """
    Edits an existing glossary term. Requires admin authentication.

    Example request:
    PUT /api/glossary/62
    JSON body: {"term": "Instar", "description": "Updated description."}

    Example output:
    {
        "message": "Term updated"
    }
    """
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    term = ((request.json or {}).get("term") or "").strip()
    description = ((request.json or {}).get("description") or "").strip()
    if not term or not description:
        return jsonify({"error": "term and description are required"}), 400

    conn = db_helpers.get_connection()
    try:
        cursor = conn.execute(
            "UPDATE GlossaryTerms SET term = ?, description = ? WHERE id = ?",
            (term, description, term_id),
        )
        conn.commit()
        updated = cursor.rowcount
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": f"Term '{term}' already exists"}), 400
    conn.close()

    if not updated:
        return jsonify({"error": "Term not found"}), 404
    return jsonify({"message": "Term updated"}), 200


@content_bp.route("/api/glossary/<int:term_id>", methods=["DELETE"])
def delete_glossary_term(term_id):
    """
    Deletes a glossary term. Requires admin authentication.

    Example request:
    DELETE /api/glossary/62

    Example output:
    {
        "message": "Term deleted"
    }
    """
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    conn = db_helpers.get_connection()
    cursor = conn.execute("DELETE FROM GlossaryTerms WHERE id = ?", (term_id,))
    conn.commit()
    deleted = cursor.rowcount
    conn.close()

    if not deleted:
        return jsonify({"error": "Term not found"}), 404
    return jsonify({"message": "Term deleted"}), 200
