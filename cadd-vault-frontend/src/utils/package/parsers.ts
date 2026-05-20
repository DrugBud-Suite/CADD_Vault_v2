/**
 * Parses tags from various input formats
 * @param input Tags as string, string array, or null
 * @returns Clean array of tag strings
 */
export const parseTags = (input: string | string[] | null): string[] => {
  if (!input) return [];
  
  // If already an array, clean and return
  if (Array.isArray(input)) {
    return input
      .filter(tag => typeof tag === 'string' && tag.trim())
      .map(tag => tag.trim());
  }
  
  // If string, try to parse as JSON first
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parseTags(parsed);
      }
    } catch {
      // Not JSON, treat as comma-separated
      return input
        .split(/[,;]/)
        .map(tag => tag.trim())
        .filter(Boolean);
    }
  }
  
  return [];
};