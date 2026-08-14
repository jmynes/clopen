import { describe, expect, it } from 'vitest';
import type { TimeEntry } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import { addAction, futureImportDates, updateAction } from './log';
import { emptyRepo, type Repo } from './repo';

function memRepo(): { repo: Repo; rows: TimeEntry[] } {
  const rows: TimeEntry[] = [];
  const repo: Repo = {
    ...emptyRepo,
    listEntries: async () => rows,
    addEntry: async (input: EntryInput) => {
      const row: TimeEntry = { id: `e${rows.length + 1}`, ...input, createdAt: 1, updatedAt: null };
      rows.push(row);
      return row;
    },
    updateEntry: async (id, input) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...input, updatedAt: 2 };
    },
    findExistingDates: async (dates) => dates.filter((d) => rows.some((r) => r.date === d)),
    listEntriesByDates: async (dates) => rows.filter((r) => dates.includes(r.date)),
  };
  return { repo, rows };
}

function fd(pairs: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(pairs)) form.set(k, v);
  return form;
}

const TODAY = '2026-06-15';

describe('futureImportDates', () => {
  it('returns only dates after today, distinct and sorted', () => {
    const csv = [
      'Date,Hours',
      '2026-06-14,8', // past
      '2026-06-15,8', // today
      '2026-06-19,8', // future
      '2026-06-16,8', // future (out of order)
      '2026-06-16,2', // future dup (second shift, same day)
    ].join('\n');
    expect(futureImportDates(csv, TODAY)).toEqual(['2026-06-16', '2026-06-19']);
  });

  it('skips off-day rows (no punches, zero/blank hours) so they never prompt', () => {
    const csv = ['Date,Hours,Clock In,Clock Out', '2026-06-20,0,,', '2026-06-21,,,'].join('\n');
    expect(futureImportDates(csv, TODAY)).toEqual([]);
  });

  it('counts a future row that has clock punches but no hours column value', () => {
    const csv = ['Date,Clock In,Clock Out', '2026-06-20,09:00,17:00'].join('\n');
    expect(futureImportDates(csv, TODAY)).toEqual(['2026-06-20']);
  });

  it('honors header aliases and weekday-prefixed M/D/YY dates', () => {
    const csv = ['Day,Total', 'Fri 6/19/26,8', 'Mon 6/15/26,8'].join('\n');
    expect(futureImportDates(csv, TODAY)).toEqual(['2026-06-19']);
  });

  it('returns [] when there is no date column, unparseable text, or no data rows', () => {
    expect(futureImportDates('Hours,Note\n8,hi', TODAY)).toEqual([]);
    expect(futureImportDates('', TODAY)).toEqual([]);
    expect(futureImportDates('Date,Hours', TODAY)).toEqual([]);
  });

  it('ignores unrecognized date strings rather than throwing', () => {
    const csv = ['Date,Hours', 'someday,8', '2026-06-30,8'].join('\n');
    expect(futureImportDates(csv, TODAY)).toEqual(['2026-06-30']);
  });
});

describe('addAction — open mode', () => {
  it('persists an arrival-only row as 0h with no end time', async () => {
    const { repo, rows } = memRepo();
    const out = await addAction(repo, fd({ mode: 'open', date: '2026-06-23', startTime: '9am' }));
    expect(out.ok).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ startTime: '09:00', endTime: null, hours: 0, entryKind: 'work' });
  });

  it('completes an open row in place via clock mode', async () => {
    const { repo, rows } = memRepo();
    await addAction(repo, fd({ mode: 'open', date: '2026-06-23', startTime: '09:00' }));
    const out = await updateAction(
      repo,
      fd({ id: 'e1', mode: 'clock', date: '2026-06-23', startTime: '09:00', endTime: '17:00' }),
    );
    expect(out.ok).toBe(true);
    expect(rows[0]).toMatchObject({ startTime: '09:00', endTime: '17:00', hours: 8 });
  });

  it('rejects an open row with no start time', async () => {
    const { repo, rows } = memRepo();
    const out = await addAction(repo, fd({ mode: 'open', date: '2026-06-23', startTime: '' }));
    expect(out.ok).toBe(false);
    expect(rows).toHaveLength(0);
  });
});

describe('addAction — returns ids', () => {
  it('surfaces the created entry id so the grid can switch to update', async () => {
    const { repo } = memRepo();
    const out = await addAction(repo, fd({ mode: 'clock', date: '2026-06-23', startTime: '09:00', endTime: '17:00' }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.ids).toEqual(['e1']);
  });
});

describe('addAction — leave with an "other" kind', () => {
  it('carries the typed label from the form through to the row', async () => {
    const { repo, rows } = memRepo();
    const out = await addAction(
      repo,
      fd({ date: '2026-06-23', mode: 'leave', kind: 'other_paid', kindLabel: '  Jury duty  ' }),
    );
    expect(out.ok).toBe(true);
    expect(rows[0].entryKind).toBe('other_paid');
    expect(rows[0].kindLabel).toBe('Jury duty');
  });

  it('scrubs a label posted alongside a named kind', async () => {
    const { repo, rows } = memRepo();
    await addAction(repo, fd({ date: '2026-06-23', mode: 'leave', kind: 'sick_paid', kindLabel: 'Jury duty' }));
    expect(rows[0].kindLabel).toBe(null);
  });

  it('rejects a label past the cap instead of silently dropping it', async () => {
    const { repo, rows } = memRepo();
    const out = await addAction(
      repo,
      fd({ date: '2026-06-23', mode: 'leave', kind: 'other_paid', kindLabel: 'x'.repeat(41) }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
    expect(rows).toHaveLength(0);
  });

  it('keeps the label on update', async () => {
    const { repo, rows } = memRepo();
    await addAction(repo, fd({ date: '2026-06-23', mode: 'leave', kind: 'other_unpaid', kindLabel: 'Moving day' }));
    await updateAction(
      repo,
      fd({ id: rows[0].id, date: '2026-06-23', mode: 'leave', kind: 'other_unpaid', kindLabel: 'Moving house' }),
    );
    expect(rows[0].kindLabel).toBe('Moving house');
  });
});

describe('addAction — extra shifts on an already-logged day', () => {
  const first = { date: '2026-06-23', mode: 'clock', startTime: '09:00', endTime: '17:00' };
  const second = { date: '2026-06-23', mode: 'clock', startTime: '19:00', endTime: '21:00' };

  it('conflicts without a strategy — the grid must not add blind', async () => {
    const { repo, rows } = memRepo();
    await addAction(repo, fd(first));
    const out = await addAction(repo, fd(second));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(409);
    expect(rows).toHaveLength(1);
  });

  it('keeps both when the caller asks to append', async () => {
    const { repo, rows } = memRepo();
    await addAction(repo, fd(first));
    const out = await addAction(repo, fd({ ...second, conflictStrategy: 'append' }));
    expect(out.ok).toBe(true);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.startTime)).toEqual(['09:00', '19:00']);
  });
});
