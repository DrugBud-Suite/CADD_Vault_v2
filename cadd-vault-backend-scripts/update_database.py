import asyncio
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, field
import json

from dotenv import load_dotenv
from supabase import create_client, Client

# Import services and models (assuming they're updated to match new schema)
from services import PublicationService, RepositoryService
from models import Config, Entry, ProcessingResult

# Set up logging with more detailed formatting
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('database_update.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class UpdateStats:
    """Track statistics for the update process."""
    total_packages: int = 0
    processed_packages: int = 0
    updated_packages: int = 0
    skipped_packages: int = 0
    failed_packages: int = 0
    errors: List[Dict[str, str]] = field(default_factory=list)
    
    # Field-specific stats
    repository_updates: int = 0
    publication_updates: int = 0
    github_data_updates: int = 0
    citation_updates: int = 0
    
    def add_error(self, package_id: str, error_message: str, error_type: str = "general"):
        """Add an error to the tracking."""
        self.errors.append({
            "package_id": package_id,
            "error": error_message,
            "type": error_type,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

class DatabaseUpdater:
    """Main class for updating database with external API data."""
    
    def __init__(self, config: Config, supabase_client: Client):
        self.config = config
        self.supabase = supabase_client
        self.stats = UpdateStats()
        
        # Initialize services
        self.publication_service = PublicationService(config)
        self.repository_service = RepositoryService(config)
        
        # Rate limiting and batch processing
        self.batch_size = 50  # Process packages in batches
        self.delay_between_batches = 5.0  # seconds
        self.max_retries = 3
        
    async def update_database(self, package_filter: Optional[Dict[str, Any]] = None):
        """
        Main function to fetch data, process entries, and update the database.
        
        Args:
            package_filter: Optional filter to apply when fetching packages
        """
        logger.info("Starting database update process...")
        
        try:
            # Fetch packages to update
            packages = await self._fetch_packages(package_filter)
            self.stats.total_packages = len(packages)
            
            if not packages:
                logger.warning("No packages found to update")
                return self.stats
            
            logger.info(f"Found {len(packages)} packages to process")
            
            # Process packages in batches
            await self._process_packages_in_batches(packages)
            
            # Log final statistics
            self._log_final_stats()
            
            return self.stats
            
        except Exception as e:
            logger.error(f"Critical error in update process: {e}")
            self.stats.add_error("system", str(e), "critical")
            raise

    async def _fetch_packages(self, package_filter: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Fetch packages from database with optional filtering."""
        try:
            query = self.supabase.table("packages").select("*")
            
            # Apply filters if provided
            if package_filter:
                for key, value in package_filter.items():
                    if key == "limit":
                        query = query.limit(value)
                    elif key == "ids":
                        query = query.in_("id", value)
                    elif key == "updated_before":
                        # Only update packages not updated recently
                        query = query.lt("last_updated", value)
                    # Add more filter conditions as needed
            
            response = query.execute()
            
            if response.data is None:
                logger.error("Failed to fetch packages from database")
                return []
                
            return response.data
            
        except Exception as e:
            logger.error(f"Error fetching packages: {e}")
            raise

    async def _process_packages_in_batches(self, packages: List[Dict[str, Any]]):
        """Process packages in batches to avoid overwhelming APIs."""
        total_batches = (len(packages) + self.batch_size - 1) // self.batch_size
        
        for batch_num, i in enumerate(range(0, len(packages), self.batch_size), 1):
            batch = packages[i:i + self.batch_size]
            
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} packages)")
            
            # Process batch
            await self._process_package_batch(batch)
            
            # Delay between batches to respect rate limits
            if batch_num < total_batches:
                logger.info(f"Waiting {self.delay_between_batches}s before next batch...")
                await asyncio.sleep(self.delay_between_batches)

    async def _process_package_batch(self, batch: List[Dict[str, Any]]):
        """Process a single batch of packages."""
        tasks = []
        
        for package_data in batch:
            task = self._process_single_package(package_data)
            tasks.append(task)
        
        # Process all packages in batch concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle any exceptions
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                package_id = batch[i].get('id', 'unknown')
                logger.error(f"Error processing package {package_id}: {result}")
                self.stats.add_error(package_id, str(result), "processing")
                self.stats.failed_packages += 1

    async def _process_single_package(self, package_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process a single package and return update data."""
        package_id = package_data.get('id')
        package_name = package_data.get('package_name', 'Unknown')
        
        try:
            logger.debug(f"Processing package: {package_name} ({package_id})")
            self.stats.processed_packages += 1
            
            # Convert to Entry object for processing
            entry = self._dict_to_entry(package_data)
            
            # Collect updates
            updates = {}
            
            # Process repository data
            repo_updates = await self._process_repository_data(entry)
            if repo_updates:
                updates.update(repo_updates)
                self.stats.repository_updates += 1
            
            # Process publication data
            pub_updates = await self._process_publication_data(entry)
            if pub_updates:
                updates.update(pub_updates)
                self.stats.publication_updates += 1
            
            # Apply updates to database if any changes
            if updates:
                await self._apply_updates(package_id, updates)
                self.stats.updated_packages += 1
                logger.info(f"Updated package {package_name} with {len(updates)} fields")
            else:
                self.stats.skipped_packages += 1
                logger.debug(f"No updates needed for package {package_name}")
            
            return updates
            
        except Exception as e:
            logger.error(f"Error processing package {package_name} ({package_id}): {e}")
            self.stats.add_error(package_id, str(e), "processing")
            self.stats.failed_packages += 1
            return None

    def _dict_to_entry(self, data: Dict[str, Any]) -> Entry:
        """Convert database dict to Entry object."""
        # Handle JSON fields
        tags = data.get('tags', [])
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except json.JSONDecodeError:
                tags = []
        
        # Map database fields to Entry fields
        return Entry(
            id=data.get('id', ''),
            package_name=data.get('package_name'),
            repo_link=data.get('repo_link'),  # Updated from 'repository'
            publication_url=data.get('publication'),  # Updated field name
            webserver=data.get('webserver'),
            link=data.get('link'),
            folder1=data.get('folder1'),
            category1=data.get('category1'),
            description=data.get('description'),
            github_stars=data.get('github_stars'),
            last_commit=data.get('last_commit'),
            last_commit_ago=data.get('last_commit_ago'),
            license=data.get('license'),
            citations=data.get('citations'),
            journal=data.get('journal'),
            jif=data.get('jif'),
            page_icon=data.get('page_icon'),
            tags=tags,
            average_rating=data.get('average_rating'),
            github_owner=data.get('github_owner'),
            github_repo=data.get('github_repo'),
            primary_language=data.get('primary_language'),
            ratings_count=data.get('ratings_count'),
            ratingsum=data.get('ratings_sum')  # Note: field name difference
        )

    async def _process_repository_data(self, entry: Entry) -> Dict[str, Any]:
        """Process repository-related data updates."""
        updates = {}
        
        if not entry.repo_link or 'github.com' not in entry.repo_link:
            return updates
        
        try:
            repo_data = await self.repository_service.get_repository_data(entry.repo_link)
            
            if repo_data:
                # Only update fields that are None or need updating
                if entry.github_stars is None and repo_data.stars is not None:
                    updates['github_stars'] = repo_data.stars
                
                if entry.last_commit is None and repo_data.last_commit is not None:
                    updates['last_commit'] = repo_data.last_commit
                
                if entry.last_commit_ago is None and repo_data.last_commit_ago is not None:
                    updates['last_commit_ago'] = repo_data.last_commit_ago
                
                if entry.license is None and repo_data.license is not None:
                    updates['license'] = repo_data.license
                
                if entry.primary_language is None and repo_data.primary_language is not None:
                    updates['primary_language'] = repo_data.primary_language
                
                # Parse and update github_owner and github_repo if missing
                if entry.github_owner is None or entry.github_repo is None:
                    repo_path = self.repository_service._extract_repo_path(entry.repo_link)
                    if repo_path and '/' in repo_path:
                        owner, repo = repo_path.split('/', 1)
                        if entry.github_owner is None:
                            updates['github_owner'] = owner
                        if entry.github_repo is None:
                            updates['github_repo'] = repo
                
                if updates:
                    self.stats.github_data_updates += 1
                    
        except Exception as e:
            logger.warning(f"Failed to process repository data for {entry.package_name}: {e}")
            self.stats.add_error(entry.id, str(e), "repository")
        
        return updates

    async def _process_publication_data(self, entry: Entry) -> Dict[str, Any]:
        """Process publication-related data updates."""
        updates = {}
        
        if not entry.publication_url:
            return updates
        
        try:
            # Normalize the publication URL
            normalized_url = self.publication_service.normalize_doi(entry.publication_url)
            
            if normalized_url:
                # Check if it's a preprint and look for published version
                if self.publication_service.is_preprint(normalized_url):
                    logger.info(f"Processing preprint: {normalized_url}")
                    preprint_result = await self.publication_service.check_publication_status(normalized_url)
                    
                    if preprint_result.publication_status == "published" and preprint_result.published_url:
                        logger.info(f"Found published version: {preprint_result.published_url}")
                        updates['publication'] = preprint_result.published_url
                        lookup_url = preprint_result.published_url
                    else:
                        lookup_url = normalized_url
                else:
                    lookup_url = normalized_url
                
                # Fetch citation data for published papers (not preprints)
                if lookup_url and not self.publication_service.is_preprint(lookup_url):
                    # Get citations
                    if entry.citations is None:
                        try:
                            citations = await self.publication_service.get_citations(lookup_url)
                            if citations is not None:
                                updates['citations'] = citations
                                self.stats.citation_updates += 1
                        except Exception as e:
                            logger.warning(f"Failed to get citations for {entry.package_name}: {e}")
                    
                    # Get journal information and impact factor
                    if entry.journal is None or entry.jif is None:
                        try:
                            journal_info = await self.publication_service.get_journal_info(lookup_url)
                            if journal_info:
                                if entry.journal is None and journal_info.get('journal'):
                                    updates['journal'] = journal_info['journal']
                                
                                if entry.jif is None:
                                    impact_factor = await self.publication_service.get_impact_factor(journal_info)
                                    if impact_factor is not None:
                                        updates['jif'] = impact_factor
                        except Exception as e:
                            logger.warning(f"Failed to get journal info for {entry.package_name}: {e}")
                
        except Exception as e:
            logger.warning(f"Failed to process publication data for {entry.package_name}: {e}")
            self.stats.add_error(entry.id, str(e), "publication")
        
        return updates

    async def _apply_updates(self, package_id: str, updates: Dict[str, Any]) -> bool:
        """Apply updates to the database with retry logic."""
        for attempt in range(self.max_retries):
            try:
                # Add timestamp for tracking when last updated
                updates['last_updated'] = datetime.now(timezone.utc).isoformat()
                
                response = await asyncio.to_thread(
                    lambda: self.supabase.table("packages")
                    .update(updates)
                    .eq("id", package_id)
                    .execute()
                )
                
                if response.data is None:
                    raise Exception("Update returned no data")
                
                logger.debug(f"Successfully updated package {package_id}")
                return True
                
            except Exception as e:
                logger.warning(f"Update attempt {attempt + 1} failed for package {package_id}: {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                else:
                    logger.error(f"Failed to update package {package_id} after {self.max_retries} attempts")
                    self.stats.add_error(package_id, str(e), "database_update")
                    return False
        
        return False

    def _log_final_stats(self):
        """Log comprehensive final statistics."""
        logger.info("=" * 60)
        logger.info("DATABASE UPDATE COMPLETE")
        logger.info("=" * 60)
        logger.info(f"Total packages processed: {self.stats.total_packages}")
        logger.info(f"Successfully processed: {self.stats.processed_packages}")
        logger.info(f"Updated packages: {self.stats.updated_packages}")
        logger.info(f"Skipped (no updates): {self.stats.skipped_packages}")
        logger.info(f"Failed packages: {self.stats.failed_packages}")
        logger.info("-" * 60)
        logger.info(f"Repository data updates: {self.stats.repository_updates}")
        logger.info(f"Publication data updates: {self.stats.publication_updates}")
        logger.info(f"GitHub data updates: {self.stats.github_data_updates}")
        logger.info(f"Citation updates: {self.stats.citation_updates}")
        
        if self.stats.errors:
            logger.error(f"Errors encountered: {len(self.stats.errors)}")
            # Log first few errors for immediate visibility
            for error in self.stats.errors[:5]:
                logger.error(f"  - {error['type']}: {error['error']} (Package: {error['package_id']})")
            
            if len(self.stats.errors) > 5:
                logger.error(f"  ... and {len(self.stats.errors) - 5} more errors (check full log)")


async def main():
    """Main entry point for the database update script."""
    # Load environment variables
    load_dotenv(dotenv_path='.env')
    load_dotenv(dotenv_path='../cadd-vault-frontend/.env')
    
    # Get configuration
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("VITE_SUPABASE_ANON_KEY")
    github_token = os.environ.get("PERSONAL_ACCESS_TOKEN")
    email = os.environ.get("CONTACT_EMAIL", "your_email@example.com")
    
    if not supabase_url or not supabase_key:
        logger.error("Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY")
        return
    
    # Initialize clients
    supabase = create_client(supabase_url, supabase_key)
    config = Config(email=email, github_token=github_token)
    
    # Create updater and run
    updater = DatabaseUpdater(config, supabase)
    
    # Example: Update only packages that haven't been updated in the last 7 days
    # package_filter = {
    #     "updated_before": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat(),
    #     "limit": 100  # Process only 100 packages for testing
    # }
    
    # Or update specific packages by ID
    # package_filter = {"ids": ["specific-package-id-1", "specific-package-id-2"]}
    
    # Or update all packages (be careful with rate limits!)
    package_filter = {"limit": 50}  # Start with a small batch for testing
    
    try:
        stats = await updater.update_database(package_filter)
        
        # Could add webhook notification, email reporting, etc. here
        logger.info("Database update completed successfully")
        
    except Exception as e:
        logger.critical(f"Database update failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())