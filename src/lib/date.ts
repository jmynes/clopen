import { getLocalTimeZone, today } from '@internationalized/date';

/** Today's date as an ISO `YYYY-MM-DD` string in the local timezone. */
export function todayISO(): string {
  return today(getLocalTimeZone()).toString();
}

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
const LONG_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: '2-digit',
  timeZone: 'UTC',
});

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "Mon" — short weekday for an ISO date. */
export function weekdayShort(iso: string): string {
  return WEEKDAY_FMT.format(utcDate(iso));
}

/** True for Saturday/Sunday — used only for visual dimming. */
export function isWeekend(iso: string): boolean {
  const dow = utcDate(iso).getUTCDay(); // 0 = Sun … 6 = Sat
  return dow === 0 || dow === 6;
}

export type TimeFormat = '12h' | '24h';

/** "09:00 AM" or "09:00" depending on `mode`; hour is zero-padded for column alignment. */
export function formatTime(hhmm: string, mode: TimeFormat = '12h'): string {
  const [h, m] = hhmm.split(':').map(Number);
  const mm = String(m).padStart(2, '0');
  if (mode === '24h') return `${String(h).padStart(2, '0')}:${mm}`;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${mm} ${period}`;
}

/** "09:00 AM – 05:00 PM" — labeled clock range; appends "(+1d)" for overnight shifts. */
export function formatTimeRange(start: string, end: string, mode: TimeFormat = '12h'): string {
  const overnight = end < start;
  return `${formatTime(start, mode)} – ${formatTime(end, mode)}${overnight ? ' (+1d)' : ''}`;
}

/** "Mon, Jan 5" — friendly label for an ISO date. */
export function formatDay(iso: string): string {
  return LONG_FMT.format(utcDate(iso));
}

/**
 * "Jan 5 – 11" — friendly label for a week given its start (ISO). With
 * `withYear`, appends the year(s): "Jan 5 – 11, 2026", or both years when the
 * week straddles a boundary: "Dec 29, 2025 – Jan 4, 2026".
 */
export function formatWeekRange(weekStartISO: string, withYear = false): string {
  const start = utcDate(weekStartISO);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return formatDateRange(start, end, withYear);
}

/** Generic ISO date-range label; collapses same-month days like "Jun 5 – 13". */
export function formatRangeISO(startISO: string, endISO: string, withYear = false): string {
  return formatDateRange(utcDate(startISO), utcDate(endISO), withYear);
}

function formatDateRange(start: Date, end: Date, withYear: boolean): string {
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && startYear === endYear;
  const startLabel = `${month.format(start)} ${start.getUTCDate()}`;
  const endLabel = sameMonth ? `${end.getUTCDate()}` : `${month.format(end)} ${end.getUTCDate()}`;
  if (!withYear) return `${startLabel} – ${endLabel}`;
  if (startYear !== endYear) return `${startLabel}, ${startYear} – ${endLabel}, ${endYear}`;
  return `${startLabel} – ${endLabel}, ${endYear}`;
}
