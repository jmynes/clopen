import { describe, expect, it } from 'vitest';
import { formatWeekRange } from './date';

describe('formatWeekRange', () => {
  it('omits the year by default', () => {
    expect(formatWeekRange('2026-01-05')).toBe('Jan 05 – 11');
    expect(formatWeekRange('2026-01-26')).toBe('Jan 26 – Feb 1');
  });

  it('shows the year when asked (same year)', () => {
    expect(formatWeekRange('2026-01-05', true)).toBe('Jan 05 – 11, 2026');
    expect(formatWeekRange('2026-01-26', true)).toBe('Jan 26 – Feb 1, 2026');
  });

  it('shows both years when the week straddles a year boundary', () => {
    expect(formatWeekRange('2025-12-29', true)).toBe('Dec 29, 2025 – Jan 04, 2026');
  });
});
