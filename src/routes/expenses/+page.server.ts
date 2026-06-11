import { fail } from '@sveltejs/kit';
import { addExpenseAction, deleteExpenseAction, updateExpenseAction } from '$lib/core/expenses';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import type { Actions } from './$types';

type Outcome = Awaited<ReturnType<typeof addExpenseAction>>;
function unwrap(out: Outcome) {
  return out.ok ? out.data : fail(out.status, out.data);
}

export const actions: Actions = {
  add: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await addExpenseAction(serverRepo, await request.formData()));
  },
  update: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await updateExpenseAction(serverRepo, await request.formData()));
  },
  delete: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await deleteExpenseAction(serverRepo, await request.formData()));
  },
};
