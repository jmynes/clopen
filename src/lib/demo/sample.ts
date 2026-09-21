/**
 * Seed data for the demo's "sample timesheet" toggle. Builds a believable
 * history of work from 2025-01-01 up to today so a first-time visitor lands on
 * Clopen mid-use — a populated dashboard and ledger — rather than a blank
 * slate. Deterministic: every value derives from a date-seeded hash, so
 * re-seeding the same range always yields the same timesheet (no reshuffle).
 *
 * The range starts a full calendar year back so the period selectors have a
 * *previous* year to page into: year-over-year views, a December that isn't
 * empty, and a holiday bonus that actually falls at Christmas.
 *
 * Authored against {@link SAMPLE_SETTINGS}: an 8h Mon–Fri baseline with the
 * tracking epoch pinned to the range's first day, so the make-whole math
 * accrues from there.
 */
import { todayISO } from '$lib/date';
import type { Bonus, Expense, SavingsGoal, Settings, TimeEntry } from '$lib/db/schema';
import type { EntryKind } from '$lib/leave-kinds';

export const SAMPLE_START = '2025-01-01';

/**
 * Savings goals accrue from the *current* year, not {@link SAMPLE_START}:
 * measured over the whole range every goal would have been reached many times
 * over, and a maxed-out progress bar demonstrates nothing.
 */
export const SAMPLE_GOALS_START = '2026-01-01';

/** Settings the sample is authored against; accrual starts Jan 1, 2025. */
export const SAMPLE_SETTINGS: Settings = {
  id: 'default',
  hourlyRate: 45,
  dailyHours: 8,
  workdays: '[1,2,3,4,5]',
  weekStartsOn: 7,
  epoch: SAMPLE_START,
  timeFormat: '12h',
  ledgerPeriod: 'month',
  payCycle: 'biweekly',
  hideWeekendsEntries: false,
  hideWeekendsGrid: false,
  expandNotes: false,
  otMultiplierEnabled: false,
  otMultiplier: 1.5,
  goalEnabled: true,
  yearlyGoal: 80000,
  countExpenses: true,
  defaultExpenseKind: 'ride',
  defaultRideVendor: 'uber',
  defaultRideDirection: 'to_work',
  defaultMealVendor: 'uber_eats',
  defaultMealMethod: 'delivery',
  defaultPurchaseVendor: 'hardware',
  defaultPurchaseCadence: 'monthly',
  timeZone: 'America/Chicago',
  observeDst: true,
  clockBreakMode: 'accrue',
};

// Fixed leave days within the range (US-ish holidays plus a little PTO/sick/
// vacation so every leave color shows up on the dashboard and ledger).
const LEAVE: Record<string, EntryKind> = {
  // ── 2025 ──────────────────────────────────────────────────────────────
  '2025-01-01': 'holiday_paid', // New Year's Day
  '2025-01-20': 'holiday_paid', // MLK Day
  '2025-02-05': 'sick_paid', // a cold
  '2025-02-17': 'holiday_paid', // Presidents' Day
  '2025-04-17': 'pto', // long weekend
  '2025-04-18': 'pto',
  '2025-05-26': 'holiday_paid', // Memorial Day
  '2025-06-19': 'holiday_paid', // Juneteenth
  '2025-07-04': 'holiday_paid', // Independence Day
  '2025-08-11': 'vacation_paid', // summer trip, Mon–Wed
  '2025-08-12': 'vacation_paid',
  '2025-08-13': 'vacation_paid',
  '2025-09-01': 'holiday_paid', // Labor Day
  '2025-10-13': 'pto_unpaid', // unpaid personal day
  '2025-10-31': 'sick_paid',
  '2025-11-27': 'holiday_paid', // Thanksgiving
  '2025-11-28': 'holiday_paid', // day after
  '2025-12-24': 'holiday_paid', // Christmas Eve
  '2025-12-25': 'holiday_paid', // Christmas Day
  '2025-12-26': 'holiday_paid',
  '2025-12-31': 'holiday_paid', // New Year's Eve
  // ── 2026 ──────────────────────────────────────────────────────────────
  '2026-01-01': 'holiday_paid', // New Year's Day
  '2026-01-19': 'holiday_paid', // MLK Day
  '2026-02-04': 'sick_paid', // a cold
  '2026-02-16': 'holiday_paid', // Presidents' Day
  '2026-03-16': 'vacation_paid', // spring trip, Mon–Wed
  '2026-03-17': 'vacation_paid',
  '2026-03-18': 'vacation_paid',
  '2026-04-10': 'pto', // long weekend
  '2026-04-30': 'pto_unpaid', // unpaid personal day
  '2026-05-06': 'sick_paid',
  '2026-05-25': 'holiday_paid', // Memorial Day
  '2026-06-19': 'holiday_paid', // Juneteenth
  '2026-07-03': 'holiday_paid', // Independence Day observed (the 4th is a Sat)
  '2026-09-07': 'holiday_paid', // Labor Day
};

// One Saturday gets logged so a weekend-with-entries row appears in the ledger.
const WEEKEND_WORK = new Set(['2025-03-22', '2026-02-21']);

/** Deterministic float in [0, 1) from a string (FNV-1a + xorshift fold). */
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) % 100000) / 100000;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function hhmm(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** A regular clocked work day with believable start time and net hours. */
function workEntry(date: string): TimeEntry {
  const r = hash01(date);
  const variant = hash01(`${date}#v`);
  const breakHours = 0.5;

  // Mostly a full day; sometimes long (crunch) or short (left early).
  let net = 8;
  let note: string | null = null;
  if (variant < 0.14) {
    net = 9 + Math.round(r * 4) / 2; // 9–11h
    note = 'Stayed late to ship';
  } else if (variant < 0.26) {
    net = 6 + Math.round(r * 3) / 2; // 6–7.5h
    note = 'Out early';
  } else if (variant < 0.34) {
    note = 'WFH';
  }

  const startMin = 8 * 60 + Math.round(r * 60); // 08:00–09:00
  const gross = net + breakHours;
  return {
    id: `sample-${date}`,
    date,
    hours: round2(gross),
    breakHours,
    startTime: hhmm(startMin),
    endTime: hhmm(startMin + Math.round(gross * 60)),
    note,
    entryKind: 'work',
    kindLabel: null,
    createdAt: Math.floor(Date.parse(date) / 1000),
    updatedAt: null,
  };
}

function leaveEntry(date: string, kind: EntryKind, paid: boolean): TimeEntry {
  return {
    id: `sample-${date}`,
    date,
    hours: paid ? SAMPLE_SETTINGS.dailyHours : 0,
    breakHours: 0,
    startTime: null,
    endTime: null,
    note: null,
    entryKind: kind,
    kindLabel: null,
    createdAt: Math.floor(Date.parse(date) / 1000),
    updatedAt: null,
  };
}

/**
 * Sample savings goals, sized against the pool the entries and bonuses above
 * produce (overtime hours × $45 plus the year's bonuses, a few thousand
 * dollars by autumn): a 75/25 ranked split of the overtime stream where the
 * small #2 reaches its target and spills its spare share up to #1, plus an
 * all-earnings goal anchored to the current month so it sits mid-progress
 * whenever the demo is visited.
 *
 * Targets have to be re-sized whenever the bonus list grows — bonuses fund
 * goals, so a bigger bonus year maxes every bar out and the demo stops
 * showing progress at all.
 */
export function sampleSavingsGoals(): SavingsGoal[] {
  const goal = (n: number, row: Omit<SavingsGoal, 'id' | 'rank' | 'createdAt' | 'updatedAt'>): SavingsGoal => ({
    id: `sample-goal-${n}`,
    rank: n,
    createdAt: Math.floor(Date.parse(row.startDate) / 1000),
    updatedAt: null,
    ...row,
  });
  return [
    goal(0, {
      name: 'Trip to Japan',
      targetAmount: 5000,
      startDate: SAMPLE_GOALS_START,
      funding: 'overtime',
      allocation: 75,
    }),
    goal(1, {
      name: 'Nintendo Switch 2',
      targetAmount: 450,
      startDate: SAMPLE_GOALS_START,
      funding: 'overtime',
      allocation: 25,
    }),
    goal(2, {
      name: 'Coffee fund',
      targetAmount: 250,
      startDate: `${todayISO().slice(0, 7)}-01`,
      funding: 'all',
      allocation: 2,
    }),
  ];
}

/**
 * Build the sample ledger from {@link SAMPLE_START} through today (inclusive).
 * Weekdays get a work entry (or the configured leave); weekends are off,
 * except the one logged Saturday. Date math is UTC so the ISO day never drifts.
 */
export function sampleEntries(): TimeEntry[] {
  const entries: TimeEntry[] = [];
  const end = Date.parse(todayISO());
  for (let t = Date.parse(SAMPLE_START); t <= end; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const dow = new Date(t).getUTCDay(); // 0 = Sun … 6 = Sat
    const leave = LEAVE[date];
    if (leave) {
      entries.push(leaveEntry(date, leave, !leave.endsWith('_unpaid')));
    } else if (dow >= 1 && dow <= 5) {
      entries.push(workEntry(date));
    } else if (WEEKEND_WORK.has(date)) {
      entries.push({ ...workEntry(date), note: 'Weekend deploy' });
    }
  }
  return entries;
}

/**
 * Sample bonuses: money that arrived without hours behind it, so the demo's
 * dashboard shows the "includes $X in bonuses" line and the savings goals
 * get a visible jump. Dated within the sample range and clipped at today, so
 * nothing lands in the future however late in the year the demo is visited.
 *
 * With the range starting a year earlier, December 2025 is inside it, so the
 * holiday bonus falls where a holiday bonus belongs.
 */
const BONUSES: Array<{ date: string; label: string; amount: number; note: string | null }> = [
  { date: '2025-03-14', label: 'Q1 performance', amount: 1200, note: null },
  { date: '2025-06-30', label: 'Q2 performance', amount: 1200, note: null },
  { date: '2025-09-30', label: 'Q3 performance', amount: 1200, note: null },
  { date: '2025-12-19', label: 'Holiday bonus', amount: 1500, note: 'Paid with the last check of the year' },
  { date: '2026-03-13', label: 'Q1 performance', amount: 1500, note: null },
  { date: '2026-05-08', label: 'Referral', amount: 750, note: 'Referred a backend hire' },
  { date: '2026-06-30', label: 'Q2 performance', amount: 1500, note: null },
  { date: '2026-08-14', label: 'Spot bonus', amount: 400, note: 'Shipped the migration a week early' },
  { date: '2026-09-30', label: 'Q3 performance', amount: 1500, note: null },
  { date: '2026-12-18', label: 'Holiday bonus', amount: 1750, note: null },
];

export function sampleBonuses(): Bonus[] {
  const today = todayISO();
  return BONUSES.filter((b) => b.date <= today).map((b, i) => ({
    id: `sample-bonus-${i}`,
    date: b.date,
    amount: b.amount,
    label: b.label,
    note: b.note,
    createdAt: Math.floor(Date.parse(b.date) / 1000),
    updatedAt: null,
  }));
}

/**
 * Sample expenses: a believable commute-and-lunch habit across the tracked
 * range, so the Expenses tab and the dashboard's include-expenses toggle both
 * have something to show. Deterministic from the same date-seeded hash as the
 * entries, so re-seeding never reshuffles the list.
 */
export function sampleExpenses(): Expense[] {
  const rows: Expense[] = [];
  const end = Date.parse(todayISO());
  const push = (date: string, n: number, row: Omit<Expense, 'id' | 'date' | 'createdAt' | 'updatedAt'>) => {
    rows.push({
      id: `sample-expense-${date}-${n}`,
      date,
      createdAt: Math.floor(Date.parse(date) / 1000) + n,
      updatedAt: null,
      ...row,
    });
  };

  for (let t = Date.parse(SAMPLE_START); t <= end; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const dow = new Date(t).getUTCDay();
    // Commute costs and work lunches only happen on days worked.
    if (dow === 0 || dow === 6) continue;
    if (LEAVE[date]) continue;

    const r = hash01(`${date}#ride`);
    // Roughly one commute leg in four is expensed rather than driven.
    if (r < 0.26) {
      const lyft = hash01(`${date}#vendor`) < 0.35;
      push(date, 0, {
        amount: round2(11 + hash01(`${date}#fare`) * 18),
        kind: 'ride',
        vendor: lyft ? 'lyft' : 'uber',
        direction: hash01(`${date}#leg`) < 0.6 ? 'to_work' : 'to_home',
        method: null,
        cadence: null,
        note: null,
      });
    }

    const m = hash01(`${date}#meal`);
    if (m < 0.18) {
      const pick = hash01(`${date}#mealv`);
      const vendor = pick < 0.45 ? 'uber_eats' : pick < 0.75 ? 'grubhub' : 'restaurant';
      push(date, 1, {
        amount: round2(13 + hash01(`${date}#tab`) * 22),
        kind: 'meal',
        vendor,
        direction: null,
        method: vendor === 'restaurant' ? 'dine_in' : hash01(`${date}#how`) < 0.7 ? 'delivery' : 'pickup',
        cadence: null,
        note: vendor === 'restaurant' ? 'Team lunch' : null,
      });
    }

    // One subscription charge a month, on the 3rd.
    if (date.endsWith('-03')) {
      push(date, 2, {
        amount: 20,
        kind: 'purchase',
        vendor: 'subscription',
        direction: null,
        method: null,
        cadence: 'monthly',
        note: 'Editor licence',
      });
    }
  }

  // A couple of one-off hardware buys so the purchase kind isn't only
  // subscriptions; dropped when the demo is visited before those dates.
  const today = todayISO();
  for (const [n, buy] of [
    { date: '2026-02-10', amount: 149.99, note: 'Mechanical keyboard' },
    { date: '2026-07-22', amount: 329.0, note: 'Second monitor' },
  ].entries()) {
    if (buy.date > today) continue;
    push(buy.date, 3 + n, {
      amount: buy.amount,
      kind: 'purchase',
      vendor: 'hardware',
      direction: null,
      method: null,
      cadence: null,
      note: buy.note,
    });
  }

  return rows;
}
