import json
import dataclasses
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

@dataclass
class Config:
    """Configuration settings for the script."""
    email: str
    github_token: Optional[str] = None
    timeout: int = 30 # seconds

@dataclass
class Entry:
    """Represents a single entry from the database."""
    id: str
    package_name: Optional[str] = None
    repo_link: Optional[str] = None
    publication_url: Optional[str] = None
    webserver: Optional[str] = None
    link: Optional[str] = None
    folder1: Optional[str] = None
    category1: Optional[str] = None
    description: Optional[str] = None
    github_stars: Optional[int] = None
    last_commit: Optional[str] = None
    last_commit_ago: Optional[str] = None
    license: Optional[str] = None
    citations: Optional[int] = None
    journal: Optional[str] = None
    jif: Optional[float] = None
    page_icon: Optional[str] = None
    tags: Optional[List[str]] = None
    average_rating: Optional[float] = None
    github_owner: Optional[str] = None
    github_repo: Optional[str] = None
    primary_language: Optional[str] = None
    ratings_count: Optional[int] = None
    ratingsum: Optional[int] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Entry":
        """Creates an Entry instance from a dictionary."""
        # Handle potential JSON string for tags
        if isinstance(data.get('tags'), str):
            try:
                data['tags'] = json.loads(data['tags'])
            except json.JSONDecodeError:
                data['tags'] = [] # Default to empty list if JSON is invalid

        # Ensure all fields are present, even if None
        field_names = {f.name for f in dataclasses.fields(cls)}
        for field_name in field_names:
            if field_name not in data:
                data[field_name] = None

        return cls(**data)


@dataclass
class ProcessingResult:
    """Summarizes the results of processing."""
    total_entries: int = 0
    successful_entries: int = 0
    failed_entries: int = 0
    errors: List[Dict[str, str]] = field(default_factory=list)

    def add_error(self, entry_name: str, error_message: str):
        """Adds an error to the results."""
        self.errors.append({"entry_name": entry_name, "error": error_message})

@dataclass
class Publication:
    """Represents publication data."""
    url: str
    citations: Optional[int] = None
    journal: Optional[str] = None
    jif: Optional[float] = None
    published_url: Optional[str] = None # For preprints that are published

@dataclass
class Repository:
    """Represents repository data."""
    url: str
    stars: Optional[int] = None
    last_commit: Optional[str] = None
    last_commit_ago: Optional[str] = None
    license: Optional[str] = None
    primary_language: Optional[str] = None