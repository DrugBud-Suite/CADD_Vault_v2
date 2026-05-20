"""HTTP-method tests for services.py.

Two mock surfaces are used:

1. **respx** intercepts every `httpx.AsyncClient` request — used for the
   GitHub, arXiv, Europe PMC, bioRxiv, and chemRxiv endpoints.
2. **MagicMock on `pub_service.crossref`** stands in for the habanero
   Crossref client (it's a sync library wrapped in `asyncio.to_thread`, so
   respx can't see those calls).

respx decorator note: `@respx.mock(assert_all_called=False)` creates a *new*
router and injects it as the `respx_mock` parameter. Routes must be added to
that local router, not the global `respx.get(...)` singleton, or they won't be
matched. Tests below follow that convention.
"""
from unittest.mock import MagicMock

import httpx
import pytest
import respx


# ---------------------------------------------------------------------------
# RepositoryService.get_repository_data + _get_last_commit
# ---------------------------------------------------------------------------

class TestGetRepositoryData:
    @pytest.mark.asyncio
    async def test_returns_none_for_non_github_url(self, repo_service):
        assert await repo_service.get_repository_data("https://gitlab.com/foo/bar") is None

    @pytest.mark.asyncio
    async def test_returns_none_for_unparseable_repo_path(self, repo_service):
        assert await repo_service.get_repository_data("https://github.com/justone") is None

    @pytest.mark.asyncio
    async def test_happy_path_populates_stars_language_license_commit(self, repo_service):
        async with respx.mock(assert_all_called=False) as router:
            router.get("https://api.github.com/repos/foo/bar").mock(
                return_value=httpx.Response(200, json={
                    "stargazers_count": 1234,
                    "language": "Python",
                    "license": {"spdx_id": "MIT"},
                }),
            )
            router.get("https://api.github.com/repos/foo/bar/commits").mock(
                return_value=httpx.Response(200, json=[
                    {"commit": {"committer": {"date": "2026-04-01T12:00:00Z"}}}
                ]),
            )

            repo = await repo_service.get_repository_data("https://github.com/foo/bar")

        assert repo is not None
        assert repo.owner == "foo" and repo.name == "bar"
        assert repo.stars == 1234
        assert repo.primary_language == "Python"
        assert repo.license == "MIT"
        assert repo.last_commit == "2026-04-01T12:00:00Z"
        assert repo.last_commit_ago is not None  # parsed into "X months ago"

    @pytest.mark.asyncio
    async def test_handles_missing_license_field(self, repo_service):
        async with respx.mock(assert_all_called=False) as router:
            router.get("https://api.github.com/repos/foo/bar").mock(
                return_value=httpx.Response(200, json={"stargazers_count": 5, "language": None}),
            )
            router.get("https://api.github.com/repos/foo/bar/commits").mock(
                return_value=httpx.Response(200, json=[]),
            )

            repo = await repo_service.get_repository_data("https://github.com/foo/bar")

        assert repo is not None
        assert repo.license is None
        assert repo.stars == 5
        assert repo.last_commit is None

    @pytest.mark.asyncio
    async def test_rate_limit_403_with_zero_remaining_returns_none(self, repo_service):
        # 403 with X-RateLimit-Remaining=0 → raises internally, gets retried by
        # backoff, all retries fail, outer try/except returns None.
        async with respx.mock(assert_all_called=False) as router:
            router.get("https://api.github.com/repos/foo/bar").mock(
                return_value=httpx.Response(
                    403,
                    headers={"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "9999"},
                    json={"message": "rate limited"},
                ),
            )

            result = await repo_service.get_repository_data("https://github.com/foo/bar")

        assert result is None

    @pytest.mark.asyncio
    async def test_404_returns_none(self, repo_service):
        async with respx.mock(assert_all_called=False) as router:
            router.get("https://api.github.com/repos/foo/bar").mock(
                return_value=httpx.Response(404),
            )

            result = await repo_service.get_repository_data("https://github.com/foo/bar")

        assert result is None

    @pytest.mark.asyncio
    async def test_404_on_commits_endpoint_still_returns_repo(self, repo_service):
        async with respx.mock(assert_all_called=False) as router:
            router.get("https://api.github.com/repos/foo/bar").mock(
                return_value=httpx.Response(200, json={"stargazers_count": 1, "language": "Go"}),
            )
            router.get("https://api.github.com/repos/foo/bar/commits").mock(
                return_value=httpx.Response(404),
            )

            repo = await repo_service.get_repository_data("https://github.com/foo/bar")

        assert repo is not None
        assert repo.stars == 1
        # last_commit gracefully None — repo data still returned
        assert repo.last_commit is None


class TestGetLastCommit:
    @pytest.mark.asyncio
    async def test_returns_iso_date(self, repo_service):
        async with respx.mock(assert_all_called=False) as router:
            router.get("https://api.github.com/repos/foo/bar/commits").mock(
                return_value=httpx.Response(200, json=[
                    {"commit": {"committer": {"date": "2026-03-15T08:30:00Z"}}}
                ]),
            )
            async with httpx.AsyncClient() as client:
                out = await repo_service._get_last_commit("foo/bar", client)
        assert out == "2026-03-15T08:30:00Z"

    @pytest.mark.asyncio
    async def test_empty_commits_list_returns_none(self, repo_service):
        async with respx.mock(assert_all_called=False) as router:
            router.get("https://api.github.com/repos/foo/bar/commits").mock(
                return_value=httpx.Response(200, json=[]),
            )
            async with httpx.AsyncClient() as client:
                assert await repo_service._get_last_commit("foo/bar", client) is None


# ---------------------------------------------------------------------------
# PublicationService._check_biorxiv  (httpx only)
# ---------------------------------------------------------------------------

BIORXIV_URL = "https://api.biorxiv.org/details/biorxiv/10.1101/2020.03.20.000133"
MEDRXIV_URL = "https://api.biorxiv.org/details/medrxiv/10.1101/2020.03.20.000133"


class TestCheckBiorxiv:
    @pytest.mark.asyncio
    async def test_published_doi_found_on_first_api(self, pub_service):
        async with respx.mock(assert_all_called=False) as router:
            router.get(BIORXIV_URL).mock(
                return_value=httpx.Response(200, json={
                    "collection": [{"published_doi": "10.1038/nature12345"}]
                }),
            )

            doi, url = await pub_service._check_biorxiv("2020.03.20.000133")

        assert doi == "10.1038/nature12345"
        assert url == "https://doi.org/10.1038/nature12345"

    @pytest.mark.asyncio
    async def test_falls_back_to_medrxiv_api_when_biorxiv_empty(self, pub_service):
        async with respx.mock() as router:
            router.get(BIORXIV_URL).mock(
                return_value=httpx.Response(200, json={"collection": []}),
            )
            router.get(MEDRXIV_URL).mock(
                return_value=httpx.Response(200, json={
                    "collection": [{"published_doi": "10.1126/science.abc"}]
                }),
            )

            doi, url = await pub_service._check_biorxiv("2020.03.20.000133")

        assert doi == "10.1126/science.abc"

    @pytest.mark.asyncio
    async def test_no_published_version_returns_none_none(self, pub_service):
        async with respx.mock() as router:
            router.get(BIORXIV_URL).mock(
                return_value=httpx.Response(200, json={"collection": [{}]}),
            )
            router.get(MEDRXIV_URL).mock(
                return_value=httpx.Response(200, json={"collection": []}),
            )

            doi, url = await pub_service._check_biorxiv("2020.03.20.000133")

        assert doi is None and url is None

    @pytest.mark.asyncio
    async def test_both_apis_error_returns_none_none(self, pub_service):
        async with respx.mock() as router:
            router.get(BIORXIV_URL).mock(return_value=httpx.Response(500))
            router.get(MEDRXIV_URL).mock(return_value=httpx.Response(503))

            doi, url = await pub_service._check_biorxiv("2020.03.20.000133")

        assert doi is None and url is None


# ---------------------------------------------------------------------------
# PublicationService._check_chemrxiv  (httpx + Crossref fallback)
# ---------------------------------------------------------------------------

EPMC_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"


class TestCheckChemrxiv:
    @pytest.mark.asyncio
    async def test_finds_published_version_via_epmc(self, pub_service):
        async with respx.mock() as router:
            router.get(url__startswith=EPMC_URL).mock(
                return_value=httpx.Response(200, json={
                    "hitCount": 1,
                    "resultList": {"result": [
                        {"source": "MED", "doi": "10.1021/jacs.abc"}
                    ]},
                }),
            )

            doi, url = await pub_service._check_chemrxiv("2020-abc")

        assert doi == "10.1021/jacs.abc"
        assert url == "https://doi.org/10.1021/jacs.abc"

    @pytest.mark.asyncio
    async def test_skips_preprint_source_in_epmc_results(self, pub_service):
        # PPR = preprint source in Europe PMC; should be ignored. Crossref
        # fallback then returns nothing useful.
        async with respx.mock() as router:
            router.get(url__startswith=EPMC_URL).mock(
                return_value=httpx.Response(200, json={
                    "hitCount": 1,
                    "resultList": {"result": [{"source": "PPR", "doi": "10.26434/preprint"}]},
                }),
            )
            pub_service.crossref.works = MagicMock(return_value={"message": {}})

            doi, url = await pub_service._check_chemrxiv("2020-abc")

        assert doi is None and url is None

    @pytest.mark.asyncio
    async def test_falls_back_to_crossref_title_search(self, pub_service):
        async with respx.mock() as router:
            router.get(url__startswith=EPMC_URL).mock(
                return_value=httpx.Response(200, json={"hitCount": 0}),
            )
            # _get_doi_title → 'Some Title', then _search_crossref_for_title → published DOI.
            pub_service.crossref.works = MagicMock(side_effect=[
                {"message": {"title": ["Some Title"]}},
                {"message": {"items": [{"title": ["some title"], "DOI": "10.1/published"}]}},
            ])

            doi, url = await pub_service._check_chemrxiv("2020-abc")

        assert doi == "10.1/published"
        assert url == "https://doi.org/10.1/published"


# ---------------------------------------------------------------------------
# PublicationService._check_arxiv  (httpx + Crossref fallback)
# ---------------------------------------------------------------------------

ARXIV_URL = "http://export.arxiv.org/api/query"


class TestCheckArxiv:
    @pytest.mark.asyncio
    async def test_returns_doi_when_arxiv_metadata_contains_it(self, pub_service):
        async with respx.mock(assert_all_called=False) as router:
            router.get(url__startswith=ARXIV_URL).mock(
                return_value=httpx.Response(200, text="<entry><doi>10.1038/x</doi></entry>"),
            )

            doi, url = await pub_service._check_arxiv("1706.03762")

        assert doi == "10.1038/x"
        assert url == "https://doi.org/10.1038/x"

    @pytest.mark.asyncio
    async def test_falls_back_to_europe_pmc(self, pub_service):
        async with respx.mock() as router:
            router.get(url__startswith=ARXIV_URL).mock(
                return_value=httpx.Response(200, text="<entry>no doi tag</entry>"),
            )
            router.get(url__startswith=EPMC_URL).mock(
                return_value=httpx.Response(200, json={
                    "hitCount": 1,
                    "resultList": {"result": [{"source": "MED", "doi": "10.1126/pmc.abc"}]},
                }),
            )

            doi, url = await pub_service._check_arxiv("1706.03762")

        assert doi == "10.1126/pmc.abc"

    @pytest.mark.asyncio
    async def test_falls_back_to_crossref_title_search(self, pub_service):
        arxiv_xml = "<entry><title>A Great Paper Title On Attention</title></entry>"
        async with respx.mock() as router:
            router.get(url__startswith=ARXIV_URL).mock(
                return_value=httpx.Response(200, text=arxiv_xml),
            )
            router.get(url__startswith=EPMC_URL).mock(
                return_value=httpx.Response(200, json={"hitCount": 0}),
            )
            pub_service.crossref.works = MagicMock(return_value={
                "message": {"items": [
                    {"title": ["a great paper title on attention"], "DOI": "10.1234/published"}
                ]},
            })

            doi, url = await pub_service._check_arxiv("1706.03762")

        assert doi == "10.1234/published"

    @pytest.mark.asyncio
    async def test_no_doi_no_pmc_short_title_returns_none(self, pub_service):
        async with respx.mock() as router:
            router.get(url__startswith=ARXIV_URL).mock(
                return_value=httpx.Response(200, text="<entry><title>tiny</title></entry>"),
            )
            router.get(url__startswith=EPMC_URL).mock(
                return_value=httpx.Response(200, json={"hitCount": 0}),
            )

            doi, url = await pub_service._check_arxiv("1706.03762")

        assert doi is None and url is None

    @pytest.mark.asyncio
    async def test_arxiv_http_error_returns_none(self, pub_service):
        async with respx.mock(assert_all_called=False) as router:
            router.get(url__startswith=ARXIV_URL).mock(
                return_value=httpx.Response(500),
            )

            doi, url = await pub_service._check_arxiv("1706.03762")

        assert doi is None and url is None


# ---------------------------------------------------------------------------
# Crossref-backed methods (mock self.crossref directly; no respx needed)
# ---------------------------------------------------------------------------

class TestGetCitations:
    @pytest.mark.asyncio
    async def test_returns_citation_count(self, pub_service):
        pub_service.crossref.works = MagicMock(return_value={
            "message": {"is-referenced-by-count": 42}
        })

        count = await pub_service.get_citations("https://doi.org/10.1234/abc")
        assert count == 42

    @pytest.mark.asyncio
    async def test_no_doi_returns_none(self, pub_service):
        assert await pub_service.get_citations("https://example.com/no-doi") is None

    @pytest.mark.asyncio
    async def test_negative_count_returns_none(self, pub_service):
        pub_service.crossref.works = MagicMock(return_value={
            "message": {"is-referenced-by-count": -1}
        })
        assert await pub_service.get_citations("https://doi.org/10.1234/abc") is None

    @pytest.mark.asyncio
    async def test_crossref_exception_returns_none_after_retries(self, pub_service):
        pub_service.crossref.works = MagicMock(side_effect=ValueError("crossref down"))
        assert await pub_service.get_citations("https://doi.org/10.1234/abc") is None

    @pytest.mark.asyncio
    async def test_url_encoded_doi_is_cleaned(self, pub_service):
        captured = {}

        def fake_works(ids):
            captured["ids"] = ids
            return {"message": {"is-referenced-by-count": 7}}

        pub_service.crossref.works = MagicMock(side_effect=fake_works)
        # %2F is the URL-encoded slash — should be unquoted before the API call.
        await pub_service.get_citations("https://doi.org/10.1234%2Fabc")
        assert captured["ids"] == ["10.1234/abc"]


class TestGetJournalInfo:
    @pytest.mark.asyncio
    async def test_returns_journal_issn(self, pub_service):
        pub_service.crossref.works = MagicMock(return_value={
            "message": {
                "container-title": ["Nature"],
                "ISSN": ["0028-0836"],
                "issn-type": [{"type": "electronic", "value": "1476-4687"}],
            }
        })

        info = await pub_service.get_journal_info("https://doi.org/10.1038/n12345")
        assert info == {
            "journal": "Nature",
            "issn": "0028-0836",
            "issn-type": [{"type": "electronic", "value": "1476-4687"}],
        }

    @pytest.mark.asyncio
    async def test_missing_container_title_returns_none_journal(self, pub_service):
        pub_service.crossref.works = MagicMock(return_value={"message": {"ISSN": ["x"]}})

        info = await pub_service.get_journal_info("https://doi.org/10.1/x")
        assert info["journal"] is None
        assert info["issn"] == "x"

    @pytest.mark.asyncio
    async def test_no_doi_returns_none(self, pub_service):
        assert await pub_service.get_journal_info("not-a-doi") is None


class TestGetDoiTitle:
    @pytest.mark.asyncio
    async def test_returns_title(self, pub_service):
        pub_service.crossref.works = MagicMock(return_value={
            "message": {"title": ["Attention Is All You Need"]}
        })
        assert await pub_service._get_doi_title("10.48550/arxiv.1706.03762") == "Attention Is All You Need"

    @pytest.mark.asyncio
    async def test_no_message_returns_none(self, pub_service):
        pub_service.crossref.works = MagicMock(return_value={})
        assert await pub_service._get_doi_title("10.1/x") is None

    @pytest.mark.asyncio
    async def test_strips_doi_url_prefix_before_lookup(self, pub_service):
        captured = {}

        def fake_works(ids):
            captured["ids"] = ids
            return {"message": {"title": ["X"]}}

        pub_service.crossref.works = MagicMock(side_effect=fake_works)
        await pub_service._get_doi_title("https://doi.org/10.1/x")
        assert captured["ids"] == ["10.1/x"]


class TestSearchCrossrefForTitle:
    @pytest.mark.asyncio
    async def test_first_query_exact_match(self, pub_service):
        pub_service.crossref.works = MagicMock(return_value={
            "message": {"items": [{"title": ["my title"], "DOI": "10.1/found"}]}
        })

        doi = await pub_service._search_crossref_for_title("My Title")
        assert doi == "10.1/found"

    @pytest.mark.asyncio
    async def test_falls_back_to_quoted_query(self, pub_service):
        pub_service.crossref.works = MagicMock(side_effect=[
            {"message": {"items": [{"title": ["different title"], "DOI": "10.1/wrong"}]}},
            {"message": {"items": [{"title": ["exact title"], "DOI": "10.1/right"}]}},
        ])

        doi = await pub_service._search_crossref_for_title("Exact Title")
        assert doi == "10.1/right"

    @pytest.mark.asyncio
    async def test_excludes_supplied_preprint_doi(self, pub_service):
        # The only match has the same DOI as the preprint, so it should be skipped.
        pub_service.crossref.works = MagicMock(return_value={
            "message": {"items": [{"title": ["my title"], "DOI": "10.preprint/x"}]}
        })

        doi = await pub_service._search_crossref_for_title("My Title", preprint_doi="10.PREPRINT/X")
        assert doi is None

    @pytest.mark.asyncio
    async def test_no_match_returns_none(self, pub_service):
        pub_service.crossref.works = MagicMock(return_value={
            "message": {"items": [{"title": ["something else"], "DOI": "10.1/x"}]}
        })
        assert await pub_service._search_crossref_for_title("My Title") is None

    @pytest.mark.asyncio
    async def test_crossref_exception_returns_none(self, pub_service):
        pub_service.crossref.works = MagicMock(side_effect=RuntimeError("boom"))
        assert await pub_service._search_crossref_for_title("Any") is None
