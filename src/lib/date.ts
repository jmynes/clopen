import { getLocalTimeZone, today } from '@internationalized/date';

/** Today's date as an ISO `YYYY-MM-DD` string in the local timezone. */
export function todayISO(): string {
  return today(getLocalTimeZone()).toString();
}

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
const LONG_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
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

/** "9:00 AM" — 12-hour label for an `HH:MM` time. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "9:00 AM – 5:00 PM" — labeled clock range. */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
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
