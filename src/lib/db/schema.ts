import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { ENTRY_KINDS } from '$lib/leave-kinds';
import { LEDGER_PERIODS } from '$lib/schemas/settings';

/**
 * One logged chunk of work. Multiple entries per calendar day are allowed
 * (e.g. a morning and an afternoon session); the UI aggregates by day.
 * `date` is an ISO `YYYY-MM-DD` string in the user's local timezone — the
 * unit that the make-whole math counts against the Mon–Fri baseline.
 */
export const timeEntries = sqliteTable('time_entries', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  hours: real('hours').notNull(),
  /** Unpaid break/lunch deducted from `hours`; net worked = hours − breakHours. */
  breakHours: real('break_hours').notNull().default(0),
  /** Optional clock in/out (`HH:MM`). When set, `hours` is their difference. */
  startTime: text('start_time'),
  endTime: text('end_time'),
  note: text('note'),
  /**
   * Entry kind. `work` is a regular logged shift; everything else is a leave
   * category (paid or unpaid) that displays as a colored badge. Paid kinds
   * credit the daily baseline; unpaid kinds record 0h.
   */
  entryKind: text('entry_kind', { enum: ENTRY_KINDS }).notNull().default('work'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

/**
 * Single-row configuration (id is always 'default'). `workdays` is a JSON
 * array of ISO weekday numbers (1 = Mon … 7 = Sun); the default Mon–Fri set
 * gives the confirmed 8h × 5 = 40h/week baseline. `dailyHours` is the
 * expected hours per workday.
 */
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().default('default'),
  hourlyRate: real('hourly_rate').notNull().default(38.4615),
  dailyHours: real('daily_hours').notNull().default(8),
  workdays: text('workdays').notNull().default('[1,2,3,4,5]'),
  /** ISO weekday the week starts on: 1 = Monday, 7 = Sunday. */
  weekStartsOn: integer('week_starts_on').notNull().default(7),
  /** Earliest date that counts toward accrual; clamps year-to-date math. */
  epoch: text('epoch').notNull().default('2025-03-16'),
  /** Clock display: '12h' (default, e.g. 09:00 AM) or '24h' (e.g. 09:00). */
  timeFormat: text('time_format').notNull().default('12h'),
  /** Period the Ledger opens to (its selector still changes it per visit). */
  ledgerPeriod: text('ledger_period', { enum: LEDGER_PERIODS }).notNull().default('month'),
  /** Hide blank Sat/Sun rows in the Entries list (weekends with entries still show). */
  hideWeekendsEntries: integer('hide_weekends_entries', { mode: 'boolean' }).notNull().default(false),
  /**
   * Hide Sat/Sun rows in the Log-a-week grid. Implies hiding blank weekends in
   * Entries too; toggle off temporarily to log an odd weekend shift.
   */
  hideWeekendsGrid: integer('hide_weekends_grid', { mode: 'boolean' }).notNull().default(false),
  /** Start with every entry's note accordion expanded in the Entries views. */
  expandNotes: integer('expand_notes', { mode: 'boolean' }).notNull().default(false),
  /** Pay day-hours beyond the daily baseline at `otMultiplier` × rate. */
  otMultiplierEnabled: integer('ot_multiplier_enabled', { mode: 'boolean' }).notNull().default(false),
  otMultiplier: real('ot_multiplier').notNull().default(1.5),
});

export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type Settings = typeof settings.$inferSelect;
