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
import type { Settings, TimeEntry } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import type { SettingsInput } from '$lib/schemas/settings';
import { SAMPLE_SETTINGS, sampleEntries } from './sample';

const SAMPLE_FLAG_KEY = 'clopen:demo-sample';
const KEYS = {
  sample: { entries: 'clopen:sample-entries', settings: 'clopen:sample-settings' },
  yours: { entries: 'clopen:entries', settings: 'clopen:settings' },
} as const;

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
    ensureSeeded();
    return sorted(readEntries());
  },

  async addEntry(input) {
    ensureSeeded();
    const entries = readEntries();
    const row = rowFromInput(input, crypto.randomUUID(), Date.now() / 1000);
    entries.push(row);
    writeEntries(entries);
    return row;
  },

  async updateEntry(id, input) {
    ensureSeeded();
    const entries = readEntries();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return;
    entries[idx] = rowFromInput(input, id, entries[idx].createdAt);
    writeEntries(entries);
  },

  async deleteEntry(id) {
    ensureSeeded();
    writeEntries(readEntries().filter((e) => e.id !== id));
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
    writeEntries(readEntries().filter((e) => !drop.has(e.date)));
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
      hideWeekendsEntries: input.hideWeekendsEntries,
      hideWeekendsGrid: input.hideWeekendsGrid,
      expandNotes: input.expandNotes,
      otMultiplierEnabled: input.otMultiplierEnabled,
      otMultiplier: input.otMultiplier,
    };
    localStorage.setItem(activeKeys().settings, JSON.stringify(row));
  },
};
