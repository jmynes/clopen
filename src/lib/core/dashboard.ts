/** Dashboard view math, computed in the universal page load from layout data. */
import { todayISO } from '$lib/date';
import type { Expense, SavingsGoal, Settings, TimeEntry } from '$lib/db/schema';
import { makeWholeStatus } from '$lib/timesheet';
import { toWorkSettings } from './repo';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function computeDashboard(
  entries: TimeEntry[],
  expenses: Expense[],
  settingsRow: Settings,
  requested: string | null,
  savingsGoals: SavingsGoal[] = [],
) {
  const today = todayISO();
  const asOf = requested && ISO_DATE.test(requested) ? requested : today;

  const settings = toWorkSettings(settingsRow);

  const status = makeWholeStatus({ entries, asOf, settings, epoch: settingsRow.epoch });

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
    goalEnabled: settingsRow.goalEnabled,
    yearlyGoal: settingsRow.yearlyGoal,
    countExpenses: settingsRow.countExpenses,
    entries,
    expenses,
    savingsGoals,
    status,
  };
}
