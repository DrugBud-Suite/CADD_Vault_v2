import json
import dataclasses
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

@dataclass
class Config:
    """Configuration settings for the script."""
    email: str
    github_token: Optional[str] = None
    timeout: int = 30  # seconds
    max_retries: int = 3
    rate_limit_delay: float = 1.0  # seconds between API calls
    batch_size: int = 50

@dataclass
class Entry:
    """Represents a single entry from the database - aligned with Supabase schema."""
    id: str
    package_name: Optional[str] = None
    
    # URLs and links
    repo_link: Optional[str] = None  # Maps to 'repo_link' in schema
    publication_url: Optional[str] = None  # Maps to 'publication' in schema
    webserver: Optional[str] = None
    link: Optional[str] = None  # General purpose link
    
    # Organization
    folder1: Optional[str] = None
    category1: Optional[str] = None
    
    # Basic info
    description: Optional[str] = None
    license: Optional[str] = None
    page_icon: Optional[str] = None
    tags: Optional[List[str]] = None
    
    # GitHub data
    github_owner: Optional[str] = None
    github_repo: Optional[str] = None
    github_stars: Optional[int] = None
    primary_language: Optional[str] = None
    last_commit: Optional[str] = None  # ISO timestamp string
    last_commit_ago: Optional[str] = None
    
    # Publication data
    citations: Optional[int] = None
    journal: Optional[str] = None
    jif: Optional[float] = None  # Journal Impact Factor
    
    # Rating data (managed by triggers)
    average_rating: Optional[float] = None
    ratings_count: Optional[int] = None
    ratingsum: Optional[int] = None  # Note: schema uses 'ratings_sum'

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Entry":
        """Creates an Entry instance from a database dictionary."""
        # Handle potential JSON string for tags
        tags = data.get('tags')
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except json.JSONDecodeError:
                tags = []
        elif tags is None:
            tags = []
        
        # Handle datetime fields
        last_commit = data.get('last_commit')
        if isinstance(last_commit, datetime):
            last_commit = last_commit.isoformat()
        
        # Ensure all fields are present, even if None
        field_names = {f.name for f in dataclasses.fields(cls)}
        processed_data = {}
        
        for field_name in field_names:
            if field_name == 'publication_url':
                # Map 'publication' from database to 'publication_url' in model
                processed_data[field_name] = data.get('publication')
            elif field_name == 'ratingsum':
                # Handle field name difference
                processed_data[field_name] = data.get('ratings_sum')
            else:
                processed_data[field_name] = data.get(field_name)
        
        # Set tags specifically
        processed_data['tags'] = tags
        processed_data['last_commit'] = last_commit
        
        return cls(**processed_data)

    def to_dict(self) -> Dict[str, Any]:
        """Convert Entry to dictionary for database updates."""
        data = {}
        
        for field in dataclasses.fields(self):
            value = getattr(self, field.name)
            
            if field.name == 'publication_url':
                # Map back to 'publication' for database
                if value is not None:
                    data['publication'] = value
            elif field.name == 'ratingsum':
                # Map back to 'ratings_sum' for database  
                if value is not None:
                    data['ratings_sum'] = value
            elif field.name == 'tags':
                # Ensure tags are stored as JSON array
                if value is not None:
                    data['tags'] = value if isinstance(value, list) else []
            elif value is not None:
                data[field.name] = value
        
        return data

    def get_github_repo_path(self) -> Optional[str]:
        """Extract GitHub repo path from repo_link."""
        if not self.repo_link or 'github.com' not in self.repo_link:
            return None
        
        try:
            # Handle various GitHub URL formats
            url = self.repo_link.replace('https://github.com/', '').replace('http://github.com/', '')
            url = url.rstrip('/')
            
            # Remove .git suffix if present
            if url.endswith('.git'):
                url = url[:-4]
            
            # Should be in format owner/repo
            if '/' in url:
                parts = url.split('/')
                if len(parts) >= 2:
                    return f"{parts[0]}/{parts[1]}"
        except Exception:
            pass
        
        return None

    def has_github_data(self) -> bool:
        """Check if package has any GitHub-related data."""
        return any([
            self.github_owner,
            self.github_repo, 
            self.github_stars,
            self.primary_language,
            self.last_commit
        ])

    def has_publication_data(self) -> bool:
        """Check if package has publication-related data."""
        return any([
            self.citations,
            self.journal,
            self.jif
        ])

    def needs_github_update(self) -> bool:
        """Determine if GitHub data needs updating."""
        return (
            self.repo_link and 
            'github.com' in self.repo_link and
            not self.has_github_data()
        )

    def needs_publication_update(self) -> bool:
        """Determine if publication data needs updating."""
        return (
            self.publication_url and 
            not self.has_publication_data()
        )


@dataclass 
class ProcessingResult:
    """Summarizes the results of processing."""
    total_entries: int = 0
    successful_entries: int = 0
    failed_entries: int = 0
    skipped_entries: int = 0
    updated_entries: int = 0
    errors: List[Dict[str, str]] = field(default_factory=list)
    
    # Detailed statistics
    github_updates: int = 0
    publication_updates: int = 0
    citation_updates: int = 0
    preprint_conversions: int = 0
    
    # Timing information
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    def add_error(self, entry_identifier: str, error_message: str, error_type: str = "general"):
        """Adds an error to the results."""
        self.errors.append({
            "entry": entry_identifier,
            "error": error_message,
            "type": error_type,
            "timestamp": datetime.now().isoformat()
        })
        self.failed_entries += 1

    def add_success(self, update_type: str = None):
        """Record a successful update."""
        self.successful_entries += 1
        
        if update_type == "github":
            self.github_updates += 1
        elif update_type == "publication":
            self.publication_updates += 1
        elif update_type == "citation":
            self.citation_updates += 1
        elif update_type == "preprint":
            self.preprint_conversions += 1

    def get_duration(self) -> Optional[float]:
        """Get processing duration in seconds."""
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return None

    def get_success_rate(self) -> float:
        """Get success rate as percentage."""
        if self.total_entries == 0:
            return 0.0
        return (self.successful_entries / self.total_entries) * 100

    def summary(self) -> str:
        """Get a formatted summary of results."""
        duration = self.get_duration()
        duration_str = f" in {duration:.1f}s" if duration else ""
        
        return f"""
Processing Summary{duration_str}:
  Total entries: {self.total_entries}
  Successful: {self.successful_entries} ({self.get_success_rate():.1f}%)
  Failed: {self.failed_entries}
  Skipped: {self.skipped_entries}
  Updated: {self.updated_entries}
  
Update Details:
  GitHub updates: {self.github_updates}
  Publication updates: {self.publication_updates}
  Citation updates: {self.citation_updates}
  Preprint conversions: {self.preprint_conversions}
  
Errors: {len(self.errors)}
""".strip()


@dataclass
class Publication:
    """Represents publication data."""
    url: str
    citations: Optional[int] = None
    journal: Optional[str] = None
    jif: Optional[float] = None
    published_url: Optional[str] = None  # For preprints that are published
    is_preprint: bool = False
    preprint_server: Optional[str] = None  # arxiv, biorxiv, etc.


@dataclass
class Repository:
    """Represents repository data."""
    url: str
    owner: Optional[str] = None
    name: Optional[str] = None
    stars: Optional[int] = None
    last_commit: Optional[str] = None
    last_commit_ago: Optional[str] = None
    license: Optional[str] = None
    primary_language: Optional[str] = None
    is_github: bool = False
    
    @classmethod
    def from_github_url(cls, url: str) -> Optional["Repository"]:
        """Create Repository from GitHub URL."""
        if not url or 'github.com' not in url:
            return None
        
        try:
            # Extract owner and repo name
            clean_url = url.replace('https://github.com/', '').replace('http://github.com/', '')
            clean_url = clean_url.rstrip('/').replace('.git', '')
            
            parts = clean_url.split('/')
            if len(parts) >= 2:
                return cls(
                    url=url,
                    owner=parts[0],
                    name=parts[1],
                    is_github=True
                )
        except Exception:
            pass
        
        return None


@dataclass
class UpdateBatch:
    """Represents a batch of updates to be applied."""
    package_id: str
    updates: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_update(self, field: str, value: Any, source: str = "api"):
        """Add an update to the batch."""
        self.updates[field] = value
        self.metadata[field] = {
            "source": source,
            "timestamp": datetime.now().isoformat()
        }
    
    def has_updates(self) -> bool:
        """Check if batch has any updates."""
        return len(self.updates) > 0
    
    def get_update_summary(self) -> str:
        """Get a summary of updates in this batch."""
        if not self.updates:
            return "No updates"
        
        return f"Updates: {', '.join(self.updates.keys())}"