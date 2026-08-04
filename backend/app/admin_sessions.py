"""
admin_sessions.py

Persistent storage for admin auth tokens. Production runs `gunicorn -w 2`
(see Dockerfile), so each worker process has its own separate memory — an
in-memory token dict is only visible to whichever worker happened to handle
the login, and any later request has roughly a coin-flip chance of landing
on the other worker, which has never seen that token, and gets a spurious
401. Storing tokens in a small shared SQLite database instead makes them
visible to every worker regardless of which one handles a given request.

Auth is global, not tied to any butterflies/dragonflies/wildflowers dataset,
so this lives in its own tiny database rather than alongside per-dataset data.
"""

import os
import sqlite3
import time

THIS_FOLDER = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(THIS_FOLDER)
DB_PATH = os.path.join(PROJECT_ROOT, "data", "admin_sessions.db")

TOKEN_TTL = 86400  # 24 hours


def get_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS AdminTokens (
            token TEXT PRIMARY KEY,
            expires_at REAL NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def store_token(token: str):
    conn = get_connection()
    conn.execute(
        "INSERT INTO AdminTokens (token, expires_at) VALUES (?, ?)",
        (token, time.time() + TOKEN_TTL),
    )
    conn.commit()
    conn.close()


def is_valid_token(token: str | None) -> bool:
    """Check whether a token is present and unexpired, deleting it if it has
    expired. Used by other route modules to gate admin-only mutations."""
    if not token:
        return False
    conn = get_connection()
    row = conn.execute(
        "SELECT expires_at FROM AdminTokens WHERE token = ?", (token,)
    ).fetchone()
    if row is None:
        conn.close()
        return False
    if time.time() >= row["expires_at"]:
        conn.execute("DELETE FROM AdminTokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        return False
    conn.close()
    return True


def delete_token(token: str | None):
    if not token:
        return
    conn = get_connection()
    conn.execute("DELETE FROM AdminTokens WHERE token = ?", (token,))
    conn.commit()
    conn.close()


def purge_expired():
    """Opportunistically clear out old tokens so the table doesn't grow
    unbounded. Called on each login attempt rather than on a schedule."""
    conn = get_connection()
    conn.execute("DELETE FROM AdminTokens WHERE expires_at <= ?", (time.time(),))
    conn.commit()
    conn.close()
