/** One CSV cell: quoted when needed; formula-like text is prefixed so Excel won't run it. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  // BOM so Excel opens ₹ and Hindi text correctly.
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Paise → rupees with 2 decimals, as a plain number for spreadsheets. */
export const rupees = (paise: number | null | undefined) => (paise === null || paise === undefined ? '' : (paise / 100).toFixed(2));
