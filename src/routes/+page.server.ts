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

  const status = makeWholeStatus({ entries, asOf, settings });
  const weeks = weeklyBreakdown({
    entries,
    yearStart: yearStartOf(asOf),
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
    status,
    weeks,
  };
};
