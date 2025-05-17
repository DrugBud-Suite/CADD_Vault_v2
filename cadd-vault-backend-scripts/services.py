"""
External API services for fetching publication and repository data.
"""
import json  # Added import for json
import logging
import re
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache, partial
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote, urlparse  # Added urlparse

import backoff
import httpx
import requests
from habanero import Crossref, counts

# Assuming models.py is in the same directory
from models import Config, Entry, ProcessingResult, Publication, Repository

from paperscraper.impact import Impactor
from rich.console import Console
from rich.progress import Progress


@dataclass
class PreprintResult:
    """Container for preprint checking results"""
    original_url: str
    published_doi: Optional[str] = None
    published_url: Optional[str] = None
    title: Optional[str] = None
    publication_status: str = "unpublished"
    error: Optional[str] = None

class PublicationService:
    """Handles all publication-related operations including preprints"""

    def __init__(self, config: Config):
        self.config = config
        self.headers = {
            "User-Agent": f"PublicationManager/1.0 (mailto:{config.email})"
        }
        self.logger = logging.getLogger(self.__class__.__name__)
        self.crossref = Crossref(mailto=config.email)
        self.impactor = Impactor()

        # Cache for impact factors and journals
        self._impact_factor_cache = {}
        self._journal_cache = {}

        # Preprint configuration
        self.preprint_domains = ['arxiv', 'biorxiv', 'medrxiv', 'chemrxiv', 'zenodo']
        self.preprint_patterns = {
            'arxiv': {
                'doi': r'10\.48550/arxiv\.(.+?)(?:v\d+)?$',
                'url': r'arxiv\.org/(?:abs|pdf)/(\d+\.\d+)',
                'id': r'(\d+\.\d+)'
            },
            'chemrxiv': {
                'doi': r'10\.26434/chemrxiv[.-](.+?)(?:/|$)',
                'url': r'chemrxiv\.org/(?:engage/)?(?:api/)?(?:download|viewer)?[^/]*/(\d+|[A-Za-z0-9-]+)',
                'id': r'([A-Za-z0-9-]+)'
            },
            'biorxiv': {
                'doi': r'10\.1101/(.+?)(?:/|$)',
                'url': r'biorxiv\.org/content/([^/]+)',
                'id': r'(\d{4}\.\d{2}\.\d{2}\.\d+)'
            }
        }

    def normalize_doi(self, doi: str) -> Optional[str]:
        """Normalize DOI format for consistency"""
        if not doi:
            return None

        # Convert to string and strip whitespace
        doi = str(doi).strip()

        # Extract DOI from URLs
        if 'doi.org/' in doi:
            doi = doi.split('doi.org/')[-1]
        elif 'http://' in doi or 'https://' in doi:
            match = re.search(r'(10\.\d+/.+)$', doi)
            if match:
                doi = match.group(1)

        # Clean the DOI
        old_doi = None
        while old_doi != doi:
            old_doi = doi
            doi = re.sub(r'v\d+(?:\.full)?$', '', doi)  # Remove version numbers
            doi = re.sub(r'\.full$', '', doi)  # Remove standalone .full
            doi = re.sub(r'\.(?:svg|pdf|html)$', '', doi)  # Remove file extensions
            doi = re.sub(r'[\[\(\{\]\)\}]+$', '', doi)  # Remove trailing brackets
            doi = re.sub(r'[\.:\-/\\]+$', '', doi)  # Remove trailing punctuation
            doi = doi.split('?')[0].split('#')[0]  # Remove query parameters
            doi = doi.strip()

        # Add proper DOI URL prefix if it's a bare DOI
        if doi.startswith('10.'):
            doi = f'https://doi.org/{doi}'

        return doi

    def is_preprint(self, url: str) -> bool:
        """Check if URL is from a preprint server"""
        if not url:
            return False
        return any(domain in url.lower() for domain in self.preprint_domains)

    def _extract_doi(self, url: str) -> Optional[str]:
        """Extract DOI from URL"""
        if not url:
            return None

        if 'doi.org' in url:
            doi = url.split('doi.org/')[-1]
            return re.sub(r'[)\]\.]+$', '', doi)

        return None

    async def check_publication_status(self, url: str) -> PreprintResult:
        """Check if a preprint has been published in a peer-reviewed venue"""
        try:
            result = PreprintResult(original_url=url)

            # Identify preprint type and ID
            preprint_type, preprint_id = self._identify_preprint(url)
            if not preprint_type or not preprint_id:
                result.error = "Could not identify preprint type or ID"
                return result

            # Check publication status based on preprint type
            checker_methods = {
                'arxiv': self._check_arxiv,
                'biorxiv': self._check_biorxiv,
                'chemrxiv': self._check_chemrxiv
            }

            if checker := checker_methods.get(preprint_type):
                published_doi, published_url = await checker(preprint_id)
                if published_doi and published_url:
                    result.published_doi = published_doi
                    result.published_url = published_url
                    result.title = await self._get_doi_title(published_doi)
                    result.publication_status = "published"

            return result

        except Exception as e:
            self.logger.error(f"Error checking publication status for {url}: {str(e)}")
            result.error = str(e)
            return result

    def _identify_preprint(self, url: str) -> Tuple[Optional[str], Optional[str]]:
        """Identify preprint type and extract identifier from URL"""
        if not url:
            return None, None

        url = url.lower().strip()

        # Check each preprint type's patterns
        for preprint_type, patterns in self.preprint_patterns.items():
            # Check DOI pattern
            if 'doi' in patterns and (match := re.search(patterns['doi'], url)):
                return preprint_type, match.group(1)

            # Check URL pattern
            if 'url' in patterns and (match := re.search(patterns['url'], url)):
                return preprint_type, match.group(1)

        return None, None

    async def _search_crossref_for_title(self, title: str, preprint_doi: Optional[str] = None) -> Optional[str]:
        """Search Crossref for a paper by title with exact matching"""
        try:
            # First try: Direct title query
            works = self.crossref.works(query=title, select='DOI,title', limit=20)

            if works and 'message' in works and 'items' in works['message']:
                title_lower = title.lower().strip()
                for item in works['message']['items']:
                    if 'title' in item and item['title']:
                        result_title = item['title'][0].lower().strip()
                        if title_lower == result_title:
                            if not preprint_doi or item['DOI'].lower() != preprint_doi.lower():
                                return item['DOI']

            # Second try: Quoted title for exact phrase matching
            works = self.crossref.works(query=f'"{title}"', select='DOI,title', limit=5)

            if works and 'message' in works and 'items' in works['message']:
                for item in works['message']['items']:
                    if 'title' in item and item['title']:
                        result_title = item['title'][0].lower().strip()
                        if title_lower == result_title:
                            if not preprint_doi or item['DOI'].lower() != preprint_doi.lower():
                                return item['DOI']

            return None

        except Exception as e:
            self.logger.error(f"Error searching Crossref for title {title}: {str(e)}")
            return None

    async def _check_arxiv(self, arxiv_id: str) -> Tuple[Optional[str], Optional[str]]:
        """Check if an arXiv paper has been published"""
        try:
            # First, check arXiv metadata for a DOI
            async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                response = await client.get(
                    f"http://export.arxiv.org/api/query?id_list={arxiv_id}",
                    headers=self.headers
                )
                response.raise_for_status()

                # Parse XML response (simplified)
                if '<doi>' in response.text:
                    doi = response.text.split('<doi>', 1)[1].split('</doi>', 1)[0]
                    return doi, f"https://doi.org/{doi}"

                # If no DOI in metadata, search Europe PMC by arXiv ID
                # Europe PMC API for finding published version from preprint ID
                europe_pmc_url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
                params = {
                    'query': f'ACCESSION:{arxiv_id}',
                    'resultType': 'lite',
                    'format': 'json'
                }
                response = await client.get(europe_pmc_url, params=params, headers=self.headers)
                response.raise_for_status()
                data = response.json()

                if data and data.get('hitCount', 0) > 0:
                    # Look for a result that is not a preprint
                    for result in data.get('resultList', {}).get('result', []):
                        if result.get('source') != 'PPR': # PPR is preprint source in Europe PMC
                            published_doi = result.get('doi')
                            if published_doi:
                                return published_doi, f"https://doi.org/{published_doi}"

                # Fallback to title search if Europe PMC doesn't find a published version
                if '<title>' in response.text:
                    title = response.text.split('<title>', 1)[1].split('</title>', 1)[0]
                    if doi := await self._search_crossref_for_title(title, f"arXiv:{arxiv_id}"):
                        return doi, f"https://doi.org/{doi}"


            return None, None

        except Exception as e:
            self.logger.error(f"Error checking arXiv publication {arxiv_id}: {str(e)}")
            return None, None

    async def _check_biorxiv(self, biorxiv_id: str) -> Tuple[Optional[str], Optional[str]]:
        """Check if a bioRxiv paper has been published using the bioRxiv API."""
        try:
            # The bioRxiv API uses the full DOI including the prefix
            biorxiv_full_id = f"10.1101/{biorxiv_id}"
            api_url = f"https://api.biorxiv.org/pubs/medrxiv/{biorxiv_full_id}" # Assuming medrxiv API can also handle biorxiv

            async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                response = await client.get(api_url, headers=self.headers)
                response.raise_for_status()
                data = response.json()

                if data.get('collection') and data['collection']:
                    # The API returns a list of results, the first one is usually the main one
                    paper_data = data['collection'][0]
                    if published_doi := paper_data.get('published_doi'):
                        return published_doi, f"https://doi.org/{published_doi}"

            # Fallback to title search if bioRxiv API doesn't provide published_doi
            # Need to get the title from the bioRxiv entry first. This might require another API call or parsing the original URL.
            # For simplicity, let's assume we can get the title from the original URL or metadata if needed.
            # A more robust implementation would fetch the bioRxiv abstract/metadata to get the title.
            # For now, we'll skip the title fallback for bioRxiv if the API doesn't give a published_doi.

            return None, None

        except Exception as e:
            self.logger.error(f"Error checking bioRxiv publication {biorxiv_id}: {str(e)}")
            return None, None


    async def _check_chemrxiv(self, chemrxiv_id: str) -> Tuple[Optional[str], Optional[str]]:
        """Check if a chemRxiv paper has been published using Europe PMC API."""
        try:
            # ChemRxiv DOIs start with 10.26434
            chemrxiv_doi = f"10.26434/chemrxiv-{chemrxiv_id}"

            # Search Europe PMC by DOI to find the published version
            europe_pmc_url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
            params = {
                'query': f'DOI:"{chemrxiv_doi}"',
                'resultType': 'lite',
                'format': 'json'
            }
            async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                response = await client.get(europe_pmc_url, params=params, headers=self.headers)
                response.raise_for_status()
                data = response.json()

                if data.get('hitCount', 0) > 0:
                     # Look for a result that is not a preprint
                    for result in data.get('resultList', {}).get('result', []):
                        if result.get('source') != 'PPR': # PPR is preprint source in Europe PMC
                            published_doi = result.get('doi')
                            if published_doi:
                                return published_doi, f"https://doi.org/{published_doi}"

            # Fallback to title search if Europe PMC doesn't find a published version
            if title := await self._get_doi_title(chemrxiv_doi):
                if doi := await self._search_crossref_for_title(title, chemrxiv_doi):
                    return doi, f"https://doi.org/{doi}"


            return None, None

        except Exception as e:
            self.logger.error(f"Error checking chemRxiv publication {chemrxiv_id}: {str(e)}")
            return None, None


    async def _get_doi_title(self, doi: str) -> Optional[str]:
        """Get title for a DOI using Crossref"""
        try:
            works = self.crossref.works(ids=[doi])
            if works and isinstance(works, dict) and 'message' in works:
                message = works['message']
                if 'title' in message and message['title']:
                    return message['title'][0]
            return None
        except Exception as e:
            self.logger.error(f"Error getting title for DOI {doi}: {str(e)}")
            return None

    @backoff.on_exception(backoff.expo,
                         (httpx.HTTPError, TimeoutError),
                         max_tries=3)
    async def get_citations(self, url: str) -> Optional[int]:
        """Get citation count using Crossref"""
        try:
            doi = self._extract_doi(url)
            if not doi:
                return None

            # Ensure the DOI is in the correct format for habanero
            if doi.startswith('https://doi.org/'):
                 doi = doi.replace('https://doi.org/', '')

            doi = unquote(doi)
            # The unquote might introduce characters that need further cleaning for habanero
            # Let's try to be more robust here.
            doi = re.sub(r'[^a-zA-Z0-9\.\-/_:]', '', doi)


            # Use Crossref API directly via habanero
            works = self.crossref.works(ids=[doi])
            if works and isinstance(works, dict) and 'message' in works:
                message = works['message']
                return message.get('is-referenced-by-count')

            return None

        except Exception as e:
            self.logger.error(f"Error getting citations for DOI {doi}: {str(e)}")
            return None

    @backoff.on_exception(backoff.expo,
                         (httpx.HTTPError, TimeoutError),
                         max_tries=3)
    async def get_journal_info(self, url: str) -> Optional[Dict[str, str]]:
        """Get journal information from DOI using Crossref"""
        try:
            doi = self._extract_doi(url)
            if not doi:
                return None

            works = self.crossref.works(ids=[doi])
            if works and isinstance(works, dict) and 'message' in works:
                message = works['message']
                journal_title = None
                if 'container-title' in message and message['container-title']:
                    journal_title = message['container-title'][0]
                return {
                    'journal': journal_title,
                    'issn': message.get('ISSN', [None])[0] if message.get('ISSN') else None,
                    'issn-type': message.get('issn-type', [])
                }
            return None
        except Exception as e:
            self.logger.error(f"Error getting journal info for DOI {doi}: {str(e)}")
            return None

    async def get_impact_factor(self, journal_info: Dict[str, str]) -> Optional[float]:
        """Get journal impact factor using paperscraper"""
        try:
            journal_name = journal_info.get('journal')
            if not journal_name or self._is_excluded_journal(journal_name):
                return None

            # Check cache first
            cached_if = self._get_cached_impact_factor(journal_name)
            if cached_if is not None:
                return cached_if

            # First try exact match
            results = self.impactor.search(journal_name, threshold=100)
            if results:
                self._cache_impact_factor(journal_name, results[0]['factor'])
                return results[0]['factor']

            return None

        except Exception as e:
            self.logger.error(f"Error getting impact factor: {str(e)}")
            return None

    @lru_cache(maxsize=1000)
    def _get_cached_impact_factor(self, journal: str) -> Optional[float]:
        """Get impact factor from cache"""
        return self._impact_factor_cache.get(journal)

    def _cache_impact_factor(self, journal: str, impact_factor: float) -> None:
        """Cache impact factor for a journal"""
        self._impact_factor_cache[journal] = impact_factor

    def _is_excluded_journal(self, journal: str) -> bool:
        """
        Check if journal should be excluded from impact factor lookup.

        Args:
            journal: Name of the journal to check

        Returns:
            bool: True if journal should be excluded, False otherwise
        """
        excluded_terms = [
            'arxiv',
            'preprint',
            'bioRxiv',
            'medRxiv',
            'chemrxiv',
            'github',
            'blog',
            'zenodo'
        ]
        return any(term.lower() in journal.lower() for term in excluded_terms)

    # Removed _update_journal_info and _update_publication_info as this logic is now in update_database.py

class RepositoryService:
    """Handle repository-related API calls"""

    def __init__(self, config: Config):
        self.config = config
        self.headers = {
            "User-Agent": f"PublicationManager/1.0 (mailto:{config.email})"
        }
        if config.github_token:
            self.headers["Authorization"] = f"token {config.github_token}"
        self.logger = logging.getLogger(self.__class__.__name__)

    async def get_repository_data(self, url: str) -> Optional[Repository]:
        """Fetch repository data"""
        if not url or 'github.com' not in url:
            return None

        try:
            repo_path = self._extract_repo_path(url)
            if not repo_path:
                return None

            async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                response = await client.get(
                    f"https://api.github.com/repos/{repo_path}",
                    headers=self.headers
                )
                response.raise_for_status()
                data = response.json()

                # Fetch license and primary language
                license_name = None
                if data.get('license') and data['license'].get('spdx_id'):
                    license_name = data['license']['spdx_id']

                primary_language = data.get('language')


                return Repository(
                    url=url,
                    stars=data.get('stargazers_count', 0),
                    last_commit=await self._get_last_commit(repo_path),
                    last_commit_ago=self._calculate_time_ago(
                        await self._get_last_commit(repo_path)
                    ),
                    license=license_name,
                    primary_language=primary_language
                )
        except Exception as e:
            self.logger.error(f"Error fetching repository data for {url}: {str(e)}")
            return None

    @staticmethod
    def _extract_repo_path(url: str) -> Optional[str]:
        """Extract repository path from GitHub URL"""
        try:
            # Ensure the URL starts with http or https
            if not url.startswith('http://') and not url.startswith('https://'):
                 url = 'https://' + url # Prepend https if missing

            parsed_url = urlparse(url)
            # Check if the hostname is github.com
            if parsed_url.hostname and 'github.com' in parsed_url.hostname:
                path_parts = [part for part in parsed_url.path.split('/') if part]
                if len(path_parts) >= 2:
                    owner = path_parts[0]
                    repo = path_parts[1].replace('.git', '') # Remove .git suffix
                    return f"{owner}/{repo}"
        except Exception:
            return None
        return None


    async def _get_last_commit(self, repo_path: str) -> Optional[str]:
        """Get repository's last commit date"""
        try:
            async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                response = await client.get(
                    f"https://api.github.com/repos/{repo_path}/commits",
                    headers=self.headers
                )
                response.raise_for_status()
                data = response.json()
                if data and isinstance(data, list) and data:
                    # Use committer date as it's less likely to be manipulated
                    return data[0]["commit"]["committer"]["date"]
        except Exception as e:
            self.logger.error(f"Error fetching last commit for {repo_path}: {str(e)}")
            return None
        return None

    @staticmethod
    def _calculate_time_ago(date_str: Optional[str]) -> Optional[str]:
        """Calculate time elapsed since date"""
        if not date_str:
            return None
        try:
            # Handle both 'Z' and '+00:00' timezone formats
            date_str = date_str.replace("Z", "+00:00")
            commit_date = datetime.fromisoformat(date_str)
            now = datetime.now(timezone.utc)
            diff = now - commit_date

            days = diff.days
            if days < 30:
                return f"{days} days ago" if days != 1 else "1 day ago"
            elif days < 365:
                months = days // 30
                return f"{months} months ago" if months != 1 else "1 month ago"
            else:
                years = days // 365
                return f"{years} years ago" if years != 1 else "1 year ago"
        except Exception as e:
            logging.error(f"Error calculating time ago for date string {date_str}: {str(e)}")
            return None