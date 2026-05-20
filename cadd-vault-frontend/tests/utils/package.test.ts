import { describe, it, expect } from 'vitest';
import {
  parseTags,
  formatLicense,
  truncateDescription,
  formatTag
} from '../../src/utils/package';

describe('Package Utilities', () => {
  describe('parseTags', () => {
    it('should parse null/undefined input', () => {
      expect(parseTags(null)).toEqual([]);
      expect(parseTags(undefined)).toEqual([]);
    });

    it('should handle array input', () => {
      expect(parseTags(['tag1', 'tag2', 'tag3'])).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should filter out empty strings from arrays', () => {
      expect(parseTags(['tag1', '', '  ', 'tag2'])).toEqual(['tag1', 'tag2']);
    });

    it('should parse JSON string arrays', () => {
      expect(parseTags('["tag1", "tag2", "tag3"]')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse comma-separated strings', () => {
      expect(parseTags('tag1, tag2, tag3')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse semicolon-separated strings', () => {
      expect(parseTags('tag1; tag2; tag3')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle mixed separators and trim whitespace', () => {
      expect(parseTags(' tag1 , tag2 ; tag3 ')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle invalid JSON gracefully', () => {
      expect(parseTags('{"invalid": "json"}')).toEqual([]);
    });

    it('should filter out empty tags from parsed strings', () => {
      expect(parseTags('tag1,, ,tag2')).toEqual(['tag1', 'tag2']);
    });
  });

  describe('formatLicense', () => {
    it('should handle null/undefined license', () => {
      expect(formatLicense(null)).toBe('No license specified');
      expect(formatLicense(undefined as any)).toBe('No license specified');
    });

    it('should format known licenses', () => {
      expect(formatLicense('mit')).toBe('MIT License');
      expect(formatLicense('MIT')).toBe('MIT License');
      expect(formatLicense('apache-2.0')).toBe('Apache License 2.0');
      expect(formatLicense('gpl-3.0')).toBe('GPL v3.0');
      expect(formatLicense('bsd-3-clause')).toBe('BSD 3-Clause');
      expect(formatLicense('mpl-2.0')).toBe('Mozilla Public License 2.0');
    });

    it('should return original string for unknown licenses', () => {
      expect(formatLicense('Custom License')).toBe('Custom License');
      expect(formatLicense('GPL-2.0+')).toBe('GPL-2.0+');
    });

    it('should be case-insensitive for known licenses', () => {
      expect(formatLicense('MIT')).toBe('MIT License');
      expect(formatLicense('mit')).toBe('MIT License');
      expect(formatLicense('Mit')).toBe('MIT License');
    });
  });

  describe('truncateDescription', () => {
    it('should not truncate short descriptions', () => {
      const short = 'This is a short description';
      expect(truncateDescription(short)).toBe(short);
    });

    it('should truncate long descriptions at word boundaries', () => {
      const long = 'This is a very long description that should be truncated at a reasonable word boundary to avoid cutting words in half which would look unprofessional';
      const result = truncateDescription(long, 50);
      expect(result.length).toBeLessThanOrEqual(50 + 3); // +3 for ellipsis
      expect(result.endsWith('...')).toBe(true);
      const body = result.slice(0, -3);
      expect(long.startsWith(body)).toBe(true); // No partial words
      expect(long[body.length]).toBe(' '); // Cut happened at a space
    });

    it('should use custom suffix', () => {
      const long = 'This is a very long description that needs to be truncated';
      const result = truncateDescription(long, 30, ' [more]');
      expect(result.endsWith(' [more]')).toBe(true);
    });

    it('should handle custom max length', () => {
      const text = 'This is a moderately long description';
      const result = truncateDescription(text, 20);
      expect(result.length).toBeLessThanOrEqual(23); // 20 + 3 for ellipsis
    });

    it('should handle edge cases', () => {
      expect(truncateDescription('', 10)).toBe('');
      expect(truncateDescription('NoSpacesInThisVeryLongString', 10)).toBe('NoSpacesInThisVeryLongString');
    });
  });

  describe('formatTag', () => {
    it('should format special case tags', () => {
      expect(formatTag('ml')).toBe('ML');
      expect(formatTag('ai')).toBe('AI');
      expect(formatTag('api')).toBe('API');
      expect(formatTag('ui')).toBe('UI');
      expect(formatTag('cadd')).toBe('CADD');
      expect(formatTag('qsar')).toBe('QSAR');
    });

    it('should capitalize regular tags', () => {
      expect(formatTag('python')).toBe('Python');
      expect(formatTag('analysis')).toBe('Analysis');
      expect(formatTag('DATABASE')).toBe('Database');
    });

    it('should be case-insensitive for special cases', () => {
      expect(formatTag('ML')).toBe('ML');
      expect(formatTag('Ml')).toBe('ML');
      expect(formatTag('mL')).toBe('ML');
    });
  });
});
