/**
 * Seed data for the demo's "sample timesheet" toggle. Builds a believable
 * history of work from 2026-01-01 up to today so a first-time visitor lands on
 * Clopen mid-use — a populated dashboard and ledger — rather than a blank
 * slate. Deterministic: every value derives from a date-seeded hash, so
 * re-seeding the same range always yields the same timesheet (no reshuffle).
 *
 * Authored against {@link SAMPLE_SETTINGS}: an 8h Mon–Fri baseline with the
 * tracking epoch pinned to Jan 1, so the make-whole math accrues from there.
 */
import { todayISO } from '$lib/date';
import type { Settings, TimeEntry } from '$lib/db/schema';
import type { EntryKind } from '$lib/leave-kinds';

export const SAMPLE_START = '2026-01-01';

/** Settings the sample is authored against; accrual starts Jan 1, 2026. */
export const SAMPLE_SETTINGS: Settings = {
  id: 'default',
  hourlyRate: 45,
  dailyHours: 8,
  workdays: '[1,2,3,4,5]',
  weekStartsOn: 7,
  epoch: SAMPLE_START,
  timeFormat: '12h',
  ledgerPeriod: 'month',
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
};

// One Saturday gets logged so a weekend-with-entries row appears in the ledger.
const WEEKEND_WORK = new Set(['2026-02-21']);

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
    createdAt: Math.floor(Date.parse(date) / 1000),
    updatedAt: null,
  };
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
