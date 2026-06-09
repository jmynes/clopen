import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db as defaultDb } from '$lib/db';
import { type TimeEntry, timeEntries } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';

// The `db` arg is injectable so unit tests pass an in-memory libSQL client.
type Database = typeof defaultDb;

export function listEntries(database: Database = defaultDb): Promise<TimeEntry[]> {
  return database.select().from(timeEntries).orderBy(desc(timeEntries.date), asc(timeEntries.createdAt));
}

export function listEntriesInRange(start: string, end: string, database: Database = defaultDb): Promise<TimeEntry[]> {
  return database
    .select()
    .from(timeEntries)
    .where(and(gte(timeEntries.date, start), lte(timeEntries.date, end)))
    .orderBy(asc(timeEntries.date), asc(timeEntries.createdAt));
}

export async function addEntry(input: EntryInput, database: Database = defaultDb): Promise<TimeEntry> {
  const [created] = await database
    .insert(timeEntries)
    .values({
      id: nanoid(),
      date: input.date,
      hours: input.hours,
      breakHours: input.breakHours,
      startTime: input.startTime,
      endTime: input.endTime,
      note: input.note,
    })
    .returning();
  return created;
}

export async function updateEntry(id: string, input: EntryInput, database: Database = defaultDb): Promise<void> {
  await database
    .update(timeEntries)
    .set({
      date: input.date,
      hours: input.hours,
      breakHours: input.breakHours,
      startTime: input.startTime,
      endTime: input.endTime,
      note: input.note,
    })
    .where(eq(timeEntries.id, id));
}

export async function deleteEntry(id: string, database: Database = defaultDb): Promise<void> {
  await database.delete(timeEntries).where(eq(timeEntries.id, id));
}
