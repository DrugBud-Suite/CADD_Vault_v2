"""Unit tests for transform_csv.py — CSV→Supabase row transformation."""
import csv
import json
import uuid
from datetime import datetime

import pytest

from transform_csv import (
    parse_date,
    parse_github_info,
    transform,
    transform_row,
    supabase_column_order,
)


# ---------------------------------------------------------------------------
# parse_date
# ---------------------------------------------------------------------------

class TestParseDate:
    def test_returns_none_for_empty(self):
        assert parse_date("") is None
        assert parse_date(None) is None

    def test_parses_iso_with_z_suffix(self):
        out = parse_date("2026-05-18T09:30:00Z")
        assert out is not None
        assert out.startswith("2026-05-18T09:30:00")

    def test_parses_iso_with_offset(self):
        out = parse_date("2026-05-18T09:30:00+00:00")
        assert out is not None
        assert "2026-05-18" in out

    def test_parses_dd_mon_with_current_year(self):
        out = parse_date("15-Jan")
        assert out is not None
        assert f"{datetime.now().year}-01-15" in out

    def test_returns_none_for_unparseable(self):
        assert parse_date("not a date") is None


# ---------------------------------------------------------------------------
# parse_github_info
# ---------------------------------------------------------------------------

class TestParseGithubInfo:
    @pytest.mark.parametrize("url,owner,repo", [
        ("https://github.com/foo/bar", "foo", "bar"),
        ("http://github.com/foo/bar/", "foo", "bar"),
        ("https://github.com/foo/bar.git", "foo", "bar"),
        ("https://github.com/foo/bar/tree/main", "foo", "bar"),
    ])
    def test_extracts_owner_and_repo(self, url, owner, repo):
        assert parse_github_info(url) == (owner, repo)

    @pytest.mark.parametrize("url", [
        None,
        "",
        "https://gitlab.com/foo/bar",
        "https://github.com/justone",  # no repo segment
    ])
    def test_non_github_returns_none_none(self, url):
        assert parse_github_info(url) == (None, None)


# ---------------------------------------------------------------------------
# transform_row — per-field transformations
# ---------------------------------------------------------------------------

class TestTransformRow:
    @pytest.fixture
    def base_row(self):
        # Minimal CSV row exercising every column the mapper knows about.
        return {
            "ENTRY NAME": "RDKit",
            "CODE": "https://github.com/rdkit/rdkit",
            "PUBLICATION": "https://doi.org/10.1234/abc",
            "WEBSERVER": "https://rdkit.org",
            "LINK": "https://docs.rdkit.org",
            "FOLDER1": "Cheminformatics",
            "CATEGORY1": "Toolkits",
            "DESCRIPTION": "Open-source cheminformatics",
            "GITHUB_STARS": "2500",
            "LAST_COMMIT": "2026-01-15T00:00:00Z",
            "LAST_COMMIT_AGO": "4 months ago",
            "LICENSE": "BSD-3-Clause",
            "CITATIONS": "1000",
            "JOURNAL": "JCIM",
            "JIF": "4.5",
            "PAGE_ICON": "icon.png",
            "TAGS": "chemistry, modeling, drug-discovery",
        }

    def test_id_is_uuid(self, base_row):
        out = transform_row(base_row)
        assert uuid.UUID(out["id"])  # raises if invalid

    def test_id_is_unique_per_call(self, base_row):
        assert transform_row(base_row)["id"] != transform_row(base_row)["id"]

    def test_tags_serialized_as_json_array_of_trimmed_strings(self, base_row):
        out = transform_row(base_row)
        assert json.loads(out["tags"]) == ["chemistry", "modeling", "drug-discovery"]

    def test_empty_tags_serialized_as_empty_json_array(self, base_row):
        base_row["TAGS"] = ""
        out = transform_row(base_row)
        assert json.loads(out["tags"]) == []

    @pytest.mark.parametrize("col_in,col_out,raw,expected", [
        ("GITHUB_STARS", "github_stars", "100", 100),
        ("CITATIONS", "citations", "42", 42),
        ("GITHUB_STARS", "github_stars", "", None),
        ("CITATIONS", "citations", "not-a-number", None),
    ])
    def test_int_columns(self, base_row, col_in, col_out, raw, expected):
        base_row[col_in] = raw
        assert transform_row(base_row)[col_out] == expected

    @pytest.mark.parametrize("col_in,col_out,raw,expected", [
        ("JIF", "jif", "4.5", 4.5),
        ("JIF", "jif", "", None),
        ("JIF", "jif", "abc", None),
    ])
    def test_float_columns(self, base_row, col_in, col_out, raw, expected):
        base_row[col_in] = raw
        assert transform_row(base_row)[col_out] == expected

    def test_last_commit_parsed_to_iso(self, base_row):
        out = transform_row(base_row)
        assert out["last_commit"].startswith("2026-01-15")

    def test_repo_link_prefers_REPO_LINK_over_CODE(self, base_row):
        base_row["REPO_LINK"] = "https://github.com/forked/repo"
        out = transform_row(base_row)
        assert out["repo_link"] == "https://github.com/forked/repo"

    def test_repo_link_falls_back_to_CODE(self, base_row):
        # No REPO_LINK column; should use CODE.
        out = transform_row(base_row)
        assert out["repo_link"] == "https://github.com/rdkit/rdkit"

    def test_github_owner_and_repo_parsed_from_repo_link(self, base_row):
        out = transform_row(base_row)
        assert out["github_owner"] == "rdkit"
        assert out["github_repo"] == "rdkit"

    def test_github_owner_repo_none_when_repo_link_missing(self):
        # Row with no CODE / REPO_LINK
        row = {"ENTRY NAME": "Standalone", "TAGS": ""}
        out = transform_row(row)
        assert out["github_owner"] is None
        assert out["github_repo"] is None

    def test_supabase_only_columns_default_to_none(self, base_row):
        out = transform_row(base_row)
        for col in ["average_rating", "primary_language", "ratings_count", "ratingsum"]:
            assert out[col] is None

    def test_package_name_mapped_from_entry_name(self, base_row):
        out = transform_row(base_row)
        assert out["package_name"] == "RDKit"

    def test_missing_csv_columns_become_none(self):
        # Only ENTRY NAME present — every other supabase column should be None.
        out = transform_row({"ENTRY NAME": "Minimal"})
        assert out["package_name"] == "Minimal"
        assert out["description"] is None
        assert out["license"] is None
        assert out["citations"] is None


# ---------------------------------------------------------------------------
# transform — full read/write
# ---------------------------------------------------------------------------

class TestTransformEndToEnd:
    def test_reads_csv_writes_supabase_shaped_csv(self, tmp_path):
        input_path = tmp_path / "in.csv"
        output_path = tmp_path / "out.csv"

        with open(input_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "ENTRY NAME", "CODE", "DESCRIPTION", "TAGS", "GITHUB_STARS",
            ])
            writer.writeheader()
            writer.writerow({
                "ENTRY NAME": "PkgA",
                "CODE": "https://github.com/a/a",
                "DESCRIPTION": "first",
                "TAGS": "tag1, tag2",
                "GITHUB_STARS": "10",
            })
            writer.writerow({
                "ENTRY NAME": "PkgB",
                "CODE": "https://github.com/b/b",
                "DESCRIPTION": "second",
                "TAGS": "",
                "GITHUB_STARS": "",
            })

        rows = transform(input_path, output_path)
        assert len(rows) == 2

        with open(output_path) as f:
            reader = csv.DictReader(f)
            assert reader.fieldnames == supabase_column_order
            written = list(reader)

        assert len(written) == 2
        assert written[0]["package_name"] == "PkgA"
        assert written[0]["github_stars"] == "10"
        assert written[0]["github_owner"] == "a"
        assert written[1]["package_name"] == "PkgB"
        assert written[1]["github_stars"] == ""  # None → empty string in CSV
