import { describe, it, expect } from 'vitest';
import { 
  parseTags, 
  formatLicense, 
  truncateDescription, 
  formatTag,
  tagsToString,
  getPackageIcon,
  extractDomain,
  parseCSVRow 
} from '../../src/utils/package';
import type { Package } from '../../src/types';

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
      expect(result).not.toMatch(/\w\.\.\.$/); // Should not cut words
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

  describe('tagsToString', () => {
    it('should convert array to comma-separated string', () => {
      expect(tagsToString(['tag1', 'tag2', 'tag3'])).toBe('tag1, tag2, tag3');
    });

    it('should handle empty array', () => {
      expect(tagsToString([])).toBe('');
    });

    it('should handle single tag', () => {
      expect(tagsToString(['single'])).toBe('single');
    });
  });

  describe('getPackageIcon', () => {
    it('should return appropriate icons based on tags', () => {
      const dbPackage = { tags: ['database', 'sql'] } as Package;
      expect(getPackageIcon(dbPackage)).toBe('database');

      const vizPackage = { tags: ['visualization', 'charts'] } as Package;
      expect(getPackageIcon(vizPackage)).toBe('chart');
    });

    it('should return github icon for GitHub repos', () => {
      const githubPackage = { 
        repo_link: 'https://github.com/user/repo',
        tags: [] 
      } as Package;
      expect(getPackageIcon(githubPackage)).toBe('github');
    });

    it('should return default package icon', () => {
      const defaultPackage = { 
        tags: ['other'], 
        repo_link: 'https://example.com' 
      } as Package;
      expect(getPackageIcon(defaultPackage)).toBe('package');
    });

    it('should handle undefined tags and links', () => {
      const emptyPackage = {} as Package;
      expect(getPackageIcon(emptyPackage)).toBe('package');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from valid URLs', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('example.com');
      expect(extractDomain('http://subdomain.example.org')).toBe('subdomain.example.org');
      expect(extractDomain('https://github.com/user/repo')).toBe('github.com');
    });

    it('should remove www prefix', () => {
      expect(extractDomain('https://www.google.com')).toBe('google.com');
      expect(extractDomain('http://www.subdomain.example.com')).toBe('subdomain.example.com');
    });

    it('should handle invalid URLs', () => {
      expect(extractDomain('not-a-url')).toBe('Invalid URL');
      expect(extractDomain('http://')).toBe('Invalid URL');
      expect(extractDomain('')).toBe('Invalid URL');
    });

    it('should handle different protocols', () => {
      expect(extractDomain('ftp://files.example.com')).toBe('files.example.com');
      expect(extractDomain('https://secure.example.com')).toBe('secure.example.com');
    });
  });

  describe('parseCSVRow', () => {
    it('should parse complete CSV row', () => {
      const csvRow = {
        package_name: 'Test Package',
        description: 'A test package',
        tags: '["python", "analysis"]',
        repo_url: 'https://github.com/test/repo',
        publication_url: 'https://doi.org/10.1000/test',
        webserver_url: 'https://test.example.com',
        link_url: 'https://docs.example.com'
      };

      const result = parseCSVRow(csvRow);

      expect(result.name).toBe('Test Package');
      expect(result.description).toBe('A test package');
      expect(result.tags).toEqual(['python', 'analysis']);
      expect(result.urls.repository).toBe('https://github.com/test/repo');
      expect(result.urls.publication).toBe('https://doi.org/10.1000/test');
      expect(result.urls.webserver).toBe('https://test.example.com');
      expect(result.urls.other).toBe('https://docs.example.com');
    });

    it('should handle missing fields', () => {
      const csvRow = {
        package_name: 'Minimal Package'
      };

      const result = parseCSVRow(csvRow);

      expect(result.name).toBe('Minimal Package');
      expect(result.description).toBe('');
      expect(result.tags).toEqual([]);
      expect(result.urls.repository).toBeUndefined();
      expect(result.urls.publication).toBeUndefined();
      expect(result.urls.webserver).toBeUndefined();
      expect(result.urls.other).toBeUndefined();
    });

    it('should trim whitespace from fields', () => {
      const csvRow = {
        package_name: '  Trimmed Package  ',
        description: '  Description with spaces  ',
        repo_url: '  https://github.com/test/repo  '
      };

      const result = parseCSVRow(csvRow);

      expect(result.name).toBe('Trimmed Package');
      expect(result.description).toBe('Description with spaces');
      expect(result.urls.repository).toBe('https://github.com/test/repo');
    });

    it('should filter out empty URLs', () => {
      const csvRow = {
        package_name: 'Test Package',
        repo_url: '',
        publication_url: '   ',
        webserver_url: 'https://test.example.com',
        link_url: undefined
      };

      const result = parseCSVRow(csvRow);

      expect(result.urls.repository).toBeUndefined();
      expect(result.urls.publication).toBeUndefined();
      expect(result.urls.webserver).toBe('https://test.example.com');
      expect(result.urls.other).toBeUndefined();
    });

    it('should handle different tag formats', () => {
      const csvRowJson = {
        package_name: 'JSON Tags',
        tags: '["tag1", "tag2"]'
      };

      const csvRowString = {
        package_name: 'String Tags',
        tags: 'tag1, tag2'
      };

      expect(parseCSVRow(csvRowJson).tags).toEqual(['tag1', 'tag2']);
      expect(parseCSVRow(csvRowString).tags).toEqual(['tag1', 'tag2']);
    });
  });
});