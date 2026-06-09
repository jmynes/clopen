import { fail } from '@sveltejs/kit';
import type { z } from 'zod';
import { parseCsv } from '$lib/csv';
import { clockEntryInput, type EntryInput, entryInput } from '$lib/schemas/entry';
import { addEntry, deleteEntry, listEntries, updateEntry } from '$lib/server/entries';
import { getSettings, toWorkSettings } from '$lib/server/settings';
import { addDays } from '$lib/timesheet';
import type { Actions, PageServerLoad } from './$types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async () => {
  const entries = await listEntries();
  const row = await getSettings();
  const settings = toWorkSettings(row);
  return {
    entries,
    dailyHours: settings.dailyHours,
    weekStartsOn: row.weekStartsOn,
    timeFormat: row.timeFormat as '12h' | '24h',
  };
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

// Map zod issues to { fieldName: firstMessage }. `prefix` lets the weekly grid
// scope errors to a specific row, e.g. `start-3`.
function fieldErrorsOf(parsed: z.ZodError, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of parsed.issues) {
    const key = `${prefix}${String(i.path[0] ?? '_')}`;
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

export const actions: Actions = {
  add: async ({ request }) => {
    const form = await request.formData();
    const parsed = parseEntry(form);
    if (!parsed.success) {
      return fail(400, {
        fieldErrors: fieldErrorsOf(parsed.error),
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
    if (!parsed.success) return fail(400, { editFieldErrors: fieldErrorsOf(parsed.error) });
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

    // Schema field name → form input name (per row, suffixed with -i later).
    const FIELD_TO_INPUT: Record<string, string> = {
      startTime: 'start',
      endTime: 'end',
      breakHours: 'break',
      hours: 'hours',
      note: 'note',
    };

    // weekStart is the first day of the grid; each row is the next day after it,
    // so this is independent of which weekday the week starts on.
    type RowResult = {
      i: number;
      parsed: ReturnType<typeof clockEntryInput.safeParse> | ReturnType<typeof entryInput.safeParse>;
    } | null;
    const rows: RowResult[] = Array.from({ length: 7 }, (_, i): RowResult => {
      const date = addDays(weekStart, i);
      const breakHours = form.get(`break-${i}`) || undefined;
      const note = form.get(`note-${i}`) ?? undefined;
      if (clock) {
        const startTime = String(form.get(`start-${i}`) ?? '').trim();
        const endTime = String(form.get(`end-${i}`) ?? '').trim();
        if (!startTime && !endTime) return null; // empty row
        return { i, parsed: clockEntryInput.safeParse({ date, startTime, endTime, breakHours, note }) };
      }
      const hours = String(form.get(`hours-${i}`) ?? '').trim();
      if (!hours) return null; // empty row
      return { i, parsed: entryInput.safeParse({ date, hours, breakHours, note }) };
    });

    const filled = rows.filter((r): r is NonNullable<RowResult> => r !== null);
    if (filled.length === 0) return fail(400, { weekError: 'Fill in at least one day' });

    const weekFieldErrors: Record<string, string> = {};
    for (const { i, parsed } of filled) {
      if (parsed.success) continue;
      for (const issue of parsed.error.issues) {
        const schemaField = String(issue.path[0] ?? '_');
        const inputName = FIELD_TO_INPUT[schemaField] ?? schemaField;
        const key = `${inputName}-${i}`;
        if (!weekFieldErrors[key]) weekFieldErrors[key] = issue.message;
      }
    }
    if (Object.keys(weekFieldErrors).length > 0) {
      return fail(400, { weekFieldErrors, weekError: 'Fix the highlighted fields' });
    }

    for (const { parsed } of filled) {
      if (parsed.success) await addEntry(parsed.data);
    }
    return { weekAdded: filled.length };
  },

  // Import arbitrarily many rows from a CSV file. Header columns are matched by
  // name; rows with both clock times use clock mode, otherwise the Hours column.
  importCsv: async ({ request }) => {
    const form = await request.formData();
    const file = form.get('file');
    const text = file instanceof File ? await file.text() : String(form.get('csv') ?? '');
    if (!text.trim()) return fail(400, { importError: 'No CSV provided' });

    const rows = parseCsv(text);
    if (rows.length < 2) return fail(400, { importError: 'CSV has a header but no data rows' });

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
    // "day of the week" matches export-style sheets that prefix the weekday onto the date cell.
    const di = col('date', 'day', 'day of the week');
    const hi = col('hours', 'hrs', 'total hours', 'total');
    const bi = col('break', 'break hours', 'breakhours');
    const si = col('clock in', 'in', 'start', 'start time', 'check-in time', 'check in time', 'checkin');
    const ei = col('clock out', 'out', 'end', 'end time', 'check-out time', 'check out time', 'checkout');
    const ni = col('note', 'notes', 'description');
    if (di === -1) return fail(400, { importError: 'CSV needs a date column' });

    const inputs: EntryInput[] = [];
    const errors: string[] = [];
    rows.slice(1).forEach((r, idx) => {
      const at = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
      const rawDate = at(di);
      if (!rawDate) return; // skip blank lines
      const start = at(si);
      const end = at(ei);
      const hours = at(hi);
      // Days with no in/out and zero/blank hours are off-days in cumulative exports — skip silently.
      if (!start && !end && (!hours || Number(hours) === 0)) return;
      const date = normalizeImportDate(rawDate);
      if (!date) {
        errors.push(`Row ${idx + 2}: unrecognized date "${rawDate}"`);
        return;
      }
      const common = { date, breakHours: at(bi) || undefined, note: at(ni) || undefined };
      const parsed =
        start && end
          ? clockEntryInput.safeParse({ ...common, startTime: start, endTime: end })
          : entryInput.safeParse({ ...common, hours });
      if (parsed.success) inputs.push(parsed.data);
      else errors.push(`Row ${idx + 2}: ${flattenError(parsed.error)}`);
    });

    if (inputs.length === 0) {
      return fail(400, { importError: errors[0] ?? 'No valid rows found' });
    }
    for (const input of inputs) await addEntry(input);
    return { imported: inputs.length, skipped: errors.length };
  },
};

// Accept ISO ("2026-01-01"), M/D/YY, M/D/YYYY, and the same with a leading
// weekday like "Thu 1/1/26" or "Thursday, 1/1/2026" (cumulative-sheet style).
function normalizeImportDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const stripped = v.replace(/^[A-Za-z]+\.?,?\s+/, '');
  const m = stripped.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
