import { asc, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db as defaultDb } from '$lib/db';
import { type Bonus, type BonusEvent, bonusEvents, bonuses } from '$lib/db/schema';
import type { BonusInput } from '$lib/schemas/bonus';

// The `db` arg is injectable so unit tests pass an in-memory libSQL client.
type Database = typeof defaultDb;

/** Append an audit event: the row after an add/edit, or as it was at deletion. */
async function logEvent(database: Database, action: BonusEvent['action'], row: Bonus): Promise<void> {
  await database.insert(bonusEvents).values({
    id: nanoid(),
    bonusId: row.id,
    action,
    at: Date.now(),
    snapshot: JSON.stringify(row),
  });
}

/** Audit log, newest first; capped like the entry and expense event lists. */
export async function listBonusEvents(database: Database = defaultDb): Promise<BonusEvent[]> {
  return database.select().from(bonusEvents).orderBy(desc(bonusEvents.at)).limit(1000);
}

export function listBonuses(database: Database = defaultDb): Promise<Bonus[]> {
  return database.select().from(bonuses).orderBy(desc(bonuses.date), asc(bonuses.createdAt));
}

export async function addBonus(input: BonusInput, database: Database = defaultDb): Promise<Bonus> {
  const [created] = await database
    .insert(bonuses)
    .values({ id: nanoid(), date: input.date, amount: input.amount, label: input.label, note: input.note })
    .returning();
  await logEvent(database, 'add', created);
  return created;
}

export async function updateBonus(id: string, input: BonusInput, database: Database = defaultDb): Promise<void> {
  const [updated] = await database
    .update(bonuses)
    .set({
      date: input.date,
      amount: input.amount,
      label: input.label,
      note: input.note,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(bonuses.id, id))
    .returning();
  if (updated) await logEvent(database, 'edit', updated);
}

export async function deleteBonus(id: string, database: Database = defaultDb): Promise<void> {
  const [removed] = await database.delete(bonuses).where(eq(bonuses.id, id)).returning();
  if (removed) await logEvent(database, 'delete', removed);
}
