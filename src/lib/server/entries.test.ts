import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import {
  addEntry,
  deleteEntriesByDates,
  deleteEntry,
  listEntries,
  listEntriesInRange,
  listEntryEvents,
  updateEntry,
} from './entries';

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Build a full EntryInput; hours mode (no clock times) unless overridden.
function mk(partial: Partial<EntryInput> & { date: string; hours: number }): EntryInput {
  return { breakHours: 0, note: null, startTime: null, endTime: null, entryKind: 'work', ...partial };
}

let db: Db;

beforeEach(async () => {
  db = drizzle(createClient({ url: ':memory:' }), { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
});

describe('entries CRUD', () => {
  it('adds an entry and reads it back', async () => {
    const created = await addEntry(mk({ date: '2026-01-05', hours: 8, note: 'kickoff' }), db);
    expect(created.id).toBeTruthy();

    const all = await listEntries(db);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ date: '2026-01-05', hours: 8, note: 'kickoff' });
  });

  it('persists break/lunch hours', async () => {
    await addEntry(mk({ date: '2026-01-05', hours: 9, breakHours: 1 }), db);
    const all = await listEntries(db);
    expect(all[0].breakHours).toBe(1);
  });

  it('persists clock in/out times', async () => {
    await addEntry(mk({ date: '2026-01-05', hours: 8, startTime: '09:00', endTime: '17:00' }), db);
    const all = await listEntries(db);
    expect(all[0]).toMatchObject({ startTime: '09:00', endTime: '17:00' });
  });

  it('keeps multiple entries on the same day', async () => {
    await addEntry(mk({ date: '2026-01-05', hours: 4, note: 'morning' }), db);
    await addEntry(mk({ date: '2026-01-05', hours: 5, note: 'afternoon' }), db);
    const all = await listEntries(db);
    expect(all).toHaveLength(2);
    expect(all.reduce((sum, e) => sum + e.hours, 0)).toBe(9);
  });

  it('filters by date range', async () => {
    await addEntry(mk({ date: '2025-12-31', hours: 8 }), db);
    await addEntry(mk({ date: '2026-01-05', hours: 8 }), db);
    await addEntry(mk({ date: '2026-02-01', hours: 8 }), db);

    const inRange = await listEntriesInRange('2026-01-01', '2026-01-31', db);
    expect(inRange).toHaveLength(1);
    expect(inRange[0].date).toBe('2026-01-05');
  });

  it('updates an entry', async () => {
    const created = await addEntry(mk({ date: '2026-01-05', hours: 8 }), db);
    await updateEntry(created.id, mk({ date: '2026-01-06', hours: 6, breakHours: 0.5, note: 'revised' }), db);

    const all = await listEntries(db);
    expect(all[0]).toMatchObject({ date: '2026-01-06', hours: 6, breakHours: 0.5, note: 'revised' });
  });

  it('deletes an entry', async () => {
    const created = await addEntry(mk({ date: '2026-01-05', hours: 8 }), db);
    await deleteEntry(created.id, db);
    expect(await listEntries(db)).toHaveLength(0);
  });

  it('audit log: add/edit/delete each record an event with a snapshot', async () => {
    const row = await addEntry(mk({ date: '2026-06-10', hours: 8 }), db);
    await updateEntry(row.id, mk({ date: '2026-06-10', hours: 7 }), db);
    await deleteEntry(row.id, db);

    const events = await listEntryEvents(db);
    expect(events.map((e) => e.action).sort()).toEqual(['add', 'delete', 'edit']);
    expect(events.every((e) => e.entryId === row.id)).toBe(true);
    // The edit snapshot is the row AFTER the edit; the delete snapshot is the
    // row as it was removed — both carry the revised hours.
    const edited = events.find((e) => e.action === 'edit');
    expect(JSON.parse(edited?.snapshot ?? '{}')).toMatchObject({ hours: 7 });
    const deleted = events.find((e) => e.action === 'delete');
    expect(JSON.parse(deleted?.snapshot ?? '{}')).toMatchObject({ hours: 7, date: '2026-06-10' });
  });

  it('audit log: bulk overwrite deletion records one event per removed entry', async () => {
    await addEntry(mk({ date: '2026-06-01', hours: 4 }), db);
    await addEntry(mk({ date: '2026-06-01', hours: 5 }), db);
    await deleteEntriesByDates(['2026-06-01'], db);

    const deletes = (await listEntryEvents(db)).filter((e) => e.action === 'delete');
    expect(deletes).toHaveLength(2);
  });

  it('updateEntry stamps updatedAt; addEntry leaves it null', async () => {
    const row = await addEntry(
      { date: '2026-06-10', hours: 8, breakHours: 0, note: null, startTime: null, endTime: null, entryKind: 'work' },
      db,
    );
    expect(row.updatedAt ?? null).toBeNull();
    const before = Math.floor(Date.now() / 1000);
    await updateEntry(
      row.id,
      { date: '2026-06-10', hours: 7, breakHours: 0, note: null, startTime: null, endTime: null, entryKind: 'work' },
      db,
    );
    const after = (await listEntries(db)).find((e) => e.id === row.id);
    expect(after?.updatedAt).toBeGreaterThanOrEqual(before);
  });
});
