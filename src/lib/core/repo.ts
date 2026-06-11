import type { EntryEvent, Expense, ExpenseEvent, OpenShift, Settings, TimeEntry } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import type { ExpenseInput } from '$lib/schemas/expense';
import { type SettingsInput, workdaysJson } from '$lib/schemas/settings';
import type { WorkSettings } from '$lib/timesheet';

/**
 * Storage contract the page logic runs against. The server implements it with
 * Drizzle/libSQL ($lib/server); demo mode implements it with localStorage
 * ($lib/demo) so the Railway copy keeps every value in the browser.
 */
export type Repo = {
  listEntries(): Promise<TimeEntry[]>;
  addEntry(input: EntryInput): Promise<TimeEntry>;
  updateEntry(id: string, input: EntryInput): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  findExistingDates(dates: string[]): Promise<string[]>;
  listEntriesByDates(dates: string[]): Promise<TimeEntry[]>;
  deleteEntriesByDates(dates: string[]): Promise<void>;
  getSettings(): Promise<Settings>;
  updateSettings(input: SettingsInput): Promise<void>;
  getOpenShift(): Promise<OpenShift | null>;
  saveOpenShift(row: OpenShift): Promise<void>;
  clearOpenShift(): Promise<void>;
  /** Audit log of ledger mutations, newest first. */
  listEntryEvents(): Promise<EntryEvent[]>;
  listExpenses(): Promise<Expense[]>;
  addExpense(input: ExpenseInput): Promise<Expense>;
  updateExpense(id: string, input: ExpenseInput): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  /** Audit log of expense mutations, newest first. */
  listExpenseEvents(): Promise<ExpenseEvent[]>;
};

export const DEFAULT_SETTINGS = {
  id: 'default',
  hourlyRate: 38.4615,
  dailyHours: 8,
  workdays: '[1,2,3,4,5]',
  weekStartsOn: 7,
  epoch: '2025-03-16',
  timeFormat: '12h',
  ledgerPeriod: 'month',
  timeZone: 'America/Chicago',
  observeDst: true,
  clockBreakMode: 'accrue',
  hideWeekendsEntries: false,
  hideWeekendsGrid: false,
  expandNotes: false,
  otMultiplierEnabled: false,
  otMultiplier: 1.5,
  goalEnabled: false,
  yearlyGoal: 80000,
  countExpenses: true,
} satisfies Settings;

/** Map a stored settings row to the shape the make-whole math expects. */
export function toWorkSettings(row: Settings): WorkSettings {
  return {
    hourlyRate: row.hourlyRate,
    dailyHours: row.dailyHours,
    workdays: workdaysJson.parse(JSON.parse(row.workdays)),
  };
}

/** Empty data source for demo-mode SSR stubs: defaults, no entries. */
export const emptyRepo: Repo = {
  listEntries: async () => [],
  addEntry: async () => {
    throw new Error('emptyRepo is read-only');
  },
  updateEntry: async () => {},
  deleteEntry: async () => {},
  findExistingDates: async () => [],
  listEntriesByDates: async () => [],
  deleteEntriesByDates: async () => {},
  getSettings: async () => DEFAULT_SETTINGS,
  updateSettings: async () => {},
  getOpenShift: async () => null,
  saveOpenShift: async () => {},
  clearOpenShift: async () => {},
  listEntryEvents: async () => [],
  listExpenses: async () => [],
  addExpense: async () => {
    throw new Error('emptyRepo is read-only');
  },
  updateExpense: async () => {},
  deleteExpense: async () => {},
  listExpenseEvents: async () => [],
};
