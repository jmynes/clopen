import { describe, expect, it } from 'vitest';
import { chartWindow } from './dashboard-period';

const EPOCH = '2025-03-16';
const TODAY = '2026-06-24';

describe('chartWindow', () => {
  describe("scope 'auto' (tracks the browsed year)", () => {
    it('current period: spans the year up to today', () => {
      expect(chartWindow({ scope: 'auto', bucketStart: '2026-06-01', today: TODAY, epoch: EPOCH })).toEqual({
        rangeStart: '2026-01-01',
        asOf: '2026-06-24',
        label: '2026',
      });
    });

    it('a different period in the same year does NOT shorten the chart', () => {
      // Browsing back to April still shows the whole year-to-today, not Jan–April.
      expect(chartWindow({ scope: 'auto', bucketStart: '2026-04-01', today: TODAY, epoch: EPOCH })).toEqual({
        rangeStart: '2026-01-01',
        asOf: '2026-06-24',
        label: '2026',
      });
    });

    it('prior year: follows the year, epoch floors the range start, full year as-of', () => {
      expect(chartWindow({ scope: 'auto', bucketStart: '2025-09-01', today: TODAY, epoch: EPOCH })).toEqual({
        rangeStart: '2025-03-16', // epoch, not 2025-01-01
        asOf: '2025-12-31',
        label: '2025',
      });
    });
  });

  describe('pinned year (ignores the browsed period)', () => {
    it('pins to the given year regardless of the browsed bucket', () => {
      // Browsed period is in 2026, but the chart is pinned to 2025.
      expect(chartWindow({ scope: '2025', bucketStart: '2026-06-01', today: TODAY, epoch: EPOCH })).toEqual({
        rangeStart: '2025-03-16', // epoch floor
        asOf: '2025-12-31',
        label: '2025',
      });
    });

    it('pins to the current year, capped at today', () => {
      expect(chartWindow({ scope: '2026', bucketStart: '2025-09-01', today: TODAY, epoch: EPOCH })).toEqual({
        rangeStart: '2026-01-01',
        asOf: '2026-06-24',
        label: '2026',
      });
    });
  });

  describe("scope 'all'", () => {
    it('spans the epoch through today regardless of the browsed period', () => {
      expect(chartWindow({ scope: 'all', bucketStart: '2026-04-01', today: TODAY, epoch: EPOCH })).toEqual({
        rangeStart: '2025-03-16',
        asOf: '2026-06-24',
        label: '2025–2026',
      });
    });

    it('labels a single tracked year without a range', () => {
      expect(chartWindow({ scope: 'all', bucketStart: '2026-06-01', today: TODAY, epoch: '2026-01-05' })).toEqual({
        rangeStart: '2026-01-05',
        asOf: '2026-06-24',
        label: '2026',
      });
    });
  });
});
