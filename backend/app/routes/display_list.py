"""
display_list.py

API routes for choosing which wildlife species appear on a dataset's main
grid ("common") versus its "More" page ("less common"), plus any named
"More" lists a dataset keeps (e.g. wildflowers' Spring/Alpine/Noxious/
Interesting pages, where a species may sit on several). Scoped per-dataset
via the `?dataset=` query param (see db_helpers.get_connection), like
wildlife.py and content.py.

Unlike the Wildlife/Fields tables, the list itself is stored as a flat JSON
file (display_list.json) alongside that dataset's database rather than in
the SQL schema, since only a subset of datasets use this feature. Mutations
require a valid admin token (see auth.py), sent as `Authorization: Bearer
<token>`.

Routes include:
    - GET /api/display-list/: Retrieve the dataset's "common" wildlife IDs and named lists
    - PUT /api/display-list/: Replace the "common" wildlife IDs and/or named lists (admin only)
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


def _read_display_list(path=None):
    """Reads the active dataset's whole display list file, or None if it has
    none yet (the feature is opt-in per dataset)."""
    path = path or _display_list_path()
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)


def _write_display_list(common_ids, lists, path=None):
    data = {"common_ids": common_ids}
    if lists:
        data["lists"] = lists
    with open(path or _display_list_path(), "w") as f:
        json.dump(data, f)


def remove_wildlife_id(wildlife_id):
    """Strips a deleted wildlife ID out of the active dataset's display list
    and named lists, if they exist. No-op for datasets without the feature."""
    path = _display_list_path()
    data = _read_display_list(path)
    if data is None:
        return
    common_ids = [wid for wid in data.get("common_ids", []) if wid != wildlife_id]
    lists = {key: [wid for wid in ids if wid != wildlife_id] for key, ids in data.get("lists", {}).items()}
    _write_display_list(common_ids, lists, path)


def _is_id_list(value):
    return isinstance(value, list) and all(isinstance(i, int) for i in value)


@display_list_bp.route("/api/display-list/", methods=["GET"])
def get_display_list():
    """
    Retrieves the dataset's list of "common" wildlife IDs (shown on the main
    grid). Species not in this list are considered less common and are shown
    on the "More" page instead. A dataset with no display list configured yet
    returns null, meaning every species counts as common.

    Example request:
    GET /api/display-list/?dataset=raptors

    Example output:
    {
        "common_ids": [1, 2, 3, 4, 5, 6, 7, 8],
        "lists": {"spring": [2, 9], "alpine": [4]}
    }
    """
    data = _read_display_list()
    if data is None:
        return jsonify({"common_ids": None, "lists": {}}), 200
    return jsonify({"common_ids": data.get("common_ids", []), "lists": data.get("lists", {})}), 200


@display_list_bp.route("/api/display-list/", methods=["PUT"])
def update_display_list():
    """
    Replaces the dataset's list of "common" wildlife IDs, and its named lists
    if "lists" is given (otherwise the existing named lists are kept).
    Requires admin authentication.

    Example request:
    PUT /api/display-list/?dataset=wildflowers
    JSON body: {"common_ids": [1, 2, 3], "lists": {"spring": [2, 9]}}

    Example output:
    {
        "message": "Display list updated"
    }
    """
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    body = request.json or {}
    common_ids = body.get("common_ids")
    if not _is_id_list(common_ids):
        return jsonify({"error": "common_ids must be a list of integers"}), 400

    lists = body.get("lists")
    if lists is None:
        lists = (_read_display_list() or {}).get("lists", {})
    elif not isinstance(lists, dict) or not all(isinstance(k, str) and _is_id_list(v) for k, v in lists.items()):
        return jsonify({"error": "lists must map list names to lists of integers"}), 400

    _write_display_list(common_ids, lists)

    return jsonify({"message": "Display list updated"}), 200
