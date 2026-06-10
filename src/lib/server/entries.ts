import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db as defaultDb } from '$lib/db';
import { type EntryEvent, entryEvents, type TimeEntry, timeEntries } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';

// The `db` arg is injectable so unit tests pass an in-memory libSQL client.
type Database = typeof defaultDb;

/** Append an audit event: the row after an add/edit, or as it was at deletion. */
async function logEvent(database: Database, action: EntryEvent['action'], row: TimeEntry): Promise<void> {
  await database.insert(entryEvents).values({
    id: nanoid(),
    entryId: row.id,
    action,
    at: Date.now(),
    snapshot: JSON.stringify(row),
  });
}

/** Audit log, newest first; capped so a years-old log can't bloat the page. */
export async function listEntryEvents(database: Database = defaultDb): Promise<EntryEvent[]> {
  return database.select().from(entryEvents).orderBy(desc(entryEvents.at)).limit(1000);
}

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
      entryKind: input.entryKind,
    })
    .returning();
  await logEvent(database, 'add', created);
  return created;
}

export async function updateEntry(id: string, input: EntryInput, database: Database = defaultDb): Promise<void> {
  const [updated] = await database
    .update(timeEntries)
    .set({
      date: input.date,
      hours: input.hours,
      breakHours: input.breakHours,
      startTime: input.startTime,
      endTime: input.endTime,
      note: input.note,
      entryKind: input.entryKind,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(timeEntries.id, id))
    .returning();
  if (updated) await logEvent(database, 'edit', updated);
}

export async function deleteEntry(id: string, database: Database = defaultDb): Promise<void> {
  const [removed] = await database.delete(timeEntries).where(eq(timeEntries.id, id)).returning();
  if (removed) await logEvent(database, 'delete', removed);
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
  const removed = await database.delete(timeEntries).where(inArray(timeEntries.date, dates)).returning();
  for (const row of removed) await logEvent(database, 'delete', row);
}
