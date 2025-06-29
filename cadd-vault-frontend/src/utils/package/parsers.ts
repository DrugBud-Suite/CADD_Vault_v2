import { ParsedPackageData } from './types';

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

/**
 * Extracts domain from URL for display
 * @param url URL string to extract domain from
 * @returns Domain name without www prefix
 */
export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Invalid URL';
  }
};

/**
 * Parses CSV row into package data
 * @param row Raw CSV row object
 * @returns Structured package data
 */
export const parseCSVRow = (row: any): ParsedPackageData => {
  return {
    name: String(row.package_name || '').trim(),
    description: String(row.description || '').trim(),
    tags: parseTags(row.tags),
    urls: {
      repository: String(row.repo_url || '').trim() || undefined,
      publication: String(row.publication_url || '').trim() || undefined,
      webserver: String(row.webserver_url || '').trim() || undefined,
      other: String(row.link_url || '').trim() || undefined,
    }
  };
};