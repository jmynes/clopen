import { describe, expect, it } from 'vitest';
import { allocateGoals } from './savings-goals';
import type { WorkSettings } from './timesheet';

// $10/h, 8h weekdays; 2026-06-08 is a Monday.
const settings: WorkSettings = { hourlyRate: 10, dailyHours: 8, workdays: [1, 2, 3, 4, 5] };

// One week Mon–Fri with 2h overtime per day → $100 surplus pool.
const surplus100 = [8, 8, 8, 8, 8].map((h, i) => ({
  date: `2026-06-${String(8 + i).padStart(2, '0')}`,
  hours: h + 2,
}));

const base = { entries: surplus100, asOf: '2026-06-12', settings };

function goal(partial: Partial<Parameters<typeof allocateGoals>[0]['goals'][number]> & { id: string }) {
  return {
    targetAmount: 1000,
    startDate: '2026-06-08',
    funding: 'overtime' as const,
    allocation: 100,
    ...partial,
  };
}

describe('allocateGoals', () => {
  it('splits the pool by allocation percentages', () => {
    const out = allocateGoals({
      ...base,
      goals: [goal({ id: 'a', allocation: 80 }), goal({ id: 'b', allocation: 20 })],
    });
    expect(out.find((g) => g.id === 'a')?.saved).toBe(80);
    expect(out.find((g) => g.id === 'b')?.saved).toBe(20);
  });

  it('caps saved at the target and reports reached', () => {
    const out = allocateGoals({ ...base, goals: [goal({ id: 'a', targetAmount: 60 })] });
    expect(out[0].saved).toBe(60);
    expect(out[0].pct).toBe(100);
    expect(out[0].remaining).toBe(0);
    expect(out[0].reached).toBe(true);
  });

  it('a smaller low-priority goal can finish first, spilling its excess up the ranking', () => {
    // Pool $100: #1 (80%) wants $5,000 → $80; #2 (20%) wants $15 → raw $20,
    // capped at $15 with $5 excess, which tops up #1 → $85.
    const out = allocateGoals({
      ...base,
      goals: [
        goal({ id: 'big', targetAmount: 5000, allocation: 80 }),
        goal({ id: 'small', targetAmount: 15, allocation: 20 }),
      ],
    });
    expect(out.find((g) => g.id === 'small')?.reached).toBe(true);
    expect(out.find((g) => g.id === 'big')?.saved).toBe(85);
  });

  it('spill fills the highest-ranked unfinished goal before lower ranks', () => {
    // Pool $100: #1 (50%) target $10 → $10 saved, $40 excess; #2 (25%) target
    // $1,000 → $25; #3 (25%) target $1,000 → $25. The $40 excess goes to #2
    // (first unfinished in rank order), not split with #3.
    const out = allocateGoals({
      ...base,
      goals: [
        goal({ id: 'one', targetAmount: 10, allocation: 50 }),
        goal({ id: 'two', allocation: 25 }),
        goal({ id: 'three', allocation: 25 }),
      ],
    });
    expect(out.find((g) => g.id === 'two')?.saved).toBe(65);
    expect(out.find((g) => g.id === 'three')?.saved).toBe(25);
  });

  it('each goal measures its pool from its own start date', () => {
    // Goal b starts Wednesday: its pool is Wed–Fri's 3 × 2h × $10 = $60.
    const out = allocateGoals({
      ...base,
      goals: [goal({ id: 'a', allocation: 50 }), goal({ id: 'b', allocation: 50, startDate: '2026-06-10' })],
    });
    expect(out.find((g) => g.id === 'a')?.saved).toBe(50);
    expect(out.find((g) => g.id === 'b')?.saved).toBe(30);
  });

  it('funding modes stay per-goal', () => {
    // All-earnings pool for the week is $500 (50h × $10); overtime pool $100.
    const out = allocateGoals({
      ...base,
      goals: [goal({ id: 'ot', allocation: 50 }), goal({ id: 'all', allocation: 10, funding: 'all' })],
    });
    expect(out.find((g) => g.id === 'ot')?.saved).toBe(50);
    expect(out.find((g) => g.id === 'all')?.saved).toBe(50);
  });

  it('a single goal at 100% matches goalProgress capped at target', () => {
    const out = allocateGoals({ ...base, goals: [goal({ id: 'only', targetAmount: 350 })] });
    expect(out[0].saved).toBe(100);
    expect(out[0].pct).toBeCloseTo(28.57, 2);
    expect(out[0].remaining).toBe(250);
    expect(out[0].reached).toBe(false);
  });
});
