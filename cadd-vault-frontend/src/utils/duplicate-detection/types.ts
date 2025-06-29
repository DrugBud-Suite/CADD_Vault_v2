export interface DuplicateInfo {
  type: 'exact_duplicate' | 'similar_suggestion' | 'similar_package';
  conflictingItem: string;
  conflictingId?: string;
  source: 'suggestions' | 'packages';
  similarity?: number;
}

export interface DuplicateCheckOptions {
  threshold?: number;  // Similarity threshold (0-1)
  checkExact?: boolean;
  checkSimilar?: boolean;
  ignoreCase?: boolean;
}