import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCsv('a,b\n"x,y",2')).toEqual([
      ['a', 'b'],
      ['x,y', '2'],
    ]);
  });

  it('handles escaped quotes', () => {
    expect(parseCsv('"he said ""hi""",2')).toEqual([['he said "hi"', '2']]);
  });

  it('handles quoted newlines', () => {
    expect(parseCsv('"line1\nline2",b')).toEqual([['line1\nline2', 'b']]);
  });

  it('normalizes CRLF and ignores a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('toCsv', () => {
  it('joins rows, quoting only when needed', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['x,y', 1],
      ]),
    ).toBe('a,b\n"x,y",1');
  });

  it('renders null as empty and escapes quotes', () => {
    expect(toCsv([['he "said"', null]])).toBe('"he ""said""",');
  });

  it('round-trips through parseCsv', () => {
    const rows = [
      ['Date', 'Note'],
      ['2026-01-05', 'lunch, then code'],
      ['2026-01-06', 'said "hi"'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
