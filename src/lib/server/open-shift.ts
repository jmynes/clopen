import { eq } from 'drizzle-orm';
import { db as defaultDb } from '$lib/db';
import { type OpenShift, openShift } from '$lib/db/schema';

type Database = typeof defaultDb;
const ID = 'current';

export async function getOpenShift(database: Database = defaultDb): Promise<OpenShift | null> {
  const rows = await database.select().from(openShift).where(eq(openShift.id, ID)).limit(1);
  return rows[0] ?? null;
}

export async function saveOpenShift(row: OpenShift, database: Database = defaultDb): Promise<void> {
  await database
    .insert(openShift)
    .values({ ...row, id: ID })
    .onConflictDoUpdate({
      target: openShift.id,
      set: {
        startedAt: row.startedAt,
        breakStartedAt: row.breakStartedAt,
        breakSeconds: row.breakSeconds,
        breakMode: row.breakMode,
      },
    });
}

export async function clearOpenShift(database: Database = defaultDb): Promise<void> {
  await database.delete(openShift).where(eq(openShift.id, ID));
}
