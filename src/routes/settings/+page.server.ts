import { fail } from '@sveltejs/kit';
import { settingsInput } from '$lib/schemas/settings';
import { getSettings, toWorkSettings, updateSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const row = await getSettings();
  return {
    settings: toWorkSettings(row),
    weekStartsOn: row.weekStartsOn,
    epoch: row.epoch,
    timeFormat: row.timeFormat,
    hideWeekendsEntries: row.hideWeekendsEntries,
    hideWeekendsGrid: row.hideWeekendsGrid,
    expandNotes: row.expandNotes,
    otMultiplierEnabled: row.otMultiplierEnabled,
    otMultiplier: row.otMultiplier,
  };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const workdays = form.getAll('workdays').map((v) => Number(v));
    const parsed = settingsInput.safeParse({
      hourlyRate: form.get('hourlyRate'),
      dailyHours: form.get('dailyHours'),
      workdays,
      weekStartsOn: form.get('weekStartsOn'),
      epoch: form.get('epoch'),
      timeFormat: form.get('timeFormat'),
      hideWeekendsEntries: form.has('hideWeekendsEntries'),
      hideWeekendsGrid: form.has('hideWeekendsGrid'),
      expandNotes: form.has('expandNotes'),
      otMultiplierEnabled: form.has('otMultiplierEnabled'),
      otMultiplier: form.get('otMultiplier'),
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    await updateSettings(parsed.data);
    return { saved: true };
  },
};
