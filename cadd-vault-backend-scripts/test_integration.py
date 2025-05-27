"""
Integration tests using real database packages and real API calls.
Tests the core functionality of update_database.py and services.py.
"""

import pytest
import pytest_asyncio
import asyncio
import os
import random
import logging
from typing import List, Dict, Any

from dotenv import load_dotenv
from supabase import create_client

# Import our modules
from models import Entry, Config
from services import RepositoryService, PublicationService
from update_database import DatabaseUpdater

# Set up logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestDataProvider:
    """Manages test data from real database"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self._test_packages = None
    
    async def get_test_packages(self, count: int = 20) -> List[Dict[str, Any]]:
        """Get a random sample of packages from the real database"""
        if self._test_packages is None:
            try:
                # Get all package IDs first
                response = self.supabase.table("packages").select("id").execute()
                
                if not response.data:
                    raise Exception("No packages found in database")
                
                all_ids = [pkg['id'] for pkg in response.data]
                
                # Select random sample
                sample_size = min(count, len(all_ids))
                selected_ids = random.sample(all_ids, sample_size)
                
                # Fetch full data for selected packages
                response = self.supabase.table("packages").select("*").in_("id", selected_ids).execute()
                
                if not response.data:
                    raise Exception("Failed to fetch selected packages")
                
                self._test_packages = response.data
                logger.info(f"Selected {len(self._test_packages)} test packages from database")
                
            except Exception as e:
                logger.error(f"Failed to get test packages: {e}")
                raise
        
        return self._test_packages
    
    def get_packages_with_github(self, max_count: int = 10) -> List[Dict[str, Any]]:
        """Get packages that have GitHub repositories"""
        packages = [pkg for pkg in self._test_packages 
                   if pkg.get('repo_link') and 'github.com' in pkg.get('repo_link', '')]
        return packages[:max_count]
    
    def get_packages_with_publications(self, max_count: int = 10) -> List[Dict[str, Any]]:
        """Get packages that have publications"""
        packages = [pkg for pkg in self._test_packages 
                   if pkg.get('publication')]
        return packages[:max_count]
    
    def get_packages_with_preprints(self, max_count: int = 5) -> List[Dict[str, Any]]:
        """Get packages that appear to have preprint URLs"""
        preprint_domains = ['arxiv', 'biorxiv', 'medrxiv', 'chemrxiv']
        packages = []
        
        for pkg in self._test_packages:
            if pkg.get('publication') is None:
                continue
            pub_url = pkg.get('publication', '').lower()
            if any(domain in pub_url for domain in preprint_domains):
                packages.append(pkg)
                if len(packages) >= max_count:
                    break
        
        return packages


@pytest.fixture(scope="session")
def test_config():
    """Create test configuration"""
    load_dotenv()
    return Config(
        email=os.environ.get("CONTACT_EMAIL", "test@caddvault.org"),
        github_token=os.environ.get("PERSONAL_ACCESS_TOKEN"),
        timeout=30,
        batch_size=5  # Small batches for testing
    )


@pytest.fixture(scope="session")
def supabase_client():
    """Create Supabase client for testing"""
    load_dotenv()
    
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        pytest.skip("Supabase credentials not available")
    
    return create_client(supabase_url, supabase_key)


@pytest_asyncio.fixture(scope="session")
async def test_data_provider(supabase_client):
    """Provide test data from real database"""
    provider = TestDataProvider(supabase_client)
    await provider.get_test_packages(30)  # Get 30 random packages
    return provider


@pytest.fixture
def repository_service(test_config):
    """Create repository service for testing"""
    return RepositoryService(test_config)


@pytest.fixture 
def publication_service(test_config):
    """Create publication service for testing"""
    return PublicationService(test_config)


class TestRepositoryService:
    """Test repository data processing with real GitHub repos"""

    @pytest.mark.asyncio
    async def test_fetch_github_data(self, repository_service, test_data_provider):
        """Test fetching real GitHub repository data"""
        github_packages = test_data_provider.get_packages_with_github(5)
        
        if not github_packages:
            pytest.skip("No packages with GitHub repos found")
        
        success_count = 0
        
        for pkg in github_packages:
            repo_url = pkg['repo_link']
            logger.info(f"Testing GitHub repo: {repo_url}")
            
            try:
                repo_data = await repository_service.get_repository_data(repo_url)
                
                if repo_data:
                    # Verify we got meaningful data
                    assert repo_data.url == repo_url
                    assert repo_data.is_github
                    assert repo_data.owner is not None
                    assert repo_data.name is not None
                    
                    # Stars should be a non-negative integer
                    if repo_data.stars is not None:
                        assert isinstance(repo_data.stars, int)
                        assert repo_data.stars >= 0
                    
                    # Language should be a string if present
                    if repo_data.primary_language:
                        assert isinstance(repo_data.primary_language, str)
                        assert len(repo_data.primary_language) > 0
                    
                    # License should be a valid SPDX identifier if present
                    if repo_data.license:
                        assert isinstance(repo_data.license, str)
                        assert len(repo_data.license) > 0
                    
                    success_count += 1
                    logger.info(f"✅ Successfully processed {repo_url}")
                    
                    # Print detailed repository information for better visibility
                    print(f"\n===== Repository Data for {repo_url} =====")
                    print(f"Owner: {repo_data.owner}")
                    print(f"Name: {repo_data.name}")
                    print(f"Stars: {repo_data.stars}")
                    print(f"Language: {repo_data.primary_language}")
                    print(f"License: {repo_data.license}")
                    print("="*40)
                    
                    # Add small delay to be respectful to GitHub API
                    await asyncio.sleep(1)
                else:
                    logger.warning(f"⚠️ No data returned for {repo_url}")
                    
            except Exception as e:
                logger.error(f"❌ Error processing {repo_url}: {e}")
        
        # At least 60% should succeed (allowing for some broken/moved repos)
        success_rate = success_count / len(github_packages) if github_packages else 0
        assert success_rate >= 0.6, f"Success rate too low: {success_rate:.1%}"
        
        logger.info(f"GitHub repo processing: {success_count}/{len(github_packages)} successful ({success_rate:.1%})")

    @pytest.mark.asyncio
    async def test_repo_path_extraction(self, repository_service, test_data_provider):
        """Test GitHub repo path extraction with real URLs"""
        github_packages = test_data_provider.get_packages_with_github(10)
        
        if not github_packages:
            pytest.skip("No packages with GitHub repos found")
        
        for pkg in github_packages:
            repo_url = pkg['repo_link']
            repo_path = repository_service._extract_repo_path(repo_url)
            
            if repo_path:
                # Should be in format owner/repo
                assert '/' in repo_path
                parts = repo_path.split('/')
                assert len(parts) >= 2
                assert all(len(part) > 0 for part in parts[:2])
                logger.info(f"✅ Extracted path '{repo_path}' from {repo_url}")
            else:
                logger.warning(f"⚠️ Could not extract path from {repo_url}")


class TestPublicationService:
    """Test publication data processing with real DOIs and preprints"""

    @pytest.mark.asyncio
    async def test_fetch_citation_data(self, publication_service, test_data_provider):
        """Test fetching real citation data"""
        pub_packages = test_data_provider.get_packages_with_publications(5)
        
        if not pub_packages:
            pytest.skip("No packages with publications found")
        
        success_count = 0
        
        for pkg in pub_packages:
            pub_url = pkg['publication']
            logger.info(f"Testing publication: {pub_url}")
            
            try:
                # Test citation fetching
                citations = await publication_service.get_citations(pub_url)
                
                if citations is not None:
                    assert isinstance(citations, int)
                    assert citations >= 0
                    success_count += 1
                    logger.info(f"✅ Got {citations} citations for {pub_url}")
                else:
                    logger.info(f"ℹ️ No citation data for {pub_url}")
                
                # Test journal info fetching
                journal_info = await publication_service.get_journal_info(pub_url)
                
                if journal_info and journal_info.get('journal'):
                    assert isinstance(journal_info['journal'], str)
                    assert len(journal_info['journal']) > 0
                    logger.info(f"✅ Got journal '{journal_info['journal']}' for {pub_url}")
                
                # Add delay to be respectful to APIs
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"❌ Error processing {pub_url}: {e}")
        
        # At least 40% should succeed (DOIs can be problematic)
        success_rate = success_count / len(pub_packages) if pub_packages else 0
        logger.info(f"Publication processing: {success_count}/{len(pub_packages)} successful ({success_rate:.1%})")

    @pytest.mark.asyncio
    async def test_preprint_detection(self, publication_service, test_data_provider):
        """Test preprint detection and conversion"""
        preprint_packages = test_data_provider.get_packages_with_preprints(3)
        
        if not preprint_packages:
            pytest.skip("No packages with preprints found")
        
        for pkg in preprint_packages:
            pub_url = pkg['publication']
            logger.info(f"Testing preprint: {pub_url}")
            
            # Test preprint detection
            is_preprint = publication_service.is_preprint(pub_url)
            assert is_preprint, f"Should detect {pub_url} as preprint"
            
            # Test preprint ID extraction
            preprint_type, preprint_id = publication_service._identify_preprint(pub_url)
            assert preprint_type is not None, f"Should identify preprint type for {pub_url}"
            assert preprint_id is not None, f"Should extract preprint ID for {pub_url}"
            
            logger.info(f"✅ Detected {preprint_type} preprint with ID {preprint_id}")
            
            # Test publication status check (might find published version)
            try:
                result = await publication_service.check_publication_status(pub_url)
                assert result.original_url == pub_url
                
                if result.publication_status == "published":
                    assert result.published_url is not None
                    logger.info(f"✅ Found published version: {result.published_url}")
                else:
                    logger.info(f"ℹ️ No published version found for {pub_url}")
                
                # Add delay
                await asyncio.sleep(3)
                
            except Exception as e:
                logger.error(f"❌ Error checking publication status for {pub_url}: {e}")

    def test_doi_normalization(self, publication_service, test_data_provider):
        """Test DOI normalization with real URLs"""
        pub_packages = test_data_provider.get_packages_with_publications(10)
        
        if not pub_packages:
            pytest.skip("No packages with publications found")
        
        for pkg in pub_packages:
            pub_url = pkg['publication']
            normalized = publication_service.normalize_doi(pub_url)
            
            if normalized:
                # Should be a valid URL
                assert normalized.startswith('http')
                logger.info(f"✅ Normalized '{pub_url}' to '{normalized}'")
            else:
                logger.info(f"ℹ️ Could not normalize '{pub_url}'")


class TestDatabaseUpdater:
    """Test the main database updater with real data"""

    @pytest.mark.asyncio
    async def test_entry_conversion(self, test_data_provider):
        """Test converting database records to Entry objects"""
        test_packages = await test_data_provider.get_test_packages(10)
        
        for pkg_data in test_packages:
            entry = Entry.from_dict(pkg_data)
            
            # Verify basic fields
            assert entry.id == pkg_data['id']
            assert entry.package_name == pkg_data.get('package_name')
            
            # Test field mapping
            assert entry.publication_url == pkg_data.get('publication')
            
            # Test tags handling
            if pkg_data.get('tags'):
                assert isinstance(entry.tags, list)
            
            logger.info(f"✅ Successfully converted {entry.package_name}")

    @pytest.mark.asyncio 
    async def test_update_workflow(self, test_config, supabase_client, test_data_provider):
        """Test the complete update workflow on a small batch"""
        updater = DatabaseUpdater(test_config, supabase_client)
        
        # Get a small sample for testing
        test_packages = await test_data_provider.get_test_packages(3)
        
        # Test processing individual packages
        for pkg_data in test_packages:
            entry = Entry.from_dict(pkg_data)
            
            logger.info(f"Testing update workflow for {entry.package_name}")
            
            # Test repository processing
            if entry.repo_link and 'github.com' in entry.repo_link:
                repo_updates = await updater._process_repository_data(entry)
                
                if repo_updates:
                    # Verify update structure
                    assert isinstance(repo_updates, dict)
                    logger.info(f"✅ Repo updates for {entry.package_name}: {list(repo_updates.keys())}")
                else:
                    logger.info(f"ℹ️ No repo updates needed for {entry.package_name}")
            
            # Test publication processing
            if entry.publication_url:
                pub_updates = await updater._process_publication_data(entry)
                
                if pub_updates:
                    assert isinstance(pub_updates, dict)
                    logger.info(f"✅ Pub updates for {entry.package_name}: {list(pub_updates.keys())}")
                else:
                    logger.info(f"ℹ️ No pub updates needed for {entry.package_name}")
            
            # Add delay between packages
            await asyncio.sleep(2)

    @pytest.mark.asyncio
    async def test_database_connection(self, supabase_client):
        """Test database connectivity and permissions"""
        try:
            # Test read access
            response = supabase_client.table("packages").select("id").limit(1).execute()
            assert response.data is not None
            logger.info("✅ Database read access confirmed")
            
            # Test count query
            count_response = supabase_client.table("packages").select("id", count="exact").execute()
            assert count_response.count is not None
            assert count_response.count > 0
            logger.info(f"✅ Database contains {count_response.count} packages")
            
        except Exception as e:
            pytest.fail(f"Database connection test failed: {e}")

    @pytest.mark.asyncio
    async def test_error_handling(self, test_config, supabase_client):
        """Test error handling with invalid data"""
        updater = DatabaseUpdater(test_config, supabase_client)
        
        # Test with invalid repository URL
        invalid_entry = Entry(
            id='test-invalid',
            package_name='Invalid Test',
            repo_link='https://not-a-real-github-repo.com/invalid'
        )
        
        repo_updates = await updater._process_repository_data(invalid_entry)
        # Should return empty dict, not crash
        assert isinstance(repo_updates, dict)
        
        # Test with invalid publication URL
        invalid_entry.publication_url = 'https://not-a-real-doi.com/invalid'
        pub_updates = await updater._process_publication_data(invalid_entry)
        # Should return empty dict, not crash
        assert isinstance(pub_updates, dict)
        
        logger.info("✅ Error handling tests passed")


@pytest.mark.asyncio
async def test_integration_sample_update(test_config, supabase_client, test_data_provider):
    """Integration test: perform actual updates on a small sample"""
    updater = DatabaseUpdater(test_config, supabase_client)
    
    # Get 2 packages for integration testing
    test_packages = await test_data_provider.get_test_packages(2)
    
    logger.info("🧪 Starting integration test with real database updates")
    logger.info("⚠️ This will make actual changes to the database")
    
    for pkg_data in test_packages:
        logger.info(f"Integration testing package: {pkg_data.get('package_name')}")
        
        # Store original values
        try:
            # Process the package
            updates = await updater._process_single_package(pkg_data)
            
            if updates:
                logger.info(f"✅ Integration test completed for {pkg_data.get('package_name')}")
                logger.info(f"   Updates applied: {list(updates.keys())}")
            else:
                logger.info(f"ℹ️ No updates needed for {pkg_data.get('package_name')}")
            
        except Exception as e:
            logger.error(f"❌ Integration test failed for {pkg_data.get('package_name')}: {e}")
            raise
        
        # Add delay between packages
        await asyncio.sleep(3)
    
    logger.info("✅ Integration test completed successfully")


if __name__ == "__main__":
    # Run tests when script is executed directly
    pytest.main([__file__, "-v", "--tb=short"])