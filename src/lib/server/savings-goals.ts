import { asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db as defaultDb } from '$lib/db';
import { type SavingsGoal, savingsGoals } from '$lib/db/schema';
import type { SavingsGoalInput } from '$lib/schemas/savings-goal';

// The `db` arg is injectable so unit tests pass an in-memory libSQL client.
type Database = typeof defaultDb;

/** Creation order — goal cards keep their place as others come and go.
 *  Same-second ties fall back to insertion (rowid) order. */
export function listSavingsGoals(database: Database = defaultDb): Promise<SavingsGoal[]> {
  return database.select().from(savingsGoals).orderBy(asc(savingsGoals.createdAt));
}

export async function addSavingsGoal(input: SavingsGoalInput, database: Database = defaultDb): Promise<SavingsGoal> {
  const [created] = await database
    .insert(savingsGoals)
    .values({
      id: nanoid(),
      name: input.name,
      targetAmount: input.targetAmount,
      startDate: input.startDate,
      funding: input.funding,
    })
    .returning();
  return created;
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
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(savingsGoals.id, id));
}

export async function deleteSavingsGoal(id: string, database: Database = defaultDb): Promise<void> {
  await database.delete(savingsGoals).where(eq(savingsGoals.id, id));
}
