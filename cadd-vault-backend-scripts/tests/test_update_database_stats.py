"""Unit tests for the pure-logic surface of update_database.py:
`UpdateStats`, `_dict_to_entry`, and `build_package_filter_query`.
"""
import pytest
from unittest.mock import MagicMock

from update_database import (
    UpdateStats,
    build_package_filter_query,
)


# ---------------------------------------------------------------------------
# UpdateStats
# ---------------------------------------------------------------------------

class TestUpdateStats:
    def test_defaults(self):
        s = UpdateStats()
        assert s.total_packages == 0
        assert s.errors == []
        assert s.dry_run_changes == []

    def test_add_error_appends_entry_with_timestamp(self):
        s = UpdateStats()
        s.add_error("pkg-1", "boom", error_type="api")
        assert len(s.errors) == 1
        rec = s.errors[0]
        assert rec["package_id"] == "pkg-1"
        assert rec["error"] == "boom"
        assert rec["type"] == "api"
        assert "timestamp" in rec

    def test_add_error_default_type_is_general(self):
        s = UpdateStats()
        s.add_error("pkg-1", "x")
        assert s.errors[0]["type"] == "general"

    def test_add_dry_run_change(self):
        s = UpdateStats()
        s.add_dry_run_change("pkg-1", "PkgA", "github_stars", 10, 20)
        assert len(s.dry_run_changes) == 1
        c = s.dry_run_changes[0]
        assert c["package_name"] == "PkgA"
        assert c["field"] == "github_stars"
        assert c["old_value"] == 10
        assert c["new_value"] == 20
        assert "timestamp" in c


# ---------------------------------------------------------------------------
# DatabaseUpdater._dict_to_entry
# ---------------------------------------------------------------------------

class TestDictToEntry:
    def test_minimal_input(self, updater):
        entry = updater._dict_to_entry({"id": "x"})
        assert entry.id == "x"
        assert entry.package_name is None
        assert entry.tags == []

    def test_field_remappings(self, updater):
        # 'publication' → publication_url, 'ratings_sum' → ratingsum
        entry = updater._dict_to_entry({
            "id": "x",
            "publication": "https://doi.org/abc",
            "ratings_sum": 42,
        })
        assert entry.publication_url == "https://doi.org/abc"
        assert entry.ratingsum == 42

    def test_tags_as_json_string(self, updater):
        entry = updater._dict_to_entry({"id": "x", "tags": '["ml", "docking"]'})
        assert entry.tags == ["ml", "docking"]

    def test_tags_as_invalid_json_defaults_to_empty(self, updater):
        entry = updater._dict_to_entry({"id": "x", "tags": "not-json"})
        assert entry.tags == []

    def test_tags_as_list_passthrough(self, updater):
        entry = updater._dict_to_entry({"id": "x", "tags": ["a", "b"]})
        assert entry.tags == ["a", "b"]


# ---------------------------------------------------------------------------
# build_package_filter_query
# ---------------------------------------------------------------------------

class TestBuildPackageFilterQuery:
    @pytest.fixture
    def query(self):
        """Build a chainable mock query like supabase's PostgrestFilterBuilder."""
        q = MagicMock(name="query")
        for method in ("limit", "in_", "or_", "like"):
            setattr(q, method, MagicMock(return_value=q))
        q.not_ = MagicMock(name="not_ns")
        q.not_.is_ = MagicMock(return_value=q)
        return q

    def test_limit(self, query):
        build_package_filter_query(query, {"limit": 25})
        query.limit.assert_called_once_with(25)

    def test_ids_uses_in_clause(self, query):
        build_package_filter_query(query, {"ids": ["a", "b", "c"]})
        query.in_.assert_called_once_with("id", ["a", "b", "c"])

    def test_updated_before_uses_or_with_null_branch(self, query):
        build_package_filter_query(query, {"updated_before": "2026-01-01T00:00:00"})
        query.or_.assert_called_once()
        args, _ = query.or_.call_args
        joined = " ".join(args)
        assert "last_updated.lt.2026-01-01T00:00:00" in joined
        assert "last_updated.is.null" in joined

    def test_github_only_filters_repo_link(self, query):
        build_package_filter_query(query, {"github_only": True})
        query.not_.is_.assert_called_once_with("repo_link", "null")
        query.like.assert_called_once_with("repo_link", "%github.com%")

    def test_publications_only_filters_publication(self, query):
        build_package_filter_query(query, {"publications_only": True})
        query.not_.is_.assert_called_once_with("publication", "null")

    def test_no_filter_returns_query_unchanged(self, query):
        result = build_package_filter_query(query, {})
        assert result is query
        query.limit.assert_not_called()
        query.in_.assert_not_called()
        query.or_.assert_not_called()

    def test_multiple_filters_combine(self, query):
        build_package_filter_query(query, {
            "limit": 10,
            "github_only": True,
            "publications_only": True,
        })
        query.limit.assert_called_once_with(10)
        # `not_.is_` is called twice: once for repo_link, once for publication
        assert query.not_.is_.call_count == 2


# ---------------------------------------------------------------------------
# DatabaseUpdater init smoke
# ---------------------------------------------------------------------------

class TestDatabaseUpdaterInit:
    def test_live_mode_default(self, updater):
        assert updater.dry_run is False
        assert updater.stats.total_packages == 0
        assert updater.publication_service is not None
        assert updater.repository_service is not None
        assert updater.batch_size == 50

    def test_dry_run_mode(self, dry_updater):
        assert dry_updater.dry_run is True
