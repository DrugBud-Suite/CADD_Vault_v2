import csv
import json
import uuid
from urllib.parse import urlparse
from datetime import datetime

# Define input and output file paths
input_csv_path = 'tagged_cadd_vault_data.csv'
output_csv_path = 'transformed_packages.csv'

# Define the mapping from CSV headers to Supabase column names
# Include all Supabase columns, even if they are not in the CSV (will be set to None)
column_mapping = {
    'ENTRY NAME': 'package_name',
    'CODE': 'repo_link', # Keep original code for parsing github info
    'PUBLICATION': 'publication',
    'WEBSERVER': 'webserver',
    'LINK': 'link',
    'FOLDER1': 'folder1',
    'CATEGORY1': 'category1',
    'DESCRIPTION': 'description',
    'GITHUB_STARS': 'github_stars',
    'LAST_COMMIT': 'last_commit',
    'LAST_COMMIT_AGO': 'last_commit_ago',
    'LICENSE': 'license',
    'CITATIONS': 'citations',
    'JOURNAL': 'journal',
    'JIF': 'jif',
    'PAGE_ICON': 'page_icon',
    'TAGS': 'tags', # Will be transformed to JSONB
    # Columns in Supabase schema but not directly in CSV (will be set to None/default)
    'id': 'id', # Will be generated UUID
    'average_rating': 'average_rating',
    'github_owner': 'github_owner', # Will be parsed
    'github_repo': 'github_repo', # Will be parsed
    'primary_language': 'primary_language',
    'ratings_count': 'ratings_count',
    'ratingsum': 'ratingsum',
}

# Supabase columns that are not directly mapped from CSV and will be set to None
supabase_only_columns = [
    'average_rating',
    'primary_language',
    'ratings_count',
    'ratingsum',
]

# Supabase columns that need to be in the output CSV header, in the correct order
# Ensure this order matches your Supabase table column order if you use CSV import
# that relies on order, otherwise alphabetical is fine. Let's use alphabetical for clarity.
supabase_column_order = sorted(column_mapping.values()) + sorted([col for col in supabase_only_columns if col not in column_mapping.values()])
# Adjusting order to match the provided SQL schema order as much as possible for better compatibility
supabase_column_order = [
    'id',
    'average_rating',
    'category1',
    'citations',
    'description',
    'folder1',
    'github_owner',
    'github_repo',
    'github_stars',
    'jif',
    'journal',
    'last_commit',
    'last_commit_ago',
    'license',
    'link',
    'page_icon',
    'primary_language',
    'publication',
    'ratings_count',
    'ratingsum',
    'repo_link', # Using repo_link as the primary source, will parse owner/repo from it
    'webserver',
    'tags',
    'package_name', # New column
]

def parse_date(date_str):
    """Attempts to parse a date string using common formats and returns in ISO 8601 format."""
    if not date_str:
        return None
    try:
        # Try parsing ISO 8601 first
        date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return date_obj.isoformat()
    except ValueError:
        try:
            # Try parsing 'DD-Mon' format (assuming current year)
            # This is a simplification; for production, you might need more robust parsing
            date_obj = datetime.strptime(date_str, '%d-%b')
            # Set year to current year or infer from context if possible
            # For simplicity, using a fixed year or current year might be acceptable for migration
            # Let's assume current year for now. You might need to adjust this.
            current_year = datetime.now().year
            date_obj = date_obj.replace(year=current_year)
            return date_obj.isoformat()
        except ValueError:
            print(f"Warning: Could not parse date string '{date_str}'. Setting to None.")
            return None
    except Exception as e:
        print(f"Warning: An unexpected error occurred while parsing date '{date_str}': {e}. Setting to None.")
        return None


def parse_github_info(repo_url):
    """Parses GitHub owner and repo from a URL."""
    if not repo_url or 'github.com' not in repo_url:
        return None, None
    try:
        parsed_url = urlparse(repo_url)
        path_parts = [part for part in parsed_url.path.split('/') if part]
        if len(path_parts) >= 2:
            owner = path_parts[0]
            repo = path_parts[1].replace('.git', '') # Remove .git suffix
            return owner, repo
    except Exception as e:
        print(f"Warning: Could not parse GitHub info from {repo_url}: {e}")
        return None, None
    return None, None


def transform_row(row):
    """Transform a single CSV row dict into a Supabase-shaped row dict."""
    transformed_row: dict = {'id': str(uuid.uuid4())}

    for csv_header, supabase_column in column_mapping.items():
        if csv_header in row:
            value = row[csv_header]
            if supabase_column == 'tags':
                transformed_row[supabase_column] = json.dumps(
                    [tag.strip() for tag in value.split(',') if tag.strip()]
                ) if value else json.dumps([])
            elif supabase_column in ['github_stars', 'citations', 'ratings_count', 'ratingsum']:
                try:
                    transformed_row[supabase_column] = int(value) if value else None
                except ValueError:
                    print(f"Warning: Could not convert '{value}' to integer for column '{supabase_column}'. Setting to None.")
                    transformed_row[supabase_column] = None
            elif supabase_column in ['jif', 'average_rating']:
                try:
                    transformed_row[supabase_column] = float(value) if value else None
                except ValueError:
                    print(f"Warning: Could not convert '{value}' to float for column '{supabase_column}'. Setting to None.")
                    transformed_row[supabase_column] = None
            elif supabase_column == 'last_commit':
                transformed_row[supabase_column] = parse_date(value)
            elif supabase_column == 'repo_link':
                transformed_row[supabase_column] = row.get('REPO_LINK') or row.get('CODE') or None
            elif supabase_column == 'package_name':
                transformed_row[supabase_column] = value if value else None
            else:
                transformed_row[supabase_column] = value if value else None
        else:
            if supabase_column not in transformed_row:
                transformed_row[supabase_column] = None

    for col in supabase_only_columns:
        if col not in transformed_row:
            transformed_row[col] = None

    repo_link_value = transformed_row.get('repo_link')
    if repo_link_value:
        owner, repo = parse_github_info(repo_link_value)
        transformed_row['github_owner'] = owner
        transformed_row['github_repo'] = repo
    else:
        transformed_row['github_owner'] = None
        transformed_row['github_repo'] = None

    return transformed_row


def transform(input_path=input_csv_path, output_path=output_csv_path):
    """Read input CSV, transform every row, write output CSV."""
    transformed_data = []
    with open(input_path, mode='r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        for row in reader:
            transformed_data.append(transform_row(row))

    with open(output_path, mode='w', newline='', encoding='utf-8') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=supabase_column_order)
        writer.writeheader()
        writer.writerows(transformed_data)

    return transformed_data


if __name__ == "__main__":
    transform()
    print(f"Transformation complete. Transformed data saved to {output_csv_path}")