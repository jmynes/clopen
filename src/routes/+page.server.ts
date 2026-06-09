import { todayISO } from '$lib/date';
import { listEntries } from '$lib/server/entries';
import { getSettings, toWorkSettings } from '$lib/server/settings';
import { makeWholeStatus, weeklyBreakdown, yearStartOf } from '$lib/timesheet';
import type { PageServerLoad } from './$types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async ({ url }) => {
  const today = todayISO();
  const requested = url.searchParams.get('asOf');
  const asOf = requested && ISO_DATE.test(requested) ? requested : today;

  const settingsRow = await getSettings();
  const settings = toWorkSettings(settingsRow);
  const entries = await listEntries();

  // Year-view stays the default; epoch only clamps the lower bound so we don't
  // accrue expected hours from before the user started tracking (year-one math).
  const yearStart = yearStartOf(asOf);
  const effectiveStart = settingsRow.epoch > yearStart ? settingsRow.epoch : yearStart;
  const status = makeWholeStatus({ entries, asOf, settings, epoch: settingsRow.epoch });
  const weeks = weeklyBreakdown({
    entries,
    yearStart: effectiveStart,
    asOf,
    settings,
    weekStartsOn: settingsRow.weekStartsOn,
  });

  return {
    asOf,
    today,
    year: asOf.slice(0, 4),
    hourlyRate: settings.hourlyRate,
    dailyHours: settings.dailyHours,
    workdays: settings.workdays,
    weekStartsOn: settingsRow.weekStartsOn,
    epoch: settingsRow.epoch,
    entries,
    status,
    weeks,
  };
};
