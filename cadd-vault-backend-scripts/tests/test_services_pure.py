"""Unit tests for the pure-logic surface of services.py.

These tests cover URL parsers, regex-driven preprint identification, journal
exclusion, rate-limiter behavior, and the static `_calculate_time_ago` helper —
nothing that hits the network. HTTP-bearing methods (`get_repository_data`,
`_check_arxiv`, etc.) are covered in `test_services_http.py` with respx.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from services import APIRateLimiter, RepositoryService
from models import Config


# ---------------------------------------------------------------------------
# APIRateLimiter
# ---------------------------------------------------------------------------

class TestAPIRateLimiter:
    def test_defaults(self):
        rl = APIRateLimiter()
        assert rl.calls_per_second == 1.0
        assert rl.last_call_time == 0.0

    def test_first_call_records_timestamp(self):
        rl = APIRateLimiter(calls_per_second=10.0)
        asyncio.run(rl.wait_if_needed())
        assert rl.last_call_time > 0

    def test_back_to_back_calls_advance_timestamp(self):
        # With asyncio.sleep stubbed via the autouse fixture we can't measure
        # real elapsed time; we just verify last_call_time is bumped on each
        # call so the rate-limiter's own state machine works.
        rl = APIRateLimiter(calls_per_second=5.0)

        async def run_two():
            await rl.wait_if_needed()
            t1 = rl.last_call_time
            await rl.wait_if_needed()
            return t1, rl.last_call_time

        first, second = asyncio.run(run_two())
        assert second >= first


# ---------------------------------------------------------------------------
# PublicationService — pure logic
# ---------------------------------------------------------------------------

class TestNormalizeDoi:
    @pytest.mark.parametrize("inp,expected", [
        ("10.1234/abc", "https://doi.org/10.1234/abc"),
        ("https://doi.org/10.1234/abc", "https://doi.org/10.1234/abc"),
        ("http://doi.org/10.1234/abc", "https://doi.org/10.1234/abc"),
        ("https://doi.org/10.1234/abc.full", "https://doi.org/10.1234/abc"),
        ("https://doi.org/10.1234/abcv2", "https://doi.org/10.1234/abc"),
        ("https://doi.org/10.1234/abc.pdf", "https://doi.org/10.1234/abc"),
        ("https://doi.org/10.1234/abc).", "https://doi.org/10.1234/abc"),
        ("https://doi.org/10.1234/abc?query=1", "https://doi.org/10.1234/abc"),
        ("https://doi.org/10.1234/abc#section", "https://doi.org/10.1234/abc"),
        ("  10.1234/abc  ", "https://doi.org/10.1234/abc"),
    ])
    def test_valid_dois_normalized_to_canonical_url(self, pub_service, inp, expected):
        assert pub_service.normalize_doi(inp) == expected

    @pytest.mark.parametrize("inp", [None, "", "   "])
    def test_empty_returns_none(self, pub_service, inp):
        assert pub_service.normalize_doi(inp) is None

    def test_non_doi_url_returned_as_is(self, pub_service):
        # When the input contains 'http' but no detectable DOI pattern, the
        # function keeps the original URL rather than dropping it.
        assert pub_service.normalize_doi("https://example.com/no-doi") == "https://example.com/no-doi"


class TestIsPreprint:
    @pytest.mark.parametrize("url", [
        "https://arxiv.org/abs/1706.03762",
        "https://www.biorxiv.org/content/10.1101/2020.03.20.000133v2",
        "https://medrxiv.org/foo",
        "https://chemrxiv.org/engage/api/download/123",
        "https://zenodo.org/record/123",
        "https://ARXIV.ORG/abs/1706.03762",  # case-insensitive
    ])
    def test_preprint_servers_recognized(self, pub_service, url):
        assert pub_service.is_preprint(url) is True

    @pytest.mark.parametrize("url", [
        "https://doi.org/10.1234/abc",
        "https://nature.com/articles/xyz",
        "https://github.com/foo/bar",
        "",
        None,
    ])
    def test_non_preprints(self, pub_service, url):
        assert pub_service.is_preprint(url) is False


class TestExtractDoi:
    def test_extracts_from_doi_url(self, pub_service):
        assert pub_service._extract_doi("https://doi.org/10.1234/abc") == "10.1234/abc"

    def test_strips_trailing_punctuation(self, pub_service):
        # Implementation strips trailing ')', ']', '.' from extracted DOI.
        assert pub_service._extract_doi("https://doi.org/10.1234/abc).") == "10.1234/abc"

    @pytest.mark.parametrize("url", [None, "", "https://example.com"])
    def test_returns_none_when_no_doi(self, pub_service, url):
        assert pub_service._extract_doi(url) is None


class TestIdentifyPreprint:
    @pytest.mark.parametrize("url,expected_type", [
        ("https://arxiv.org/abs/1706.03762", "arxiv"),
        ("https://arxiv.org/pdf/1706.03762", "arxiv"),
        ("https://doi.org/10.48550/arxiv.1706.03762", "arxiv"),
        ("https://www.biorxiv.org/content/2020.03.20.000133", "biorxiv"),
        ("https://www.medrxiv.org/content/2020.03.20.000133", "medrxiv"),
        ("https://doi.org/10.26434/chemrxiv-2020-abc", "chemrxiv"),
    ])
    def test_identifies_type_and_extracts_id(self, pub_service, url, expected_type):
        ptype, pid = pub_service._identify_preprint(url)
        assert ptype == expected_type
        assert pid is not None and len(pid) > 0

    @pytest.mark.parametrize("url", [None, "", "https://nature.com/abc"])
    def test_returns_none_for_non_preprints(self, pub_service, url):
        ptype, pid = pub_service._identify_preprint(url)
        assert ptype is None
        assert pid is None


class TestIsExcludedJournal:
    @pytest.mark.parametrize("journal", [
        "arXiv",
        "bioRxiv preprint",
        "medRxiv",
        "chemRxiv",
        "GitHub repository",
        "Personal Blog",
        "Zenodo",
        "Figshare dataset",
        "ResearchGate",
    ])
    def test_excludes_known_non_journals(self, pub_service, journal):
        assert pub_service._is_excluded_journal(journal) is True

    @pytest.mark.parametrize("journal", [
        "Nature",
        "Journal of Chemical Information and Modeling",
        "Bioinformatics",
        "PLOS One",
    ])
    def test_does_not_exclude_real_journals(self, pub_service, journal):
        assert pub_service._is_excluded_journal(journal) is False


class TestImpactFactorCache:
    def test_cache_returns_stored_value(self, pub_service):
        pub_service._cache_impact_factor("Nature", 49.962)
        assert pub_service._impact_factor_cache["Nature"] == 49.962

    def test_get_cached_returns_none_for_unknown(self, pub_service):
        assert pub_service._get_cached_impact_factor("Unknown Journal") is None


# ---------------------------------------------------------------------------
# RepositoryService — pure logic
# ---------------------------------------------------------------------------

class TestRepositoryServiceInit:
    def test_includes_auth_header_when_token_provided(self):
        cfg = Config(email="x@y", github_token="abc")
        svc = RepositoryService(cfg)
        assert svc.headers["Authorization"] == "token abc"

    def test_omits_auth_header_when_no_token(self):
        cfg = Config(email="x@y", github_token=None)
        svc = RepositoryService(cfg)
        assert "Authorization" not in svc.headers

    def test_user_agent_includes_email(self):
        cfg = Config(email="x@y")
        svc = RepositoryService(cfg)
        assert "x@y" in svc.headers["User-Agent"]


class TestExtractRepoPath:
    @pytest.mark.parametrize("url,expected", [
        ("https://github.com/foo/bar", "foo/bar"),
        ("http://github.com/foo/bar", "foo/bar"),
        ("github.com/foo/bar", "foo/bar"),  # gets https:// prefix
        ("https://github.com/foo/bar/", "foo/bar"),
        ("https://github.com/foo/bar.git", "foo/bar"),
        ("https://github.com/foo/bar/tree/main", "foo/bar"),
        ("https://github.com/foo/bar/blob/main/README.md", "foo/bar"),
    ])
    def test_extracts_owner_repo(self, repo_service, url, expected):
        assert repo_service._extract_repo_path(url) == expected

    @pytest.mark.parametrize("url", [
        "https://gitlab.com/foo/bar",
        "https://github.com/justone",
        "",
    ])
    def test_returns_none_for_invalid(self, repo_service, url):
        assert repo_service._extract_repo_path(url) is None


class TestCalculateTimeAgo:
    """Static helper; uses datetime.now(UTC) — we just freeze relative offsets."""

    def _at(self, days_ago: int) -> str:
        dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
        return dt.isoformat().replace("+00:00", "Z")

    @pytest.mark.parametrize("days,expected_unit", [
        (0, "days ago"),
        (1, "day ago"),
        (5, "days ago"),
        (29, "days ago"),
        (30, "month ago"),
        (60, "months ago"),
        (364, "months ago"),
        (365, "year ago"),
        (730, "years ago"),
    ])
    def test_relative_time_units(self, days, expected_unit):
        out = RepositoryService._calculate_time_ago(self._at(days))
        assert out is not None
        assert expected_unit in out

    def test_returns_none_for_empty(self):
        assert RepositoryService._calculate_time_ago(None) is None
        assert RepositoryService._calculate_time_ago("") is None

    def test_returns_none_for_malformed(self):
        assert RepositoryService._calculate_time_ago("not-a-date") is None

    def test_handles_both_Z_and_offset_suffixes(self):
        # Same instant expressed two ways should not crash.
        dt = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        assert "day" in RepositoryService._calculate_time_ago(dt) or "days" in RepositoryService._calculate_time_ago(dt)
        assert "day" in RepositoryService._calculate_time_ago(dt.replace("+00:00", "Z"))
