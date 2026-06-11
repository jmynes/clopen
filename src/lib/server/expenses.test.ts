import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '$lib/db/schema';
import type { ExpenseInput } from '$lib/schemas/expense';
import { addExpense, deleteExpense, listExpenseEvents, listExpenses, updateExpense } from './expenses';

type Db = ReturnType<typeof drizzle<typeof schema>>;

function mk(partial: Partial<ExpenseInput> & { date: string; amount: number }): ExpenseInput {
  return { kind: 'ride', vendor: null, direction: null, method: null, note: null, ...partial };
}

let db: Db;

beforeEach(async () => {
  db = drizzle(createClient({ url: ':memory:' }), { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
});

describe('expenses CRUD', () => {
  it('adds an expense and reads it back', async () => {
    const created = await addExpense(mk({ date: '2026-06-10', amount: 18.5, note: 'Uber in' }), db);
    expect(created.id).toBeTruthy();
    expect(created.updatedAt ?? null).toBeNull();

    const all = await listExpenses(db);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ date: '2026-06-10', amount: 18.5, kind: 'ride', note: 'Uber in' });
  });

  it('lists newest date first, same-day by creation order', async () => {
    await addExpense(mk({ date: '2026-06-01', amount: 10, note: 'first' }), db);
    await addExpense(mk({ date: '2026-06-10', amount: 20 }), db);
    await addExpense(mk({ date: '2026-06-01', amount: 30, note: 'second' }), db);

    const all = await listExpenses(db);
    expect(all.map((e) => e.amount)).toEqual([20, 10, 30]);
  });

  it('updates an expense and stamps updatedAt', async () => {
    const created = await addExpense(mk({ date: '2026-06-10', amount: 18.5 }), db);
    await updateExpense(created.id, mk({ date: '2026-06-11', amount: 22, kind: 'other', note: 'revised' }), db);

    const all = await listExpenses(db);
    expect(all[0]).toMatchObject({ date: '2026-06-11', amount: 22, kind: 'other', note: 'revised' });
    expect(all[0].updatedAt).not.toBeNull();
  });

  it('persists ride vendor and direction', async () => {
    await addExpense(mk({ date: '2026-06-10', amount: 18.5, vendor: 'lyft', direction: 'to_home' }), db);
    const all = await listExpenses(db);
    expect(all[0]).toMatchObject({ vendor: 'lyft', direction: 'to_home' });
  });

  it('persists meal vendor and method', async () => {
    await addExpense(mk({ date: '2026-06-10', amount: 24, kind: 'meal', vendor: 'grubhub', method: 'delivery' }), db);
    const all = await listExpenses(db);
    expect(all[0]).toMatchObject({ kind: 'meal', vendor: 'grubhub', method: 'delivery', direction: null });
  });

  it('deletes an expense', async () => {
    const created = await addExpense(mk({ date: '2026-06-10', amount: 18.5 }), db);
    await deleteExpense(created.id, db);
    expect(await listExpenses(db)).toHaveLength(0);
  });

  it('audit log: add/edit/delete each record an event with a snapshot', async () => {
    const row = await addExpense(mk({ date: '2026-06-10', amount: 18.5 }), db);
    await updateExpense(row.id, mk({ date: '2026-06-10', amount: 22 }), db);
    await deleteExpense(row.id, db);

    const events = await listExpenseEvents(db);
    expect(events.map((e) => e.action).sort()).toEqual(['add', 'delete', 'edit']);
    expect(events.every((e) => e.expenseId === row.id)).toBe(true);
    // The edit snapshot is the row AFTER the edit; the delete snapshot is the
    // row as it was removed — both carry the revised amount.
    const edited = events.find((e) => e.action === 'edit');
    expect(JSON.parse(edited?.snapshot ?? '{}')).toMatchObject({ amount: 22 });
    const deleted = events.find((e) => e.action === 'delete');
    expect(JSON.parse(deleted?.snapshot ?? '{}')).toMatchObject({ amount: 22, date: '2026-06-10' });
  });

  it('deleting a missing id records no event', async () => {
    await deleteExpense('nope', db);
    expect(await listExpenseEvents(db)).toHaveLength(0);
  });
});
