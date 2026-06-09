import { describe, expect, it } from 'vitest';
import {
  addDays,
  countWorkdays,
  expectedHours,
  hoursBetween,
  loggedHours,
  makeWholeStatus,
  parseTimeInput,
  type WorkSettings,
  weekDates,
  weeklyBreakdown,
  yearStartOf,
} from './timesheet';

// Reference calendar facts used throughout (all dates ISO, local-naive):
//   2026-01-01 = Thursday
//   2026-01-03 = Saturday, 2026-01-04 = Sunday
//   2026-01-05 = Monday  … 2026-01-11 = Sunday
const MON_FRI = [1, 2, 3, 4, 5];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

const settings: WorkSettings = { hourlyRate: 25, dailyHours: 8, workdays: MON_FRI };

describe('countWorkdays', () => {
  it('counts a single workday inclusively', () => {
    expect(countWorkdays('2026-01-01', '2026-01-01', MON_FRI)).toBe(1); // Thursday
  });

  it('excludes weekends across a Thu→Wed span', () => {
    // Thu,Fri,(Sat,Sun),Mon,Tue,Wed -> 5 workdays
    expect(countWorkdays('2026-01-01', '2026-01-07', MON_FRI)).toBe(5);
  });

  it('counts exactly 5 for a full Mon–Sun week', () => {
    expect(countWorkdays('2026-01-05', '2026-01-11', MON_FRI)).toBe(5);
  });

  it('returns 0 for a weekend-only span', () => {
    expect(countWorkdays('2026-01-03', '2026-01-04', MON_FRI)).toBe(0);
  });

  it('returns 0 when end precedes start', () => {
    expect(countWorkdays('2026-01-10', '2026-01-01', MON_FRI)).toBe(0);
  });

  it('honors a custom workday set (includes Saturday)', () => {
    // Mon–Sat. Jan 1–7: Thu,Fri,Sat,Mon,Tue,Wed = 6 (only Sunday excluded)
    expect(countWorkdays('2026-01-01', '2026-01-07', [1, 2, 3, 4, 5, 6])).toBe(6);
  });

  it('iterates across a leap day (2028-02-29 exists)', () => {
    // Feb 28, Feb 29, Mar 1 — counting all days proves Feb 29 is traversed.
    expect(countWorkdays('2028-02-28', '2028-03-01', ALL_DAYS)).toBe(3);
  });
});

describe('addDays', () => {
  it('moves forward and backward across month/year boundaries', () => {
    expect(addDays('2026-01-01', 1)).toBe('2026-01-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-01-05', 7)).toBe('2026-01-12');
  });

  it('lands on a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('weekDates', () => {
  it('returns the 7 Mon–Sun dates for the week containing a mid-week day', () => {
    // 2026-01-01 is a Thursday; its week starts Mon 2025-12-29.
    expect(weekDates('2026-01-01')).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ]);
  });

  it('starts on Monday when given a Monday', () => {
    const dates = weekDates('2026-01-05');
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-01-05');
    expect(dates[6]).toBe('2026-01-11');
  });

  it('can start the week on Sunday', () => {
    // 2026-01-01 is Thursday; the Sunday-start week begins Sun 2025-12-28.
    expect(weekDates('2026-01-01', 7)).toEqual([
      '2025-12-28',
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
  });
});

describe('hoursBetween', () => {
  it('computes whole and fractional hours between two HH:MM times', () => {
    expect(hoursBetween('09:00', '17:00')).toBe(8);
    expect(hoursBetween('09:30', '17:00')).toBe(7.5);
    expect(hoursBetween('08:15', '16:45')).toBe(8.5);
  });

  it('is negative when end precedes start (caller rejects it)', () => {
    expect(hoursBetween('17:00', '09:00')).toBe(-8);
  });
});

describe('parseTimeInput', () => {
  it('normalizes loose 12-hour input', () => {
    expect(parseTimeInput('2pm')).toBe('14:00');
    expect(parseTimeInput('230pm')).toBe('14:30');
    expect(parseTimeInput('2:30pm')).toBe('14:30');
    expect(parseTimeInput('2:30 PM')).toBe('14:30');
    expect(parseTimeInput('2 pm')).toBe('14:00');
  });

  it('assumes AM when no meridiem is given', () => {
    expect(parseTimeInput('2:00')).toBe('02:00');
    expect(parseTimeInput('9')).toBe('09:00');
    expect(parseTimeInput('230')).toBe('02:30');
  });

  it('accepts 24-hour input and ignores a redundant meridiem', () => {
    expect(parseTimeInput('14:00')).toBe('14:00');
    expect(parseTimeInput('1430')).toBe('14:30');
    expect(parseTimeInput('0930')).toBe('09:30');
    expect(parseTimeInput('14:00 pm')).toBe('14:00');
  });

  it('handles the 12 o’clock edge cases', () => {
    expect(parseTimeInput('12am')).toBe('00:00');
    expect(parseTimeInput('12pm')).toBe('12:00');
    expect(parseTimeInput('12:30am')).toBe('00:30');
  });

  it('returns null for blank or out-of-range input', () => {
    expect(parseTimeInput('')).toBeNull();
    expect(parseTimeInput('  ')).toBeNull();
    expect(parseTimeInput('abc')).toBeNull();
    expect(parseTimeInput('25:00')).toBeNull();
    expect(parseTimeInput('2:99')).toBeNull();
  });
});

describe('expectedHours', () => {
  it('is workdays × dailyHours', () => {
    expect(expectedHours('2026-01-07', '2026-01-01', 8, MON_FRI)).toBe(40); // 5 × 8
  });
});

describe('loggedHours', () => {
  it('sums hours, including multiple entries on one day', () => {
    expect(
      loggedHours([
        { date: '2026-01-01', hours: 5 },
        { date: '2026-01-01', hours: 4 },
      ]),
    ).toBe(9);
  });

  it('is 0 for no entries', () => {
    expect(loggedHours([])).toBe(0);
  });

  it('deducts break/lunch time from the hours that count', () => {
    expect(loggedHours([{ date: '2026-01-05', hours: 9, breakHours: 1 }])).toBe(8);
  });

  it('treats a missing break as zero', () => {
    expect(loggedHours([{ date: '2026-01-05', hours: 8 }])).toBe(8);
  });
});

describe('yearStartOf', () => {
  it('returns Jan 1 of the as-of year', () => {
    expect(yearStartOf('2026-06-09')).toBe('2026-01-01');
  });
});

describe('makeWholeStatus', () => {
  it('reports a deficit when behind the Mon–Fri baseline', () => {
    // Year-to-date 2026-01-07: expected 40h. Logged 30h.
    const status = makeWholeStatus({
      asOf: '2026-01-07',
      settings,
      entries: [
        { date: '2026-01-01', hours: 8 },
        { date: '2026-01-02', hours: 8 },
        { date: '2026-01-05', hours: 8 },
        { date: '2026-01-06', hours: 6 },
      ],
    });
    expect(status.expected).toBe(40);
    expect(status.logged).toBe(30);
    expect(status.net).toBe(-10);
    expect(status.deficit).toBe(10);
    expect(status.surplus).toBe(0);
    expect(status.owedDollars).toBe(250);
    expect(status.surplusDollars).toBe(0);
  });

  it('counts break time as removed hours toward the deficit', () => {
    const status = makeWholeStatus({
      asOf: '2026-01-07',
      settings,
      entries: [
        { date: '2026-01-01', hours: 9, breakHours: 1 }, // net 8
        { date: '2026-01-02', hours: 8 }, // net 8
      ],
    });
    expect(status.logged).toBe(16); // 9-1 + 8
    expect(status.expected).toBe(40);
    expect(status.deficit).toBe(24);
  });

  it('banks overtime into a surplus', () => {
    const status = makeWholeStatus({
      asOf: '2026-01-07',
      settings,
      entries: [
        { date: '2026-01-01', hours: 12 },
        { date: '2026-01-02', hours: 12 },
        { date: '2026-01-05', hours: 12 },
        { date: '2026-01-06', hours: 9 },
      ], // 45h vs 40 expected
    });
    expect(status.net).toBe(5);
    expect(status.surplus).toBe(5);
    expect(status.deficit).toBe(0);
    expect(status.surplusDollars).toBe(125);
  });

  it('lets later overtime offset an earlier shortfall (net to whole)', () => {
    const status = makeWholeStatus({
      asOf: '2026-01-07',
      settings,
      entries: [
        { date: '2026-01-01', hours: 4 }, // short
        { date: '2026-01-02', hours: 4 }, // short
        { date: '2026-01-05', hours: 16 }, // overtime catch-up
        { date: '2026-01-06', hours: 16 },
      ], // 40h total
    });
    expect(status.net).toBe(0);
    expect(status.deficit).toBe(0);
    expect(status.surplus).toBe(0);
  });

  it('ignores entries before the year start and after the as-of date', () => {
    const status = makeWholeStatus({
      asOf: '2026-01-07',
      settings,
      entries: [
        { date: '2025-12-31', hours: 8 }, // prior year — ignored
        { date: '2026-01-01', hours: 8 },
        { date: '2026-02-01', hours: 8 }, // future — ignored
      ],
    });
    expect(status.logged).toBe(8);
    expect(status.expected).toBe(40);
    expect(status.deficit).toBe(32);
  });
});

describe('weeklyBreakdown', () => {
  it('splits a partial first week from a full second week', () => {
    const weeks = weeklyBreakdown({
      yearStart: '2026-01-01',
      asOf: '2026-01-11',
      settings,
      entries: [
        { date: '2026-01-02', hours: 8 }, // week 1 (Fri)
        { date: '2026-01-05', hours: 8 }, // week 2 (Mon)
        { date: '2026-01-06', hours: 8 }, // week 2 (Tue)
      ],
    });
    expect(weeks).toHaveLength(2);

    // Week 1: Monday Dec 29 2025; in-range workdays are Thu+Fri = 2 → 16h target.
    expect(weeks[0].weekStart).toBe('2025-12-29');
    expect(weeks[0].target).toBe(16);
    expect(weeks[0].logged).toBe(8);
    expect(weeks[0].net).toBe(-8);

    // Week 2: Jan 5–11, full Mon–Fri = 40h target, 16h logged.
    expect(weeks[1].weekStart).toBe('2026-01-05');
    expect(weeks[1].target).toBe(40);
    expect(weeks[1].logged).toBe(16);
    expect(weeks[1].net).toBe(-24);
  });

  it('groups weeks from Sunday when configured', () => {
    const weeks = weeklyBreakdown({
      yearStart: '2026-01-01',
      asOf: '2026-01-10', // Saturday
      settings,
      entries: [],
      weekStartsOn: 7,
    });
    expect(weeks).toHaveLength(2);
    expect(weeks[0].weekStart).toBe('2025-12-28'); // Sunday
    expect(weeks[1].weekStart).toBe('2026-01-04'); // Sunday
  });

  it('clips the final week target at a mid-week as-of date', () => {
    const weeks = weeklyBreakdown({
      yearStart: '2026-01-05',
      asOf: '2026-01-07', // Wednesday
      settings,
      entries: [],
    });
    expect(weeks).toHaveLength(1);
    // Mon,Tue,Wed = 3 workdays → 24h target.
    expect(weeks[0].weekStart).toBe('2026-01-05');
    expect(weeks[0].target).toBe(24);
  });
});
