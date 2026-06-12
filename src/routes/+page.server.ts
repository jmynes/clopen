import { fail } from '@sveltejs/kit';
import {
  addSavingsGoalAction,
  deleteSavingsGoalAction,
  moveSavingsGoalAction,
  updateSavingsGoalAction,
} from '$lib/core/savings-goals';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import type { Actions } from './$types';

// Form actions only — no load, so the dashboard keeps deriving its view from
// the root layout data and tab switches stay network-free.

type Outcome = Awaited<ReturnType<typeof addSavingsGoalAction>>;
function unwrap(out: Outcome) {
  return out.ok ? out.data : fail(out.status, out.data);
}

export const actions: Actions = {
  addGoal: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await addSavingsGoalAction(serverRepo, await request.formData()));
  },
  updateGoal: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await updateSavingsGoalAction(serverRepo, await request.formData()));
  },
  deleteGoal: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await deleteSavingsGoalAction(serverRepo, await request.formData()));
  },
  moveGoal: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await moveSavingsGoalAction(serverRepo, await request.formData()));
  },
};
