"""
home_datasets.py

API routes for choosing which datasets can be opened from the site home
page. Disabled datasets still show a (faded, unclickable) tile there.

Like display_list.py, the setting is stored as a flat JSON file
(home_datasets.json) rather than in the SQL schema. It always lives in the
"home" dataset's folder, regardless of any `?dataset=` param, so it's synced
to production along with the rest of the home content by
`upload_data.py home`. Mutations require a valid admin token (see auth.py),
sent as `Authorization: Bearer <token>`.

Routes include:
    - GET /api/home-datasets/: Retrieve the list of disabled dataset IDs
    - PUT /api/home-datasets/: Replace the list of disabled dataset IDs (admin only)
"""

import json
import os

from flask import Blueprint, request, jsonify
from app import db_helpers
from app.routes.auth import is_valid_token

home_datasets_bp = Blueprint("home_datasets", __name__)

HOME_DATASETS_PATH = os.path.join(db_helpers.DATA_FOLDER, "home", "home_datasets.json")


def _require_admin():
    """Returns a (response, status) error tuple if the request lacks a valid
    admin token, otherwise None."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[len("Bearer "):] if auth_header.startswith("Bearer ") else None
    if not is_valid_token(token):
        return jsonify({"error": "Admin authentication required"}), 401
    return None


def read_disabled():
    """Reads the list of dataset IDs disabled on the home page. Every dataset
    is enabled if the file doesn't exist yet."""
    if not os.path.exists(HOME_DATASETS_PATH):
        return []
    with open(HOME_DATASETS_PATH, "r") as f:
        data = json.load(f)
    return data.get("disabled", [])


@home_datasets_bp.route("/api/home-datasets/", methods=["GET"])
def get_home_datasets():
    """
    Retrieves the IDs of datasets disabled on the home page.

    Example request:
    GET /api/home-datasets/

    Example output:
    {
        "disabled": ["bats"]
    }
    """
    return jsonify({"disabled": read_disabled()}), 200


@home_datasets_bp.route("/api/home-datasets/", methods=["PUT"])
def update_home_datasets():
    """
    Replaces the IDs of datasets disabled on the home page. Requires admin
    authentication.

    Example request:
    PUT /api/home-datasets/
    JSON body: {"disabled": ["bats", "lichens"]}

    Example output:
    {
        "message": "Home datasets updated"
    }
    """
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    disabled = (request.json or {}).get("disabled")
    if not isinstance(disabled, list) or not all(isinstance(d, str) for d in disabled):
        return jsonify({"error": "disabled must be a list of strings"}), 400

    os.makedirs(os.path.dirname(HOME_DATASETS_PATH), exist_ok=True)
    with open(HOME_DATASETS_PATH, "w") as f:
        json.dump({"disabled": disabled}, f)

    return jsonify({"message": "Home datasets updated"}), 200
