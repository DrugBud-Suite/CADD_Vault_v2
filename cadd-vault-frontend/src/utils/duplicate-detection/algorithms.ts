/**
 * Normalizes a string for comparison by removing punctuation,
 * converting to lowercase, and normalizing whitespace
 */
export const normalizeString = (str: string): string => {
  return str.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
};

/**
 * Calculates word-based similarity between two strings
 * @returns Similarity score between 0 and 1
 */
export const calculateSimilarity = (str1: string, str2: string): number => {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  
  if (norm1 === norm2) return 1.0;
  
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  const allWords = new Set([...words1, ...words2]);
  const commonWords = words1.filter(word => words2.includes(word));
  
  return commonWords.length / allWords.size;
};

/**
 * Advanced similarity using Levenshtein distance
 * Implements the Wagner-Fischer algorithm for computing edit distance
 * @param str1 First string to compare
 * @param str2 Second string to compare
 * @returns Similarity score between 0 and 1 (1 = identical, 0 = completely different)
 */
export const calculateLevenshteinSimilarity = (str1: string, str2: string): number => {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  
  if (norm1 === norm2) return 1.0;
  if (norm1.length === 0) return norm2.length === 0 ? 1.0 : 0.0;
  if (norm2.length === 0) return 0.0;
  
  // Create matrix for dynamic programming
  const matrix: number[][] = [];
  const len1 = norm1.length;
  const len2 = norm2.length;
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [];
    matrix[i][0] = i;
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill the matrix using Wagner-Fischer algorithm
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = norm1.charAt(i - 1) === norm2.charAt(j - 1) ? 0 : 1;
      
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  // Convert edit distance to similarity score
  const maxLength = Math.max(len1, len2);
  const editDistance = matrix[len1][len2];
  
  return 1.0 - (editDistance / maxLength);
};