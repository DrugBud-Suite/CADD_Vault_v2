import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  findDuplicates
} from '../../src/utils/duplicate-detection';
import { calculateLevenshteinSimilarity, normalizeString, calculateSimilarity } from '../../src/utils/duplicate-detection/algorithms';
import type { Package, PackageSuggestion } from '../../src/types';

describe('Duplicate Detection Utilities', () => {
  describe('Algorithm Functions', () => {
    describe('normalizeString', () => {
      it('should convert to lowercase', () => {
        expect(normalizeString('UPPERCASE')).toBe('uppercase');
      });

      it('should remove extra spaces', () => {
        expect(normalizeString('  multiple   spaces  ')).toBe('multiple spaces');
      });

      it('should remove special characters except alphanumeric and spaces', () => {
        expect(normalizeString('hello-world_123!@#')).toBe('helloworld_123');
      });

      it('should handle empty strings', () => {
        expect(normalizeString('')).toBe('');
        expect(normalizeString('   ')).toBe('');
      });
    });

    describe('calculateLevenshteinSimilarity', () => {
      it('should return 1.0 for identical strings', () => {
        expect(calculateLevenshteinSimilarity('hello', 'hello')).toBe(1.0);
      });

      it('should return 0.0 for completely different strings', () => {
        const similarity = calculateLevenshteinSimilarity('abc', 'xyz');
        expect(similarity).toBe(0.0);
      });

      it('should calculate similarity for partially similar strings', () => {
        const similarity = calculateLevenshteinSimilarity('kitten', 'sitting');
        expect(similarity).toBeGreaterThan(0.5);
        expect(similarity).toBeLessThan(1.0);
      });

      it('should handle empty strings', () => {
        expect(calculateLevenshteinSimilarity('', '')).toBe(1.0);
        expect(calculateLevenshteinSimilarity('hello', '')).toBe(0.0);
        expect(calculateLevenshteinSimilarity('', 'hello')).toBe(0.0);
      });

      it('should be case-insensitive when strings are normalized', () => {
        const str1 = normalizeString('Hello World');
        const str2 = normalizeString('HELLO WORLD');
        expect(calculateLevenshteinSimilarity(str1, str2)).toBe(1.0);
      });
    });
  });

  describe('Duplicate Detection Functions', () => {
    let mockPackages: Package[];
    let mockSuggestions: PackageSuggestion[];

    beforeEach(() => {
      mockPackages = [
        {
          id: '1',
          package_name: 'Test Package',
          description: 'A test package for testing',
          tags: ['test', 'package'],
          created_at: '2023-01-01',
          updated_at: '2023-01-01'
        },
        {
          id: '2', 
          package_name: 'Another Package',
          description: 'Another package for testing',
          tags: ['another', 'test'],
          created_at: '2023-01-02',
          updated_at: '2023-01-02'
        },
        {
          id: '3',
          package_name: 'Test Package Similar',
          description: 'A similar test package',
          tags: ['test', 'similar'],
          created_at: '2023-01-03',
          updated_at: '2023-01-03'
        }
      ] as Package[];

      mockSuggestions = [
        {
          id: '1',
          package_name: 'Suggested Package',
          description: 'A suggested package',
          status: 'pending',
          created_at: '2023-01-01',
          suggested_by_user_id: 'user1'
        },
        {
          id: '2',
          package_name: 'Test Package',
          description: 'Exact duplicate of existing package',
          status: 'pending', 
          created_at: '2023-01-02',
          suggested_by_user_id: 'user2'
        }
      ] as PackageSuggestion[];
    });

    describe('calculateSimilarity', () => {
      it('should return 1.0 for identical strings', () => {
        expect(calculateSimilarity('test package', 'test package')).toBe(1.0);
      });

      it('should calculate word-based similarity', () => {
        const similarity = calculateSimilarity('machine learning toolkit', 'machine learning framework');
        expect(similarity).toBeGreaterThan(0.5);
        expect(similarity).toBeLessThan(1.0);
      });

      it('should handle completely different strings', () => {
        const similarity = calculateSimilarity('completely different', 'nothing similar');
        expect(similarity).toBe(0);
      });

      it('should be case-insensitive', () => {
        expect(calculateSimilarity('Test Package', 'TEST PACKAGE')).toBe(1.0);
      });
    });

    describe('findDuplicates', () => {
      it('should find exact duplicates in packages', () => {
        const testSuggestion = {
          id: 'test-1',
          package_name: 'Test Package',
          description: 'Test description',
          status: 'pending',
          created_at: '2023-01-01',
          suggested_by_user_id: 'user1'
        } as PackageSuggestion;

        const duplicates = findDuplicates(testSuggestion, mockSuggestions, mockPackages);
        
        expect(duplicates.length).toBeGreaterThan(0);
        expect(duplicates.some(d => d.type === 'exact_duplicate')).toBe(true);
      });

      it('should find exact duplicates in suggestions', () => {
        const testSuggestion = {
          id: 'test-new',
          package_name: 'Test Package',
          description: 'Another test',
          status: 'pending',
          created_at: '2023-01-01',
          suggested_by_user_id: 'user2'
        } as PackageSuggestion;

        const duplicates = findDuplicates(testSuggestion, mockSuggestions, mockPackages);
        
        expect(duplicates.some(d => d.source === 'suggestions')).toBe(true);
        expect(duplicates.some(d => d.source === 'packages')).toBe(true);
      });

      it('should find similar matches when no exact duplicates', () => {
        const testSuggestion = {
          id: 'test-similar',
          package_name: 'Test Package Alternative',
          description: 'Similar to test package',
          status: 'pending',
          created_at: '2023-01-01',
          suggested_by_user_id: 'user3'
        } as PackageSuggestion;

        const duplicates = findDuplicates(testSuggestion, mockSuggestions, mockPackages, { threshold: 0.3 });
        
        expect(duplicates.some(d => d.type === 'similar_package')).toBe(true);
      });

      it('should return empty array for unique names', () => {
        const testSuggestion = {
          id: 'test-unique',
          package_name: 'Completely Unique Package Name XYZ123',
          description: 'Unique package',
          status: 'pending',
          created_at: '2023-01-01',
          suggested_by_user_id: 'user4'
        } as PackageSuggestion;

        const duplicates = findDuplicates(testSuggestion, mockSuggestions, mockPackages);
        expect(duplicates).toHaveLength(0);
      });

      it('should handle empty input arrays', () => {
        const testSuggestion = {
          id: 'test-empty',
          package_name: 'Test Package',
          description: 'Test with empty arrays',
          status: 'pending',
          created_at: '2023-01-01',
          suggested_by_user_id: 'user5'
        } as PackageSuggestion;

        const duplicates = findDuplicates(testSuggestion, [], []);
        expect(duplicates).toHaveLength(0);
      });

      it('should respect threshold option', () => {
        const testSuggestion = {
          id: 'test-threshold',
          package_name: 'Test Package Similar',
          description: 'Similar package',
          status: 'pending',
          created_at: '2023-01-01',
          suggested_by_user_id: 'user6'
        } as PackageSuggestion;

        const highThreshold = findDuplicates(testSuggestion, mockSuggestions, mockPackages, { threshold: 0.9 });
        const lowThreshold = findDuplicates(testSuggestion, mockSuggestions, mockPackages, { threshold: 0.3 });
        
        expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle packages with missing names gracefully', () => {
      const packagesWithMissingNames = [
        { id: '1', package_name: '', description: 'Empty name' },
        { id: '2', package_name: null, description: 'Null name' },
        { id: '3', package_name: 'Valid Name', description: 'Valid package' }
      ] as Package[];

      const testSuggestion = {
        id: 'test-edge',
        package_name: 'Test',
        description: 'Test description',
        status: 'pending',
        created_at: '2023-01-01',
        suggested_by_user_id: 'user1'
      } as PackageSuggestion;

      expect(() => findDuplicates(testSuggestion, [], packagesWithMissingNames)).not.toThrow();
    });

    it('should handle very long package names', () => {
      const longName = 'a'.repeat(1000);
      const packages = [{ id: '1', package_name: longName, description: 'Long name' }] as Package[];
      
      const testSuggestion = {
        id: 'test-long',
        package_name: longName,
        description: 'Long name test',
        status: 'pending',
        created_at: '2023-01-01',
        suggested_by_user_id: 'user1'
      } as PackageSuggestion;
      
      expect(() => findDuplicates(testSuggestion, [], packages)).not.toThrow();
    });

    it('should handle special characters in package names', () => {
      const specialName = 'Package-Name_With!Special@Characters#123';
      const packages = [{ id: '1', package_name: specialName, description: 'Special chars' }] as Package[];
      
      const testSuggestion = {
        id: 'test-special',
        package_name: specialName,
        description: 'Special characters test',
        status: 'pending',
        created_at: '2023-01-01',
        suggested_by_user_id: 'user1'
      } as PackageSuggestion;
      
      const duplicates = findDuplicates(testSuggestion, [], packages);
      expect(duplicates[0].type).toBe('exact_duplicate');
    });
  });
});