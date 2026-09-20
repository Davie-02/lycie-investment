/**
 * CSV for spreadsheets. Two safety rules:
 *  - values are quoted and escaped so commas/quotes/newlines can't break rows;
 *  - a value starting with = + - @ (or a tab/CR) is prefixed with an apostrophe,
 *    because Excel/Sheets would otherwise run it as a formula — a real attack
 *    when the data came from public forms ("=HYPERLINK(...)" in a name field).
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  // Phone numbers (+265 991…) and plain numbers (-5) start with + or - but cannot run as formulas.
  const harmless = /^\+[\d\s().-]+$/.test(text) || /^-?\d+(\.\d+)?$/.test(text);
  if (!harmless && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
