/** Pure helpers for the dashboard's period navigation. */

function minISO(a: string, b: string): string {
  return a < b ? a : b;
}
function maxISO(a: string, b: string): string {
  return a > b ? a : b;
}

/**
 * The year-view window the hours chart should render for the navigated period.
 *
 * The chart respects the *year* the period selector is browsed to, without
 * shortening to the sub-period: its year follows the selected period, its as-of
 * is that year's end capped at today (so the current year shows year-to-today
 * and a past year shows the full year), and its range start is that year's
 * January 1 floored at the tracking epoch. Moving within a year leaves the
 * chart unchanged; moving to a different year switches it to that whole year.
 */
export function chartWindow(params: { bucketStart: string; today: string; epoch: string }): {
  year: string;
  rangeStart: string;
  asOf: string;
} {
  const { bucketStart, today, epoch } = params;
  const year = bucketStart.slice(0, 4);
  const asOf = minISO(`${year}-12-31`, today);
  const rangeStart = maxISO(`${year}-01-01`, epoch);
  return { year, rangeStart, asOf };
}
