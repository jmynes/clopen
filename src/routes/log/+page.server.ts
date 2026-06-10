import { fail } from '@sveltejs/kit';
import { addAction, addWeekAction, deleteAction, importCsvAction, loadLog, updateAction } from '$lib/core/log';
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

// Demo mode never touches the database: SSR serves a defaults stub and the
// browser recomputes from localStorage (see +page.ts).
export const load: PageServerLoad = async () => loadLog(isDemo ? emptyRepo : repo);

type Outcome = Awaited<ReturnType<typeof addAction>>;
function unwrap(out: Outcome) {
  return out.ok ? out.data : fail(out.status, out.data);
}

export const actions: Actions = {
  add: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await addAction(repo, await request.formData()));
  },
  update: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await updateAction(repo, await request.formData()));
  },
  delete: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await deleteAction(repo, await request.formData()));
  },
  addWeek: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await addWeekAction(repo, await request.formData()));
  },
  importCsv: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await importCsvAction(repo, await request.formData()));
  },
};
