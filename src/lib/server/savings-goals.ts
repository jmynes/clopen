import { asc, eq, max } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db as defaultDb } from '$lib/db';
import { type SavingsGoal, savingsGoals } from '$lib/db/schema';
import type { SavingsGoalInput } from '$lib/schemas/savings-goal';

// The `db` arg is injectable so unit tests pass an in-memory libSQL client.
type Database = typeof defaultDb;

/** Rank order (the allocation priority); rank ties fall back to creation order. */
export function listSavingsGoals(database: Database = defaultDb): Promise<SavingsGoal[]> {
  return database.select().from(savingsGoals).orderBy(asc(savingsGoals.rank), asc(savingsGoals.createdAt));
}

export async function addSavingsGoal(input: SavingsGoalInput, database: Database = defaultDb): Promise<SavingsGoal> {
  const [{ top }] = await database.select({ top: max(savingsGoals.rank) }).from(savingsGoals);
  const [created] = await database
    .insert(savingsGoals)
    .values({
      id: nanoid(),
      name: input.name,
      targetAmount: input.targetAmount,
      startDate: input.startDate,
      funding: input.funding,
      allocation: input.allocation,
      rank: (top ?? -1) + 1,
    })
    .returning();
  return created;
}

/** Used by the reorder action, which rewrites ranks as 0..n−1. */
export async function setSavingsGoalRank(id: string, rank: number, database: Database = defaultDb): Promise<void> {
  await database.update(savingsGoals).set({ rank }).where(eq(savingsGoals.id, id));
}

export async function updateSavingsGoal(
  id: string,
  input: SavingsGoalInput,
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(savingsGoals)
    .set({
      name: input.name,
      targetAmount: input.targetAmount,
      startDate: input.startDate,
      funding: input.funding,
      allocation: input.allocation,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(savingsGoals.id, id));
}

export async function deleteSavingsGoal(id: string, database: Database = defaultDb): Promise<void> {
  await database.delete(savingsGoals).where(eq(savingsGoals.id, id));
}
