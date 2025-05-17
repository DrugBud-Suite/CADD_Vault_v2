export interface Package {
	id: string;
	package_name: string;
	publication?: string;
	webserver?: string;
	link?: string; // General purpose link
	repo_link?: string; // Specific link to code repository
	folder1?: string;
	category1?: string;
	subcategory1?: string;
	subsubcategory1?: string;
	description?: string;
	github_stars?: number;
	last_commit?: Date | null;
	last_commit_ago?: string;
	license?: string;
	citations?: number;
	journal?: string;
	jif?: number;
	page_icon?: string;
	tags?: string[];
	github_owner?: string;
	github_repo?: string;
	// Supabase rating fields
	average_rating?: number;
	ratings_count?: number;
	name?: string;
	version?: string;
	repository?: string;
}

// Interface for individual user ratings (Supabase schema)
export interface Rating {
	id: string; // Supabase UUID
	package_id: string; // Matches public.packages.id (text)
	user_id: string; // Matches auth.users.id (text in this case)
	rating: number; // Matches public.ratings.rating (integer)
	created_at: string; // Matches public.ratings.created_at (timestamp with time zone)
}