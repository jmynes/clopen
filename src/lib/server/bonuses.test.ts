import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '$lib/db/schema';
import type { BonusInput } from '$lib/schemas/bonus';
import { addBonus, deleteBonus, listBonusEvents, listBonuses, updateBonus } from './bonuses';

type Db = ReturnType<typeof drizzle<typeof schema>>;

function mk(partial: Partial<BonusInput> & { date: string; amount: number }): BonusInput {
  return { label: null, note: null, ...partial };
}

let db: Db;

beforeEach(async () => {
  db = drizzle(createClient({ url: ':memory:' }), { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
});

describe('bonuses CRUD', () => {
  it('adds a bonus and reads it back', async () => {
    const created = await addBonus(mk({ date: '2026-09-15', amount: 2000, label: 'Q3 performance' }), db);
    expect(created.id).toBeTruthy();
    expect(created.updatedAt ?? null).toBeNull();

    const all = await listBonuses(db);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ date: '2026-09-15', amount: 2000, label: 'Q3 performance' });
  });

  it('lists newest date first, same-day by creation order', async () => {
    await addBonus(mk({ date: '2026-06-01', amount: 10, label: 'first' }), db);
    await addBonus(mk({ date: '2026-06-10', amount: 20 }), db);
    await addBonus(mk({ date: '2026-06-01', amount: 30, label: 'second' }), db);

    expect((await listBonuses(db)).map((b) => b.amount)).toEqual([20, 10, 30]);
  });

  it('stamps updatedAt on edit and keeps createdAt', async () => {
    const created = await addBonus(mk({ date: '2026-09-15', amount: 2000 }), db);
    await updateBonus(created.id, mk({ date: '2026-09-15', amount: 2500 }), db);

    const [row] = await listBonuses(db);
    expect(row.amount).toBe(2500);
    expect(row.createdAt).toBe(created.createdAt);
    expect(row.updatedAt).not.toBeNull();
  });

  it('deletes', async () => {
    const created = await addBonus(mk({ date: '2026-09-15', amount: 2000 }), db);
    await deleteBonus(created.id, db);
    expect(await listBonuses(db)).toHaveLength(0);
  });
});

describe('bonus audit log', () => {
  it('records add, edit, and delete with snapshots', async () => {
    const created = await addBonus(mk({ date: '2026-09-15', amount: 2000, label: 'spot' }), db);
    await updateBonus(created.id, mk({ date: '2026-09-15', amount: 2500, label: 'spot' }), db);
    await deleteBonus(created.id, db);

    const events = await listBonusEvents(db);
    // Sorted, not ordered: `at` is epoch ms with no tie-break, so a fast
    // edit-then-delete can share a millisecond (same as the expense log).
    expect(events.map((e) => e.action).sort()).toEqual(['add', 'delete', 'edit']);
    expect(events.every((e) => e.bonusId === created.id)).toBe(true);
    // The edit snapshot is the row after the edit; the delete snapshot is the
    // row as it was removed — both carry the revised amount.
    const edited = events.find((e) => e.action === 'edit');
    expect(JSON.parse(edited?.snapshot ?? '{}')).toMatchObject({ amount: 2500 });
    const deleted = events.find((e) => e.action === 'delete');
    expect(JSON.parse(deleted?.snapshot ?? '{}')).toMatchObject({ amount: 2500, label: 'spot' });
  });

  it('logs nothing when the id does not exist', async () => {
    await updateBonus('nope', mk({ date: '2026-09-15', amount: 1 }), db);
    await deleteBonus('nope', db);
    expect(await listBonusEvents(db)).toHaveLength(0);
  });
});
