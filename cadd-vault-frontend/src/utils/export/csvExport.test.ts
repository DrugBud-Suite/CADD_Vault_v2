import { describe, expect, it } from 'vitest';
import { PackageWithNormalizedData } from '../../types';
import {
  buildExportFilename,
  PACKAGE_EXPORT_COLUMNS,
  serializePackagesToCsv,
} from './csvExport';

const makePkg = (overrides: Partial<PackageWithNormalizedData> = {}): PackageWithNormalizedData => ({
  id: 'pkg-1',
  package_name: 'TestPkg',
  description: 'A test package',
  folder: 'ADMET',
  category: 'Pretrained Models',
  tags: ['admet', 'bbb'],
  license: 'MIT',
  github_stars: 42,
  citations: 10,
  average_rating: 4.5,
  ratings_count: 8,
  repo_link: 'https://github.com/foo/bar',
  publication: 'https://doi.org/10.1/abc',
  webserver: 'https://example.com',
  link: 'https://example.com/info',
  last_updated: '2026-05-16T14:32:00.000Z',
  ...overrides,
});

describe('serializePackagesToCsv', () => {
  it('produces a header row matching the curated column list', () => {
    const csv = serializePackagesToCsv([makePkg()]);
    const header = csv.split('\r\n')[0];
    const expected = PACKAGE_EXPORT_COLUMNS.map((c) => c.header).join(',');
    expect(header).toBe(expected);
  });

  it('joins tags with semicolons', () => {
    const csv = serializePackagesToCsv([
      makePkg({ tags: ['alpha', 'beta', 'gamma'] }),
    ]);
    expect(csv).toContain('alpha; beta; gamma');
  });

  it('emits empty cell when tags is an empty array', () => {
    const csv = serializePackagesToCsv([makePkg({ tags: [] })]);
    expect(csv).not.toContain('undefined');
  });

  it('escapes commas, double quotes, and newlines per RFC 4180', () => {
    const tricky = makePkg({
      package_name: 'name, with comma',
      description: 'has "quotes" and\nnewline',
    });
    const csv = serializePackagesToCsv([tricky]);
    expect(csv).toContain('"name, with comma"');
    expect(csv).toContain('"has ""quotes"" and\nnewline"');
  });

  it('preserves unicode characters (Greek letters, accents)', () => {
    const csv = serializePackagesToCsv([
      makePkg({ package_name: 'α-Schrödinger', description: 'β-BBB' }),
    ]);
    expect(csv).toContain('α-Schrödinger');
    expect(csv).toContain('β-BBB');
  });

  it('renders null/undefined fields as empty strings', () => {
    const sparse = makePkg({
      description: undefined,
      license: undefined,
      github_stars: undefined,
      citations: undefined,
      publication: undefined,
    });
    const csv = serializePackagesToCsv([sparse]);
    const dataRow = csv.split('\r\n')[1];
    expect(dataRow).not.toContain('undefined');
    expect(dataRow).not.toContain('null');
  });

  it('formats last_updated as YYYY-MM-DD', () => {
    const csv = serializePackagesToCsv([
      makePkg({ last_updated: '2026-05-16T14:32:00.000Z' }),
    ]);
    expect(csv).toContain('2026-05-16');
    expect(csv).not.toContain('T14:32');
  });

  it('neutralizes cells that begin with a formula trigger character', () => {
    const malicious = makePkg({
      package_name: '=HYPERLINK("http://evil.com","click")',
      description: '+1+2',
      license: '-2+3',
      folder: '@SUM(A1:A9)',
    });
    const csv = serializePackagesToCsv([malicious]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+1+2");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain("'@SUM(A1:A9)");
    // The raw formula must never appear directly after a cell boundary.
    expect(csv).not.toMatch(/(^|,|")=HYPERLINK/);
  });

  it('leaves safe values untouched (no spurious quote prefix)', () => {
    const csv = serializePackagesToCsv([makePkg({ package_name: 'SafeName' })]);
    expect(csv).toContain('SafeName');
    expect(csv).not.toContain("'SafeName");
  });

  it('handles multiple packages with one header row', () => {
    const csv = serializePackagesToCsv([
      makePkg({ id: '1', package_name: 'First' }),
      makePkg({ id: '2', package_name: 'Second' }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[1]).toContain('First');
    expect(lines[2]).toContain('Second');
  });
});

describe('buildExportFilename', () => {
  it('produces a filename in the expected pattern', () => {
    const date = new Date(2026, 4, 16, 14, 32);
    const name = buildExportFilename(date);
    expect(name).toBe('cadd-vault-export-2026-05-16-1432.csv');
  });

  it('zero-pads single-digit month, day, hour, minute', () => {
    const date = new Date(2026, 0, 1, 3, 7);
    const name = buildExportFilename(date);
    expect(name).toBe('cadd-vault-export-2026-01-01-0307.csv');
  });
});
