"""Tests for `DatabaseUpdater._fetch_packages` — the only nontrivial logic in
the data-access layer. Covers:

* fast-path for `{"ids": [...]}` (single query, no pagination)
* paginated path when no filter or only `limit` is given
* `limit` smaller than a page (one query, capped)
* `limit` spanning multiple pages
* the "fewer rows than page_size means no more data" termination
* error path (supabase returns `data=None`)
"""
import pytest
from unittest.mock import MagicMock


def _row(i):
    return {"id": f"pkg-{i}", "package_name": f"P{i}"}


@pytest.mark.asyncio
async def test_fetch_by_ids_uses_single_query(updater, mock_supabase):
    rows = [_row(1), _row(2)]
    mock_supabase._chain.execute.return_value = MagicMock(data=rows)

    out = await updater._fetch_packages({"ids": ["pkg-1", "pkg-2"]})

    assert out == rows
    # Single execute, no pagination loop
    assert mock_supabase._chain.execute.call_count == 1


@pytest.mark.asyncio
async def test_fetch_by_ids_returns_empty_on_data_none(updater, mock_supabase):
    mock_supabase._chain.execute.return_value = MagicMock(data=None)
    out = await updater._fetch_packages({"ids": ["pkg-1"]})
    assert out == []


@pytest.mark.asyncio
async def test_fetch_no_filter_paginates_until_short_page(updater, mock_supabase):
    # First page returns 1000 rows (full page), second returns 10 (short → stop).
    page1 = [_row(i) for i in range(1000)]
    page2 = [_row(i) for i in range(1000, 1010)]
    mock_supabase._chain.execute.side_effect = [
        MagicMock(data=page1),
        MagicMock(data=page2),
    ]

    out = await updater._fetch_packages(None)

    assert len(out) == 1010
    assert mock_supabase._chain.execute.call_count == 2
    # range() was called with (0, 999) then (1000, 1999)
    range_calls = [c for c in mock_supabase._chain.range.call_args_list]
    assert range_calls[0].args == (0, 999)
    assert range_calls[1].args == (1000, 1999)


@pytest.mark.asyncio
async def test_fetch_with_limit_smaller_than_page_size(updater, mock_supabase):
    rows = [_row(i) for i in range(25)]
    mock_supabase._chain.execute.return_value = MagicMock(data=rows)

    out = await updater._fetch_packages({"limit": 25})

    assert len(out) == 25
    # Should only call execute once and request just 25 rows
    assert mock_supabase._chain.execute.call_count == 1
    mock_supabase._chain.range.assert_called_with(0, 24)


@pytest.mark.asyncio
async def test_fetch_with_limit_spanning_pages(updater, mock_supabase):
    # limit=1500 → first page of 1000, second page capped at 500.
    page1 = [_row(i) for i in range(1000)]
    page2 = [_row(i) for i in range(1000, 1500)]
    mock_supabase._chain.execute.side_effect = [
        MagicMock(data=page1),
        MagicMock(data=page2),
    ]

    out = await updater._fetch_packages({"limit": 1500})

    assert len(out) == 1500
    assert mock_supabase._chain.execute.call_count == 2
    range_calls = mock_supabase._chain.range.call_args_list
    assert range_calls[0].args == (0, 999)
    assert range_calls[1].args == (1000, 1499)


@pytest.mark.asyncio
async def test_fetch_paginated_data_none_returns_empty(updater, mock_supabase):
    mock_supabase._chain.execute.return_value = MagicMock(data=None)
    out = await updater._fetch_packages(None)
    assert out == []


@pytest.mark.asyncio
async def test_fetch_with_github_only_filter_applies_filters(updater, mock_supabase):
    mock_supabase._chain.execute.return_value = MagicMock(data=[_row(1)])
    await updater._fetch_packages({"limit": 5, "github_only": True})
    # The filter builder was applied: `not_.is_("repo_link", "null")` and `like(...)`.
    mock_supabase._chain.not_.is_.assert_any_call("repo_link", "null")
    mock_supabase._chain.like.assert_any_call("repo_link", "%github.com%")


@pytest.mark.asyncio
async def test_fetch_raises_on_unexpected_exception(updater, mock_supabase):
    mock_supabase._chain.execute.side_effect = RuntimeError("DB down")
    with pytest.raises(RuntimeError, match="DB down"):
        await updater._fetch_packages({"ids": ["pkg-1"]})
