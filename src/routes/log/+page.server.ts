import { fail } from '@sveltejs/kit';
import type { z } from 'zod';
import { entryInput } from '$lib/schemas/entry';
import { addEntry, deleteEntry, listEntries, updateEntry } from '$lib/server/entries';
import { getSettings, toWorkSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const entries = await listEntries();
  const settings = toWorkSettings(await getSettings());
  return { entries, dailyHours: settings.dailyHours };
};

function parseEntry(form: FormData) {
  return entryInput.safeParse({
    date: form.get('date'),
    hours: form.get('hours'),
    note: form.get('note') ?? undefined,
  });
}

function flattenError(parsed: z.ZodError): string {
  return parsed.issues.map((i) => i.message).join('; ');
}

export const actions: Actions = {
  add: async ({ request }) => {
    const form = await request.formData();
    const parsed = parseEntry(form);
    if (!parsed.success) {
      return fail(400, {
        error: flattenError(parsed.error),
        values: {
          date: String(form.get('date') ?? ''),
          hours: String(form.get('hours') ?? ''),
          note: String(form.get('note') ?? ''),
        },
      });
    }
    await addEntry(parsed.data);
    return { added: true };
  },

  update: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing entry id' });
    const parsed = parseEntry(form);
    if (!parsed.success) return fail(400, { error: flattenError(parsed.error) });
    await updateEntry(id, parsed.data);
    return { updated: true };
  },

  delete: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing entry id' });
    await deleteEntry(id);
    return { deleted: true };
  },
};
