"""Tests for `DatabaseUpdater.export_dry_run_results` — CSV and Excel writers.

Each test seeds `stats.dry_run_changes` (and optionally `stats.errors`),
writes to `tmp_path`, then re-reads the resulting file via pandas to verify
shape and contents.
"""
import pandas as pd


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_changes(updater):
    updater.dry_run = True
    updater.stats.total_packages = 2
    updater.stats.updated_packages = 2
    updater.stats.add_dry_run_change("p1", "P1", "github_stars", 0, 100)
    updater.stats.add_dry_run_change("p2", "P2", "citations", None, 10)


# ---------------------------------------------------------------------------
# Guard
# ---------------------------------------------------------------------------

def test_no_op_when_not_dry_run(updater, tmp_path):
    # `updater` fixture has dry_run=False — should refuse to export.
    updater.stats.add_dry_run_change("p1", "P1", "x", 0, 1)
    updater.export_dry_run_results(str(tmp_path / "out.csv"))
    assert not (tmp_path / "out.csv").exists()


def test_no_op_when_no_changes(dry_updater, tmp_path):
    # dry_run=True but stats.dry_run_changes is empty.
    dry_updater.export_dry_run_results(str(tmp_path / "out.csv"))
    assert not (tmp_path / "out.csv").exists()


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------

class TestCsvExport:
    def test_writes_main_changes_and_summary_files(self, dry_updater, tmp_path):
        _seed_changes(dry_updater)
        out = tmp_path / "result.csv"

        dry_updater.export_dry_run_results(str(out), "csv")

        assert out.exists()
        summary = tmp_path / "result_summary.csv"
        assert summary.exists()

        changes_df = pd.read_csv(out)
        assert len(changes_df) == 2
        assert set(changes_df["field"]) == {"github_stars", "citations"}

        summary_df = pd.read_csv(summary)
        assert summary_df.iloc[0]["total_packages"] == 2
        assert summary_df.iloc[0]["total_changes"] == 2

    def test_auto_appends_csv_suffix(self, dry_updater, tmp_path):
        _seed_changes(dry_updater)
        # Pass a path without extension; writer should add `.csv`.
        out = tmp_path / "result"

        dry_updater.export_dry_run_results(str(out), "csv")

        assert (tmp_path / "result.csv").exists()

    def test_writes_errors_csv_when_errors_present(self, dry_updater, tmp_path):
        _seed_changes(dry_updater)
        dry_updater.stats.add_error("p1", "boom", "api")
        out = tmp_path / "result.csv"

        dry_updater.export_dry_run_results(str(out), "csv")

        errors_csv = tmp_path / "result_errors.csv"
        assert errors_csv.exists()
        df = pd.read_csv(errors_csv)
        assert df.iloc[0]["error"] == "boom"
        assert df.iloc[0]["type"] == "api"


# ---------------------------------------------------------------------------
# Excel
# ---------------------------------------------------------------------------

class TestExcelExport:
    def test_writes_multiple_sheets(self, dry_updater, tmp_path):
        _seed_changes(dry_updater)
        dry_updater.stats.add_error("p1", "boom", "api")
        out = tmp_path / "result.xlsx"

        dry_updater.export_dry_run_results(str(out), "excel")

        assert out.exists()
        sheets = pd.read_excel(out, sheet_name=None)  # dict of all sheets
        assert set(sheets.keys()) == {"Changes", "Summary", "Errors"}
        assert len(sheets["Changes"]) == 2
        assert sheets["Summary"].iloc[0]["total_changes"] == 2
        assert sheets["Errors"].iloc[0]["error"] == "boom"

    def test_auto_appends_xlsx_suffix_when_excel_requested(self, dry_updater, tmp_path):
        _seed_changes(dry_updater)
        out = tmp_path / "result"  # no extension

        dry_updater.export_dry_run_results(str(out), "excel")

        assert (tmp_path / "result.xlsx").exists()

    def test_excel_without_errors_sheet_when_no_errors(self, dry_updater, tmp_path):
        _seed_changes(dry_updater)
        out = tmp_path / "result.xlsx"

        dry_updater.export_dry_run_results(str(out), "excel")

        sheets = pd.read_excel(out, sheet_name=None)
        assert "Errors" not in sheets
