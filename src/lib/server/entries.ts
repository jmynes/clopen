import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
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
      isPto: input.isPto,
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
      isPto: input.isPto,
    })
    .where(eq(timeEntries.id, id));
}

export async function deleteEntry(id: string, database: Database = defaultDb): Promise<void> {
  await database.delete(timeEntries).where(eq(timeEntries.id, id));
}

/** Returns the subset of `dates` that already have at least one entry. */
export async function findExistingDates(dates: string[], database: Database = defaultDb): Promise<string[]> {
  if (dates.length === 0) return [];
  const rows = await database
    .selectDistinct({ date: timeEntries.date })
    .from(timeEntries)
    .where(inArray(timeEntries.date, dates));
  return rows.map((r) => r.date);
}

/** Return every entry whose date is in `dates`, ordered by date then createdAt. */
export async function listEntriesByDates(dates: string[], database: Database = defaultDb): Promise<TimeEntry[]> {
  if (dates.length === 0) return [];
  return database
    .select()
    .from(timeEntries)
    .where(inArray(timeEntries.date, dates))
    .orderBy(asc(timeEntries.date), asc(timeEntries.createdAt));
}

/** Bulk delete every entry whose date is in `dates`. Used when overwriting on conflict. */
export async function deleteEntriesByDates(dates: string[], database: Database = defaultDb): Promise<void> {
  if (dates.length === 0) return;
  await database.delete(timeEntries).where(inArray(timeEntries.date, dates));
}
