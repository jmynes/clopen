import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
  hourlyRate: real('hourly_rate').notNull().default(25),
  dailyHours: real('daily_hours').notNull().default(8),
  workdays: text('workdays').notNull().default('[1,2,3,4,5]'),
  /** ISO weekday the week starts on: 1 = Monday, 7 = Sunday. */
  weekStartsOn: integer('week_starts_on').notNull().default(7),
});

export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type Settings = typeof settings.$inferSelect;
