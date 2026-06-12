import { describe, expect, it } from 'vitest';
import { goalProgress } from './savings-goals';
import type { WorkSettings } from './timesheet';

// Round numbers so expectations read at a glance: $10/h, 8h weekdays.
const settings: WorkSettings = { hourlyRate: 10, dailyHours: 8, workdays: [1, 2, 3, 4, 5] };

// 2026-06-08 is a Monday; the week runs Mon 08 … Fri 12.
const week = (hours: number[]) =>
  hours.map((h, i) => ({ date: `2026-06-${String(8 + i).padStart(2, '0')}`, hours: h }));

describe('goalProgress · all-earnings funding', () => {
  it('counts every dollar earned from the start date', () => {
    const p = goalProgress({
      entries: week([8, 8, 8, 8, 8]),
      startDate: '2026-06-08',
      targetAmount: 1000,
      funding: 'all',
      asOf: '2026-06-12',
      settings,
    });
    expect(p.saved).toBe(400); // 40h × $10
    expect(p.pct).toBe(40);
    expect(p.remaining).toBe(600);
    expect(p.reached).toBe(false);
  });

  it('ignores entries before the start date and respects breaks', () => {
    const entries = [
      { date: '2026-06-05', hours: 8 }, // before start
      { date: '2026-06-08', hours: 9, breakHours: 1 },
    ];
    const p = goalProgress({
      entries,
      startDate: '2026-06-08',
      targetAmount: 100,
      funding: 'all',
      asOf: '2026-06-12',
      settings,
    });
    expect(p.saved).toBe(80); // (9 − 1)h × $10
  });
});

describe('goalProgress · overtime funding', () => {
  it('is zero when logged hours exactly meet the schedule', () => {
    const p = goalProgress({
      entries: week([8, 8, 8, 8, 8]),
      startDate: '2026-06-08',
      targetAmount: 350,
      funding: 'overtime',
      asOf: '2026-06-12',
      settings,
    });
    expect(p.saved).toBe(0);
    expect(p.reached).toBe(false);
  });

  it('banks hours beyond the schedule at the straight rate', () => {
    const p = goalProgress({
      entries: week([10, 8, 8, 8, 9]),
      startDate: '2026-06-08',
      targetAmount: 350,
      funding: 'overtime',
      asOf: '2026-06-12',
      settings,
    });
    expect(p.saved).toBe(30); // 3h over × $10
    expect(p.remaining).toBe(320);
  });

  it('floors at zero when behind the schedule', () => {
    const p = goalProgress({
      entries: week([4, 8, 8, 8, 8]),
      startDate: '2026-06-08',
      targetAmount: 350,
      funding: 'overtime',
      asOf: '2026-06-12',
      settings,
    });
    expect(p.saved).toBe(0);
    expect(p.remaining).toBe(350);
  });

  it('counts the OT premium when the multiplier is enabled', () => {
    const p = goalProgress({
      entries: week([10, 8, 8, 8, 8]),
      startDate: '2026-06-08',
      targetAmount: 350,
      funding: 'overtime',
      asOf: '2026-06-12',
      settings,
      otMultiplierEnabled: true,
      otMultiplier: 1.5,
    });
    // 2h over: earned = 38h×$10 + 2h×$15 = $410 vs $400 expected → $30 surplus.
    expect(p.saved).toBe(30);
  });

  it('clamps the window at the tracking epoch', () => {
    const p = goalProgress({
      entries: [
        { date: '2026-06-08', hours: 12 }, // before epoch — out of the window
        { date: '2026-06-10', hours: 10 },
        { date: '2026-06-11', hours: 8 },
        { date: '2026-06-12', hours: 8 },
      ],
      startDate: '2026-06-08',
      targetAmount: 350,
      funding: 'overtime',
      asOf: '2026-06-12',
      settings,
      epoch: '2026-06-10',
    });
    // Window Wed–Fri: 26h logged vs 24h expected → 2h × $10.
    expect(p.saved).toBe(20);
  });
});

describe('goalProgress · edges', () => {
  it('a goal that starts in the future has saved nothing', () => {
    const p = goalProgress({
      entries: week([10, 10, 10, 10, 10]),
      startDate: '2026-07-01',
      targetAmount: 350,
      funding: 'overtime',
      asOf: '2026-06-12',
      settings,
    });
    expect(p.saved).toBe(0);
    expect(p.pct).toBe(0);
  });

  it('reaches at or beyond the target, pct uncapped', () => {
    const p = goalProgress({
      entries: week([8, 8, 8, 8, 8]),
      startDate: '2026-06-08',
      targetAmount: 200,
      funding: 'all',
      asOf: '2026-06-12',
      settings,
    });
    expect(p.saved).toBe(400);
    expect(p.pct).toBe(200);
    expect(p.remaining).toBe(0);
    expect(p.reached).toBe(true);
  });
});
