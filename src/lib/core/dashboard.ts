/** Dashboard load logic, shared by the server route and demo mode. */
import { todayISO } from '$lib/date';
import { makeWholeStatus, weeklyBreakdown, yearStartOf } from '$lib/timesheet';
import { type Repo, toWorkSettings } from './repo';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function loadDashboard(repo: Repo, requested: string | null) {
  const today = todayISO();
  const asOf = requested && ISO_DATE.test(requested) ? requested : today;

  const settingsRow = await repo.getSettings();
  const settings = toWorkSettings(settingsRow);
  const entries = await repo.listEntries();

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
    otMultiplierEnabled: settingsRow.otMultiplierEnabled,
    otMultiplier: settingsRow.otMultiplier,
    entries,
    status,
    weeks,
  };
}
