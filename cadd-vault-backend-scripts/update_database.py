"""
Database update script for CADD Vault.

This script updates package information by fetching data from external APIs like GitHub
and publication sources. It handles pagination for the Supabase client, which has a 
default limit of 1000 rows per query, to ensure all packages in the database can be 
processed even when there are more than 1000 entries.
"""

import asyncio
import os
import logging
import argparse
import pandas as pd
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
import json
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

# Import services and models (assuming they're updated to match new schema)
from services import PublicationService, RepositoryService
from models import Config, Entry

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
    
    # Dry run specific
    dry_run_changes: List[Dict[str, Any]] = field(default_factory=list)
    
    def add_error(self, package_id: str, error_message: str, error_type: str = "general"):
        """Add an error to the tracking."""
        self.errors.append({
            "package_id": package_id,
            "error": error_message,
            "type": error_type,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    def add_dry_run_change(self, package_id: str, package_name: str, field: str, old_value: Any, new_value: Any):
        """Add a change record for dry run mode."""
        self.dry_run_changes.append({
            "package_id": package_id,
            "package_name": package_name,
            "field": field,
            "old_value": old_value,
            "new_value": new_value,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

class DatabaseUpdater:
    """Main class for updating database with external API data."""
    
    def __init__(self, config: Config, supabase_client: Client, dry_run: bool = False):
        self.config = config
        self.supabase = supabase_client
        self.stats = UpdateStats()
        self.dry_run = dry_run
        
        # Initialize services
        self.publication_service = PublicationService(config)
        self.repository_service = RepositoryService(config)
        
        # Rate limiting and batch processing
        self.batch_size = 50  # Process packages in batches
        self.delay_between_batches = 5.0  # seconds
        self.max_retries = 3
        
        logger.info(f"DatabaseUpdater initialized in {'DRY RUN' if dry_run else 'LIVE'} mode")
        
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
            all_packages = []
            
            # If we are fetching specific IDs, we can do it in one query
            if package_filter and "ids" in package_filter:
                query = self.supabase.table("packages").select("*")
                query = build_package_filter_query(query, package_filter)
                response = query.execute()
                
                if response.data is None:
                    logger.error("Failed to fetch packages from database")
                    return []
                
                return response.data
            
            # For other cases, we need to handle pagination to get all rows
            # since Supabase has a default limit of 1000 rows per query
            page_size = 1000  # Maximum allowed by Supabase
            current_page = 0
            total_fetched = 0
            has_more = True
            
            # Log if we're fetching all packages
            if not package_filter or ("limit" not in package_filter):
                logger.info("Fetching ALL packages from the database (with pagination)")
            
            # For limit queries, adjust to fetch only what's needed
            max_packages = None
            if package_filter and "limit" in package_filter:
                max_packages = package_filter["limit"]
                logger.info(f"Fetching up to {max_packages} packages from the database")
            
            # Create a copy of package_filter without the limit for pagination handling
            pagination_filter = package_filter.copy() if package_filter else {}
            if "limit" in pagination_filter:
                del pagination_filter["limit"]
            
            while has_more:
                # Calculate how many records to fetch in this page
                fetch_count = page_size
                if max_packages is not None:
                    remaining = max_packages - total_fetched
                    if remaining <= 0:
                        break
                    fetch_count = min(fetch_count, remaining)
                
                # Build query with pagination
                query = self.supabase.table("packages").select("*").range(
                    current_page * page_size, 
                    (current_page * page_size) + fetch_count - 1
                )
                
                # Apply other filters
                if pagination_filter:
                    query = build_package_filter_query(query, pagination_filter)
                
                # Execute query
                response = query.execute()
                
                if response.data is None:
                    logger.error("Failed to fetch packages from database")
                    return []
                
                # Add results to our collection
                packages_count = len(response.data)
                all_packages.extend(response.data)
                total_fetched += packages_count
                
                # Check if we need to fetch more
                has_more = packages_count == fetch_count
                if has_more:
                    current_page += 1
                    logger.info(f"Fetched {total_fetched} packages so far, getting more...")
                
                # If we've reached our limit, stop
                if max_packages is not None and total_fetched >= max_packages:
                    has_more = False
            
            logger.info(f"Successfully fetched {len(all_packages)} packages in total")
            return all_packages
            
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
            
            # Handle updates (either apply to database or record for dry run)
            if updates:
                if self.dry_run:
                    # Record changes for dry run output
                    for field, new_value in updates.items():
                        old_value = getattr(entry, field, None) if hasattr(entry, field) else package_data.get(field)
                        self.stats.add_dry_run_change(package_id, package_name, field, old_value, new_value)
                    logger.info(f"[DRY RUN] Would update package {package_name} with {len(updates)} fields")
                else:
                    await self._apply_updates(package_id, updates)
                    logger.info(f"Updated package {package_name} with {len(updates)} fields")
                
                self.stats.updated_packages += 1
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
                # Always update GitHub stars
                if repo_data.stars is not None:
                    updates['github_stars'] = repo_data.stars
                
                # Always update last commit information when available
                if repo_data.last_commit is not None:
                    updates['last_commit'] = repo_data.last_commit
                
                if repo_data.last_commit_ago is not None:
                    updates['last_commit_ago'] = repo_data.last_commit_ago
                
                # Only update license if it is None
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
                    # Always get latest citations
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
        mode = "DRY RUN" if self.dry_run else "LIVE UPDATE"
        logger.info("=" * 60)
        logger.info(f"DATABASE UPDATE COMPLETE - {mode}")
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
        
        if self.dry_run:
            logger.info(f"Total field changes (dry run): {len(self.stats.dry_run_changes)}")
        
        if self.stats.errors:
            logger.error(f"Errors encountered: {len(self.stats.errors)}")
            # Log first few errors for immediate visibility
            for error in self.stats.errors[:5]:
                logger.error(f"  - {error['type']}: {error['error']} (Package: {error['package_id']})")
            
            if len(self.stats.errors) > 5:
                logger.error(f"  ... and {len(self.stats.errors) - 5} more errors (check full log)")

    def export_dry_run_results(self, output_file: str, format_type: str = "csv"):
        """Export dry run results to CSV or Excel file."""
        if not self.dry_run or not self.stats.dry_run_changes:
            logger.warning("No dry run changes to export")
            return
        
        # Prepare data for export
        df = pd.DataFrame(self.stats.dry_run_changes)
        
        # Add summary data
        summary_data = {
            "total_packages": self.stats.total_packages,
            "processed_packages": self.stats.processed_packages,
            "updated_packages": self.stats.updated_packages,
            "skipped_packages": self.stats.skipped_packages,
            "failed_packages": self.stats.failed_packages,
            "repository_updates": self.stats.repository_updates,
            "publication_updates": self.stats.publication_updates,
            "github_data_updates": self.stats.github_data_updates,
            "citation_updates": self.stats.citation_updates,
            "total_changes": len(self.stats.dry_run_changes)
        }
        
        output_path = Path(output_file)
        
        if format_type.lower() == "excel":
            # Export to Excel with multiple sheets
            if not output_path.suffix or output_path.suffix.lower() not in ['.xlsx', '.xls']:
                output_path = output_path.with_suffix('.xlsx')
            
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                # Main changes sheet
                df.to_excel(writer, sheet_name='Changes', index=False)
                
                # Summary sheet
                summary_df = pd.DataFrame([summary_data])
                summary_df.to_excel(writer, sheet_name='Summary', index=False)
                
                # Errors sheet (if any)
                if self.stats.errors:
                    errors_df = pd.DataFrame(self.stats.errors)
                    errors_df.to_excel(writer, sheet_name='Errors', index=False)
            
            logger.info(f"Dry run results exported to Excel: {output_path}")
            
        else:
            # Export to CSV
            if not output_path.suffix or output_path.suffix.lower() != '.csv':
                output_path = output_path.with_suffix('.csv')
            
            df.to_csv(output_path, index=False)
            
            # Also create a summary CSV
            summary_path = output_path.with_name(f"{output_path.stem}_summary.csv")
            summary_df = pd.DataFrame([summary_data])
            summary_df.to_csv(summary_path, index=False)
            
            # Export errors if any
            if self.stats.errors:
                errors_path = output_path.with_name(f"{output_path.stem}_errors.csv")
                errors_df = pd.DataFrame(self.stats.errors)
                errors_df.to_csv(errors_path, index=False)
            
            logger.info(f"Dry run results exported to CSV: {output_path}")
            logger.info(f"Summary exported to: {summary_path}")
            if self.stats.errors:
                logger.info(f"Errors exported to: {errors_path}")


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Update CADD Vault database with external API data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run on 10 packages, export to CSV
  python update_database.py --dry-run --limit 10 --output results.csv

  # Dry run on specific packages, export to Excel
  python update_database.py --dry-run --ids pkg1,pkg2,pkg3 --output results.xlsx --format excel

  # Live update of packages not updated in 7 days
  python update_database.py --days-since-update 7 --limit 50

  # Update all packages (no limit)
  python update_database.py --all

  # Update packages with GitHub repos only
  python update_database.py --github-only --limit 20
        """
    )
    
    # Mode selection
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Run in dry-run mode (no database changes, export results to file)"
    )
    
    # Package selection
    selection_group = parser.add_mutually_exclusive_group()
    selection_group.add_argument(
        "--limit", 
        type=int, 
        help="Limit number of packages to process"
    )
    selection_group.add_argument(
        "--ids", 
        type=str, 
        help="Comma-separated list of specific package IDs to process"
    )
    selection_group.add_argument(
        "--all", 
        action="store_true", 
        help="Process ALL packages in the database without any limit"
    )
    
    # Filtering options
    parser.add_argument(
        "--days-since-update", 
        type=int, 
        help="Only process packages not updated in X days"
    )
    parser.add_argument(
        "--github-only", 
        action="store_true", 
        help="Only process packages with GitHub repositories"
    )
    parser.add_argument(
        "--publications-only", 
        action="store_true", 
        help="Only process packages with publication URLs"
    )
    
    # Output options (for dry run)
    parser.add_argument(
        "--output", 
        type=str, 
        help="Output file for dry run results (auto-detects format from extension)"
    )
    parser.add_argument(
        "--format", 
        choices=["csv", "excel"], 
        default="csv", 
        help="Output format for dry run results (default: csv)"
    )
    
    # Processing options
    parser.add_argument(
        "--batch-size", 
        type=int, 
        default=50, 
        help="Number of packages to process in each batch (default: 50)"
    )
    parser.add_argument(
        "--delay", 
        type=float, 
        default=5.0, 
        help="Delay in seconds between batches (default: 5.0)"
    )
    
    # Logging
    parser.add_argument(
        "--verbose", "-v", 
        action="store_true", 
        help="Enable verbose logging"
    )
    parser.add_argument(
        "--quiet", "-q", 
        action="store_true", 
        help="Suppress non-error output"
    )
    
    return parser.parse_args()


def setup_logging(verbose: bool = False, quiet: bool = False):
    """Configure logging based on command line options."""
    if quiet:
        level = logging.ERROR
    elif verbose:
        level = logging.DEBUG
    else:
        level = logging.INFO
    
    # Update the existing logging configuration
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('database_update.log'),
            logging.StreamHandler()
        ]
    )


async def main():
    """Main entry point for the database update script."""
    # Parse command line arguments
    args = parse_arguments()
    
    # Setup logging
    setup_logging(args.verbose, args.quiet)
    
    # Load environment variables
    load_dotenv()
    
    # Get configuration
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    github_token = os.environ.get("PERSONAL_ACCESS_TOKEN")
    email = os.environ.get("CROSSREF_EMAIL", "your_email@example.com")
    
    if not supabase_url or not supabase_key:
        logger.error("Missing required environment variables")
        return 1
    
    # Initialize clients
    supabase = create_client(supabase_url, supabase_key)
    config = Config(
        email=email, 
        github_token=github_token,
        batch_size=args.batch_size
    )
    
    # Create updater
    updater = DatabaseUpdater(config, supabase, dry_run=args.dry_run)
    updater.delay_between_batches = args.delay
    
    # Build package filter based on arguments
    package_filter = {}
    
    if args.limit:
        package_filter["limit"] = args.limit
    elif args.ids:
        package_ids = [id.strip() for id in args.ids.split(',')]
        package_filter["ids"] = package_ids
    elif not args.all:
        # Default to a safe limit if no specific selection is made
        package_filter["limit"] = 10
        logger.warning("No specific package selection provided. Defaulting to 10 packages. Use --all to process all packages.")
    else:
        # When --all is specified, we don't set a limit to process the entire database
        logger.info("Processing ALL packages in the database")
    
    if args.days_since_update:
        cutoff_date = (datetime.now(timezone.utc) - timedelta(days=args.days_since_update)).isoformat()
        package_filter["updated_before"] = cutoff_date
    
    if args.github_only:
        package_filter["github_only"] = True
    
    if args.publications_only:
        package_filter["publications_only"] = True
    
    # Log what we're about to do
    mode = "DRY RUN" if args.dry_run else "LIVE UPDATE"
    logger.info(f"Starting database update in {mode} mode")
    logger.info(f"Filter: {package_filter}")
    
    if args.dry_run and not args.output:
        # Default output filename for dry run
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = f"dry_run_results_{timestamp}.csv"
        logger.info(f"No output file specified for dry run. Using: {args.output}")
    
    try:
        # Run the update
        await updater.update_database(package_filter)
        
        # Export dry run results if applicable
        if args.dry_run and args.output:
            # Auto-detect format from file extension if not specified
            output_format = args.format
            if args.output.lower().endswith('.xlsx') or args.output.lower().endswith('.xls'):
                output_format = "excel"
            elif args.output.lower().endswith('.csv'):
                output_format = "csv"
            
            updater.export_dry_run_results(args.output, output_format)
        
        logger.info("Database update completed successfully")
        return 0
        
    except KeyboardInterrupt:
        logger.warning("Update interrupted by user")
        return 130
    except Exception as e:
        logger.critical(f"Database update failed: {e}")
        return 1


def build_package_filter_query(query, package_filter: Dict[str, Any]):
    """Build Supabase query with filters applied."""
    # Note: For pagination, the 'limit' should be handled separately
    # But we still handle it here for backward compatibility
    if "limit" in package_filter:
        query = query.limit(package_filter["limit"])
    
    if "ids" in package_filter:
        query = query.in_("id", package_filter["ids"])
    
    if "updated_before" in package_filter:
        query = query.lt("last_updated", package_filter["updated_before"])
    
    if package_filter.get("github_only"):
        query = query.not_.is_("repo_link", "null").like("repo_link", "%github.com%")
    
    if package_filter.get("publications_only"):
        query = query.not_.is_("publication", "null")
    
    return query


if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)