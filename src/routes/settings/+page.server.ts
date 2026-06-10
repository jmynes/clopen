import { fail } from '@sveltejs/kit';
import { emptyRepo, type Repo } from '$lib/core/repo';
import { loadSettingsPage, saveSettingsAction } from '$lib/core/settings-page';
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
import type { Actions, PageServerLoad } from './$types';

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

export const load: PageServerLoad = async () => loadSettingsPage(isDemo ? emptyRepo : repo);

export const actions: Actions = {
  default: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    const out = await saveSettingsAction(repo, await request.formData());
    return out.ok ? out.data : fail(out.status, out.data);
  },
};
