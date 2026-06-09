/**
 * Make-whole timesheet math. Pure, dependency-free, timezone-safe.
 *
 * Model: hourly pay, a baseline of `dailyHours` on each configured workday
 * (default Mon–Fri = 8h × 5 = 40h/week). Overtime is tracked but not paid at
 * a premium — it simply banks against shortfalls because we compare *total*
 * logged hours to the *total* expected hours up to the as-of date. The year
 * boundary is the calendar year (Jan 1).
 *
 * Dates are ISO `YYYY-MM-DD` strings interpreted as local-naive calendar days.
 * All arithmetic runs in UTC against explicitly constructed dates so results
 * never depend on the host timezone.
 */

export type WorkSettings = {
  hourlyRate: number;
  dailyHours: number;
  /** ISO weekday numbers that count as workdays: 1 = Mon … 7 = Sun. */
  workdays: number[];
};

export type EntryLike = { date: string; hours: number; breakHours?: number };

export type MakeWholeStatus = {
  expected: number;
  logged: number;
  net: number;
  deficit: number;
  surplus: number;
  owedDollars: number;
  surplusDollars: number;
};

export type WeekSummary = {
  /** Monday (ISO) of the week, as `YYYY-MM-DD`. */
  weekStart: string;
  logged: number;
  target: number;
  net: number;
};

const DAY_MS = 86_400_000;

function parseISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** ISO weekday for a UTC timestamp: 1 = Mon … 7 = Sun. */
function isoWeekday(ms: number): number {
  const dow = new Date(ms).getUTCDay(); // 0 = Sun … 6 = Sat
  return dow === 0 ? 7 : dow;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Jan 1 of the as-of date's calendar year, as ISO. */
export function yearStartOf(asOf: string): string {
  return `${asOf.slice(0, 4)}-01-01`;
}

/** Inclusive count of days in [start, end] whose ISO weekday is in `workdays`. */
export function countWorkdays(start: string, end: string, workdays: number[]): number {
  const startMs = parseISO(start);
  const endMs = parseISO(end);
  if (endMs < startMs) return 0;
  const allow = new Set(workdays);
  let count = 0;
  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    if (allow.has(isoWeekday(ms))) count++;
  }
  return count;
}

export function expectedHours(asOf: string, yearStart: string, dailyHours: number, workdays: number[]): number {
  return round2(countWorkdays(yearStart, asOf, workdays) * dailyHours);
}

/** Hours that count toward the baseline: worked hours minus break/lunch. */
export function loggedHours(entries: EntryLike[]): number {
  return round2(entries.reduce((sum, e) => sum + e.hours - (e.breakHours ?? 0), 0));
}

export function makeWholeStatus(params: {
  entries: EntryLike[];
  asOf: string;
  settings: WorkSettings;
}): MakeWholeStatus {
  const { entries, asOf, settings } = params;
  const yearStart = yearStartOf(asOf);
  const inRange = entries.filter((e) => e.date >= yearStart && e.date <= asOf);

  const expected = expectedHours(asOf, yearStart, settings.dailyHours, settings.workdays);
  const logged = loggedHours(inRange);
  const net = round2(logged - expected);
  const deficit = round2(Math.max(0, -net));
  const surplus = round2(Math.max(0, net));

  return {
    expected,
    logged,
    net,
    deficit,
    surplus,
    owedDollars: round2(deficit * settings.hourlyRate),
    surplusDollars: round2(surplus * settings.hourlyRate),
  };
}

/** Shift an ISO date by `days` (may be negative), returning an ISO date. */
export function addDays(iso: string, days: number): string {
  return toISO(parseISO(iso) + days * DAY_MS);
}

/** Monday (ISO) of the week containing `iso`. */
function mondayOf(iso: string): number {
  const ms = parseISO(iso);
  return ms - (isoWeekday(ms) - 1) * DAY_MS;
}

/** The seven ISO dates (Mon→Sun) of the week containing `iso`. */
export function weekDates(iso: string): string[] {
  const monday = mondayOf(iso);
  return Array.from({ length: 7 }, (_, i) => toISO(monday + i * DAY_MS));
}

export function weeklyBreakdown(params: {
  entries: EntryLike[];
  yearStart: string;
  asOf: string;
  settings: WorkSettings;
}): WeekSummary[] {
  const { entries, yearStart, asOf, settings } = params;
  const yearStartMs = parseISO(yearStart);
  const asOfMs = parseISO(asOf);
  if (asOfMs < yearStartMs) return [];

  const weeks: WeekSummary[] = [];
  for (let weekMs = mondayOf(yearStart); weekMs <= asOfMs; weekMs += 7 * DAY_MS) {
    const weekEnd = weekMs + 6 * DAY_MS;
    // Clip the week to the [yearStart, asOf] window.
    const from = Math.max(weekMs, yearStartMs);
    const to = Math.min(weekEnd, asOfMs);
    const fromISO = toISO(from);
    const toRangeISO = toISO(to);

    const target = round2(countWorkdays(fromISO, toRangeISO, settings.workdays) * settings.dailyHours);
    const logged = loggedHours(entries.filter((e) => e.date >= fromISO && e.date <= toRangeISO));

    weeks.push({
      weekStart: toISO(weekMs),
      logged,
      target,
      net: round2(logged - target),
    });
  }
  return weeks;
}
