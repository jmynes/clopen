import { describe, expect, it } from 'vitest';
import { chartWindow } from './dashboard-period';

const EPOCH = '2025-03-16';
const TODAY = '2026-06-24';

describe('chartWindow', () => {
  it('current period: spans the year up to today', () => {
    expect(chartWindow({ bucketStart: '2026-06-01', today: TODAY, epoch: EPOCH })).toEqual({
      year: '2026',
      rangeStart: '2026-01-01',
      asOf: '2026-06-24',
    });
  });

  it('a different period in the same year does NOT shorten the chart', () => {
    // Browsing back to April still shows the whole year-to-today, not Jan–April.
    expect(chartWindow({ bucketStart: '2026-04-01', today: TODAY, epoch: EPOCH })).toEqual({
      year: '2026',
      rangeStart: '2026-01-01',
      asOf: '2026-06-24',
    });
  });

  it('prior year: the chart follows the year and the epoch floors the range start', () => {
    expect(chartWindow({ bucketStart: '2025-09-01', today: TODAY, epoch: EPOCH })).toEqual({
      year: '2025',
      rangeStart: '2025-03-16', // epoch, not 2025-01-01
      asOf: '2025-12-31', // the full prior year
    });
  });

  it('whole prior year period: full year clamped to the epoch', () => {
    expect(chartWindow({ bucketStart: '2025-01-01', today: TODAY, epoch: EPOCH })).toEqual({
      year: '2025',
      rangeStart: '2025-03-16',
      asOf: '2025-12-31',
    });
  });

  it('period straddling a year boundary: charts the start year', () => {
    // A bi-week from late Dec 2025 into early Jan 2026 charts 2025.
    expect(chartWindow({ bucketStart: '2025-12-29', today: TODAY, epoch: EPOCH })).toEqual({
      year: '2025',
      rangeStart: '2025-03-16',
      asOf: '2025-12-31',
    });
  });

  it('future period within this year: still year-to-today', () => {
    expect(chartWindow({ bucketStart: '2026-07-01', today: TODAY, epoch: EPOCH })).toEqual({
      year: '2026',
      rangeStart: '2026-01-01',
      asOf: '2026-06-24',
    });
  });
});
