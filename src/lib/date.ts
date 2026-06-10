import { fromAbsolute, getLocalTimeZone, parseDateTime, today } from '@internationalized/date';

// The app-wide zone: set by the root layout load from settings before any
// page compute runs, so "today" is stable regardless of where the browser or
// server happens to be. Null falls back to the runtime's local zone.
let appZone: string | null = null;
export function setAppTimeZone(zone: string | null): void {
  appZone = zone;
}
export function appTimeZone(): string {
  return appZone ?? getLocalTimeZone();
}

/** Today's date as an ISO `YYYY-MM-DD` string in the app zone. */
export function todayISO(): string {
  return today(appTimeZone()).toString();
}

function utcOffsetMinutes(zone: string, atUtc: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(atUtc);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0; // bare "GMT" = UTC
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * The zone that actually drives day boundaries: the IANA zone itself when
 * observing DST, else its fixed standard-time offset (DST always springs
 * forward, so standard = the smaller of the January/July offsets). Etc/GMT
 * names invert the sign (Chicago standard, UTC-6, is `Etc/GMT+6`); zones with
 * fractional standard offsets have no Etc twin and pass through unchanged.
 */
export function effectiveZone(timeZone: string, observeDst: boolean): string {
  if (observeDst) return timeZone;
  const year = new Date().getUTCFullYear();
  const jan = utcOffsetMinutes(timeZone, new Date(Date.UTC(year, 0, 15)));
  const jul = utcOffsetMinutes(timeZone, new Date(Date.UTC(year, 6, 15)));
  if (jan === jul) return timeZone; // no DST to opt out of
  const standard = Math.min(jan, jul);
  if (standard % 60 !== 0) return timeZone;
  const hours = standard / 60;
  if (hours === 0) return 'UTC';
  return `Etc/GMT${hours > 0 ? '-' : '+'}${Math.abs(hours)}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Y-M-D and HH:MM wall-clock parts of an absolute instant, in the app zone. */
export function zonedParts(ms: number): { date: string; hhmm: string } {
  const z = fromAbsolute(ms, appTimeZone());
  return {
    date: `${z.year}-${pad2(z.month)}-${pad2(z.day)}`,
    hhmm: `${pad2(z.hour)}:${pad2(z.minute)}`,
  };
}

/** Absolute epoch ms for a wall-clock date + HH:MM in the app zone. */
export function zonedToMs(date: string, hhmm: string): number {
  return parseDateTime(`${date}T${hhmm}`).toDate(appTimeZone()).getTime();
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
 * "Jan 05 – 11" — friendly label for a week given its start (ISO); days are
 * zero-padded for mono alignment. With `withYear`, appends the year(s):
 * "Jan 05 – 11, 2026", or both years when the week straddles a boundary:
 * "Dec 29, 2025 – Jan 04, 2026".
 */
export function formatWeekRange(weekStartISO: string, withYear = false): string {
  const start = utcDate(weekStartISO);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return formatDateRange(start, end, withYear);
}

/** Generic ISO date-range label; collapses same-month days like "Jun 05 – 13". */
export function formatRangeISO(startISO: string, endISO: string, withYear = false): string {
  return formatDateRange(utcDate(startISO), utcDate(endISO), withYear);
}

function formatDateRange(start: Date, end: Date, withYear: boolean): string {
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && startYear === endYear;
  const pad = (d: Date) => String(d.getUTCDate()).padStart(2, '0');
  const startLabel = `${month.format(start)} ${pad(start)}`;
  const endLabel = sameMonth ? pad(end) : `${month.format(end)} ${pad(end)}`;
  if (!withYear) return `${startLabel} – ${endLabel}`;
  if (startYear !== endYear) return `${startLabel}, ${startYear} – ${endLabel}, ${endYear}`;
  return `${startLabel} – ${endLabel}, ${endYear}`;
}

const STAMP_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });

/** "Jun 10, 09:14 PM" — created/edited stamps for epoch *seconds*, app zone. */
export function formatTimestamp(epochSeconds: number, mode: TimeFormat = '12h'): string {
  const { date, hhmm } = zonedParts(epochSeconds * 1000);
  return `${STAMP_FMT.format(utcDate(date))}, ${formatTime(hhmm, mode)}`;
}
