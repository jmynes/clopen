import { fail } from '@sveltejs/kit';
import { addBonusAction, deleteBonusAction, updateBonusAction } from '$lib/core/bonuses';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import type { Actions } from './$types';

type Outcome = Awaited<ReturnType<typeof addBonusAction>>;
function unwrap(out: Outcome) {
  return out.ok ? out.data : fail(out.status, out.data);
}

export const actions: Actions = {
  add: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await addBonusAction(serverRepo, await request.formData()));
  },
  update: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await updateBonusAction(serverRepo, await request.formData()));
  },
  delete: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await deleteBonusAction(serverRepo, await request.formData()));
  },
};
