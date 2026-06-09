import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '$lib/db/schema';
import { addEntry, deleteEntry, listEntries, listEntriesInRange, updateEntry } from './entries';

type Db = ReturnType<typeof drizzle<typeof schema>>;

let db: Db;

beforeEach(async () => {
  db = drizzle(createClient({ url: ':memory:' }), { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
});

describe('entries CRUD', () => {
  it('adds an entry and reads it back', async () => {
    const created = await addEntry({ date: '2026-01-05', hours: 8, note: 'kickoff' }, db);
    expect(created.id).toBeTruthy();

    const all = await listEntries(db);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ date: '2026-01-05', hours: 8, note: 'kickoff' });
  });

  it('keeps multiple entries on the same day', async () => {
    await addEntry({ date: '2026-01-05', hours: 4, note: 'morning' }, db);
    await addEntry({ date: '2026-01-05', hours: 5, note: 'afternoon' }, db);
    const all = await listEntries(db);
    expect(all).toHaveLength(2);
    expect(all.reduce((sum, e) => sum + e.hours, 0)).toBe(9);
  });

  it('filters by date range', async () => {
    await addEntry({ date: '2025-12-31', hours: 8, note: null }, db);
    await addEntry({ date: '2026-01-05', hours: 8, note: null }, db);
    await addEntry({ date: '2026-02-01', hours: 8, note: null }, db);

    const inRange = await listEntriesInRange('2026-01-01', '2026-01-31', db);
    expect(inRange).toHaveLength(1);
    expect(inRange[0].date).toBe('2026-01-05');
  });

  it('updates an entry', async () => {
    const created = await addEntry({ date: '2026-01-05', hours: 8, note: null }, db);
    await updateEntry(created.id, { date: '2026-01-06', hours: 6, note: 'revised' }, db);

    const all = await listEntries(db);
    expect(all[0]).toMatchObject({ date: '2026-01-06', hours: 6, note: 'revised' });
  });

  it('deletes an entry', async () => {
    const created = await addEntry({ date: '2026-01-05', hours: 8, note: null }, db);
    await deleteEntry(created.id, db);
    expect(await listEntries(db)).toHaveLength(0);
  });
});
