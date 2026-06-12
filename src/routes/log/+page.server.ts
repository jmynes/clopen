import { fail } from '@sveltejs/kit';
import {
  addAction,
  addWeekAction,
  clearAllAction,
  clearPeriodAction,
  deleteAction,
  importCsvAction,
  updateAction,
} from '$lib/core/log';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import type { Actions } from './$types';

type Outcome = Awaited<ReturnType<typeof addAction>>;
function unwrap(out: Outcome) {
  return out.ok ? out.data : fail(out.status, out.data);
}

export const actions: Actions = {
  add: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await addAction(serverRepo, await request.formData()));
  },
  update: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await updateAction(serverRepo, await request.formData()));
  },
  delete: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await deleteAction(serverRepo, await request.formData()));
  },
  addWeek: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await addWeekAction(serverRepo, await request.formData()));
  },
  importCsv: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await importCsvAction(serverRepo, await request.formData()));
  },
  clearAll: async () => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await clearAllAction(serverRepo));
  },
  clearPeriod: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await clearPeriodAction(serverRepo, await request.formData()));
  },
};
