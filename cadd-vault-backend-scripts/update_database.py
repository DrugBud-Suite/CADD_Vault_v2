import asyncio
import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import Dict, Any, List, Optional

# Assuming services.py and models.py are in the same directory
from services import PublicationService, RepositoryService
from models import Config, Entry, ProcessingResult

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def update_database():
    """
    Main function to fetch data, process entries, and update the database.
    """
    logger.info("Starting database update script...")

    # 1. Environment Setup
    load_dotenv(dotenv_path='.env')
    load_dotenv(dotenv_path='../cadd-vault-frontend/.env') # Load frontend .env as well for Supabase details

    supabase_url: str = os.environ.get("VITE_SUPABASE_URL")
    supabase_key: str = os.environ.get("VITE_SUPABASE_ANON_KEY")
    github_token: Optional[str] = os.environ.get("PERSONAL_ACCESS_TOKEN")
    email: Optional[str] = "your_email@example.com" # Replace with a valid email for API usage

    if not supabase_url or not supabase_key:
        logger.error("Supabase URL or Key not found in environment variables.")
        return

    # 2. Supabase Interaction
    logger.info("Initializing Supabase client...")
    supabase: Client = create_client(supabase_url, supabase_key)

    logger.info("Fetching entries from Supabase...")
    try:
        response = supabase.table("packages").select("*").execute()
        if response.data is None:
             logger.error("Failed to fetch data from Supabase.")
             return
        raw_entries: List[Dict[str, Any]] = response.data
        logger.info(f"Fetched {len(raw_entries)} entries from Supabase.")
    except Exception as e:
        logger.error(f"Error fetching entries from Supabase: {e}")
        return

    # Initialize services
    config = Config(email=email, github_token=github_token)
    publication_service = PublicationService(config)
    repository_service = RepositoryService(config)

    # 3. Data Processing and API Interaction
    processed_entries: List[Entry] = []
    processing_results = ProcessingResult()

    for raw_entry in raw_entries:
        try:
            entry = Entry.from_dict(raw_entry)
            updated_entry_data = entry.__dict__.copy() # Start with current data

            # Process Repository Data
            if entry.repo_link and "github.com" in entry.repo_link:
                 logger.info(f"Processing repository data for {entry.package_name or entry.id}...")
                 repo_data = await repository_service.get_repository_data(entry.repo_link)
                 if repo_data:
                     if entry.github_stars is None and repo_data.stars is not None:
                         updated_entry_data['github_stars'] = repo_data.stars
                     if entry.last_commit is None and repo_data.last_commit is not None:
                         updated_entry_data['last_commit'] = repo_data.last_commit
                     if entry.last_commit_ago is None and repo_data.last_commit_ago is not None:
                         updated_entry_data['last_commit_ago'] = repo_data.last_commit_ago
                     if entry.license is None and repo_data.license is not None:
                         updated_entry_data['license'] = repo_data.license
                     if entry.primary_language is None and repo_data.primary_language is not None:
                         updated_entry_data['primary_language'] = repo_data.primary_language
                     # Parse and update github_owner and github_repo
                     owner, repo = repository_service._extract_repo_path(entry.repo_link).split('/') if repository_service._extract_repo_path(entry.repo_link) else (None, None)
                     if entry.github_owner is None and owner:
                         updated_entry_data['github_owner'] = owner
                     if entry.github_repo is None and repo:
                         updated_entry_data['github_repo'] = repo


            # Process Publication Data (Focus on Preprints)
            if entry.publication_url:
                logger.info(f"Processing publication data for {entry.package_name or entry.id}...")
                normalized_url = publication_service.normalize_doi(entry.publication_url)

                if normalized_url and publication_service.is_preprint(normalized_url):
                    logger.info(f"Identified as preprint: {normalized_url}")
                    preprint_result = await publication_service.check_publication_status(normalized_url)

                    if preprint_result.publication_status == "published" and preprint_result.published_url:
                        logger.info(f"Preprint published: {preprint_result.published_url}")
                        updated_entry_data['publication_url'] = preprint_result.published_url
                        # Use the published URL for further lookups
                        lookup_url = preprint_result.published_url
                    else:
                        logger.info(f"Preprint not published or error: {preprint_result.error}")
                        # Use the original normalized URL for further lookups if not published
                        lookup_url = normalized_url

                    # Fetch citations, journal, and JIF for published preprints or original non-preprint URLs
                    if lookup_url and not publication_service.is_preprint(lookup_url): # Only process if it's a published version or non-preprint
                        if entry.citations is None:
                            citations = await publication_service.get_citations(lookup_url)
                            if citations is not None:
                                updated_entry_data['citations'] = citations

                        if entry.journal is None or entry.jif is None:
                            journal_info = await publication_service.get_journal_info(lookup_url)
                            if journal_info and journal_info.get('journal') and entry.journal is None:
                                updated_entry_data['journal'] = journal_info['journal']
                            if journal_info and entry.jif is None:
                                impact_factor = await publication_service.get_impact_factor(journal_info)
                                if impact_factor is not None:
                                    updated_entry_data['jif'] = impact_factor

                elif normalized_url: # Process non-preprint publications
                     logger.info(f"Identified as non-preprint: {normalized_url}")
                     if entry.citations is None:
                         citations = await publication_service.get_citations(normalized_url)
                         if citations is not None:
                             updated_entry_data['citations'] = citations

                     if entry.journal is None or entry.jif is None:
                         journal_info = await publication_service.get_journal_info(normalized_url)
                         if journal_info and journal_info.get('journal') and entry.journal is None:
                             updated_entry_data['journal'] = journal_info['journal']
                         if journal_info and entry.jif is None:
                             impact_factor = await publication_service.get_impact_factor(journal_info)
                             if impact_factor is not None:
                                 updated_entry_data['jif'] = impact_factor


            # 4. Database Update
            # Compare updated_entry_data with original entry.__dict__ to find changes
            changes = {key: updated_entry_data[key] for key in updated_entry_data if updated_entry_data[key] != getattr(entry, key)}

            if changes:
                logger.info(f"Updating entry {entry.id} with changes: {changes}")
                try:
                    # Ensure 'id' is not in the changes payload for the update operation
                    if 'id' in changes:
                        del changes['id']
                    response = supabase.table("packages").update(changes).eq("id", entry.id).execute()
                    if response.data is None:
                        logger.error(f"Failed to update entry {entry.id}.")
                        processing_results.add_error(entry.package_name or entry.id, "Database update failed.")
                    else:
                        logger.info(f"Successfully updated entry {entry.id}.")
                        processing_results.successful_entries += 1
                except Exception as e:
                    logger.error(f"Error updating entry {entry.id}: {e}")
                    processing_results.add_error(entry.package_name or entry.id, str(e))
            else:
                logger.info(f"No updates needed for entry {entry.id}.")
                processing_results.successful_entries += 1 # Count as successful if no update needed

        except Exception as e:
            logger.error(f"Error processing entry {raw_entry.get('id', 'Unknown')}: {e}")
            processing_results.failed_entries += 1
            processing_results.add_error(raw_entry.get('name', 'Unknown'), str(e))

    processing_results.total_entries = len(raw_entries)

    # 5. Logging Completion Summary
    logger.info("Database update script finished.")
    logger.info(f"Total entries processed: {processing_results.total_entries}")
    logger.info(f"Successful updates/no updates needed: {processing_results.successful_entries}")
    logger.info(f"Failed entries: {processing_results.failed_entries}")
    if processing_results.errors:
        logger.warning("Errors encountered during processing:")
        for error in processing_results.errors:
            logger.warning(f"  Entry: {error['entry_name']}, Error: {error['error']}")


if __name__ == "__main__":
    asyncio.run(update_database())