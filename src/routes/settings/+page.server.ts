import { fail } from '@sveltejs/kit';
import { settingsInput } from '$lib/schemas/settings';
import { getSettings, toWorkSettings, updateSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return { settings: toWorkSettings(await getSettings()) };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const workdays = form.getAll('workdays').map((v) => Number(v));
    const parsed = settingsInput.safeParse({
      hourlyRate: form.get('hourlyRate'),
      dailyHours: form.get('dailyHours'),
      workdays,
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    await updateSettings(parsed.data);
    return { saved: true };
  },
};
