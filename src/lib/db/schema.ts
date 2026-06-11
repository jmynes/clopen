import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { EXPENSE_KINDS, EXPENSE_VENDORS, MEAL_METHODS, RIDE_DIRECTIONS } from '$lib/expense-kinds';
import { ENTRY_KINDS } from '$lib/leave-kinds';
import { CLOCK_BREAK_MODES, LEDGER_PERIODS } from '$lib/schemas/settings';

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
  /** Epoch seconds of the last edit; null = never edited since creation. */
  updatedAt: integer('updated_at'),
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
  timeFormat: text('time_format', { enum: ['12h', '24h'] })
    .notNull()
    .default('12h'),
  /** Period the Ledger opens to (its selector still changes it per visit). */
  ledgerPeriod: text('ledger_period', { enum: LEDGER_PERIODS }).notNull().default('month'),
  /** IANA zone that defines "today" app-wide and stamps the clock. */
  timeZone: text('time_zone').notNull().default('America/Chicago'),
  /** Off pins the zone to its fixed standard-time offset (no DST shifts). */
  observeDst: integer('observe_dst', { mode: 'boolean' }).notNull().default(true),
  /** Clock-page breaks: accrue into one shift entry, or split shifts at breaks. */
  clockBreakMode: text('clock_break_mode', { enum: CLOCK_BREAK_MODES }).notNull().default('accrue'),
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
  /** Chase a yearly dollar target instead of straight salary math. */
  goalEnabled: integer('goal_enabled', { mode: 'boolean' }).notNull().default(false),
  yearlyGoal: real('yearly_goal').notNull().default(80000),
  /** Dashboard default for folding expenses into the make-whole math. */
  countExpenses: integer('count_expenses', { mode: 'boolean' }).notNull().default(true),
});

export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type Settings = typeof settings.$inferSelect;

/**
 * Append-only audit log of ledger mutations. `snapshot` is the entry row
 * after an add/edit, or as it was at deletion — an entry's history is the
 * chain of its snapshots. Written inside the repo implementations so every
 * mutation path (forms, CSV import, conflict overwrite, punch clock) logs
 * without per-caller wiring. `at` is epoch ms so bulk operations keep order.
 */
export const entryEvents = sqliteTable('entry_events', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').notNull(),
  action: text('action', { enum: ['add', 'edit', 'delete'] }).notNull(),
  at: integer('at').notNull(),
  snapshot: text('snapshot').notNull(),
});
export type EntryEvent = typeof entryEvents.$inferSelect;

/**
 * The running punch-clock shift — at most one row (`id = 'current'`). Punches
 * mutate it; clock-out composes normal time_entries and clears it, so the
 * ledger stays the only canonical record. Instants are epoch *ms*.
 * `startedAt` is null while on break in split mode (that segment was already
 * written as an entry); `breakStartedAt` is set while on break in either mode.
 */
export const openShift = sqliteTable('open_shift', {
  id: text('id').primaryKey().default('current'),
  startedAt: integer('started_at'),
  breakStartedAt: integer('break_started_at'),
  breakSeconds: integer('break_seconds').notNull().default(0),
  breakMode: text('break_mode', { enum: CLOCK_BREAK_MODES }).notNull().default('accrue'),
});
export type OpenShift = typeof openShift.$inferSelect;

/**
 * One work-related expense (an Uber to a shift, etc.). `date` is the same
 * ISO local-day string time entries use; `amount` is dollars. Kind comes
 * from $lib/expense-kinds — extensible without migration (plain text).
 */
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  amount: real('amount').notNull(),
  kind: text('kind', { enum: EXPENSE_KINDS }).notNull().default('ride'),
  /** Who the money went to; values are scoped per kind (KIND_VENDORS). */
  vendor: text('vendor', { enum: EXPENSE_VENDORS }),
  /** Ride-only commute leg / meal-only delivery-vs-pickup. Null elsewhere. */
  direction: text('direction', { enum: RIDE_DIRECTIONS }),
  method: text('method', { enum: MEAL_METHODS }),
  note: text('note'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  /** Epoch seconds of the last edit; null = never edited since creation. */
  updatedAt: integer('updated_at'),
});
export type Expense = typeof expenses.$inferSelect;

/**
 * Append-only audit log of expense mutations — the exact shape of
 * entry_events with `expenseId` in place of `entryId`. Written inside the
 * repo implementations so every mutation path logs without per-caller wiring.
 */
export const expenseEvents = sqliteTable('expense_events', {
  id: text('id').primaryKey(),
  expenseId: text('expense_id').notNull(),
  action: text('action', { enum: ['add', 'edit', 'delete'] }).notNull(),
  at: integer('at').notNull(),
  snapshot: text('snapshot').notNull(),
});
export type ExpenseEvent = typeof expenseEvents.$inferSelect;
