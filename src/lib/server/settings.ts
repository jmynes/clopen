import { eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS, toWorkSettings } from '$lib/core/repo';
import { db as defaultDb } from '$lib/db';
import { type Settings, settings } from '$lib/db/schema';
import type { SettingsInput } from '$lib/schemas/settings';

type Database = typeof defaultDb;

const DEFAULT_ID = 'default';
const DEFAULTS = DEFAULT_SETTINGS;

// Kept as a re-export so existing imports keep working; the implementation
// lives in the client-safe core.
export { toWorkSettings };

/** Read the single settings row, seeding defaults on first access. */
export async function getSettings(database: Database = defaultDb): Promise<Settings> {
  const rows = await database.select().from(settings).where(eq(settings.id, DEFAULT_ID)).limit(1);
  if (rows[0]) return rows[0];
  await database.insert(settings).values(DEFAULTS).onConflictDoNothing();
  return DEFAULTS;
}

export async function updateSettings(input: SettingsInput, database: Database = defaultDb): Promise<void> {
  // One column map serves both arms of the upsert.
  const set = {
    hourlyRate: input.hourlyRate,
    dailyHours: input.dailyHours,
    workdays: JSON.stringify(input.workdays),
    weekStartsOn: input.weekStartsOn,
    epoch: input.epoch,
    timeFormat: input.timeFormat,
    ledgerPeriod: input.ledgerPeriod,
    timeZone: input.timeZone,
    observeDst: input.observeDst,
    clockBreakMode: input.clockBreakMode,
    hideWeekendsEntries: input.hideWeekendsEntries,
    hideWeekendsGrid: input.hideWeekendsGrid,
    expandNotes: input.expandNotes,
    otMultiplierEnabled: input.otMultiplierEnabled,
    otMultiplier: input.otMultiplier,
    goalEnabled: input.goalEnabled,
    yearlyGoal: input.yearlyGoal,
    countExpenses: input.countExpenses,
    defaultExpenseKind: input.defaultExpenseKind,
    defaultRideVendor: input.defaultRideVendor,
    defaultRideDirection: input.defaultRideDirection,
    defaultMealVendor: input.defaultMealVendor,
    defaultMealMethod: input.defaultMealMethod,
    defaultPurchaseVendor: input.defaultPurchaseVendor,
    defaultPurchaseCadence: input.defaultPurchaseCadence,
  };
  await database
    .insert(settings)
    .values({ id: DEFAULT_ID, ...set })
    .onConflictDoUpdate({ target: settings.id, set });
}
