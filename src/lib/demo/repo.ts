/**
 * localStorage-backed Repo for demo mode. Shapes and semantics mirror the
 * server implementation ($lib/server/entries + settings): entries sort by
 * date desc then createdAt asc, settings are a single row seeded from
 * defaults. Browser-only — demo SSR uses core's emptyRepo stub instead.
 */
import { DEFAULT_SETTINGS, type Repo } from '$lib/core/repo';
import type { Settings, TimeEntry } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import type { SettingsInput } from '$lib/schemas/settings';

const ENTRIES_KEY = 'clopen:entries';
const SETTINGS_KEY = 'clopen:settings';

function readEntries(): TimeEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    return raw ? (JSON.parse(raw) as TimeEntry[]) : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: TimeEntry[]): void {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

function sorted(entries: TimeEntry[]): TimeEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1; // date desc
    return a.createdAt - b.createdAt; // createdAt asc
  });
}

function rowFromInput(input: EntryInput, id: string, createdAt: number): TimeEntry {
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
  };
}

export const demoRepo: Repo = {
  async listEntries() {
    return sorted(readEntries());
  },

  async addEntry(input) {
    const entries = readEntries();
    const row = rowFromInput(input, crypto.randomUUID(), Date.now() / 1000);
    entries.push(row);
    writeEntries(entries);
    return row;
  },

  async updateEntry(id, input) {
    const entries = readEntries();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return;
    entries[idx] = rowFromInput(input, id, entries[idx].createdAt);
    writeEntries(entries);
  },

  async deleteEntry(id) {
    writeEntries(readEntries().filter((e) => e.id !== id));
  },

  async findExistingDates(dates) {
    const want = new Set(dates);
    const found = new Set<string>();
    for (const e of readEntries()) {
      if (want.has(e.date)) found.add(e.date);
    }
    return [...found];
  },

  async listEntriesByDates(dates) {
    // Server semantics: date asc, then createdAt asc.
    const want = new Set(dates);
    return readEntries()
      .filter((e) => want.has(e.date))
      .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.createdAt - b.createdAt));
  },

  async deleteEntriesByDates(dates) {
    const drop = new Set(dates);
    writeEntries(readEntries().filter((e) => !drop.has(e.date)));
  },

  async getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      // fall through to defaults
    }
    return DEFAULT_SETTINGS;
  },

  async updateSettings(input: SettingsInput) {
    const row: Settings = {
      id: 'default',
      hourlyRate: input.hourlyRate,
      dailyHours: input.dailyHours,
      workdays: JSON.stringify(input.workdays),
      weekStartsOn: input.weekStartsOn,
      epoch: input.epoch,
      timeFormat: input.timeFormat,
      hideWeekendsEntries: input.hideWeekendsEntries,
      hideWeekendsGrid: input.hideWeekendsGrid,
      expandNotes: input.expandNotes,
      otMultiplierEnabled: input.otMultiplierEnabled,
      otMultiplier: input.otMultiplier,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(row));
  },
};
