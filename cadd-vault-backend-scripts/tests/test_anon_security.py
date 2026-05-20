"""Security regression tests: every mutation RPC must reject anonymous calls.

Exercises the live Supabase project using ONLY the anon key. Asserts that
every SECURITY DEFINER mutation function returns HTTP 4xx with permission
denied (Postgres SQLSTATE 42501) -- either because EXECUTE was revoked from
anon (PostgREST 401/403) or because the function body raised it explicitly.

Skips automatically if VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are unset.
Mark with @pytest.mark.integration so it doesn't run in default unit suites.

Run with:
    pytest tests/test_anon_security.py -m integration -v
"""
import json
import os
import urllib.error
import urllib.request
import uuid

import pytest
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "").rstrip("/")
ANON_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not SUPABASE_URL or not ANON_KEY,
        reason="VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set",
    ),
]


def _rpc(name: str, body: dict) -> tuple[int, str]:
    """POST to /rest/v1/rpc/<name> with the anon key. Returns (status, body)."""
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/{name}",
        method="POST",
        data=json.dumps(body).encode(),
        headers={
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def _assert_denied(status: int, body: str, fn_name: str) -> None:
    """A call is 'denied' if PostgREST returned 401/403, OR the response body
    contains 'permission denied' / SQLSTATE 42501. Either path is a pass."""
    denied_by_status = status in (401, 403)
    denied_by_body = (
        "permission denied" in body.lower()
        or '"42501"' in body
        or "'42501'" in body
    )
    assert denied_by_status or denied_by_body, (
        f"{fn_name}: anon was NOT denied. status={status}, body={body[:300]}"
    )


FAKE_UUID = str(uuid.uuid4())


class TestAnonMutationRPCsAreRejected:
    """One test per mutation RPC. Each asserts anon is denied."""

    def test_upsert_rating_denied(self):
        status, body = _rpc("upsert_rating", {"package_uuid": FAKE_UUID, "new_rating": 5})
        _assert_denied(status, body, "upsert_rating")

    def test_delete_user_rating_denied(self):
        status, body = _rpc("delete_user_rating", {"package_uuid": FAKE_UUID})
        _assert_denied(status, body, "delete_user_rating")

    def test_update_package_tags_denied(self):
        status, body = _rpc(
            "update_package_tags",
            {"package_uuid": FAKE_UUID, "new_tags": ["x"]},
        )
        _assert_denied(status, body, "update_package_tags")

    def test_update_suggestion_tags_denied(self):
        status, body = _rpc(
            "update_suggestion_tags",
            {"suggestion_uuid": FAKE_UUID, "new_tags": ["x"]},
        )
        _assert_denied(status, body, "update_suggestion_tags")

    def test_update_package_folder_category_denied(self):
        status, body = _rpc(
            "update_package_folder_category",
            {"package_uuid": FAKE_UUID, "folder_name": "F", "category_name": "C"},
        )
        _assert_denied(status, body, "update_package_folder_category")

    def test_update_suggestion_folder_category_denied(self):
        status, body = _rpc(
            "update_suggestion_folder_category",
            {"suggestion_uuid": FAKE_UUID, "folder_name": "F", "category_name": "C"},
        )
        _assert_denied(status, body, "update_suggestion_folder_category")

    def test_ensure_folder_category_exists_denied(self):
        status, body = _rpc(
            "ensure_folder_category_exists",
            {"folder_name": "F", "category_name": "C"},
        )
        _assert_denied(status, body, "ensure_folder_category_exists")

    def test_approve_suggestion_with_normalized_data_denied(self):
        status, body = _rpc(
            "approve_suggestion_with_normalized_data",
            {"p_suggestion_id": FAKE_UUID},
        )
        _assert_denied(status, body, "approve_suggestion_with_normalized_data")

    def test_cleanup_orphaned_tags_denied(self):
        status, body = _rpc("cleanup_orphaned_tags", {})
        _assert_denied(status, body, "cleanup_orphaned_tags")

    def test_get_suggestions_with_user_email_denied(self):
        """PII-exposing read: must not be reachable by anon."""
        status, body = _rpc(
            "get_suggestions_with_user_email", {"filter_status": "pending"}
        )
        _assert_denied(status, body, "get_suggestions_with_user_email")


class TestAnonReadRPCsStillWork:
    """Sanity checks: the three RPCs that ARE supposed to work for anon
    must still respond 200. If these fail, the migration over-revoked."""

    def test_get_package_rating_stats_works(self):
        status, body = _rpc("get_package_rating_stats", {"package_uuid": FAKE_UUID})
        assert status == 200, f"anon read broken: status={status} body={body[:200]}"

    def test_get_package_tags_works(self):
        status, body = _rpc("get_package_tags", {"package_uuid": FAKE_UUID})
        assert status == 200, f"anon read broken: status={status} body={body[:200]}"

    def test_is_current_user_admin_works(self):
        """Returns false for anon, but the call itself should succeed."""
        status, body = _rpc("is_current_user_admin", {})
        assert status == 200, f"anon read broken: status={status} body={body[:200]}"
        assert body.strip().lower() == "false"
