import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '$lib/db/schema';
import type { SavingsGoalInput } from '$lib/schemas/savings-goal';
import {
  addSavingsGoal,
  deleteSavingsGoal,
  listSavingsGoals,
  setSavingsGoalRank,
  updateSavingsGoal,
} from './savings-goals';

type Db = ReturnType<typeof drizzle<typeof schema>>;

function mk(partial: Partial<SavingsGoalInput> & { name: string }): SavingsGoalInput {
  return { targetAmount: 350, startDate: '2026-06-12', funding: 'overtime', allocation: 100, ...partial };
}

let db: Db;

beforeEach(async () => {
  db = drizzle(createClient({ url: ':memory:' }), { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
});

describe('savings goals CRUD', () => {
  it('adds a goal and reads it back', async () => {
    const created = await addSavingsGoal(mk({ name: 'Nintendo Switch' }), db);
    expect(created.id).toBeTruthy();
    expect(created.updatedAt ?? null).toBeNull();

    const all = await listSavingsGoals(db);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'Nintendo Switch', targetAmount: 350, funding: 'overtime' });
  });

  it('lists in rank order; new goals append at the end', async () => {
    await addSavingsGoal(mk({ name: 'first' }), db);
    await addSavingsGoal(mk({ name: 'second' }), db);
    const all = await listSavingsGoals(db);
    expect(all.map((g) => g.name)).toEqual(['first', 'second']);
    expect(all[1].rank).toBeGreaterThan(all[0].rank);
  });

  it('setSavingsGoalRank reorders the list', async () => {
    const a = await addSavingsGoal(mk({ name: 'a' }), db);
    const b = await addSavingsGoal(mk({ name: 'b' }), db);
    await setSavingsGoalRank(a.id, 1, db);
    await setSavingsGoalRank(b.id, 0, db);
    const all = await listSavingsGoals(db);
    expect(all.map((g) => g.name)).toEqual(['b', 'a']);
  });

  it('persists allocation', async () => {
    await addSavingsGoal(mk({ name: 'split', allocation: 20 }), db);
    expect((await listSavingsGoals(db))[0].allocation).toBe(20);
  });

  it('updates a goal and stamps updatedAt', async () => {
    const created = await addSavingsGoal(mk({ name: 'Switch' }), db);
    await updateSavingsGoal(created.id, mk({ name: 'Switch 2', targetAmount: 450, funding: 'all' }), db);

    const all = await listSavingsGoals(db);
    expect(all[0]).toMatchObject({ name: 'Switch 2', targetAmount: 450, funding: 'all' });
    expect(all[0].updatedAt).not.toBeNull();
  });

  it('deletes a goal', async () => {
    const created = await addSavingsGoal(mk({ name: 'Switch' }), db);
    await deleteSavingsGoal(created.id, db);
    expect(await listSavingsGoals(db)).toHaveLength(0);
  });
});
