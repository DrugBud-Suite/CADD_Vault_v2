"""Unit tests for models.py — pure dataclass logic, no external dependencies."""
from datetime import datetime, timedelta, timezone

import pytest

from models import (
    Config,
    Entry,
    ProcessingResult,
    Publication,
    Repository,
    UpdateBatch,
)


class TestConfig:
    def test_defaults(self):
        c = Config(email="x@example.com")
        assert c.email == "x@example.com"
        assert c.github_token is None
        assert c.timeout == 30
        assert c.max_retries == 3
        assert c.rate_limit_delay == 1.0
        assert c.batch_size == 50

    def test_overrides(self):
        c = Config(email="a@b", github_token="t", timeout=5, max_retries=10,
                   rate_limit_delay=0.1, batch_size=1)
        assert c.github_token == "t"
        assert c.timeout == 5
        assert c.batch_size == 1


class TestEntryFromDict:
    def test_minimal(self):
        e = Entry.from_dict({"id": "abc"})
        assert e.id == "abc"
        assert e.package_name is None
        assert e.tags == []  # defaulted from None

    def test_tags_as_json_string(self):
        e = Entry.from_dict({"id": "x", "tags": '["ml", "docking"]'})
        assert e.tags == ["ml", "docking"]

    def test_tags_as_invalid_json_string(self):
        e = Entry.from_dict({"id": "x", "tags": "not-json"})
        assert e.tags == []

    def test_tags_as_list(self):
        e = Entry.from_dict({"id": "x", "tags": ["a", "b"]})
        assert e.tags == ["a", "b"]

    def test_tags_missing(self):
        e = Entry.from_dict({"id": "x"})
        assert e.tags == []

    def test_publication_field_remapping(self):
        # Database column 'publication' maps to model field 'publication_url'.
        e = Entry.from_dict({"id": "x", "publication": "https://doi.org/abc"})
        assert e.publication_url == "https://doi.org/abc"

    def test_ratingsum_field_remapping(self):
        # Database column 'ratings_sum' maps to model field 'ratingsum'.
        e = Entry.from_dict({"id": "x", "ratings_sum": 42})
        assert e.ratingsum == 42

    def test_last_commit_datetime_serialized_to_iso(self):
        dt = datetime(2026, 5, 18, 9, 30, tzinfo=timezone.utc)
        e = Entry.from_dict({"id": "x", "last_commit": dt})
        assert e.last_commit == dt.isoformat()

    def test_last_commit_string_passthrough(self):
        e = Entry.from_dict({"id": "x", "last_commit": "2026-05-18T09:30:00Z"})
        assert e.last_commit == "2026-05-18T09:30:00Z"

    def test_unknown_keys_are_ignored(self):
        # `from_dict` only pulls fields declared on the dataclass.
        e = Entry.from_dict({"id": "x", "nonexistent_field": "ignored"})
        assert not hasattr(e, "nonexistent_field")


class TestEntryToDict:
    def test_excludes_none_fields(self):
        e = Entry(id="x", package_name="P")
        d = e.to_dict()
        assert d == {"id": "x", "package_name": "P", "tags": []} or "package_name" in d
        # Specifically: no `None` fields should leak through
        for k, v in d.items():
            assert v is not None or k == "tags"

    def test_publication_url_maps_back_to_publication(self):
        e = Entry(id="x", publication_url="https://doi.org/abc")
        d = e.to_dict()
        assert "publication" in d
        assert d["publication"] == "https://doi.org/abc"
        assert "publication_url" not in d

    def test_ratingsum_maps_back_to_ratings_sum(self):
        e = Entry(id="x", ratingsum=10)
        d = e.to_dict()
        assert d["ratings_sum"] == 10
        assert "ratingsum" not in d

    def test_tags_serialized_as_list(self):
        e = Entry(id="x", tags=["a", "b"])
        d = e.to_dict()
        assert d["tags"] == ["a", "b"]

    def test_tags_non_list_coerced_to_empty(self):
        e = Entry(id="x")
        e.tags = "broken"  # type: ignore[assignment]
        d = e.to_dict()
        assert d["tags"] == []

    def test_from_dict_then_to_dict_roundtrip(self):
        original = {
            "id": "x",
            "package_name": "MyPkg",
            "repo_link": "https://github.com/foo/bar",
            "publication": "https://doi.org/abc",
            "tags": ["ml", "docking"],
            "github_stars": 100,
            "ratings_sum": 42,
        }
        e = Entry.from_dict(original)
        d = e.to_dict()
        assert d["package_name"] == "MyPkg"
        assert d["publication"] == "https://doi.org/abc"
        assert d["ratings_sum"] == 42
        assert d["tags"] == ["ml", "docking"]


class TestEntryHelpers:
    @pytest.mark.parametrize("url,expected", [
        ("https://github.com/foo/bar", "foo/bar"),
        ("http://github.com/foo/bar/", "foo/bar"),
        ("https://github.com/foo/bar.git", "foo/bar"),
        ("https://github.com/foo/bar/tree/main", "foo/bar"),
        ("https://gitlab.com/foo/bar", None),
        ("", None),
        (None, None),
        ("https://github.com/justone", None),  # no /repo
    ])
    def test_get_github_repo_path(self, url, expected):
        e = Entry(id="x", repo_link=url)
        assert e.get_github_repo_path() == expected

    def test_has_github_data_true(self):
        e = Entry(id="x", github_stars=5)
        assert e.has_github_data() is True

    def test_has_github_data_false(self):
        e = Entry(id="x")
        assert e.has_github_data() is False

    def test_has_publication_data_true(self):
        e = Entry(id="x", citations=10)
        assert e.has_publication_data() is True

    def test_has_publication_data_false(self):
        e = Entry(id="x")
        assert e.has_publication_data() is False

    def test_needs_github_update_true(self):
        e = Entry(id="x", repo_link="https://github.com/foo/bar")
        assert e.needs_github_update() is True

    def test_needs_github_update_false_no_repo(self):
        e = Entry(id="x")
        assert not e.needs_github_update()

    def test_needs_github_update_false_already_has_data(self):
        e = Entry(id="x", repo_link="https://github.com/foo/bar", github_stars=5)
        assert not e.needs_github_update()

    def test_needs_github_update_false_non_github_repo(self):
        e = Entry(id="x", repo_link="https://gitlab.com/foo/bar")
        assert not e.needs_github_update()

    def test_needs_publication_update_true(self):
        e = Entry(id="x", publication_url="https://doi.org/abc")
        assert e.needs_publication_update() is True

    def test_needs_publication_update_false_no_url(self):
        e = Entry(id="x")
        assert not e.needs_publication_update()

    def test_needs_publication_update_false_has_data(self):
        e = Entry(id="x", publication_url="https://doi.org/abc", citations=10)
        assert not e.needs_publication_update()


class TestProcessingResult:
    def test_defaults(self):
        r = ProcessingResult()
        assert r.total_entries == 0
        assert r.successful_entries == 0
        assert r.failed_entries == 0
        assert r.errors == []

    def test_add_error_increments_failed_and_appends(self):
        r = ProcessingResult()
        r.add_error("pkg-1", "boom", error_type="api")
        assert r.failed_entries == 1
        assert len(r.errors) == 1
        assert r.errors[0]["entry"] == "pkg-1"
        assert r.errors[0]["error"] == "boom"
        assert r.errors[0]["type"] == "api"
        assert "timestamp" in r.errors[0]

    @pytest.mark.parametrize("update_type,counter_attr", [
        ("github", "github_updates"),
        ("publication", "publication_updates"),
        ("citation", "citation_updates"),
        ("preprint", "preprint_conversions"),
    ])
    def test_add_success_increments_typed_counter(self, update_type, counter_attr):
        r = ProcessingResult()
        r.add_success(update_type)
        assert r.successful_entries == 1
        assert getattr(r, counter_attr) == 1

    def test_add_success_unknown_type_only_bumps_successful(self):
        r = ProcessingResult()
        r.add_success("mystery")
        assert r.successful_entries == 1
        assert r.github_updates == 0

    def test_add_success_no_type(self):
        r = ProcessingResult()
        r.add_success()
        assert r.successful_entries == 1

    def test_get_duration_none_until_set(self):
        r = ProcessingResult()
        assert r.get_duration() is None

    def test_get_duration_seconds(self):
        r = ProcessingResult()
        r.start_time = datetime(2026, 1, 1, 0, 0, 0)
        r.end_time = r.start_time + timedelta(seconds=12, milliseconds=500)
        assert r.get_duration() == pytest.approx(12.5, rel=1e-3)

    def test_success_rate_zero_when_empty(self):
        r = ProcessingResult()
        assert r.get_success_rate() == 0.0

    def test_success_rate_percentage(self):
        r = ProcessingResult(total_entries=4, successful_entries=3)
        assert r.get_success_rate() == 75.0

    def test_summary_contains_key_fields(self):
        r = ProcessingResult(total_entries=10, successful_entries=8,
                             failed_entries=2, github_updates=5,
                             publication_updates=3)
        s = r.summary()
        assert "Total entries: 10" in s
        assert "Successful: 8" in s
        assert "Failed: 2" in s
        assert "GitHub updates: 5" in s
        assert "Publication updates: 3" in s


class TestRepository:
    @pytest.mark.parametrize("url,expected_owner,expected_repo", [
        ("https://github.com/foo/bar", "foo", "bar"),
        ("http://github.com/foo/bar/", "foo", "bar"),
        ("https://github.com/foo/bar.git", "foo", "bar"),
    ])
    def test_from_github_url_parses(self, url, expected_owner, expected_repo):
        r = Repository.from_github_url(url)
        assert r is not None
        assert r.owner == expected_owner
        assert r.name == expected_repo
        assert r.is_github is True
        assert r.url == url

    @pytest.mark.parametrize("url", [
        None,
        "",
        "https://gitlab.com/foo/bar",
        "https://github.com/justone",
    ])
    def test_from_github_url_rejects_non_github(self, url):
        assert Repository.from_github_url(url) is None


class TestPublication:
    def test_defaults(self):
        p = Publication(url="https://doi.org/abc")
        assert p.url == "https://doi.org/abc"
        assert p.citations is None
        assert p.is_preprint is False
        assert p.preprint_server is None


class TestUpdateBatch:
    def test_starts_empty(self):
        b = UpdateBatch(package_id="x")
        assert not b.has_updates()
        assert b.updates == {}
        assert b.metadata == {}
        assert "No updates" in b.get_update_summary()

    def test_add_update_records_value_and_metadata(self):
        b = UpdateBatch(package_id="x")
        b.add_update("github_stars", 42, source="github_api")
        assert b.has_updates()
        assert b.updates == {"github_stars": 42}
        assert b.metadata["github_stars"]["source"] == "github_api"
        assert "timestamp" in b.metadata["github_stars"]

    def test_update_summary_lists_keys(self):
        b = UpdateBatch(package_id="x")
        b.add_update("stars", 1)
        b.add_update("citations", 2)
        s = b.get_update_summary()
        assert "stars" in s
        assert "citations" in s
