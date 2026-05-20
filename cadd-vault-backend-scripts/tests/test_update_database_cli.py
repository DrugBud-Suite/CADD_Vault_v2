"""Tests for `parse_arguments` and the filter-building branches of `main()`.

The full `main()` orchestration boots a Supabase client and runs a real async
update — so we mock `create_client`, the `DatabaseUpdater` constructor, and
`load_dotenv`. Each test then asserts what `package_filter` got passed to
`updater.update_database` and that the right export was triggered.
"""
import sys
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

import update_database as udb


# ---------------------------------------------------------------------------
# parse_arguments
# ---------------------------------------------------------------------------

class TestParseArguments:
    def _argv(self, monkeypatch, *args):
        monkeypatch.setattr(sys, "argv", ["update_database.py", *args])
        return udb.parse_arguments()

    def test_defaults(self, monkeypatch):
        args = self._argv(monkeypatch)
        assert args.dry_run is False
        assert args.limit is None
        assert args.ids is None
        assert args.all is False
        assert args.days_since_update is None
        assert args.github_only is False
        assert args.publications_only is False
        assert args.batch_size == 50
        assert args.delay == 5.0
        assert args.format == "csv"
        assert args.verbose is False
        assert args.quiet is False

    def test_dry_run_with_limit_and_output(self, monkeypatch):
        args = self._argv(monkeypatch, "--dry-run", "--limit", "10", "--output", "out.csv")
        assert args.dry_run is True
        assert args.limit == 10
        assert args.output == "out.csv"

    def test_ids_as_comma_separated(self, monkeypatch):
        args = self._argv(monkeypatch, "--ids", "a,b,c")
        assert args.ids == "a,b,c"

    def test_all_flag(self, monkeypatch):
        args = self._argv(monkeypatch, "--all")
        assert args.all is True

    def test_mutually_exclusive_limit_ids_all(self, monkeypatch):
        monkeypatch.setattr(sys, "argv",
                            ["update_database.py", "--limit", "5", "--all"])
        with pytest.raises(SystemExit):
            udb.parse_arguments()

    def test_excel_format(self, monkeypatch):
        args = self._argv(monkeypatch, "--format", "excel")
        assert args.format == "excel"

    def test_invalid_format_rejected(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["update_database.py", "--format", "yaml"])
        with pytest.raises(SystemExit):
            udb.parse_arguments()


# ---------------------------------------------------------------------------
# main() — filter-building branches
# ---------------------------------------------------------------------------

class _FakeUpdater:
    """Captures `package_filter` passed to update_database and tracks
    `export_dry_run_results` calls so main()'s filter-building logic can be
    asserted in isolation."""

    def __init__(self, *args, **kwargs):
        self.update_database = AsyncMock(return_value=None)
        self.export_dry_run_results = MagicMock()
        self.delay_between_batches = 5.0


@pytest.fixture
def patched_main(monkeypatch):
    """Stub out everything except main()'s argv-to-filter mapping."""
    fake_updater = _FakeUpdater()
    monkeypatch.setattr(udb, "create_client", lambda url, key: MagicMock())
    monkeypatch.setattr(udb, "DatabaseUpdater", lambda *a, **kw: fake_updater)
    monkeypatch.setattr(udb, "load_dotenv", lambda: None)
    monkeypatch.setenv("VITE_SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fake-key")
    monkeypatch.setenv("PERSONAL_ACCESS_TOKEN", "fake-gh")
    monkeypatch.setenv("CROSSREF_EMAIL", "test@example.com")
    return fake_updater


def _run_main(monkeypatch, *argv):
    monkeypatch.setattr(sys, "argv", ["update_database.py", *argv])
    import asyncio
    return asyncio.run(udb.main())


class TestMainFilterBuilding:
    def test_no_selection_defaults_to_limit_10(self, patched_main, monkeypatch):
        code = _run_main(monkeypatch)
        assert code == 0
        patched_main.update_database.assert_awaited_once()
        called_filter = patched_main.update_database.await_args.args[0]
        assert called_filter == {"limit": 10}

    def test_all_flag_means_empty_filter(self, patched_main, monkeypatch):
        _run_main(monkeypatch, "--all")
        called_filter = patched_main.update_database.await_args.args[0]
        assert called_filter == {}

    def test_explicit_limit(self, patched_main, monkeypatch):
        _run_main(monkeypatch, "--limit", "25")
        assert patched_main.update_database.await_args.args[0] == {"limit": 25}

    def test_ids_split_on_comma(self, patched_main, monkeypatch):
        _run_main(monkeypatch, "--ids", "pkg-a, pkg-b ,pkg-c")
        called_filter = patched_main.update_database.await_args.args[0]
        assert called_filter == {"ids": ["pkg-a", "pkg-b", "pkg-c"]}

    def test_days_since_update_adds_updated_before_iso(self, patched_main, monkeypatch):
        _run_main(monkeypatch, "--all", "--days-since-update", "7")
        called_filter = patched_main.update_database.await_args.args[0]
        assert "updated_before" in called_filter
        # roughly 7 days ago
        cutoff = datetime.fromisoformat(called_filter["updated_before"])
        delta = datetime.now(timezone.utc) - cutoff
        assert timedelta(days=6, hours=23) < delta < timedelta(days=7, hours=1)

    def test_github_only_flag(self, patched_main, monkeypatch):
        _run_main(monkeypatch, "--all", "--github-only")
        assert patched_main.update_database.await_args.args[0]["github_only"] is True

    def test_publications_only_flag(self, patched_main, monkeypatch):
        _run_main(monkeypatch, "--all", "--publications-only")
        assert patched_main.update_database.await_args.args[0]["publications_only"] is True

    def test_missing_env_vars_returns_1(self, patched_main, monkeypatch):
        monkeypatch.delenv("VITE_SUPABASE_URL")
        code = _run_main(monkeypatch)
        assert code == 1
        patched_main.update_database.assert_not_called()

    def test_keyboard_interrupt_returns_130(self, patched_main, monkeypatch):
        patched_main.update_database.side_effect = KeyboardInterrupt()
        code = _run_main(monkeypatch)
        assert code == 130

    def test_critical_exception_returns_1(self, patched_main, monkeypatch):
        patched_main.update_database.side_effect = RuntimeError("DB gone")
        code = _run_main(monkeypatch)
        assert code == 1

    def test_dry_run_with_no_output_auto_generates_csv_name(self, patched_main, monkeypatch):
        _run_main(monkeypatch, "--dry-run", "--limit", "5")
        # Export should have been called with an auto-generated filename
        patched_main.export_dry_run_results.assert_called_once()
        out_arg = patched_main.export_dry_run_results.call_args.args[0]
        assert out_arg.startswith("dry_run_results_")
        assert out_arg.endswith(".csv")

    def test_dry_run_xlsx_extension_auto_detects_excel(self, patched_main, monkeypatch):
        _run_main(monkeypatch, "--dry-run", "--limit", "5", "--output", "out.xlsx")
        out_arg, fmt_arg = patched_main.export_dry_run_results.call_args.args
        assert out_arg == "out.xlsx"
        assert fmt_arg == "excel"

    def test_dry_run_csv_extension_auto_detects_csv(self, patched_main, monkeypatch):
        _run_main(monkeypatch,
                  "--dry-run", "--limit", "5", "--output", "x.csv", "--format", "excel")
        out_arg, fmt_arg = patched_main.export_dry_run_results.call_args.args
        # extension wins over --format flag
        assert fmt_arg == "csv"

    def test_batch_size_and_delay_propagate_to_updater(self, patched_main, monkeypatch):
        _run_main(monkeypatch, "--all", "--batch-size", "10", "--delay", "1.5")
        assert patched_main.delay_between_batches == 1.5


# ---------------------------------------------------------------------------
# setup_logging
# ---------------------------------------------------------------------------

class TestSetupLogging:
    def test_quiet_sets_error_level(self):
        import logging
        udb.setup_logging(verbose=False, quiet=True)
        assert logging.root.level == logging.ERROR

    def test_verbose_sets_debug_level(self):
        import logging
        udb.setup_logging(verbose=True, quiet=False)
        assert logging.root.level == logging.DEBUG

    def test_default_is_info_level(self):
        import logging
        udb.setup_logging(verbose=False, quiet=False)
        assert logging.root.level == logging.INFO
