import { fail } from '@sveltejs/kit';
import type { z } from 'zod';
import { clockEntryInput, entryInput } from '$lib/schemas/entry';
import { addEntry, deleteEntry, listEntries, updateEntry } from '$lib/server/entries';
import { getSettings, toWorkSettings } from '$lib/server/settings';
import { addDays } from '$lib/timesheet';
import type { Actions, PageServerLoad } from './$types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async () => {
  const entries = await listEntries();
  const row = await getSettings();
  const settings = toWorkSettings(row);
  return { entries, dailyHours: settings.dailyHours, weekStartsOn: row.weekStartsOn };
};

// One entry, from either the "hours" or "clock" input mode.
function parseEntry(form: FormData) {
  const common = {
    date: form.get('date'),
    breakHours: form.get('breakHours') || undefined,
    note: form.get('note') ?? undefined,
  };
  if (form.get('mode') === 'clock') {
    return clockEntryInput.safeParse({ ...common, startTime: form.get('startTime'), endTime: form.get('endTime') });
  }
  return entryInput.safeParse({ ...common, hours: form.get('hours') });
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

  // Bulk-insert a whole week: one row per day. Only filled rows are added,
  // each validated like a single entry in the chosen mode (clock or hours).
  addWeek: async ({ request }) => {
    const form = await request.formData();
    const weekStart = String(form.get('weekStart') ?? '');
    if (!ISO_DATE.test(weekStart)) return fail(400, { weekError: 'Invalid week' });
    const clock = form.get('mode') === 'clock';

    // weekStart is the first day of the grid; each row is the next day after it,
    // so this is independent of which weekday the week starts on.
    const parsed = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const breakHours = form.get(`break-${i}`) || undefined;
      const note = form.get(`note-${i}`) ?? undefined;
      if (clock) {
        const startTime = String(form.get(`start-${i}`) ?? '').trim();
        const endTime = String(form.get(`end-${i}`) ?? '').trim();
        if (!startTime && !endTime) return null; // empty row
        return clockEntryInput.safeParse({ date, startTime, endTime, breakHours, note });
      }
      const hours = String(form.get(`hours-${i}`) ?? '').trim();
      if (!hours) return null; // empty row
      return entryInput.safeParse({ date, hours, breakHours, note });
    }).filter((p) => p !== null);

    if (parsed.length === 0) return fail(400, { weekError: 'Fill in at least one day' });

    const bad = parsed.find((p) => !p.success);
    if (bad && !bad.success) return fail(400, { weekError: flattenError(bad.error) });

    for (const p of parsed) {
      if (p.success) await addEntry(p.data);
    }
    return { weekAdded: parsed.length };
  },
};
