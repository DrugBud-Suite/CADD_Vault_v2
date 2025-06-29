import { Package } from '../../types';

/**
 * Formats license string for display
 * @param license License identifier or name
 * @returns Human-readable license name
 */
export const formatLicense = (license: string | null): string => {
  if (!license) return 'No license specified';
  
  const licenseMap: Record<string, string> = {
    'mit': 'MIT License',
    'apache-2.0': 'Apache License 2.0',
    'gpl-3.0': 'GPL v3.0',
    'bsd-3-clause': 'BSD 3-Clause',
    'mpl-2.0': 'Mozilla Public License 2.0',
  };
  
  const lower = license.toLowerCase();
  return licenseMap[lower] || license;
};

/**
 * Truncates description intelligently at word boundaries
 * @param description Description text to truncate
 * @param maxLength Maximum length of truncated text
 * @param suffix Suffix to append when truncated
 * @returns Truncated description
 */
export const truncateDescription = (
  description: string,
  maxLength: number = 150,
  suffix: string = '...'
): string => {
  if (description.length <= maxLength) return description;
  
  // Find last space before maxLength
  const truncated = description.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return truncated.substring(0, lastSpace) + suffix;
};

/**
 * Formats tags for display with proper casing
 * @param tag Tag string to format
 * @returns Formatted tag with proper casing
 */
export const formatTag = (tag: string): string => {
  // Handle special cases
  const specialCases: Record<string, string> = {
    'ml': 'ML',
    'ai': 'AI',
    'api': 'API',
    'ui': 'UI',
    'ux': 'UX',
    'cadd': 'CADD',
    'qsar': 'QSAR',
  };
  
  const lower = tag.toLowerCase();
  if (specialCases[lower]) return specialCases[lower];
  
  // Otherwise, capitalize first letter
  return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
};

/**
 * Converts tags array to string for editing
 * @param tags Array of tag strings
 * @returns Comma-separated tag string
 */
export const tagsToString = (tags: string[]): string => {
  return tags.join(', ');
};

/**
 * Gets appropriate icon based on package type or content
 * @param pkg Package object to analyze
 * @returns Icon identifier string
 */
export const getPackageIcon = (pkg: Package): string => {
  // Logic to determine icon based on tags, URLs, etc.
  if (pkg.tags?.includes('database')) return 'database';
  if (pkg.tags?.includes('visualization')) return 'chart';
  if (pkg.repo_link?.includes('github.com')) return 'github';
  return 'package';
};