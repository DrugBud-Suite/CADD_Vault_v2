import { DuplicateInfo, DuplicateCheckOptions } from './types';
import { normalizeString, calculateSimilarity } from './algorithms';
import { Package, PackageSuggestion } from '../../types';

export * from './types';
export * from './algorithms';

/**
 * Finds duplicates for a given item within collections
 * @param item The package suggestion to check for duplicates
 * @param suggestions Array of existing package suggestions
 * @param packages Array of existing packages
 * @param options Configuration options for duplicate detection
 * @returns Array of duplicate information found
 */
export const findDuplicates = (
  item: PackageSuggestion,
  suggestions: PackageSuggestion[],
  packages: Package[],
  options: DuplicateCheckOptions = {}
): DuplicateInfo[] => {
  const {
    threshold = 0.8,
    checkExact = true,
    checkSimilar = true,
  } = options;
  
  const duplicates: DuplicateInfo[] = [];
  const itemName = item.package_name;
  
  // Check exact duplicates first
  if (checkExact) {
    // Check against existing suggestions
    const exactSuggestionMatch = suggestions.find(
      suggestion => suggestion.id !== item.id && 
      normalizeString(suggestion.package_name) === normalizeString(itemName)
    );
    
    if (exactSuggestionMatch) {
      duplicates.push({
        type: 'exact_duplicate',
        conflictingItem: exactSuggestionMatch.package_name,
        conflictingId: exactSuggestionMatch.id,
        source: 'suggestions',
        similarity: 1.0
      });
    }
    
    // Check against existing packages
    const exactPackageMatch = packages.find(
      pkg => normalizeString(pkg.package_name) === normalizeString(itemName)
    );
    
    if (exactPackageMatch) {
      duplicates.push({
        type: 'exact_duplicate',
        conflictingItem: exactPackageMatch.package_name,
        conflictingId: exactPackageMatch.id,
        source: 'packages',
        similarity: 1.0
      });
    }
  }
  
  // Check similar items only if no exact duplicates found
  if (checkSimilar && duplicates.length === 0) {
    // Check similar suggestions
    for (const suggestion of suggestions) {
      if (suggestion.id === item.id) continue;
      
      const similarity = calculateSimilarity(itemName, suggestion.package_name);
      if (similarity >= threshold) {
        duplicates.push({
          type: 'similar_suggestion',
          conflictingItem: suggestion.package_name,
          conflictingId: suggestion.id,
          source: 'suggestions',
          similarity
        });
      }
    }
    
    // Check similar packages
    for (const pkg of packages) {
      const similarity = calculateSimilarity(itemName, pkg.package_name);
      if (similarity >= threshold) {
        duplicates.push({
          type: 'similar_package',
          conflictingItem: pkg.package_name,
          conflictingId: pkg.id,
          source: 'packages',
          similarity
        });
      }
    }
  }
  
  return duplicates;
};