"""Shared fixtures for the backend test suite.

Why an autouse `fast_async_sleep`: services.py wires `APIRateLimiter` to wait
between calls and decorates several methods with `backoff.on_exception(...,
max_time=60)`. With real sleeps a single retry-exercising test can burn 7+
seconds; the entire HTTP-test file would push into the minutes. We replace
`asyncio.sleep` with a no-op so rate-limiter pauses and backoff intervals
collapse to zero in tests. Production code paths are unaffected.
"""
import asyncio
from unittest.mock import MagicMock

import pytest

from models import Config
from services import PublicationService, RepositoryService


@pytest.fixture(autouse=True)
def fast_async_sleep(monkeypatch):
    async def _noop(*_a, **_kw):
        return None
    monkeypatch.setattr(asyncio, "sleep", _noop)


@pytest.fixture
def config():
    return Config(email="test@example.com", github_token="fake-token", timeout=5)


@pytest.fixture
def pub_service(config, monkeypatch):
    # Stub Crossref/Impactor at the class level so __init__ doesn't try real
    # network calls or load JIF dumps from disk.
    monkeypatch.setattr("services.Crossref", lambda **kw: MagicMock())
    monkeypatch.setattr("services.Impactor", lambda: MagicMock())
    return PublicationService(config)


@pytest.fixture
def repo_service(config):
    return RepositoryService(config)


@pytest.fixture
def mock_supabase():
    """A MagicMock standing in for `supabase.Client`. All chain methods
    (`table().select().eq().execute()` etc.) return the same chain so tests
    can drive the terminal `.execute()` return value directly."""
    client = MagicMock(name="supabase_client")
    chain = MagicMock(name="supabase_chain")
    for method in ("select", "insert", "update", "delete", "eq", "neq",
                   "gt", "gte", "lt", "lte", "like", "ilike", "in_", "is_",
                   "filter", "or_", "and_", "not_", "order", "range", "limit"):
        setattr(chain, method, MagicMock(return_value=chain))
    # `.not_.is_(...)` chains through an inner namespace
    chain.not_ = MagicMock(name="not_ns")
    chain.not_.is_ = MagicMock(return_value=chain)
    chain.execute = MagicMock(return_value=MagicMock(data=[], count=0))
    client.table = MagicMock(return_value=chain)
    client._chain = chain  # exposed for tests that want to swap .execute return
    return client


@pytest.fixture
def updater(config, mock_supabase, monkeypatch):
    """`DatabaseUpdater` wired against a MagicMock supabase. Services are
    stubbed (Crossref/Impactor) the same way `pub_service` does."""
    monkeypatch.setattr("services.Crossref", lambda **kw: MagicMock())
    monkeypatch.setattr("services.Impactor", lambda: MagicMock())
    from update_database import DatabaseUpdater
    return DatabaseUpdater(config, mock_supabase, dry_run=False)


@pytest.fixture
def dry_updater(config, mock_supabase, monkeypatch):
    """Same as `updater` but in dry-run mode."""
    monkeypatch.setattr("services.Crossref", lambda **kw: MagicMock())
    monkeypatch.setattr("services.Impactor", lambda: MagicMock())
    from update_database import DatabaseUpdater
    return DatabaseUpdater(config, mock_supabase, dry_run=True)
