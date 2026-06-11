/**
 * localStorage-backed Repo for demo mode. Shapes and semantics mirror the
 * server implementation ($lib/server/entries + settings): entries sort by
 * date desc then createdAt asc, settings are a single row seeded from
 * defaults. Browser-only — demo SSR uses core's emptyRepo stub instead.
 *
 * The demo has two independent buckets, chosen by the header's data toggle:
 *  - "sample" (default): a pre-seeded in-use timesheet (see ./sample), so a
 *    visitor lands on populated data demonstrating Clopen.
 *  - "yours": a blank-slate sandbox the visitor fills themselves.
 * Each is its own set of localStorage keys, so editing one never touches the
 * other and toggling flips cleanly between them.
 */
import { DEFAULT_SETTINGS, type Repo } from '$lib/core/repo';
import type { EntryEvent, Expense, ExpenseEvent, OpenShift, Settings, TimeEntry } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import type { ExpenseInput } from '$lib/schemas/expense';
import type { SettingsInput } from '$lib/schemas/settings';
import { SAMPLE_SETTINGS, sampleEntries } from './sample';

const SAMPLE_FLAG_KEY = 'clopen:demo-sample';
const KEYS = {
  sample: {
    entries: 'clopen:sample-entries',
    settings: 'clopen:sample-settings',
    openShift: 'clopen:sample-open-shift',
    events: 'clopen:sample-entry-events',
    expenses: 'clopen:sample-expenses',
    expenseEvents: 'clopen:sample-expense-events',
  },
  yours: {
    entries: 'clopen:entries',
    settings: 'clopen:settings',
    openShift: 'clopen:open-shift',
    events: 'clopen:entry-events',
    expenses: 'clopen:expenses',
    expenseEvents: 'clopen:expense-events',
  },
} as const;

// Audit log cap per bucket: localStorage is finite, and the latest few
// hundred mutations are the useful part of a demo's history.
const EVENTS_CAP = 500;

function readEvents(): EntryEvent[] {
  try {
    const raw = localStorage.getItem(activeKeys().events);
    return raw ? (JSON.parse(raw) as EntryEvent[]) : [];
  } catch {
    return [];
  }
}

/** Best-effort append — a logging failure never blocks the mutation itself. */
function logEvent(action: EntryEvent['action'], row: TimeEntry): void {
  try {
    const events = readEvents();
    events.push({ id: crypto.randomUUID(), entryId: row.id, action, at: Date.now(), snapshot: JSON.stringify(row) });
    localStorage.setItem(activeKeys().events, JSON.stringify(events.slice(-EVENTS_CAP)));
  } catch {
    // storage unavailable or full — the ledger write still stands
  }
}

/**
 * Whether the sample timesheet is the active bucket. Defaults to on (an unset
 * flag means a first-time visitor sees the populated demo). Storage is wrapped
 * because this also runs during demo SSR, where localStorage is absent — there
 * we report "off" so the reads fall through to empty, matching the old stub.
 */
export function isSampleData(): boolean {
  try {
    return localStorage.getItem(SAMPLE_FLAG_KEY) !== '0';
  } catch {
    return false;
  }
}

/** Persist the toggle. Callers invalidate('demo:data') to reload after this. */
export function setSampleData(on: boolean): void {
  try {
    localStorage.setItem(SAMPLE_FLAG_KEY, on ? '1' : '0');
  } catch {
    // storage unavailable — nothing to persist
  }
}

function activeKeys(): (typeof KEYS)[keyof typeof KEYS] {
  return isSampleData() ? KEYS.sample : KEYS.yours;
}

/**
 * Populate the sample bucket the first time it's used. Seeds entries and
 * settings only when their keys are absent, so a visitor's later edits to the
 * sample stick. No-op outside the browser or when the sample is toggled off.
 */
function ensureSeeded(): void {
  try {
    if (localStorage.getItem(SAMPLE_FLAG_KEY) === '0') return;
    if (localStorage.getItem(KEYS.sample.entries) === null) {
      localStorage.setItem(KEYS.sample.entries, JSON.stringify(sampleEntries()));
    }
    if (localStorage.getItem(KEYS.sample.settings) === null) {
      localStorage.setItem(KEYS.sample.settings, JSON.stringify(SAMPLE_SETTINGS));
    }
  } catch {
    // SSR / storage unavailable — nothing to seed
  }
}

function readEntries(): TimeEntry[] {
  try {
    const raw = localStorage.getItem(activeKeys().entries);
    return raw ? (JSON.parse(raw) as TimeEntry[]) : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: TimeEntry[]): void {
  localStorage.setItem(activeKeys().entries, JSON.stringify(entries));
}

function sorted<T extends { date: string; createdAt: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1; // date desc
    return a.createdAt - b.createdAt; // createdAt asc
  });
}

function rowFromInput(input: EntryInput, id: string, createdAt: number, updatedAt: number | null = null): TimeEntry {
  return {
    id,
    date: input.date,
    hours: input.hours,
    breakHours: input.breakHours ?? 0,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    note: input.note ?? null,
    entryKind: input.entryKind,
    createdAt,
    updatedAt,
  };
}

function readExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(activeKeys().expenses);
    return raw ? (JSON.parse(raw) as Expense[]) : [];
  } catch {
    return [];
  }
}

function writeExpenses(rows: Expense[]): void {
  localStorage.setItem(activeKeys().expenses, JSON.stringify(rows));
}

function readExpenseEvents(): ExpenseEvent[] {
  try {
    const raw = localStorage.getItem(activeKeys().expenseEvents);
    return raw ? (JSON.parse(raw) as ExpenseEvent[]) : [];
  } catch {
    return [];
  }
}

/** Best-effort append — a logging failure never blocks the mutation itself. */
function logExpenseEvent(action: ExpenseEvent['action'], row: Expense): void {
  try {
    const events = readExpenseEvents();
    events.push({
      id: crypto.randomUUID(),
      expenseId: row.id,
      action,
      at: Date.now(),
      snapshot: JSON.stringify(row),
    });
    localStorage.setItem(activeKeys().expenseEvents, JSON.stringify(events.slice(-EVENTS_CAP)));
  } catch {
    // storage unavailable or full — the expense write still stands
  }
}

function expenseFromInput(
  input: ExpenseInput,
  id: string,
  createdAt: number,
  updatedAt: number | null = null,
): Expense {
  return { id, date: input.date, amount: input.amount, kind: input.kind, note: input.note, createdAt, updatedAt };
}

export const demoRepo: Repo = {
  async listEntries() {
    ensureSeeded();
    return sorted(readEntries());
  },

  async addEntry(input) {
    ensureSeeded();
    const entries = readEntries();
    const row = rowFromInput(input, crypto.randomUUID(), Date.now() / 1000);
    entries.push(row);
    writeEntries(entries);
    logEvent('add', row);
    return row;
  },

  async updateEntry(id, input) {
    ensureSeeded();
    const entries = readEntries();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return;
    entries[idx] = rowFromInput(input, id, entries[idx].createdAt, Math.floor(Date.now() / 1000));
    writeEntries(entries);
    logEvent('edit', entries[idx]);
  },

  async deleteEntry(id) {
    ensureSeeded();
    const entries = readEntries();
    const removed = entries.find((e) => e.id === id);
    writeEntries(entries.filter((e) => e.id !== id));
    if (removed) logEvent('delete', removed);
  },

  async findExistingDates(dates) {
    ensureSeeded();
    const want = new Set(dates);
    const found = new Set<string>();
    for (const e of readEntries()) {
      if (want.has(e.date)) found.add(e.date);
    }
    return [...found];
  },

  async listEntriesByDates(dates) {
    ensureSeeded();
    // Server semantics: date asc, then createdAt asc.
    const want = new Set(dates);
    return readEntries()
      .filter((e) => want.has(e.date))
      .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.createdAt - b.createdAt));
  },

  async deleteEntriesByDates(dates) {
    ensureSeeded();
    const drop = new Set(dates);
    const entries = readEntries();
    writeEntries(entries.filter((e) => !drop.has(e.date)));
    for (const row of entries.filter((e) => drop.has(e.date))) logEvent('delete', row);
  },

  async listEntryEvents() {
    ensureSeeded();
    return [...readEvents()].sort((a, b) => b.at - a.at);
  },

  async listExpenses() {
    ensureSeeded();
    return sorted(readExpenses());
  },

  async addExpense(input) {
    ensureSeeded();
    const rows = readExpenses();
    const row = expenseFromInput(input, crypto.randomUUID(), Date.now() / 1000);
    rows.push(row);
    writeExpenses(rows);
    logExpenseEvent('add', row);
    return row;
  },

  async updateExpense(id, input) {
    ensureSeeded();
    const rows = readExpenses();
    const idx = rows.findIndex((e) => e.id === id);
    if (idx === -1) return;
    rows[idx] = expenseFromInput(input, id, rows[idx].createdAt, Math.floor(Date.now() / 1000));
    writeExpenses(rows);
    logExpenseEvent('edit', rows[idx]);
  },

  async deleteExpense(id) {
    ensureSeeded();
    const rows = readExpenses();
    const removed = rows.find((e) => e.id === id);
    writeExpenses(rows.filter((e) => e.id !== id));
    if (removed) logExpenseEvent('delete', removed);
  },

  async listExpenseEvents() {
    ensureSeeded();
    return [...readExpenseEvents()].sort((a, b) => b.at - a.at);
  },

  async getSettings() {
    ensureSeeded();
    try {
      const raw = localStorage.getItem(activeKeys().settings);
      if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      // fall through to defaults
    }
    return DEFAULT_SETTINGS;
  },

  async updateSettings(input: SettingsInput) {
    ensureSeeded();
    const row: Settings = {
      id: 'default',
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
    };
    localStorage.setItem(activeKeys().settings, JSON.stringify(row));
  },

  async getOpenShift() {
    try {
      const raw = localStorage.getItem(activeKeys().openShift);
      return raw ? (JSON.parse(raw) as OpenShift) : null;
    } catch {
      return null;
    }
  },
  async saveOpenShift(row) {
    localStorage.setItem(activeKeys().openShift, JSON.stringify(row));
  },
  async clearOpenShift() {
    localStorage.removeItem(activeKeys().openShift);
  },
};
