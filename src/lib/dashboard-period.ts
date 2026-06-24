/** Pure helpers for the dashboard's period navigation. */

/**
 * Hours-chart scope: `'follow'` tracks the browsed year (default), `'all'`
 * shows every tracked year, and a 4-digit year string (e.g. `'2025'`) pins the
 * chart to that year.
 */
export type ChartScope = 'follow' | 'all' | string;

function minISO(a: string, b: string): string {
  return a < b ? a : b;
}
function maxISO(a: string, b: string): string {
  return a > b ? a : b;
}

/**
 * The window the hours chart should render, given its scope.
 *
 * **all** — every tracked period: epoch through today, so all years with data
 * show (at any granularity). Its label is that year span.
 *
 * **follow** (default) — respects the *year* the period selector is browsed to,
 * without shortening to the sub-period: its as-of is that year's end capped at
 * today (current year → year-to-today, a past year → the full year) and its
 * range start is that year's January 1 floored at the epoch. Moving within a
 * year leaves the chart unchanged; moving to another year switches it.
 *
 * **a year string** (e.g. `'2025'`) — pins the chart to that year, ignoring the
 * browsed period; same year/epoch/today clamping as `follow`.
 */
export function chartWindow(params: { scope: ChartScope; bucketStart: string; today: string; epoch: string }): {
  rangeStart: string;
  asOf: string;
  label: string;
} {
  const { scope, bucketStart, today, epoch } = params;
  if (scope === 'all') {
    const startYear = epoch.slice(0, 4);
    const endYear = today.slice(0, 4);
    return { rangeStart: epoch, asOf: today, label: startYear === endYear ? startYear : `${startYear}–${endYear}` };
  }
  // 'follow' tracks the browsed year; any other value is a pinned 4-digit year.
  const year = scope === 'follow' ? bucketStart.slice(0, 4) : scope;
  return { rangeStart: maxISO(`${year}-01-01`, epoch), asOf: minISO(`${year}-12-31`, today), label: year };
}
