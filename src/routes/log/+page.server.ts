import { fail } from '@sveltejs/kit';
import type { z } from 'zod';
import { entryInput } from '$lib/schemas/entry';
import { addEntry, deleteEntry, listEntries, updateEntry } from '$lib/server/entries';
import { getSettings, toWorkSettings } from '$lib/server/settings';
import { weekDates } from '$lib/timesheet';
import type { Actions, PageServerLoad } from './$types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

  // Bulk-insert a whole week: one row per day (Mon–Sun). Only rows with hours
  // are added; each is validated like a single entry.
  addWeek: async ({ request }) => {
    const form = await request.formData();
    const weekStart = String(form.get('weekStart') ?? '');
    if (!ISO_DATE.test(weekStart)) return fail(400, { weekError: 'Invalid week' });

    const dates = weekDates(weekStart);
    const rows = dates
      .map((date, i) => ({ date, hours: String(form.get(`hours-${i}`) ?? '').trim(), note: form.get(`note-${i}`) }))
      .filter((row) => row.hours !== '');

    if (rows.length === 0) return fail(400, { weekError: 'Enter hours for at least one day' });

    const parsed = rows.map((row) =>
      entryInput.safeParse({ date: row.date, hours: row.hours, note: row.note ?? undefined }),
    );
    const bad = parsed.find((p) => !p.success);
    if (bad && !bad.success) return fail(400, { weekError: flattenError(bad.error) });

    for (const p of parsed) {
      if (p.success) await addEntry(p.data);
    }
    return { weekAdded: rows.length };
  },
};
