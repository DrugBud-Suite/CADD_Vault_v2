/**
 * Normalizes a string for comparison by removing punctuation,
 * converting to lowercase, and normalizing whitespace
 */
export const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
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