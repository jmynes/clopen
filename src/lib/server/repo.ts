import type { Repo } from '$lib/core/repo';
import {
  addEntry,
  deleteEntriesByDates,
  deleteEntry,
  findExistingDates,
  listEntries,
  listEntriesByDates,
  listEntryEvents,
  updateEntry,
} from '$lib/server/entries';
import { addExpense, deleteExpense, listExpenseEvents, listExpenses, updateExpense } from '$lib/server/expenses';
import { clearOpenShift, getOpenShift, saveOpenShift } from '$lib/server/open-shift';
import { addSavingsGoal, deleteSavingsGoal, listSavingsGoals, updateSavingsGoal } from '$lib/server/savings-goals';
import { getSettings, updateSettings } from '$lib/server/settings';

/** The Drizzle/libSQL implementation of the Repo storage contract. */
export const serverRepo: Repo = {
  listEntries,
  addEntry,
  updateEntry,
  deleteEntry,
  findExistingDates,
  listEntriesByDates,
  deleteEntriesByDates,
  getSettings,
  updateSettings,
  getOpenShift,
  saveOpenShift,
  clearOpenShift,
  listEntryEvents,
  listExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  listExpenseEvents,
  listSavingsGoals,
  addSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
};
