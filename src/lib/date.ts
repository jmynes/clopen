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

/** "Mon, Jan 5" — friendly label for an ISO date. */
export function formatDay(iso: string): string {
  return LONG_FMT.format(utcDate(iso));
}

/** "Jan 5 – 11" — friendly label for a week given its Monday (ISO). */
export function formatWeekRange(weekStartISO: string): string {
  const start = utcDate(weekStartISO);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  const startLabel = `${month.format(start)} ${start.getUTCDate()}`;
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const endLabel = sameMonth ? `${end.getUTCDate()}` : `${month.format(end)} ${end.getUTCDate()}`;
  return `${startLabel} – ${endLabel}`;
}
