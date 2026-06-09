import { eq } from 'drizzle-orm';
import { db as defaultDb } from '$lib/db';
import { type Settings, settings } from '$lib/db/schema';
import type { SettingsInput } from '$lib/schemas/settings';
import { workdaysJson } from '$lib/schemas/settings';
import type { WorkSettings } from '$lib/timesheet';

type Database = typeof defaultDb;

const DEFAULT_ID = 'default';
const DEFAULTS = {
  id: DEFAULT_ID,
  hourlyRate: 38.4615,
  dailyHours: 8,
  workdays: '[1,2,3,4,5]',
  weekStartsOn: 7,
  epoch: '2025-03-16',
} satisfies Settings;

/** Read the single settings row, seeding defaults on first access. */
export async function getSettings(database: Database = defaultDb): Promise<Settings> {
  const rows = await database.select().from(settings).where(eq(settings.id, DEFAULT_ID)).limit(1);
  if (rows[0]) return rows[0];
  await database.insert(settings).values(DEFAULTS).onConflictDoNothing();
  return DEFAULTS;
}

export async function updateSettings(input: SettingsInput, database: Database = defaultDb): Promise<void> {
  const row = {
    id: DEFAULT_ID,
    hourlyRate: input.hourlyRate,
    dailyHours: input.dailyHours,
    workdays: JSON.stringify(input.workdays),
    weekStartsOn: input.weekStartsOn,
    epoch: input.epoch,
  };
  await database
    .insert(settings)
    .values(row)
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        hourlyRate: row.hourlyRate,
        dailyHours: row.dailyHours,
        workdays: row.workdays,
        weekStartsOn: row.weekStartsOn,
        epoch: row.epoch,
      },
    });
}

/** Map a stored settings row to the shape the make-whole math expects. */
export function toWorkSettings(row: Settings): WorkSettings {
  return {
    hourlyRate: row.hourlyRate,
    dailyHours: row.dailyHours,
    workdays: workdaysJson.parse(JSON.parse(row.workdays)),
  };
}
