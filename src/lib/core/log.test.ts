import { describe, expect, it } from 'vitest';
import { futureImportDates } from './log';

const TODAY = '2026-06-15';

describe('futureImportDates', () => {
  it('returns only dates after today, distinct and sorted', () => {
    const csv = [
      'Date,Hours',
      '2026-06-14,8', // past
      '2026-06-15,8', // today
      '2026-06-19,8', // future
      '2026-06-16,8', // future (out of order)
      '2026-06-16,2', // future dup (second shift, same day)
    ].join('\n');
    expect(futureImportDates(csv, TODAY)).toEqual(['2026-06-16', '2026-06-19']);
  });

  it('skips off-day rows (no punches, zero/blank hours) so they never prompt', () => {
    const csv = ['Date,Hours,Clock In,Clock Out', '2026-06-20,0,,', '2026-06-21,,,'].join('\n');
    expect(futureImportDates(csv, TODAY)).toEqual([]);
  });

  it('counts a future row that has clock punches but no hours column value', () => {
    const csv = ['Date,Clock In,Clock Out', '2026-06-20,09:00,17:00'].join('\n');
    expect(futureImportDates(csv, TODAY)).toEqual(['2026-06-20']);
  });

  it('honors header aliases and weekday-prefixed M/D/YY dates', () => {
    const csv = ['Day,Total', 'Fri 6/19/26,8', 'Mon 6/15/26,8'].join('\n');
    expect(futureImportDates(csv, TODAY)).toEqual(['2026-06-19']);
  });

  it('returns [] when there is no date column, unparseable text, or no data rows', () => {
    expect(futureImportDates('Hours,Note\n8,hi', TODAY)).toEqual([]);
    expect(futureImportDates('', TODAY)).toEqual([]);
    expect(futureImportDates('Date,Hours', TODAY)).toEqual([]);
  });

  it('ignores unrecognized date strings rather than throwing', () => {
    const csv = ['Date,Hours', 'someday,8', '2026-06-30,8'].join('\n');
    expect(futureImportDates(csv, TODAY)).toEqual(['2026-06-30']);
  });
});
