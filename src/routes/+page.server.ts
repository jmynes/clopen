import { loadDashboard } from '$lib/core/dashboard';
import { emptyRepo, type Repo } from '$lib/core/repo';
import { isDemo } from '$lib/demo/flag';
import {
  addEntry,
  deleteEntriesByDates,
  deleteEntry,
  findExistingDates,
  listEntries,
  listEntriesByDates,
  updateEntry,
} from '$lib/server/entries';
import { getSettings, updateSettings } from '$lib/server/settings';
import type { PageServerLoad } from './$types';

const repo: Repo = {
  listEntries,
  addEntry,
  updateEntry,
  deleteEntry,
  findExistingDates,
  listEntriesByDates,
  deleteEntriesByDates,
  getSettings,
  updateSettings,
};

export const load: PageServerLoad = async ({ url }) =>
  loadDashboard(isDemo ? emptyRepo : repo, url.searchParams.get('asOf'));
