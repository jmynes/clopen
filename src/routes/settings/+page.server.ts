import { fail } from '@sveltejs/kit';
import { saveSettingsAction } from '$lib/core/settings-page';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    const out = await saveSettingsAction(serverRepo, await request.formData());
    return out.ok ? out.data : fail(out.status, out.data);
  },
};
