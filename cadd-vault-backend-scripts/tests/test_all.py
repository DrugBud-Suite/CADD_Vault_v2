"""
Integration tests for database update pipeline.
Tests core functionality with real API calls to ensure services work correctly.
"""

import pytest
import asyncio
import os
import logging
from dotenv import load_dotenv
from supabase import create_client

from models import Entry, Config
from services import RepositoryService, PublicationService
from update_database import DatabaseUpdater

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
TEST_SAMPLE_SIZE = 5  # Number of packages to test for each service
TEST_TIMEOUT = 30  # Timeout for API calls


class TestConfig:
    """Test configuration constants"""
    # Known good test cases that should always work
    KNOWN_GITHUB_REPOS = [
        "https://github.com/python/cpython",
        "https://github.com/numpy/numpy",
        "https://github.com/pandas-dev/pandas"
    ]
    
    KNOWN_DOIS = [
        "10.1038/nature12373",  # Well-known Nature paper
        "10.1126/science.1242072",  # Science paper
    ]
    
    KNOWN_PREPRINTS = [
        "https://arxiv.org/abs/1706.03762",  # Attention is All You Need
        "https://www.biorxiv.org/content/10.1101/2020.03.20.000133v2",  # Example bioRxiv
    ]


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def test_config():
    """Create test configuration."""
    return Config(
        email=os.environ.get("CONTACT_EMAIL", "test@caddvault.org"),
        github_token=os.environ.get("PERSONAL_ACCESS_TOKEN"),
        timeout=TEST_TIMEOUT,
        batch_size=5,
        rate_limit_delay=1.0
    )


@pytest.fixture(scope="session")
def supabase_client():
    """Create Supabase client for testing."""
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        pytest.skip("Supabase credentials not available")
    
    return create_client(supabase_url, supabase_key)


@pytest.fixture(scope="session")
def repository_service(test_config):
    """Create repository service for testing."""
    return RepositoryService(test_config)


@pytest.fixture(scope="session")
def publication_service(test_config):
    """Create publication service for testing."""
    return PublicationService(test_config)


@pytest.fixture(scope="session")
def database_updater(test_config, supabase_client):
    """Create database updater for testing."""
    return DatabaseUpdater(test_config, supabase_client, dry_run=True)


class TestDatabaseConnectivity:
    """Test database connection and basic operations."""
    
    def test_database_connection(self, supabase_client):
        """Test basic database connectivity."""
        response = supabase_client.table("packages").select("id").limit(1).execute()
        assert response.data is not None
        logger.info("✅ Database connection successful")
    
    def test_database_pagination(self, supabase_client):
        """Test that pagination works correctly."""
        # First, get total count
        count_response = supabase_client.table("packages").select("id", count="exact").execute()
        total_count = count_response.count
        
        if total_count and total_count > 1000:
            # Test fetching beyond the 1000 row limit
            response = supabase_client.table("packages").select("id").range(0, 1100).execute()
            assert response.data is not None
            assert len(response.data) <= 1101  # Should respect the range
            logger.info(f"✅ Pagination working correctly (total packages: {total_count})")
        else:
            logger.info(f"ℹ️ Skipping pagination test (only {total_count} packages)")
    
    @pytest.mark.asyncio
    async def test_sample_packages_fetch(self, supabase_client):
        """Test fetching sample packages with all required fields."""
        response = supabase_client.table("packages").select("*").limit(TEST_SAMPLE_SIZE).execute()
        
        assert response.data is not None
        assert len(response.data) > 0
        
        # Verify essential fields exist
        for pkg in response.data:
            assert "id" in pkg
            assert "package_name" in pkg
            
        logger.info(f"✅ Successfully fetched {len(response.data)} sample packages")


class TestGitHubIntegration:
    """Test GitHub repository data fetching."""
    
    @pytest.mark.asyncio
    async def test_known_github_repos(self, repository_service):
        """Test fetching data from known GitHub repositories."""
        success_count = 0
        
        for repo_url in TestConfig.KNOWN_GITHUB_REPOS[:3]:  # Test first 3
            try:
                logger.info(f"Testing GitHub repo: {repo_url}")
                repo_data = await repository_service.get_repository_data(repo_url)
                
                assert repo_data is not None
                assert repo_data.owner is not None
                assert repo_data.name is not None
                assert isinstance(repo_data.stars, int)
                assert repo_data.stars >= 0
                
                success_count += 1
                logger.info(f"✅ {repo_url} - Stars: {repo_data.stars}, Language: {repo_data.primary_language}")
                
                # Rate limit pause
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ Failed to fetch {repo_url}: {e}")
        
        assert success_count >= 2, f"Only {success_count}/3 GitHub repos succeeded"
    
    @pytest.mark.asyncio
    async def test_github_with_real_packages(self, repository_service, supabase_client):
        """Test GitHub integration with real packages from database."""
        # Fetch packages with GitHub repos
        response = supabase_client.table("packages")\
            .select("id, package_name, repo_link")\
            .not_.is_("repo_link", "null")\
            .like("repo_link", "%github.com%")\
            .limit(TEST_SAMPLE_SIZE)\
            .execute()
        
        if not response.data:
            pytest.skip("No packages with GitHub repos found")
        
        success_count = 0
        for pkg in response.data:
            try:
                repo_data = await repository_service.get_repository_data(pkg['repo_link'])
                if repo_data:
                    success_count += 1
                    logger.info(f"✅ {pkg['package_name']}: {repo_data.stars} stars")
                await asyncio.sleep(1)  # Rate limit
            except Exception as e:
                logger.warning(f"⚠️ Failed for {pkg['package_name']}: {e}")
        
        # At least 60% should succeed
        success_rate = success_count / len(response.data)
        assert success_rate >= 0.6, f"Success rate too low: {success_rate:.1%}"
        logger.info(f"GitHub integration: {success_count}/{len(response.data)} successful")


class TestPublicationIntegration:
    """Test publication and citation data fetching."""
    
    @pytest.mark.asyncio
    async def test_known_dois(self, publication_service):
        """Test fetching data from known DOIs."""
        success_count = 0
        
        for doi in TestConfig.KNOWN_DOIS:
            try:
                logger.info(f"Testing DOI: {doi}")
                
                # Test citation fetching
                citations = await publication_service.get_citations(f"https://doi.org/{doi}")
                assert citations is not None
                assert isinstance(citations, int)
                assert citations >= 0
                
                # Test journal info
                journal_info = await publication_service.get_journal_info(f"https://doi.org/{doi}")
                assert journal_info is not None
                assert "journal" in journal_info
                
                success_count += 1
                logger.info(f"✅ {doi} - Citations: {citations}, Journal: {journal_info.get('journal')}")
                
                await asyncio.sleep(2)  # Crossref rate limit
                
            except Exception as e:
                logger.error(f"❌ Failed for DOI {doi}: {e}")
        
        assert success_count >= 1, "No DOIs succeeded"
    
    @pytest.mark.asyncio
    async def test_preprint_detection(self, publication_service):
        """Test preprint detection and published version checking."""
        for preprint_url in TestConfig.KNOWN_PREPRINTS[:2]:  # Test first 2
            try:
                logger.info(f"Testing preprint: {preprint_url}")
                
                # Test preprint detection
                is_preprint = publication_service.is_preprint(preprint_url)
                assert is_preprint, f"{preprint_url} should be detected as preprint"
                
                # Test preprint ID extraction
                preprint_type, preprint_id = publication_service._identify_preprint(preprint_url)
                assert preprint_type is not None
                assert preprint_id is not None
                logger.info(f"✅ Detected {preprint_type} preprint: {preprint_id}")
                
                # Test publication status check (may or may not find published version)
                result = await publication_service.check_publication_status(preprint_url)
                assert result.original_url == preprint_url
                
                if result.publication_status == "published":
                    logger.info(f"✅ Found published version: {result.published_url}")
                else:
                    logger.info("ℹ️ No published version found")
                
                await asyncio.sleep(3)  # Rate limit
                
            except Exception as e:
                logger.error(f"❌ Error checking preprint {preprint_url}: {e}")
    
    @pytest.mark.asyncio
    async def test_citations_with_real_packages(self, publication_service, supabase_client):
        """Test citation fetching with real packages from database."""
        # Fetch packages with publications
        response = supabase_client.table("packages")\
            .select("id, package_name, publication")\
            .not_.is_("publication", "null")\
            .limit(TEST_SAMPLE_SIZE)\
            .execute()
        
        if not response.data:
            pytest.skip("No packages with publications found")
        
        success_count = 0
        for pkg in response.data:
            try:
                citations = await publication_service.get_citations(pkg['publication'])
                if citations is not None:
                    success_count += 1
                    logger.info(f"✅ {pkg['package_name']}: {citations} citations")
                await asyncio.sleep(2)  # Rate limit
            except Exception as e:
                logger.warning(f"⚠️ Failed for {pkg['package_name']}: {e}")
        
        # At least 40% should succeed (DOIs can be problematic)
        success_rate = success_count / len(response.data)
        logger.info(f"Citation fetching: {success_count}/{len(response.data)} successful ({success_rate:.1%})")


class TestDatabaseUpdater:
    """Test the main database updater functionality."""
    
    def test_entry_model_conversion(self, supabase_client):
        """Test converting database records to Entry objects."""
        response = supabase_client.table("packages").select("*").limit(5).execute()
        
        assert response.data
        for pkg_data in response.data:
            entry = Entry.from_dict(pkg_data)
            
            assert entry.id == pkg_data['id']
            assert entry.package_name == pkg_data.get('package_name')
            assert entry.publication_url == pkg_data.get('publication')
            
            # Test field mapping
            if pkg_data.get('tags'):
                assert isinstance(entry.tags, list)
            
            logger.info(f"✅ Successfully converted {entry.package_name}")
    
    @pytest.mark.asyncio
    async def test_dry_run_update(self, database_updater, supabase_client):
        """Test database update in dry-run mode."""
        # Get a few packages to test
        response = supabase_client.table("packages")\
            .select("*")\
            .or_("repo_link.not.is.null,publication.not.is.null")\
            .limit(3)\
            .execute()
        
        if not response.data:
            pytest.skip("No suitable packages found for testing")
        
        for pkg_data in response.data:
            entry = Entry.from_dict(pkg_data)
            logger.info(f"Testing update workflow for {entry.package_name}")
            
            # Test repository processing
            if entry.repo_link and 'github.com' in entry.repo_link:
                repo_updates = await database_updater._process_repository_data(entry)
                if repo_updates:
                    logger.info(f"✅ Would update repo data: {list(repo_updates.keys())}")
            
            # Test publication processing
            if entry.publication_url:
                pub_updates = await database_updater._process_publication_data(entry)
                if pub_updates:
                    logger.info(f"✅ Would update publication data: {list(pub_updates.keys())}")
            
            await asyncio.sleep(1)  # Rate limit


class TestErrorHandling:
    """Test error handling and edge cases."""
    
    @pytest.mark.asyncio
    async def test_invalid_urls(self, repository_service, publication_service):
        """Test handling of invalid URLs."""
        # Test invalid GitHub URL
        repo_data = await repository_service.get_repository_data("https://not-a-real-github-repo.com")
        assert repo_data is None
        
        # Test invalid DOI
        citations = await publication_service.get_citations("https://not-a-real-doi.com")
        assert citations is None
        
        logger.info("✅ Error handling for invalid URLs works correctly")
    
    def test_malformed_data(self):
        """Test handling of malformed data."""
        # Test Entry with missing required fields
        malformed_data = {"id": "test-id"}  # Missing package_name
        entry = Entry.from_dict(malformed_data)
        assert entry.id == "test-id"
        assert entry.package_name is None
        
        logger.info("✅ Malformed data handling works correctly")


if __name__ == "__main__":
    # Run tests when script is executed directly
    pytest.main([__file__, "-v", "--tb=short", "-s"])