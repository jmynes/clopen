import { afterEach, describe, expect, it } from 'vitest';
import {
  effectiveZone,
  formatTimestamp,
  formatWeekRange,
  setAppTimeZone,
  todayISO,
  zonedParts,
  zonedToMs,
} from './date';

describe('formatWeekRange', () => {
  it('omits the year by default', () => {
    expect(formatWeekRange('2026-01-05')).toBe('Jan 05 – 11');
    expect(formatWeekRange('2026-01-26')).toBe('Jan 26 – Feb 01');
  });

  it('shows the year when asked (same year)', () => {
    expect(formatWeekRange('2026-01-05', true)).toBe('Jan 05 – 11, 2026');
    expect(formatWeekRange('2026-01-26', true)).toBe('Jan 26 – Feb 01, 2026');
  });

  it('shows both years when the week straddles a year boundary', () => {
    expect(formatWeekRange('2025-12-29', true)).toBe('Dec 29, 2025 – Jan 04, 2026');
  });
});

describe('effectiveZone', () => {
  it('returns the zone itself when observing DST', () => {
    expect(effectiveZone('America/Chicago', true)).toBe('America/Chicago');
  });
  it('pins a DST zone to its standard offset when opting out', () => {
    expect(effectiveZone('America/Chicago', false)).toBe('Etc/GMT+6'); // Etc names invert the sign
    expect(effectiveZone('America/New_York', false)).toBe('Etc/GMT+5');
  });
  it('southern hemisphere: standard time is the July offset', () => {
    expect(effectiveZone('Australia/Sydney', false)).toBe('Etc/GMT-10');
  });
  it('zones without DST pass through unchanged', () => {
    expect(effectiveZone('Asia/Tokyo', false)).toBe('Asia/Tokyo');
    expect(effectiveZone('UTC', false)).toBe('UTC');
  });
  it('fractional-DST zone passes through unchanged (no Etc/GMT twin)', () => {
    expect(effectiveZone('Australia/Lord_Howe', false)).toBe('Australia/Lord_Howe');
  });
});

describe('app zone', () => {
  afterEach(() => setAppTimeZone(null));

  it('zonedToMs and zonedParts round-trip in the configured zone', () => {
    setAppTimeZone('America/Chicago');
    const ms = zonedToMs('2026-01-15', '09:00');
    expect(zonedParts(ms)).toEqual({ date: '2026-01-15', hhmm: '09:00' });
  });
  it('summer wall-clock differs by an hour between CDT and the fixed standard offset', () => {
    setAppTimeZone('America/Chicago');
    const cdt = zonedToMs('2026-07-15', '09:00');
    setAppTimeZone('Etc/GMT+6');
    const fixed = zonedToMs('2026-07-15', '09:00');
    expect(fixed - cdt).toBe(3_600_000);
  });
  it('the app zone decides which calendar date an instant falls on', () => {
    const ms = Date.UTC(2026, 5, 10, 23, 30); // 2026-06-10T23:30Z
    setAppTimeZone('America/Chicago');
    expect(zonedParts(ms).date).toBe('2026-06-10'); // 18:30 CDT
    setAppTimeZone('Asia/Tokyo');
    expect(zonedParts(ms).date).toBe('2026-06-11'); // 08:30 JST next day
  });
  it('todayISO follows the app zone', () => {
    setAppTimeZone('UTC');
    const utcDay = todayISO();
    expect(utcDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('formatTimestamp renders epoch seconds in the app zone', () => {
    setAppTimeZone('America/Chicago');
    const secs = Math.floor(zonedToMs('2026-06-10', '21:14') / 1000);
    expect(formatTimestamp(secs)).toBe('Jun 10, 09:14 PM');
    expect(formatTimestamp(secs, '24h')).toBe('Jun 10, 21:14');
  });
});
