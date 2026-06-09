/** Minimal RFC-4180-ish CSV. Handles quoted fields, embedded commas/newlines, and "" escapes. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  // Drop a trailing empty line produced by a final newline.
  if (!(rows.length > 0 && row.length === 1 && row[0] === '')) rows.push(row);
  return rows;
}

/** Serialize rows to CSV text, quoting cells that contain commas, quotes, or newlines. */
export function toCsv(rows: (string | number | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const value = cell === null ? '' : String(cell);
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(','),
    )
    .join('\n');
}
