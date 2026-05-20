"""Tests for the processing pipeline:

* `_process_repository_data` — GitHub-only paths, no-op for non-github URLs,
  preserves existing fields, parses owner/repo when missing.
* `_process_publication_data` — preprint upgrade, citation fetch, journal +
  impact-factor fetch, conditional on entry already having values.
* `_process_single_package` — dispatches to the two above and either applies
  updates or records dry-run changes.
* `_process_package_batch` / `_process_packages_in_batches` — gather +
  exception handling + batching.
* `_apply_updates` — retry loop with exponential backoff.
* `update_database` — top-level orchestrator (delegation only).
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from models import Entry, Repository
from services import PreprintResult


# ---------------------------------------------------------------------------
# _process_repository_data
# ---------------------------------------------------------------------------

class TestProcessRepositoryData:
    @pytest.mark.asyncio
    async def test_no_op_for_empty_repo_link(self, updater):
        entry = Entry(id="x")
        updates = await updater._process_repository_data(entry)
        assert updates == {}

    @pytest.mark.asyncio
    async def test_no_op_for_non_github_url(self, updater):
        entry = Entry(id="x", repo_link="https://gitlab.com/foo/bar")
        updates = await updater._process_repository_data(entry)
        assert updates == {}

    @pytest.mark.asyncio
    async def test_populates_stars_language_license_when_missing(self, updater):
        entry = Entry(id="x", repo_link="https://github.com/foo/bar")
        updater.repository_service.get_repository_data = AsyncMock(return_value=Repository(
            url="https://github.com/foo/bar",
            stars=1234, primary_language="Python", license="MIT",
            last_commit="2026-04-01T12:00:00Z", last_commit_ago="3 months ago",
        ))

        updates = await updater._process_repository_data(entry)

        assert updates["github_stars"] == 1234
        assert updates["primary_language"] == "Python"
        assert updates["license"] == "MIT"
        assert updates["last_commit"] == "2026-04-01T12:00:00Z"
        assert updates["last_commit_ago"] == "3 months ago"
        assert updates["github_owner"] == "foo"
        assert updates["github_repo"] == "bar"
        assert updater.stats.github_data_updates == 1

    @pytest.mark.asyncio
    async def test_preserves_existing_license_and_language(self, updater):
        entry = Entry(
            id="x", repo_link="https://github.com/foo/bar",
            license="GPL", primary_language="Rust",
            github_owner="foo", github_repo="bar",
        )
        updater.repository_service.get_repository_data = AsyncMock(return_value=Repository(
            url="https://github.com/foo/bar",
            stars=99, primary_language="Python", license="MIT",
        ))

        updates = await updater._process_repository_data(entry)

        assert updates["github_stars"] == 99  # always updated
        assert "license" not in updates       # not overwritten
        assert "primary_language" not in updates
        assert "github_owner" not in updates
        assert "github_repo" not in updates

    @pytest.mark.asyncio
    async def test_returns_empty_when_service_returns_none(self, updater):
        entry = Entry(id="x", repo_link="https://github.com/foo/bar")
        updater.repository_service.get_repository_data = AsyncMock(return_value=None)
        updates = await updater._process_repository_data(entry)
        assert updates == {}

    @pytest.mark.asyncio
    async def test_service_exception_is_logged_and_returns_empty(self, updater):
        entry = Entry(id="x", repo_link="https://github.com/foo/bar")
        updater.repository_service.get_repository_data = AsyncMock(side_effect=RuntimeError("api down"))
        updates = await updater._process_repository_data(entry)
        assert updates == {}
        assert len(updater.stats.errors) == 1
        assert updater.stats.errors[0]["type"] == "repository"


# ---------------------------------------------------------------------------
# _process_publication_data
# ---------------------------------------------------------------------------

class TestProcessPublicationData:
    @pytest.mark.asyncio
    async def test_no_op_when_no_publication_url(self, updater):
        entry = Entry(id="x")
        updates = await updater._process_publication_data(entry)
        assert updates == {}

    @pytest.mark.asyncio
    async def test_no_op_when_normalize_returns_none(self, updater):
        entry = Entry(id="x", publication_url="garbage")
        updater.publication_service.normalize_doi = MagicMock(return_value=None)
        updates = await updater._process_publication_data(entry)
        assert updates == {}

    @pytest.mark.asyncio
    async def test_regular_publication_fetches_citations_journal_jif(self, updater):
        entry = Entry(id="x", publication_url="https://doi.org/10.1/abc")
        pub = updater.publication_service
        pub.normalize_doi = MagicMock(return_value="https://doi.org/10.1/abc")
        pub.is_preprint = MagicMock(return_value=False)
        pub.get_citations = AsyncMock(return_value=42)
        pub.get_journal_info = AsyncMock(return_value={"journal": "Nature", "issn": "x"})
        pub.get_impact_factor = AsyncMock(return_value=49.962)

        updates = await updater._process_publication_data(entry)

        assert updates["citations"] == 42
        assert updates["journal"] == "Nature"
        assert updates["jif"] == 49.962
        assert updater.stats.citation_updates == 1

    @pytest.mark.asyncio
    async def test_existing_journal_not_overwritten(self, updater):
        entry = Entry(id="x", publication_url="https://doi.org/10.1/abc",
                      journal="Nature", jif=49.962)
        pub = updater.publication_service
        pub.normalize_doi = MagicMock(return_value="https://doi.org/10.1/abc")
        pub.is_preprint = MagicMock(return_value=False)
        pub.get_citations = AsyncMock(return_value=100)
        pub.get_journal_info = AsyncMock()  # shouldn't be called

        updates = await updater._process_publication_data(entry)

        assert updates["citations"] == 100
        assert "journal" not in updates
        assert "jif" not in updates
        pub.get_journal_info.assert_not_called()

    @pytest.mark.asyncio
    async def test_preprint_with_published_version_upgrades_url(self, updater):
        entry = Entry(id="x", publication_url="https://arxiv.org/abs/1706.03762")
        pub = updater.publication_service
        pub.normalize_doi = MagicMock(return_value="https://arxiv.org/abs/1706.03762")
        # is_preprint: True for original arxiv URL, False for the published DOI
        pub.is_preprint = MagicMock(side_effect=[True, False])
        pub.check_publication_status = AsyncMock(return_value=PreprintResult(
            original_url="https://arxiv.org/abs/1706.03762",
            published_doi="10.1234/published",
            published_url="https://doi.org/10.1234/published",
            publication_status="published",
        ))
        pub.get_citations = AsyncMock(return_value=500)
        pub.get_journal_info = AsyncMock(return_value={"journal": "NeurIPS"})
        pub.get_impact_factor = AsyncMock(return_value=None)

        updates = await updater._process_publication_data(entry)

        assert updates["publication"] == "https://doi.org/10.1234/published"
        assert updates["citations"] == 500
        assert updates["journal"] == "NeurIPS"
        assert "jif" not in updates  # impact_factor returned None

    @pytest.mark.asyncio
    async def test_preprint_with_no_published_version_skips_citations(self, updater):
        entry = Entry(id="x", publication_url="https://arxiv.org/abs/1706.03762")
        pub = updater.publication_service
        pub.normalize_doi = MagicMock(return_value="https://arxiv.org/abs/1706.03762")
        pub.is_preprint = MagicMock(return_value=True)
        pub.check_publication_status = AsyncMock(return_value=PreprintResult(
            original_url="https://arxiv.org/abs/1706.03762",
            publication_status="unpublished",
        ))
        pub.get_citations = AsyncMock()  # shouldn't be called — lookup_url still preprint

        updates = await updater._process_publication_data(entry)

        assert "citations" not in updates
        pub.get_citations.assert_not_called()

    @pytest.mark.asyncio
    async def test_citations_exception_does_not_fail_whole_update(self, updater):
        entry = Entry(id="x", publication_url="https://doi.org/10.1/abc")
        pub = updater.publication_service
        pub.normalize_doi = MagicMock(return_value="https://doi.org/10.1/abc")
        pub.is_preprint = MagicMock(return_value=False)
        pub.get_citations = AsyncMock(side_effect=RuntimeError("crossref down"))
        pub.get_journal_info = AsyncMock(return_value={"journal": "Nature"})
        pub.get_impact_factor = AsyncMock(return_value=49.0)

        updates = await updater._process_publication_data(entry)
        # Journal/JIF still flow through despite citation failure
        assert "citations" not in updates
        assert updates["journal"] == "Nature"
        assert updates["jif"] == 49.0


# ---------------------------------------------------------------------------
# _process_single_package
# ---------------------------------------------------------------------------

class TestProcessSinglePackage:
    @pytest.mark.asyncio
    async def test_live_mode_calls_apply_updates(self, updater, monkeypatch):
        monkeypatch.setattr(updater, "_process_repository_data",
                            AsyncMock(return_value={"github_stars": 5}))
        monkeypatch.setattr(updater, "_process_publication_data",
                            AsyncMock(return_value={"citations": 10}))
        applied = AsyncMock(return_value=True)
        monkeypatch.setattr(updater, "_apply_updates", applied)

        result = await updater._process_single_package(
            {"id": "pkg-1", "package_name": "P"}
        )

        assert result == {"github_stars": 5, "citations": 10}
        applied.assert_awaited_once_with("pkg-1", {"github_stars": 5, "citations": 10})
        assert updater.stats.updated_packages == 1
        assert updater.stats.processed_packages == 1

    @pytest.mark.asyncio
    async def test_dry_run_records_changes_does_not_apply(self, dry_updater, monkeypatch):
        monkeypatch.setattr(dry_updater, "_process_repository_data",
                            AsyncMock(return_value={"github_stars": 5}))
        monkeypatch.setattr(dry_updater, "_process_publication_data",
                            AsyncMock(return_value={"citations": 10}))
        applied = AsyncMock()
        monkeypatch.setattr(dry_updater, "_apply_updates", applied)

        await dry_updater._process_single_package(
            {"id": "pkg-1", "package_name": "P", "github_stars": 0, "citations": 0}
        )

        applied.assert_not_called()
        assert len(dry_updater.stats.dry_run_changes) == 2
        fields = {c["field"] for c in dry_updater.stats.dry_run_changes}
        assert fields == {"github_stars", "citations"}
        assert dry_updater.stats.updated_packages == 1

    @pytest.mark.asyncio
    async def test_no_updates_means_skipped(self, updater, monkeypatch):
        monkeypatch.setattr(updater, "_process_repository_data", AsyncMock(return_value={}))
        monkeypatch.setattr(updater, "_process_publication_data", AsyncMock(return_value={}))

        result = await updater._process_single_package({"id": "pkg-1"})

        assert result == {}
        assert updater.stats.skipped_packages == 1
        assert updater.stats.updated_packages == 0

    @pytest.mark.asyncio
    async def test_exception_recorded_and_returns_none(self, updater, monkeypatch):
        monkeypatch.setattr(updater, "_process_repository_data",
                            AsyncMock(side_effect=RuntimeError("boom")))

        result = await updater._process_single_package({"id": "pkg-1", "package_name": "P"})

        assert result is None
        assert updater.stats.failed_packages == 1
        assert any(e["type"] == "processing" for e in updater.stats.errors)


# ---------------------------------------------------------------------------
# _process_package_batch + _process_packages_in_batches
# ---------------------------------------------------------------------------

class TestProcessPackageBatch:
    @pytest.mark.asyncio
    async def test_individual_exception_tracked_as_failure(self, updater, monkeypatch):
        # First package raises, second succeeds.
        call_count = {"n": 0}

        async def fake_process(data):
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise RuntimeError("first one bombed")
            return {}

        monkeypatch.setattr(updater, "_process_single_package", fake_process)
        batch = [{"id": "pkg-1"}, {"id": "pkg-2"}]

        await updater._process_package_batch(batch)

        assert updater.stats.failed_packages == 1
        assert updater.stats.errors[0]["package_id"] == "pkg-1"


class TestProcessPackagesInBatches:
    @pytest.mark.asyncio
    async def test_splits_into_batches_of_batch_size(self, updater, monkeypatch):
        updater.batch_size = 3
        seen_batches = []

        async def fake_batch(batch):
            seen_batches.append([p["id"] for p in batch])

        monkeypatch.setattr(updater, "_process_package_batch", fake_batch)
        packages = [{"id": f"p{i}"} for i in range(7)]

        await updater._process_packages_in_batches(packages)

        assert seen_batches == [
            ["p0", "p1", "p2"],
            ["p3", "p4", "p5"],
            ["p6"],
        ]


# ---------------------------------------------------------------------------
# _apply_updates
# ---------------------------------------------------------------------------

class TestApplyUpdates:
    @pytest.mark.asyncio
    async def test_success_first_attempt(self, updater, mock_supabase):
        mock_supabase._chain.execute.return_value = MagicMock(data=[{"id": "pkg-1"}])
        ok = await updater._apply_updates("pkg-1", {"github_stars": 100})
        assert ok is True
        # last_updated timestamp added
        update_call_args = mock_supabase._chain.update.call_args.args[0]
        assert update_call_args["github_stars"] == 100
        assert "last_updated" in update_call_args

    @pytest.mark.asyncio
    async def test_success_after_retry(self, updater, mock_supabase):
        # Fail twice, succeed on third attempt.
        mock_supabase._chain.execute.side_effect = [
            RuntimeError("transient"),
            RuntimeError("transient again"),
            MagicMock(data=[{"id": "pkg-1"}]),
        ]
        ok = await updater._apply_updates("pkg-1", {"github_stars": 100})
        assert ok is True
        assert mock_supabase._chain.execute.call_count == 3

    @pytest.mark.asyncio
    async def test_all_retries_fail_returns_false_and_records_error(self, updater, mock_supabase):
        mock_supabase._chain.execute.side_effect = RuntimeError("never works")
        ok = await updater._apply_updates("pkg-1", {"github_stars": 100})
        assert ok is False
        assert mock_supabase._chain.execute.call_count == updater.max_retries
        assert any(e["type"] == "database_update" for e in updater.stats.errors)

    @pytest.mark.asyncio
    async def test_data_none_response_treated_as_failure(self, updater, mock_supabase):
        # All attempts return data=None → raises internally → exhausts retries.
        mock_supabase._chain.execute.return_value = MagicMock(data=None)
        ok = await updater._apply_updates("pkg-1", {"github_stars": 1})
        assert ok is False


# ---------------------------------------------------------------------------
# update_database (top-level orchestrator)
# ---------------------------------------------------------------------------

class TestUpdateDatabase:
    @pytest.mark.asyncio
    async def test_no_packages_returns_stats_without_processing(self, updater, monkeypatch):
        monkeypatch.setattr(updater, "_fetch_packages", AsyncMock(return_value=[]))
        processed = AsyncMock()
        monkeypatch.setattr(updater, "_process_packages_in_batches", processed)

        stats = await updater.update_database()

        assert stats.total_packages == 0
        processed.assert_not_called()

    @pytest.mark.asyncio
    async def test_happy_path_processes_all_fetched(self, updater, monkeypatch):
        packages = [{"id": "p1"}, {"id": "p2"}, {"id": "p3"}]
        monkeypatch.setattr(updater, "_fetch_packages", AsyncMock(return_value=packages))
        processed = AsyncMock()
        monkeypatch.setattr(updater, "_process_packages_in_batches", processed)

        stats = await updater.update_database({"limit": 3})

        assert stats.total_packages == 3
        processed.assert_awaited_once_with(packages)

    @pytest.mark.asyncio
    async def test_fetch_exception_records_critical_error_and_reraises(self, updater, monkeypatch):
        monkeypatch.setattr(updater, "_fetch_packages",
                            AsyncMock(side_effect=RuntimeError("DB unreachable")))

        with pytest.raises(RuntimeError, match="DB unreachable"):
            await updater.update_database()

        assert any(e["type"] == "critical" for e in updater.stats.errors)
