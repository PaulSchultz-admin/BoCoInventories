"""
display_list.py

API routes for choosing which wildlife species appear on a dataset's main
grid ("common") versus its "More" page ("less common"). Scoped per-dataset
via the `?dataset=` query param (see db_helpers.get_connection), like
wildlife.py and content.py.

Unlike the Wildlife/Fields tables, the list itself is stored as a flat JSON
file (display_list.json) alongside that dataset's database rather than in
the SQL schema, since only a subset of datasets use this feature. Mutations
require a valid admin token (see auth.py), sent as `Authorization: Bearer
<token>`.

Routes include:
    - GET /api/display-list/: Retrieve the dataset's list of "common" wildlife IDs
    - PUT /api/display-list/: Replace the list of "common" wildlife IDs (admin only)
"""

import json
import os

from flask import Blueprint, request, jsonify
from app import db_helpers
from app.routes.auth import is_valid_token

display_list_bp = Blueprint("display_list", __name__)

DISPLAY_LIST_FILENAME = "display_list.json"


def _require_admin():
    """Returns a (response, status) error tuple if the request lacks a valid
    admin token, otherwise None."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[len("Bearer "):] if auth_header.startswith("Bearer ") else None
    if not is_valid_token(token):
        return jsonify({"error": "Admin authentication required"}), 401
    return None


def _display_list_path():
    return os.path.join(db_helpers.get_active_data_folder(), DISPLAY_LIST_FILENAME)


def read_common_ids(path=None):
    """Reads the active dataset's list of "common" wildlife IDs. Returns None
    if it has no display list yet (the feature is opt-in per dataset)."""
    path = path or _display_list_path()
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        data = json.load(f)
    return data.get("common_ids", [])


def remove_wildlife_id(wildlife_id):
    """Strips a deleted wildlife ID out of the active dataset's display list,
    if one exists. No-op for datasets without the feature."""
    path = _display_list_path()
    common_ids = read_common_ids(path)
    if common_ids is None or wildlife_id not in common_ids:
        return
    common_ids = [wid for wid in common_ids if wid != wildlife_id]
    with open(path, "w") as f:
        json.dump({"common_ids": common_ids}, f)


@display_list_bp.route("/api/display-list/", methods=["GET"])
def get_display_list():
    """
    Retrieves the dataset's list of "common" wildlife IDs (shown on the main
    grid). Species not in this list are considered less common and are shown
    on the "More" page instead. A dataset with no display list configured yet
    returns an empty list.

    Example request:
    GET /api/display-list/?dataset=raptors

    Example output:
    {
        "common_ids": [1, 2, 3, 4, 5, 6, 7, 8]
    }
    """
    common_ids = read_common_ids()
    return jsonify({"common_ids": common_ids or []}), 200


@display_list_bp.route("/api/display-list/", methods=["PUT"])
def update_display_list():
    """
    Replaces the dataset's list of "common" wildlife IDs. Requires admin
    authentication.

    Example request:
    PUT /api/display-list/?dataset=raptors
    JSON body: {"common_ids": [1, 2, 3]}

    Example output:
    {
        "message": "Display list updated"
    }
    """
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    common_ids = (request.json or {}).get("common_ids")
    if not isinstance(common_ids, list) or not all(isinstance(i, int) for i in common_ids):
        return jsonify({"error": "common_ids must be a list of integers"}), 400

    with open(_display_list_path(), "w") as f:
        json.dump({"common_ids": common_ids}, f)

    return jsonify({"message": "Display list updated"}), 200
