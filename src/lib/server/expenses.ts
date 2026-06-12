import { asc, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db as defaultDb } from '$lib/db';
import { type Expense, type ExpenseEvent, expenseEvents, expenses } from '$lib/db/schema';
import type { ExpenseInput } from '$lib/schemas/expense';

// The `db` arg is injectable so unit tests pass an in-memory libSQL client.
type Database = typeof defaultDb;

/** Append an audit event: the row after an add/edit, or as it was at deletion. */
async function logEvent(database: Database, action: ExpenseEvent['action'], row: Expense): Promise<void> {
  await database.insert(expenseEvents).values({
    id: nanoid(),
    expenseId: row.id,
    action,
    at: Date.now(),
    snapshot: JSON.stringify(row),
  });
}

/** Audit log, newest first; capped like the entry events list. */
export async function listExpenseEvents(database: Database = defaultDb): Promise<ExpenseEvent[]> {
  return database.select().from(expenseEvents).orderBy(desc(expenseEvents.at)).limit(1000);
}

export function listExpenses(database: Database = defaultDb): Promise<Expense[]> {
  return database.select().from(expenses).orderBy(desc(expenses.date), asc(expenses.createdAt));
}

export async function addExpense(input: ExpenseInput, database: Database = defaultDb): Promise<Expense> {
  const [created] = await database
    .insert(expenses)
    .values({
      id: nanoid(),
      date: input.date,
      amount: input.amount,
      kind: input.kind,
      vendor: input.vendor,
      direction: input.direction,
      method: input.method,
      cadence: input.cadence,
      note: input.note,
    })
    .returning();
  await logEvent(database, 'add', created);
  return created;
}

export async function updateExpense(id: string, input: ExpenseInput, database: Database = defaultDb): Promise<void> {
  const [updated] = await database
    .update(expenses)
    .set({
      date: input.date,
      amount: input.amount,
      kind: input.kind,
      vendor: input.vendor,
      direction: input.direction,
      method: input.method,
      cadence: input.cadence,
      note: input.note,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(expenses.id, id))
    .returning();
  if (updated) await logEvent(database, 'edit', updated);
}

export async function deleteExpense(id: string, database: Database = defaultDb): Promise<void> {
  const [removed] = await database.delete(expenses).where(eq(expenses.id, id)).returning();
  if (removed) await logEvent(database, 'delete', removed);
}
