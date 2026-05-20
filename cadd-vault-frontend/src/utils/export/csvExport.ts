import Papa from 'papaparse';
import { PackageWithNormalizedData } from '../../types';

export interface ExportColumn {
  header: string;
  accessor: (pkg: PackageWithNormalizedData) => string | number | null | undefined;
}

const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const joinArray = (arr: string[] | undefined): string =>
  Array.isArray(arr) ? arr.join('; ') : '';

// Cells beginning with one of these characters are interpreted as a formula
// by Excel / Google Sheets / LibreOffice (CSV injection). Package and
// suggestion text is user-influenced, so any such cell is prefixed with a
// single quote to force the spreadsheet to treat it as literal text.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

const neutralizeCsvValue = (
  value: string | number | null | undefined,
): string | number | null | undefined => {
  if (typeof value === 'string' && FORMULA_TRIGGER.test(value)) {
    return `'${value}`;
  }
  return value;
};

export const PACKAGE_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Package Name', accessor: (p) => p.package_name },
  { header: 'Description', accessor: (p) => p.description },
  { header: 'Folder', accessor: (p) => p.folder },
  { header: 'Category', accessor: (p) => p.category },
  { header: 'Tags', accessor: (p) => joinArray(p.tags) },
  { header: 'License', accessor: (p) => p.license },
  { header: 'GitHub Stars', accessor: (p) => p.github_stars },
  { header: 'Citations', accessor: (p) => p.citations },
  { header: 'Average Rating', accessor: (p) => p.average_rating },
  { header: 'Ratings Count', accessor: (p) => p.ratings_count },
  { header: 'Repository', accessor: (p) => p.repo_link },
  { header: 'Publication', accessor: (p) => p.publication },
  { header: 'Web Server', accessor: (p) => p.webserver },
  { header: 'Link', accessor: (p) => p.link },
  { header: 'Last Updated', accessor: (p) => formatDate(p.last_updated) },
];

export const serializePackagesToCsv = (
  packages: PackageWithNormalizedData[],
  columns: ExportColumn[] = PACKAGE_EXPORT_COLUMNS,
): string => {
  const rows = packages.map((pkg) => {
    const row: Record<string, string | number | null | undefined> = {};
    for (const col of columns) {
      row[col.header] = neutralizeCsvValue(col.accessor(pkg) ?? '');
    }
    return row;
  });

  return Papa.unparse(rows, {
    columns: columns.map((c) => c.header),
    quotes: false,
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ',',
    header: true,
    newline: '\r\n',
  });
};

export const buildExportFilename = (date: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `cadd-vault-export-${stamp}.csv`;
};

export const triggerCsvDownload = (csv: string, filename: string): void => {
  const UTF8_BOM = '﻿';
  const blob = new Blob([UTF8_BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
