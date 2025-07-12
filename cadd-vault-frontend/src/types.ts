export interface Package {
	id: string;
	package_name: string;
	publication?: string;
	webserver?: string;
	link?: string; // General purpose link
	repo_link?: string; // Specific link to code repository
	description?: string;
	github_stars?: number;
	last_commit?: Date | null;
	last_commit_ago?: string;
	license?: string;
	citations?: number;
	journal?: string;
	jif?: number;
	page_icon?: string;
	github_owner?: string;
	github_repo?: string;
	// Supabase rating fields
	average_rating?: number;
	ratings_count?: number;
	// User-specific rating data (populated when user is authenticated)
	user_rating?: number | null;
	user_rating_id?: string | null;
	name?: string;
	version?: string;
	repository?: string;
	last_updated?: string; // ISO timestamp of when the package was last updated
}

// Enhanced package query result that includes user rating map
export interface PackageQueryResult {
	packages: Package[];
	totalCount: number;
	userRatings?: Map<string, { rating: number; rating_id: string }>;
}

// Interface for individual user ratings (Supabase schema)
export interface Rating {
	id: string; // Supabase UUID
	package_id: string; // Matches public.packages.id (text)
	user_id: string; // Matches auth.users.id (text in this case)
	rating: number; // Matches public.ratings.rating (integer)
	created_at: string; // Matches public.ratings.created_at (timestamp with time zone)
}

export interface PackageSuggestion {
	id: string; // UUID, primary key
	suggested_by_user_id?: string | null; // UUID, from auth.users.id, nullable for anonymous
	package_name: string;
	description?: string;
	publication_url?: string;
	webserver_url?: string;
	repo_url?: string;
	link_url?: string; // General link
	license?: string;
	suggestion_reason?: string;
	status: 'pending' | 'approved' | 'rejected' | 'added';
	admin_notes?: string;
	created_at: string; // ISO timestamp string
	reviewed_at?: string | null; // ISO timestamp string
	reviewed_by_admin_id?: string | null; // UUID from auth.users.id
	// For display purposes on admin page, might join user email
	suggester_email?: string; // Not a DB column, but useful for display
}

// Add these new interfaces
export interface Tag {
    id: string;
    name: string;
    created_at: string;
}

export interface Folder {
    id: string;
    name: string;
    created_at: string;
}

export interface Category {
    id: string;
    name: string;
    created_at: string;
}

export interface FolderCategory {
    id: string;
    folder_id: string;
    category_id: string;
    folder?: Folder;
    category?: Category;
}

// New interfaces for components that need normalized data
export interface PackageWithNormalizedData extends Package {
    tags: string[];       // Array of tag names from normalized tables
    folder: string;       // Folder name from normalized tables  
    category: string;     // Category name from normalized tables
}

export interface PackageSuggestionWithNormalizedData extends PackageSuggestion {
    tags: string[];       // Array of tag names from normalized tables
    folder: string;       // Folder name from normalized tables
    category: string;     // Category name from normalized tables
}

// Raw database query result structure (for API layer only)
export interface PackageWithRelations extends Package {
    package_tags?: { tag_id: string; tags?: Tag }[];
    package_folder_categories?: { 
        folder_category_id: string; 
        folder_categories?: {
            folder_id: string;
            category_id: string;
            folders?: Folder;
            categories?: Category;
        }
    }[];
}

export interface PackageSuggestionWithRelations extends PackageSuggestion {
    package_suggestion_tags?: { tag_id: string; tags?: Tag }[];
    package_suggestion_folder_categories?: { 
        folder_category_id: string; 
        folder_categories?: {
            folder_id: string;
            category_id: string;
            folders?: Folder;
            categories?: Category;
        }
    }[];
}