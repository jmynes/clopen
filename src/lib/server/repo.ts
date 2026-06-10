import type { Repo } from '$lib/core/repo';
import {
  addEntry,
  deleteEntriesByDates,
  deleteEntry,
  findExistingDates,
  listEntries,
  listEntriesByDates,
  updateEntry,
} from '$lib/server/entries';
import { clearOpenShift, getOpenShift, saveOpenShift } from '$lib/server/open-shift';
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
};
