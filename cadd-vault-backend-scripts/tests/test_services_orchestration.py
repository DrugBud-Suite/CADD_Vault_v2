"""Orchestrator-level tests: `check_publication_status` dispatches to the
right `_check_*` method based on URL type, and `get_impact_factor` flows
through the cache + paperscraper Impactor.

Each `_check_*` is patched on the instance with `monkeypatch.setattr` so the
test can assert dispatch behavior without re-mocking the HTTP layer.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest


# ---------------------------------------------------------------------------
# check_publication_status
# ---------------------------------------------------------------------------

class TestCheckPublicationStatus:
    @pytest.mark.asyncio
    async def test_dispatches_arxiv_url_to_arxiv_checker(self, pub_service, monkeypatch):
        called = {}

        async def fake_arxiv(arxiv_id):
            called["arxiv_id"] = arxiv_id
            return "10.1/published", "https://doi.org/10.1/published"

        async def fake_title(doi):
            return "Paper Title"

        monkeypatch.setattr(pub_service, "_check_arxiv", fake_arxiv)
        monkeypatch.setattr(pub_service, "_get_doi_title", fake_title)

        result = await pub_service.check_publication_status("https://arxiv.org/abs/1706.03762")

        assert called["arxiv_id"] == "1706.03762"
        assert result.publication_status == "published"
        assert result.published_doi == "10.1/published"
        assert result.published_url == "https://doi.org/10.1/published"
        assert result.title == "Paper Title"

    @pytest.mark.asyncio
    async def test_dispatches_biorxiv_url_to_biorxiv_checker(self, pub_service, monkeypatch):
        async def fake_biorxiv(biorxiv_id):
            return "10.1/from-biorxiv", "https://doi.org/10.1/from-biorxiv"

        monkeypatch.setattr(pub_service, "_check_biorxiv", fake_biorxiv)
        monkeypatch.setattr(pub_service, "_get_doi_title", AsyncMock(return_value="t"))

        result = await pub_service.check_publication_status(
            "https://www.biorxiv.org/content/2020.03.20.000133"
        )
        assert result.publication_status == "published"
        assert result.published_doi == "10.1/from-biorxiv"

    @pytest.mark.asyncio
    async def test_dispatches_medrxiv_url_to_biorxiv_checker(self, pub_service, monkeypatch):
        # medrxiv uses the same checker as biorxiv (DOI prefix is 10.1101 for both).
        async def fake_biorxiv(biorxiv_id):
            return "10.1/med-published", "https://doi.org/10.1/med-published"

        monkeypatch.setattr(pub_service, "_check_biorxiv", fake_biorxiv)
        monkeypatch.setattr(pub_service, "_get_doi_title", AsyncMock(return_value=None))

        result = await pub_service.check_publication_status(
            "https://www.medrxiv.org/content/2020.03.20.000133"
        )
        assert result.published_doi == "10.1/med-published"

    @pytest.mark.asyncio
    async def test_dispatches_chemrxiv_url_to_chemrxiv_checker(self, pub_service, monkeypatch):
        async def fake_chemrxiv(chemrxiv_id):
            return "10.1/chem-published", "https://doi.org/10.1/chem-published"

        monkeypatch.setattr(pub_service, "_check_chemrxiv", fake_chemrxiv)
        monkeypatch.setattr(pub_service, "_get_doi_title", AsyncMock(return_value="title"))

        result = await pub_service.check_publication_status(
            "https://doi.org/10.26434/chemrxiv-2020-abc"
        )
        assert result.published_doi == "10.1/chem-published"

    @pytest.mark.asyncio
    async def test_unrecognized_url_returns_error_in_result(self, pub_service):
        result = await pub_service.check_publication_status("https://nature.com/articles/x")
        assert result.publication_status == "unpublished"
        assert result.error is not None
        assert "Could not identify" in result.error

    @pytest.mark.asyncio
    async def test_no_published_version_returns_unpublished(self, pub_service, monkeypatch):
        async def fake_arxiv(arxiv_id):
            return None, None

        monkeypatch.setattr(pub_service, "_check_arxiv", fake_arxiv)

        result = await pub_service.check_publication_status("https://arxiv.org/abs/1706.03762")
        assert result.publication_status == "unpublished"
        assert result.published_doi is None
        assert result.published_url is None

    @pytest.mark.asyncio
    async def test_checker_exception_returned_as_error(self, pub_service, monkeypatch):
        async def fake_arxiv(arxiv_id):
            raise RuntimeError("upstream failed")

        monkeypatch.setattr(pub_service, "_check_arxiv", fake_arxiv)

        result = await pub_service.check_publication_status("https://arxiv.org/abs/1706.03762")
        assert result.publication_status == "unpublished"
        assert result.error == "upstream failed"


# ---------------------------------------------------------------------------
# get_impact_factor
# ---------------------------------------------------------------------------

class TestGetImpactFactor:
    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached_value(self, pub_service):
        pub_service._cache_impact_factor("Nature", 49.962)

        impact = await pub_service.get_impact_factor({"journal": "Nature"})
        assert impact == 49.962

    @pytest.mark.asyncio
    async def test_excluded_journal_returns_none(self, pub_service):
        # arXiv-named "journal" is excluded → don't even consult the impactor.
        pub_service.impactor.search = MagicMock(return_value=[{"factor": 5.0}])
        impact = await pub_service.get_impact_factor({"journal": "arXiv"})
        assert impact is None

    @pytest.mark.asyncio
    async def test_no_journal_name_returns_none(self, pub_service):
        impact = await pub_service.get_impact_factor({"journal": None})
        assert impact is None

    @pytest.mark.asyncio
    async def test_impactor_unavailable_returns_none(self, pub_service):
        pub_service.impactor = None
        impact = await pub_service.get_impact_factor({"journal": "Some New Journal"})
        assert impact is None

    @pytest.mark.asyncio
    async def test_impactor_search_returns_factor(self, pub_service):
        pub_service.impactor.search = MagicMock(return_value=[{"factor": 12.3}])
        impact = await pub_service.get_impact_factor({"journal": "Brand New Journal"})
        assert impact == 12.3
        # And the result is cached for the next call.
        assert pub_service._impact_factor_cache["Brand New Journal"] == 12.3

    @pytest.mark.asyncio
    async def test_impactor_search_no_results_returns_none(self, pub_service):
        pub_service.impactor.search = MagicMock(return_value=[])
        impact = await pub_service.get_impact_factor({"journal": "Another Journal"})
        assert impact is None

    @pytest.mark.asyncio
    async def test_impactor_search_exception_returns_none(self, pub_service):
        pub_service.impactor.search = MagicMock(side_effect=RuntimeError("paperscraper failed"))
        impact = await pub_service.get_impact_factor({"journal": "Yet Another Journal"})
        assert impact is None
