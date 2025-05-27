# test_integration.py
import pytest
import os
from dotenv import load_dotenv
from supabase import create_client
from models import Config
from services import RepositoryService, PublicationService

load_dotenv()

@pytest.fixture(scope="session")
def supabase_client():
    url = os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        pytest.skip("Supabase credentials not available")
    return create_client(url, key)

@pytest.fixture(scope="session")
def config():
    return Config(
        email=os.environ.get("CONTACT_EMAIL", "test@caddvault.org"),
        github_token=os.environ.get("PERSONAL_ACCESS_TOKEN"),
        timeout=30,
        batch_size=5
    )

def test_database_connection(supabase_client):
    """Test basic database connectivity."""
    response = supabase_client.table("packages").select("id").limit(1).execute()
    assert response.data is not None

def test_github_service(config):
    """Test GitHub service initialization."""
    service = RepositoryService(config)
    assert service is not None
    assert service.headers.get("Authorization") is not None

def test_publication_service(config):
    """Test publication service initialization."""
    service = PublicationService(config)
    assert service is not None
    assert service.crossref is not None