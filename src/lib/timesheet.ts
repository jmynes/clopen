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
/**
 * Parse a loosely-typed clock time into canonical `HH:MM` (24-hour), or null.
 * Accepts e.g. `2pm`, `230pm`, `2:30 PM`, `2:00` (assumes AM), `14:00`, `0930`.
 * A meridiem on an already-24h hour (`14:00 pm`) is treated as redundant.
 */
export function parseTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  const meridiem = s.includes('p') ? 'pm' : s.includes('a') ? 'am' : null;
  const core = s.replace(/[^0-9:]/g, '');
  if (!core) return null;

  let h: number;
  let m: number;
  if (core.includes(':')) {
    const [hp, mp] = core.split(':');
    if (hp === '') return null;
    h = Number(hp);
    m = Number(mp === '' ? '0' : mp);
  } else if (core.length <= 2) {
    h = Number(core);
    m = 0;
  } else if (core.length === 3) {
    h = Number(core.slice(0, 1));
    m = Number(core.slice(1));
  } else if (core.length === 4) {
    h = Number(core.slice(0, 2));
    m = Number(core.slice(2));
  } else {
    return null;
  }
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;

  // Only adjust a 12-hour hour; leave 13–23 alone even if a meridiem was typed.
  if (meridiem === 'pm' && h < 12) h += 12;
  else if (meridiem === 'am' && h === 12) h = 0;

  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Hours between two `HH:MM` clock times (end − start); negative if end precedes start. */
export function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return round2((eh * 60 + em - (sh * 60 + sm)) / 60);
}

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

/**
 * Start-of-week (ms) for `iso`. `weekStartsOn` is the ISO weekday the week
 * begins on (1 = Mon … 7 = Sun); defaults to Monday.
 */
function weekStartOf(iso: string, weekStartsOn: number): number {
  const ms = parseISO(iso);
  const daysBack = (isoWeekday(ms) - weekStartsOn + 7) % 7;
  return ms - daysBack * DAY_MS;
}

/** The seven ISO dates of the week containing `iso`, ordered from `weekStartsOn`. */
export function weekDates(iso: string, weekStartsOn = 1): string[] {
  const start = weekStartOf(iso, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => toISO(start + i * DAY_MS));
}

export function weeklyBreakdown(params: {
  entries: EntryLike[];
  yearStart: string;
  asOf: string;
  settings: WorkSettings;
  weekStartsOn?: number;
}): WeekSummary[] {
  const { entries, yearStart, asOf, settings, weekStartsOn = 1 } = params;
  const yearStartMs = parseISO(yearStart);
  const asOfMs = parseISO(asOf);
  if (asOfMs < yearStartMs) return [];

  const weeks: WeekSummary[] = [];
  for (let weekMs = weekStartOf(yearStart, weekStartsOn); weekMs <= asOfMs; weekMs += 7 * DAY_MS) {
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
