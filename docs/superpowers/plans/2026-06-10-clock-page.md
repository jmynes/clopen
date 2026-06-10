# Clock In/Out Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live punch-clock page (4th nav tab) — clock in, break out/in, clock out, multiple shifts per day — plus an app-wide timezone setting (default America/Chicago, DST opt-out) and created/edited timestamps on entries.

**Architecture:** The open shift is a single state row (`open_shift` table, demo: one localStorage key); punches mutate it through a pure state machine in `src/lib/core/clock.ts`, and clock-out composes normal `time_entries` rows via the existing `Repo` — the ledger stays the only canonical record. The configured zone is set module-globally in `src/lib/date.ts` by the root layout load before any page compute runs; all instants are epoch ms, wall-clock fields are derived only at composition time. Spec: `docs/superpowers/specs/2026-06-10-clock-page-design.md`.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Drizzle/libSQL, Zod, `@internationalized/date`, Bun, Vitest, Biome.

**House rules (apply to every task):** `bun run check` and `bun run lint` must report 0 errors AND 0 warnings before each commit. No `as any`, no suppression comments (the one tolerated kind is `svelte-ignore` with an explanatory line, only where the codebase already does it). `??` not `||` when 0/''/false are valid. Single quotes, 2-space indent, 120 width. Every commit message ends with the `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.

---

### Task 1: Timezone foundation in `src/lib/date.ts`

**Files:**
- Modify: `src/lib/date.ts`
- Test: `src/lib/date.test.ts` (exists — append)

- [ ] **Step 1: Write failing tests** — append to `src/lib/date.test.ts`:

```ts
import { describe, expect, it, afterEach } from 'vitest';
import {
  effectiveZone,
  formatTimestamp,
  setAppTimeZone,
  todayISO,
  zonedParts,
  zonedToMs,
} from './date';

describe('effectiveZone', () => {
  it('returns the zone itself when observing DST', () => {
    expect(effectiveZone('America/Chicago', true)).toBe('America/Chicago');
  });
  it('pins a DST zone to its standard offset when opting out', () => {
    expect(effectiveZone('America/Chicago', false)).toBe('Etc/GMT+6'); // Etc names invert the sign
    expect(effectiveZone('America/New_York', false)).toBe('Etc/GMT+5');
  });
  it('southern hemisphere: standard time is the July offset', () => {
    expect(effectiveZone('Australia/Sydney', false)).toBe('Etc/GMT-10');
  });
  it('zones without DST pass through unchanged', () => {
    expect(effectiveZone('Asia/Tokyo', false)).toBe('Asia/Tokyo');
    expect(effectiveZone('UTC', false)).toBe('UTC');
  });
});

describe('app zone', () => {
  afterEach(() => setAppTimeZone(null));

  it('zonedToMs and zonedParts round-trip in the configured zone', () => {
    setAppTimeZone('America/Chicago');
    const ms = zonedToMs('2026-01-15', '09:00');
    expect(zonedParts(ms)).toEqual({ date: '2026-01-15', hhmm: '09:00' });
  });
  it('summer wall-clock differs by an hour between CDT and the fixed standard offset', () => {
    setAppTimeZone('America/Chicago');
    const cdt = zonedToMs('2026-07-15', '09:00');
    setAppTimeZone('Etc/GMT+6');
    const fixed = zonedToMs('2026-07-15', '09:00');
    expect(fixed - cdt).toBe(3_600_000);
  });
  it('todayISO answers in the configured zone', () => {
    // Pick two zones a day apart right now: UTC-11 vs UTC+13 are never the same date.
    setAppTimeZone('Pacific/Pago_Pago');
    const west = todayISO();
    setAppTimeZone('Pacific/Tongatapu');
    const east = todayISO();
    expect(east > west).toBe(true);
  });
  it('formatTimestamp renders epoch seconds in the app zone', () => {
    setAppTimeZone('America/Chicago');
    const secs = Math.floor(zonedToMs('2026-06-10', '21:14') / 1000);
    expect(formatTimestamp(secs)).toBe('Jun 10, 09:14 PM');
    expect(formatTimestamp(secs, '24h')).toBe('Jun 10, 21:14');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `bun run test src/lib/date.test.ts` → FAIL (`effectiveZone` not exported).

- [ ] **Step 3: Implement** — in `src/lib/date.ts`, change the import line and `todayISO`, and add the new functions:

```ts
import { fromAbsolute, getLocalTimeZone, parseDateTime, today } from '@internationalized/date';

// The app-wide zone: set by the root layout load from settings before any
// page compute runs, so "today" is stable regardless of where the browser or
// server happens to be. Null falls back to the runtime's local zone.
let appZone: string | null = null;
export function setAppTimeZone(zone: string | null): void {
  appZone = zone;
}
export function appTimeZone(): string {
  return appZone ?? getLocalTimeZone();
}

/** Today's date as an ISO `YYYY-MM-DD` string in the app zone. */
export function todayISO(): string {
  return today(appTimeZone()).toString();
}

function utcOffsetMinutes(zone: string, atUtc: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(atUtc);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0; // bare "GMT" = UTC
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * The zone that actually drives day boundaries: the IANA zone itself when
 * observing DST, else its fixed standard-time offset (DST always springs
 * forward, so standard = the smaller of the January/July offsets). Etc/GMT
 * names invert the sign (Chicago standard, UTC-6, is `Etc/GMT+6`); zones with
 * fractional standard offsets have no Etc twin and pass through unchanged.
 */
export function effectiveZone(timeZone: string, observeDst: boolean): string {
  if (observeDst) return timeZone;
  const year = new Date().getUTCFullYear();
  const jan = utcOffsetMinutes(timeZone, new Date(Date.UTC(year, 0, 15)));
  const jul = utcOffsetMinutes(timeZone, new Date(Date.UTC(year, 6, 15)));
  if (jan === jul) return timeZone; // no DST to opt out of
  const standard = Math.min(jan, jul);
  if (standard % 60 !== 0) return timeZone;
  const hours = standard / 60;
  if (hours === 0) return 'UTC';
  return `Etc/GMT${hours > 0 ? '-' : '+'}${Math.abs(hours)}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Y-M-D and HH:MM wall-clock parts of an absolute instant, in the app zone. */
export function zonedParts(ms: number): { date: string; hhmm: string } {
  const z = fromAbsolute(ms, appTimeZone());
  return {
    date: `${z.year}-${pad2(z.month)}-${pad2(z.day)}`,
    hhmm: `${pad2(z.hour)}:${pad2(z.minute)}`,
  };
}

/** Absolute epoch ms for a wall-clock date + HH:MM in the app zone. */
export function zonedToMs(date: string, hhmm: string): number {
  return parseDateTime(`${date}T${hhmm}`).toDate(appTimeZone()).getTime();
}

const STAMP_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });

/** "Jun 10, 09:14 PM" — created/edited stamps for epoch *seconds*, app zone. */
export function formatTimestamp(epochSeconds: number, mode: TimeFormat = '12h'): string {
  const { date, hhmm } = zonedParts(epochSeconds * 1000);
  return `${STAMP_FMT.format(utcDate(date))}, ${formatTime(hhmm, mode)}`;
}
```

(`utcDate`, `formatTime`, `TimeFormat` already exist in this file; `STAMP_FMT` formats a date that is already zone-resolved, hence `timeZone: 'UTC'` like the file's other formatters.)

- [ ] **Step 4: Run tests** — `bun run test src/lib/date.test.ts` → PASS. Then `bun run test` (all), `bun run check`, `bun run lint` → all green.

- [ ] **Step 5: Commit** — `feat(date): app-wide timezone with DST opt-out (effectiveZone, zoned helpers)`

---

### Task 2: Settings + entry schema additions, repos, migration

**Files:**
- Modify: `src/lib/schemas/settings.ts`, `src/lib/db/schema.ts`, `src/lib/core/repo.ts`, `src/lib/server/settings.ts`, `src/lib/server/entries.ts` (no change yet — Task 3), `src/lib/demo/repo.ts`, `src/lib/demo/sample.ts`, `src/lib/core/settings-page.ts`
- Create: `src/lib/server/open-shift.ts`, drizzle migration via codegen
- Modify: `src/lib/server/repo.ts`

- [ ] **Step 1: Zod** — in `src/lib/schemas/settings.ts` add above `settingsInput`:

```ts
export const CLOCK_BREAK_MODES = ['accrue', 'split'] as const;
export type ClockBreakMode = (typeof CLOCK_BREAK_MODES)[number];

const KNOWN_ZONES = new Set<string>(Intl.supportedValuesOf('timeZone'));
```

and inside `settingsInput` after `ledgerPeriod`:

```ts
  timeZone: z
    .string()
    .refine((v) => v === 'UTC' || KNOWN_ZONES.has(v), 'Unknown timezone')
    .default('America/Chicago'),
  observeDst: z.boolean().default(true),
  clockBreakMode: z.enum(CLOCK_BREAK_MODES).default('accrue'),
```

- [ ] **Step 2: DB schema** — in `src/lib/db/schema.ts`: import `CLOCK_BREAK_MODES` from `$lib/schemas/settings` (the `LEDGER_PERIODS` import is already there). In `settings` after `ledgerPeriod`:

```ts
  /** IANA zone that defines "today" app-wide and stamps the clock. */
  timeZone: text('time_zone').notNull().default('America/Chicago'),
  /** Off pins the zone to its fixed standard-time offset (no DST shifts). */
  observeDst: integer('observe_dst', { mode: 'boolean' }).notNull().default(true),
  /** Clock-page breaks: accrue into one shift entry, or split shifts at breaks. */
  clockBreakMode: text('clock_break_mode', { enum: CLOCK_BREAK_MODES }).notNull().default('accrue'),
```

In `timeEntries` after `createdAt`:

```ts
  /** Epoch seconds of the last edit; null = never edited since creation. */
  updatedAt: integer('updated_at'),
```

New table + type at the bottom:

```ts
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
```

- [ ] **Step 3: Repo contract + defaults** — `src/lib/core/repo.ts`: add to the `Repo` type:

```ts
  getOpenShift(): Promise<OpenShift | null>;
  saveOpenShift(row: OpenShift): Promise<void>;
  clearOpenShift(): Promise<void>;
```

(import `OpenShift` from `$lib/db/schema`). `DEFAULT_SETTINGS` gains, after `ledgerPeriod`:

```ts
  timeZone: 'America/Chicago',
  observeDst: true,
  clockBreakMode: 'accrue',
```

`emptyRepo` gains:

```ts
  getOpenShift: async () => null,
  saveOpenShift: async () => {},
  clearOpenShift: async () => {},
```

- [ ] **Step 4: Server side** — create `src/lib/server/open-shift.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db as defaultDb } from '$lib/db';
import { type OpenShift, openShift } from '$lib/db/schema';

type Database = typeof defaultDb;
const ID = 'current';

export async function getOpenShift(database: Database = defaultDb): Promise<OpenShift | null> {
  const rows = await database.select().from(openShift).where(eq(openShift.id, ID)).limit(1);
  return rows[0] ?? null;
}

export async function saveOpenShift(row: OpenShift, database: Database = defaultDb): Promise<void> {
  await database
    .insert(openShift)
    .values({ ...row, id: ID })
    .onConflictDoUpdate({
      target: openShift.id,
      set: {
        startedAt: row.startedAt,
        breakStartedAt: row.breakStartedAt,
        breakSeconds: row.breakSeconds,
        breakMode: row.breakMode,
      },
    });
}

export async function clearOpenShift(database: Database = defaultDb): Promise<void> {
  await database.delete(openShift).where(eq(openShift.id, ID));
}
```

`src/lib/server/repo.ts`: import the three and add them to `serverRepo`. `src/lib/server/settings.ts`: add `timeZone: input.timeZone`, `observeDst: input.observeDst`, `clockBreakMode: input.clockBreakMode` to both the `row` object and the `onConflictDoUpdate.set` object (next to `ledgerPeriod`).

- [ ] **Step 5: Demo side** — `src/lib/demo/repo.ts`: add an `openShift` key to both buckets in `KEYS` (`'clopen:sample-open-shift'` / `'clopen:open-shift'`); add the new settings fields to the `row` in `updateSettings` (next to `ledgerPeriod`); add to `demoRepo`:

```ts
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
```

(import the `OpenShift` type). `src/lib/demo/sample.ts`: `SAMPLE_SETTINGS` gains `timeZone: 'America/Chicago'`, `observeDst: true`, `clockBreakMode: 'accrue'`; every place a `TimeEntry` literal is built (the sample-entry helper and `rowFromInput` in `demo/repo.ts`) gains `updatedAt: null`. `rowFromInput` signature becomes `rowFromInput(input, id, createdAt, updatedAt: number | null = null)`.

- [ ] **Step 6: Settings page compute/parse plumbing** — `src/lib/core/settings-page.ts`: `computeSettingsPage` returns `timeZone: row.timeZone, observeDst: row.observeDst, clockBreakMode: row.clockBreakMode` too; `saveSettingsAction` parse adds `timeZone: form.get('timeZone'), observeDst: form.has('observeDst'), clockBreakMode: form.get('clockBreakMode')`.

- [ ] **Step 7: Migration** — `bun run db:generate` then `bun run db:migrate`. Inspect the new `drizzle/00xx_*.sql`: expect three `ALTER TABLE settings ADD ...`, one `ALTER TABLE time_entries ADD updated_at`, one `CREATE TABLE open_shift`.

- [ ] **Step 8: Gates** — `bun run check`, `bun run lint`, `bun run test` all green. If `src/lib/server/entries.test.ts` asserts full row shapes, extend the expected objects with `updatedAt: null` — do not weaken assertions.

- [ ] **Step 9: Commit** — `feat(db): timezone/DST/break-mode settings, entry updatedAt, open_shift table (migration 0017)`

---

### Task 3: `updatedAt` on the edit paths + edit-dialog stamps

**Files:**
- Modify: `src/lib/server/entries.ts` (the `updateEntry` `.set({...})`), `src/lib/demo/repo.ts` (`updateEntry`), `src/routes/log/+page.svelte` (edit dialog), `src/lib/server/entries.test.ts`

- [ ] **Step 1: Failing test** — in `src/lib/server/entries.test.ts`, add (mirroring the file's existing in-memory-db setup):

```ts
it('updateEntry stamps updatedAt; addEntry leaves it null', async () => {
  const row = await addEntry({ date: '2026-06-10', hours: 8, breakHours: 0, note: null, startTime: null, endTime: null, entryKind: 'work' }, db);
  expect(row.updatedAt ?? null).toBeNull();
  const before = Math.floor(Date.now() / 1000);
  await updateEntry(row.id, { date: '2026-06-10', hours: 7, breakHours: 0, note: null, startTime: null, endTime: null, entryKind: 'work' }, db);
  const after = (await listEntries(db)).find((e) => e.id === row.id);
  expect(after?.updatedAt).toBeGreaterThanOrEqual(before);
});
```

Run `bun run test src/lib/server/entries.test.ts` → FAIL (updatedAt stays null).

- [ ] **Step 2: Implement** — server `updateEntry`: add `updatedAt: Math.floor(Date.now() / 1000),` to the `.set({...})`. Demo `updateEntry`: change the replacement line to `entries[idx] = rowFromInput(input, id, entries[idx].createdAt, Math.floor(Date.now() / 1000));`.

- [ ] **Step 3: Edit dialog stamps** — in `src/routes/log/+page.svelte`, inside the edit dialog's `Dialog.Content`, directly above the dialog's footer/buttons row, add:

```svelte
{#if editing}
  <p class="text-xs text-muted-foreground">
    Added {formatTimestamp(editing.createdAt, data.timeFormat)}{editing.updatedAt
      ? ` · Edited ${formatTimestamp(editing.updatedAt, data.timeFormat)}`
      : ''}
  </p>
{/if}
```

(import `formatTimestamp` from `$lib/date`; `editing` is the existing `$state<TimeEntry | null>`).

- [ ] **Step 4: Gates + commit** — all green → `feat(log): stamp entry edits and show added/edited times in the dialog`

---

### Task 4: Clock state machine in `src/lib/core/clock.ts`

**Files:**
- Create: `src/lib/core/clock.ts`, `src/lib/core/clock.test.ts`

- [ ] **Step 1: Failing tests** — `src/lib/core/clock.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setAppTimeZone, zonedToMs } from '$lib/date';
import type { OpenShift, TimeEntry } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import { DEFAULT_SETTINGS, type Repo, emptyRepo } from './repo';
import {
  adjustStart, clockIn, clockOut, clockStateOf, composeEntry, computeClock,
  endBreak, isStale, resolveDiscard, resolveSave, startBreak,
} from './clock';

function fakeRepo() {
  let shift: OpenShift | null = null;
  const added: EntryInput[] = [];
  const repo: Repo = {
    ...emptyRepo,
    addEntry: async (input) => {
      added.push(input);
      return { ...input, id: 'x', createdAt: 0, updatedAt: null, note: input.note ?? null, startTime: input.startTime ?? null, endTime: input.endTime ?? null, breakHours: input.breakHours ?? 0 } as TimeEntry;
    },
    getOpenShift: async () => shift,
    saveOpenShift: async (row) => { shift = row; },
    clearOpenShift: async () => { shift = null; },
  };
  return { repo, added, shift: () => shift };
}

const T = (date: string, hhmm: string) => zonedToMs(date, hhmm);

beforeEach(() => setAppTimeZone('America/Chicago'));
afterEach(() => setAppTimeZone(null));

describe('accrue mode', () => {
  it('full cycle: in → break → back → out writes one entry with accrued break', async () => {
    const { repo, added, shift } = fakeRepo();
    await clockIn(repo, T('2026-06-10', '09:00'), 'accrue');
    expect(clockStateOf(shift())).toBe('working');
    await startBreak(repo, T('2026-06-10', '12:00'));
    expect(clockStateOf(shift())).toBe('on_break');
    await endBreak(repo, T('2026-06-10', '12:30'));
    await clockOut(repo, T('2026-06-10', '17:30'));
    expect(shift()).toBeNull();
    expect(added).toEqual([
      { date: '2026-06-10', hours: 8.5, breakHours: 0.5, startTime: '09:00', endTime: '17:30', note: null, entryKind: 'work' },
    ]);
  });
  it('clocking out while on break ends the shift at the break start', async () => {
    const { repo, added } = fakeRepo();
    await clockIn(repo, T('2026-06-10', '09:00'), 'accrue');
    await startBreak(repo, T('2026-06-10', '12:00'));
    await clockOut(repo, T('2026-06-10', '15:00'));
    expect(added[0]).toMatchObject({ endTime: '12:00', hours: 3 });
  });
});

describe('split mode', () => {
  it('each in→out span is its own entry; break gap writes nothing', async () => {
    const { repo, added, shift } = fakeRepo();
    await clockIn(repo, T('2026-06-10', '09:00'), 'split');
    await startBreak(repo, T('2026-06-10', '12:00'));
    expect(added).toHaveLength(1); // segment written at break start
    expect(shift()?.startedAt).toBeNull();
    await endBreak(repo, T('2026-06-10', '12:30'));
    await clockOut(repo, T('2026-06-10', '17:30'));
    expect(added).toEqual([
      { date: '2026-06-10', hours: 3, breakHours: 0, startTime: '09:00', endTime: '12:00', note: null, entryKind: 'work' },
      { date: '2026-06-10', hours: 5, breakHours: 0, startTime: '12:30', endTime: '17:30', note: null, entryKind: 'work' },
    ]);
  });
  it('clock-out while on break writes nothing more', async () => {
    const { repo, added, shift } = fakeRepo();
    await clockIn(repo, T('2026-06-10', '09:00'), 'split');
    await startBreak(repo, T('2026-06-10', '12:00'));
    await clockOut(repo, T('2026-06-10', '13:00'));
    expect(added).toHaveLength(1);
    expect(shift()).toBeNull();
  });
});

describe('guards and edges', () => {
  it('double clock-in fails 409 and break/out require state', async () => {
    const { repo } = fakeRepo();
    expect((await startBreak(repo, 1)).ok).toBe(false);
    expect((await clockOut(repo, 1)).ok).toBe(false);
    await clockIn(repo, T('2026-06-10', '09:00'), 'accrue');
    const dup = await clockIn(repo, T('2026-06-10', '10:00'), 'accrue');
    expect(dup).toMatchObject({ ok: false, status: 409 });
  });
  it('adjustStart moves the running segment start', async () => {
    const { repo, shift } = fakeRepo();
    await clockIn(repo, T('2026-06-10', '09:14'), 'accrue');
    await adjustStart(repo, T('2026-06-10', '09:00'), T('2026-06-10', '10:00'));
    expect(shift()?.startedAt).toBe(T('2026-06-10', '09:00'));
  });
  it('composeEntry spans midnight: date is the start date, hours keep real elapsed', () => {
    expect(composeEntry(T('2026-06-10', '23:00'), T('2026-06-11', '01:30'), 0)).toMatchObject({
      date: '2026-06-10', startTime: '23:00', endTime: '01:30', hours: 2.5,
    });
  });
  it('isStale: started before today in the app zone', async () => {
    const { repo, shift } = fakeRepo();
    await clockIn(repo, Date.now() - 26 * 3_600_000, 'accrue');
    expect(isStale(shift())).toBe(true);
    await resolveDiscard(repo);
    expect(shift()).toBeNull();
  });
  it('resolveSave clamps the end to the break start when on break', async () => {
    const { repo, added } = fakeRepo();
    await clockIn(repo, T('2026-06-09', '09:00'), 'accrue');
    await startBreak(repo, T('2026-06-09', '12:00'));
    await resolveSave(repo, T('2026-06-09', '17:00'));
    expect(added[0]).toMatchObject({ endTime: '12:00' });
  });
});
```

Run `bun run test src/lib/core/clock.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement** — `src/lib/core/clock.ts`:

```ts
/**
 * Punch-clock state machine. The open shift is a single row (one shift at a
 * time); punches mutate it and clock-out composes normal ledger entries
 * through the Repo, so time_entries stays the only canonical record. All
 * instants are epoch ms; wall-clock fields are derived in the app zone only
 * at composition time (overnight spans rely on hoursBetween's midnight wrap
 * downstream).
 */
import { todayISO, zonedParts } from '$lib/date';
import type { OpenShift, Settings, TimeEntry } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import type { ClockBreakMode } from '$lib/schemas/settings';
import type { ActionOutcome } from './log';
import type { Repo } from './repo';

export type ClockState = 'idle' | 'working' | 'on_break';

export function clockStateOf(row: OpenShift | null): ClockState {
  if (!row) return 'idle';
  return row.breakStartedAt != null ? 'on_break' : 'working';
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const err = (status: number, error: string): ActionOutcome => ({ ok: false, status, data: { error } });
const ok = (): ActionOutcome => ({ ok: true, data: {} });

/** Compose a ledger entry from an absolute span plus accrued break seconds. */
export function composeEntry(startMs: number, endMs: number, breakSeconds: number): EntryInput {
  const start = zonedParts(startMs);
  const end = zonedParts(endMs);
  return {
    date: start.date,
    hours: round2((endMs - startMs) / 3_600_000),
    breakHours: round2(breakSeconds / 3600),
    startTime: start.hhmm,
    endTime: end.hhmm,
    note: null,
    entryKind: 'work',
  };
}

export async function clockIn(repo: Repo, now: number, mode: ClockBreakMode): Promise<ActionOutcome> {
  if (await repo.getOpenShift()) return err(409, 'Already clocked in');
  await repo.saveOpenShift({ id: 'current', startedAt: now, breakStartedAt: null, breakSeconds: 0, breakMode: mode });
  return ok();
}

export async function startBreak(repo: Repo, now: number): Promise<ActionOutcome> {
  const row = await repo.getOpenShift();
  if (!row || row.breakStartedAt != null || row.startedAt == null) return err(409, 'Not clocked in');
  if (now <= row.startedAt) return err(400, 'Break must start after clock-in');
  if (row.breakMode === 'split') {
    await repo.addEntry(composeEntry(row.startedAt, now, 0));
    await repo.saveOpenShift({ ...row, startedAt: null, breakStartedAt: now });
  } else {
    await repo.saveOpenShift({ ...row, breakStartedAt: now });
  }
  return ok();
}

export async function endBreak(repo: Repo, now: number): Promise<ActionOutcome> {
  const row = await repo.getOpenShift();
  if (!row || row.breakStartedAt == null) return err(409, 'Not on a break');
  if (row.breakMode === 'split') {
    await repo.saveOpenShift({ ...row, startedAt: now, breakStartedAt: null });
  } else {
    const breakSeconds = row.breakSeconds + Math.round((now - row.breakStartedAt) / 1000);
    await repo.saveOpenShift({ ...row, breakSeconds, breakStartedAt: null });
  }
  return ok();
}

/** Clocking out while on break ends the shift at the break's start. */
export async function clockOut(repo: Repo, now: number): Promise<ActionOutcome> {
  const row = await repo.getOpenShift();
  if (!row) return err(409, 'Not clocked in');
  const end = row.breakStartedAt ?? now;
  if (row.startedAt != null) {
    if (end <= row.startedAt) return err(400, 'Clock-out must come after clock-in');
    await repo.addEntry(composeEntry(row.startedAt, end, row.breakSeconds));
  }
  // Split mode on break: the last segment was already written at break start.
  await repo.clearOpenShift();
  return ok();
}

export async function adjustStart(repo: Repo, startMs: number, now: number): Promise<ActionOutcome> {
  const row = await repo.getOpenShift();
  if (!row || row.startedAt == null || row.breakStartedAt != null) return err(409, 'No running segment to adjust');
  if (startMs >= now) return err(400, 'Start must be in the past');
  await repo.saveOpenShift({ ...row, startedAt: startMs });
  return ok();
}

/** A shift is stale when it started before today (app zone). */
export function isStale(row: OpenShift | null): boolean {
  const startMs = row?.startedAt ?? row?.breakStartedAt;
  if (startMs == null) return false;
  return zonedParts(startMs).date < todayISO();
}

export async function resolveSave(repo: Repo, endMs: number): Promise<ActionOutcome> {
  const row = await repo.getOpenShift();
  if (!row) return err(409, 'Nothing to resolve');
  const end = row.breakStartedAt != null ? Math.min(endMs, row.breakStartedAt) : endMs;
  if (row.startedAt != null) {
    if (end <= row.startedAt) return err(400, 'End must come after the shift started');
    await repo.addEntry(composeEntry(row.startedAt, end, row.breakSeconds));
  }
  await repo.clearOpenShift();
  return ok();
}

export async function resolveDiscard(repo: Repo): Promise<ActionOutcome> {
  if (!(await repo.getOpenShift())) return err(409, 'Nothing to resolve');
  await repo.clearOpenShift();
  return ok();
}

/** Clock page view-model, computed from layout data in +page.ts. */
export function computeClock(entries: TimeEntry[], row: Settings, openShift: OpenShift | null) {
  const today = todayISO();
  const todayEntries = entries.filter((e) => e.date === today);
  const workedToday = round2(todayEntries.reduce((s, e) => s + e.hours - e.breakHours, 0));
  return {
    openShift,
    state: clockStateOf(openShift),
    stale: isStale(openShift),
    today,
    todayEntries,
    workedToday,
    timeFormat: row.timeFormat as '12h' | '24h',
    breakMode: row.clockBreakMode,
  };
}
```

- [ ] **Step 3: Run tests** — `bun run test src/lib/core/clock.test.ts` → PASS; full `bun run test`, `check`, `lint` green.

- [ ] **Step 4: Commit** — `feat(clock): punch-clock state machine composing ledger entries`

---

### Task 5: Layout — openShift in the load, app zone set, Clock nav tab

**Files:**
- Modify: `src/routes/+layout.server.ts`, `src/routes/+layout.ts`, `src/routes/+layout.svelte`

- [ ] **Step 1: Server load** — `+layout.server.ts` body becomes:

```ts
export const load: LayoutServerLoad = async () => {
  const repo = isDemo ? emptyRepo : serverRepo;
  const [entries, settings, openShift] = await Promise.all([repo.listEntries(), repo.getSettings(), repo.getOpenShift()]);
  return { entries, settings, openShift };
};
```

- [ ] **Step 2: Universal load** — `+layout.ts` becomes (keep the existing `ssr` export and comments):

```ts
export const load: LayoutLoad = async ({ data, depends }) => {
  if (!isDemo) {
    setAppTimeZone(effectiveZone(data.settings.timeZone, data.settings.observeDst));
    return data;
  }
  depends('demo:data');
  if (!browser) return data;
  const { demoRepo } = await import('$lib/demo/repo');
  const [entries, settings, openShift] = await Promise.all([
    demoRepo.listEntries(),
    demoRepo.getSettings(),
    demoRepo.getOpenShift(),
  ]);
  setAppTimeZone(effectiveZone(settings.timeZone, settings.observeDst));
  return { entries, settings, openShift };
};
```

(imports: `effectiveZone, setAppTimeZone` from `$lib/date`.)

- [ ] **Step 3: Nav** — `+layout.svelte`: change props to `let { children, data } = $props();` (type comes from `./$types` `LayoutData` via generated props — if the file types props explicitly, use `import type { LayoutData } from './$types'`). Import `Clock` from `@lucide/svelte/icons/clock`. Links array:

```ts
const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clock', label: 'Clock', icon: Clock },
  { href: '/log', label: 'Log', icon: NotebookPen },
  { href: '/settings', label: 'Settings', icon: Settings },
];
const clockRunning = $derived(!!data.openShift);
```

In BOTH nav render loops (desktop header links and the mobile bottom tab bar), make the `<a>` `relative` (add to its class list) and add inside it, right after the icon:

```svelte
{#if link.href === '/clock' && clockRunning}
  <span class="absolute top-1 right-1 size-1.5 rounded-full bg-success" aria-hidden="true"></span>
{/if}
```

(If `bg-success` isn't a theme color in this app, use `bg-emerald-500`.) Also add the same link entry handling to the hamburger slide-down menu if it renders from the same `links` array (it does — verify by reading the file).

- [ ] **Step 4: Gates + verify** — `check`/`lint`/`test` green. `bun run dev`, confirm 4 tabs render on desktop width and the mobile bottom bar (resize) — no dot yet (no open shift).

- [ ] **Step 5: Commit** — `feat(nav): Clock tab with running indicator; open shift + app zone in the layout load`

---

### Task 6: Clock route — server actions + page compute

**Files:**
- Create: `src/routes/clock/+page.server.ts`, `src/routes/clock/+page.ts`

- [ ] **Step 1: Actions** — `src/routes/clock/+page.server.ts`:

```ts
import { fail } from '@sveltejs/kit';
import {
  adjustStart, clockIn, clockOut, endBreak, resolveDiscard, resolveSave, startBreak,
} from '$lib/core/clock';
import { effectiveZone, setAppTimeZone, zonedToMs } from '$lib/date';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import { parseTimeInput } from '$lib/timesheet';
import type { Actions } from './$types';

type Outcome = Awaited<ReturnType<typeof clockOut>>;
const unwrap = (out: Outcome) => (out.ok ? out.data : fail(out.status, out.data));
const demoFail = () => fail(400, { error: 'Demo mode handles this in the browser' });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Actions run before loads, so pin the zone themselves: composition derives
// wall-clock fields from it.
async function settingsWithZone() {
  const s = await serverRepo.getSettings();
  setAppTimeZone(effectiveZone(s.timeZone, s.observeDst));
  return s;
}

/** "2026-06-10" + "5:30 PM" → epoch ms in the app zone, or null. */
function formMs(form: FormData, dateKey: string, timeKey: string): number | null {
  const date = form.get(dateKey);
  const time = form.get(timeKey);
  if (typeof date !== 'string' || !ISO_DATE.test(date) || typeof time !== 'string') return null;
  const hhmm = parseTimeInput(time);
  if (!hhmm) return null;
  return zonedToMs(date, hhmm);
}

export const actions: Actions = {
  in: async () => {
    if (isDemo) return demoFail();
    const s = await settingsWithZone();
    return unwrap(await clockIn(serverRepo, Date.now(), s.clockBreakMode));
  },
  breakStart: async () => {
    if (isDemo) return demoFail();
    await settingsWithZone();
    return unwrap(await startBreak(serverRepo, Date.now()));
  },
  breakEnd: async () => {
    if (isDemo) return demoFail();
    await settingsWithZone();
    return unwrap(await endBreak(serverRepo, Date.now()));
  },
  out: async () => {
    if (isDemo) return demoFail();
    await settingsWithZone();
    return unwrap(await clockOut(serverRepo, Date.now()));
  },
  adjust: async ({ request }) => {
    if (isDemo) return demoFail();
    await settingsWithZone();
    const ms = formMs(await request.formData(), 'date', 'time');
    if (ms == null) return fail(400, { error: 'Enter a time like 9:00 AM' });
    return unwrap(await adjustStart(serverRepo, ms, Date.now()));
  },
  resolveSave: async ({ request }) => {
    if (isDemo) return demoFail();
    await settingsWithZone();
    const ms = formMs(await request.formData(), 'endDate', 'endTime');
    if (ms == null) return fail(400, { error: 'Enter when the shift ended' });
    return unwrap(await resolveSave(serverRepo, ms));
  },
  resolveDiscard: async () => {
    if (isDemo) return demoFail();
    return unwrap(await resolveDiscard(serverRepo));
  },
};
```

(Verify `parseTimeInput` lives in `$lib/timesheet` — CLAUDE.md lists it there.)

- [ ] **Step 2: Page load** — `src/routes/clock/+page.ts`:

```ts
import { computeClock } from '$lib/core/clock';
import type { PageLoad } from './$types';

// Pure view computation over the layout-loaded data — switching to this tab
// never fetches from the server.
export const load: PageLoad = async ({ parent }) => {
  const { entries, settings, openShift } = await parent();
  return computeClock(entries, settings, openShift);
};
```

- [ ] **Step 3: Gates + commit** — `check`/`lint`/`test` green (the route renders a 500 without a `+page.svelte`? No — SvelteKit needs the component; create a placeholder `src/routes/clock/+page.svelte` with `<script lang="ts">let { data } = $props();</script><pre>{JSON.stringify(data.state)}</pre>` if check complains, replaced in Task 7). Commit: `feat(clock): punch actions and page compute`

---

### Task 7: Clock page UI

**Files:**
- Create/replace: `src/routes/clock/+page.svelte`

- [ ] **Step 1: Component** — follow the app's established patterns (forms with `method="POST"` + `use:enhance` with a demo branch; `Card` primitives; `DateField` for dates; `Input`; `Button`). Full component:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import DateField from '$lib/components/DateField.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import type { ActionOutcome } from '$lib/core/log';
  import { formatTime, formatTimeRange, zonedParts } from '$lib/date';
  import { isDemo } from '$lib/demo/flag';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let demoForm = $state<ActionData>(null);
  const actionData = $derived(isDemo ? demoForm : form);
  const errorMsg = $derived(actionData && 'error' in actionData ? (actionData.error as string) : null);

  // Ticking clock for the live timer; one interval for the whole page.
  let nowMs = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
    return () => clearInterval(id);
  });

  const shift = $derived(data.openShift);
  // Worked ms in the running shift (frozen at break start while on break).
  const workedMs = $derived.by(() => {
    if (!shift || shift.startedAt == null) return 0;
    const end = shift.breakStartedAt ?? nowMs;
    return Math.max(0, end - shift.startedAt - shift.breakSeconds * 1000);
  });
  const breakMs = $derived(shift?.breakStartedAt != null ? Math.max(0, nowMs - shift.breakStartedAt) : 0);

  function fmtElapsed(ms: number): string {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  const hrs = (n: number) => `${n.toFixed(2)}h`;
  const sinceLabel = $derived(
    shift?.startedAt != null ? formatTime(zonedParts(shift.startedAt).hhmm, data.timeFormat) : '',
  );
  const breakSinceLabel = $derived(
    shift?.breakStartedAt != null ? formatTime(zonedParts(shift.breakStartedAt).hhmm, data.timeFormat) : '',
  );
  const startedDate = $derived(shift?.startedAt != null ? zonedParts(shift.startedAt).date : data.today);

  // Demo branch: run the matching core action against localStorage.
  function demoEnhance(run: (repo: import('$lib/core/repo').Repo) => Promise<ActionOutcome>) {
    return ({ cancel }: { cancel: () => void }) => {
      if (!isDemo) return;
      cancel();
      void (async () => {
        const { demoRepo } = await import('$lib/demo/repo');
        const out = await run(demoRepo);
        demoForm = out.data as ActionData;
        await invalidate('demo:data');
      })();
    };
  }

  let adjustOpen = $state(false);
  let discardOpen = $state(false);
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-6">
  <div class="max-md:text-center">
    <h1 class="text-2xl font-semibold tracking-tight">Clock</h1>
    <p class="mt-1 text-sm text-muted-foreground">Punch in and out; finished shifts land in the ledger.</p>
  </div>

  {#if data.stale && shift}
    <Card.Root class="border-destructive/50">
      <Card.Header class="max-md:text-center">
        <Card.Title>Still clocked in from {zonedParts(shift.startedAt ?? shift.breakStartedAt ?? 0).date}</Card.Title>
        <Card.Description>Set when this shift actually ended, or discard the punch. Nothing saves on its own.</Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-3">
        <form
          method="POST"
          action="?/resolveSave"
          use:enhance={demoEnhance(async (repo) => {
            const { resolveSave } = await import('$lib/core/clock');
            const { zonedToMs } = await import('$lib/date');
            const { parseTimeInput } = await import('$lib/timesheet');
            const dateEl = document.querySelector<HTMLInputElement>('input[name="endDate"]');
            const timeEl = document.querySelector<HTMLInputElement>('input[name="endTime"]');
            const hhmm = timeEl ? parseTimeInput(timeEl.value) : null;
            if (!dateEl?.value || !hhmm) return { ok: false, status: 400, data: { error: 'Enter when the shift ended' } };
            return resolveSave(repo, zonedToMs(dateEl.value, hhmm));
          })}
          class="flex flex-wrap items-end gap-3"
        >
          <div class="flex flex-col gap-1.5">
            <Label for="endDate">Ended on</Label>
            <DateField id="endDate" name="endDate" value={startedDate} max={data.today} />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="endTime">at</Label>
            <Input id="endTime" name="endTime" placeholder="05:30 PM" class="w-28" required />
          </div>
          <Button type="submit">Save shift</Button>
          <Button type="button" variant="outline" onclick={() => (discardOpen = true)}>Discard punch</Button>
        </form>
      </Card.Content>
    </Card.Root>
  {:else}
    <Card.Root>
      <Card.Content class="flex flex-col items-center gap-4 py-8">
        {#if data.state === 'idle'}
          <p class="text-5xl font-semibold tabular-nums tracking-tight">0:00:00</p>
          <p class="text-sm text-muted-foreground">Not clocked in</p>
          <form method="POST" action="?/in" use:enhance={demoEnhance(async (repo) => {
            const { clockIn } = await import('$lib/core/clock');
            const s = await repo.getSettings();
            return clockIn(repo, Date.now(), s.clockBreakMode);
          })}>
            <Button type="submit" size="lg">Clock in</Button>
          </form>
        {:else if data.state === 'working'}
          <p class="text-5xl font-semibold tabular-nums tracking-tight">{fmtElapsed(workedMs)}</p>
          <p class="text-sm text-muted-foreground">
            Clocked in at {sinceLabel}
            {#if shift && shift.breakSeconds > 0}· {hrs(shift.breakSeconds / 3600)} break so far{/if}
            <button type="button" class="ml-1 underline decoration-dotted" onclick={() => (adjustOpen = !adjustOpen)}>
              adjust
            </button>
          </p>
          {#if adjustOpen}
            <form method="POST" action="?/adjust" use:enhance={demoEnhance(async (repo) => {
              const { adjustStart } = await import('$lib/core/clock');
              const { zonedToMs } = await import('$lib/date');
              const { parseTimeInput } = await import('$lib/timesheet');
              const timeEl = document.querySelector<HTMLInputElement>('input[name="time"]');
              const hhmm = timeEl ? parseTimeInput(timeEl.value) : null;
              if (!hhmm) return { ok: false, status: 400, data: { error: 'Enter a time like 9:00 AM' } };
              return adjustStart(repo, zonedToMs(startedDate, hhmm), Date.now());
            })} class="flex items-end gap-2">
              <input type="hidden" name="date" value={startedDate} />
              <div class="flex flex-col gap-1.5">
                <Label for="time">Actually started at</Label>
                <Input id="time" name="time" placeholder={sinceLabel} class="w-28" required />
              </div>
              <Button type="submit" variant="outline" size="sm">Fix it</Button>
            </form>
          {/if}
          <div class="flex gap-3">
            <form method="POST" action="?/breakStart" use:enhance={demoEnhance(async (repo) => {
              const { startBreak } = await import('$lib/core/clock');
              return startBreak(repo, Date.now());
            })}>
              <Button type="submit" variant="outline">Take a break</Button>
            </form>
            <form method="POST" action="?/out" use:enhance={demoEnhance(async (repo) => {
              const { clockOut } = await import('$lib/core/clock');
              return clockOut(repo, Date.now());
            })}>
              <Button type="submit">Clock out</Button>
            </form>
          </div>
        {:else}
          <p class="text-5xl font-semibold tabular-nums tracking-tight">{fmtElapsed(breakMs)}</p>
          <p class="text-sm text-muted-foreground">On break since {breakSinceLabel} · {fmtElapsed(workedMs)} worked</p>
          <div class="flex gap-3">
            <form method="POST" action="?/breakEnd" use:enhance={demoEnhance(async (repo) => {
              const { endBreak } = await import('$lib/core/clock');
              return endBreak(repo, Date.now());
            })}>
              <Button type="submit">Back to work</Button>
            </form>
            <form method="POST" action="?/out" use:enhance={demoEnhance(async (repo) => {
              const { clockOut } = await import('$lib/core/clock');
              return clockOut(repo, Date.now());
            })}>
              <Button type="submit" variant="outline">Clock out</Button>
            </form>
          </div>
        {/if}
        {#if errorMsg}<p class="text-sm text-destructive">{errorMsg}</p>{/if}
      </Card.Content>
    </Card.Root>
  {/if}

  <Card.Root>
    <Card.Header class="max-md:text-center">
      <Card.Title>Today</Card.Title>
      <Card.Description>
        {hrs(data.workedToday)} logged{shift && !data.stale ? ` · ${fmtElapsed(workedMs)} on the clock` : ''}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      {#if data.todayEntries.length === 0}
        <p class="py-4 text-center text-sm text-muted-foreground">No shifts logged today yet.</p>
      {:else}
        <ul class="divide-y divide-border/50">
          {#each data.todayEntries as e (e.id)}
            <li class="flex items-center justify-between py-2 text-sm">
              <span class="font-mono">
                {e.startTime && e.endTime ? formatTimeRange(e.startTime, e.endTime, data.timeFormat) : '—'}
              </span>
              <span class="font-mono tabular-nums">{hrs(e.hours - e.breakHours)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<Dialog.Root bind:open={discardOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Discard this punch?</Dialog.Title>
      <Dialog.Description>The open shift is thrown away and nothing lands in the ledger.</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (discardOpen = false)}>Cancel</Button>
      <form method="POST" action="?/resolveDiscard" use:enhance={demoEnhance(async (repo) => {
        const { resolveDiscard } = await import('$lib/core/clock');
        return resolveDiscard(repo);
      })}>
        <Button type="submit" variant="destructive" onclick={() => (discardOpen = false)}>Discard</Button>
      </form>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

Implementation notes for the executor: the `demoEnhance` return value relies on returning `undefined` in non-demo mode so SvelteKit's default `applyAction`+`invalidateAll` runs; type the callback parameter against `SubmitFunction` from `@sveltejs/kit` if svelte-check demands it. The demo branches must also set the app zone before composing — the layout load already did it in the same browser session, which is sufficient (same module instance).

- [ ] **Step 2: Gates** — `check`/`lint`/`test` green.

- [ ] **Step 3: Manual verify (normal mode)** — `DATABASE_URL=file:/tmp/scratch.db bun run dev` against a **copy** of local.db (`cp local.db /tmp/scratch.db`): clock in → timer ticks, nav dot appears on the Clock tab; take a break → break timer; back to work; clock out → entry appears on /log and the Today card; second clock-in same day → second shift. Adjust start moves the "Clocked in at" label. Errors render (e.g. POST ?/in twice via two tabs).

- [ ] **Step 4: Commit** — `feat(clock): live punch clock page`

---

### Task 8: Settings UI — timezone, DST, break mode

**Files:**
- Modify: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Controls** — in the existing **Clock** section (the one holding Time format), extend the grid with three controls (auto-save needs no extra wiring — the form-level `onchange` covers them):

```svelte
<div class="flex flex-col gap-1.5">
  <Label for="timeZone">Timezone</Label>
  <select
    id="timeZone"
    name="timeZone"
    class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
  >
    {#each timeZones as tz (tz)}
      <option value={tz} selected={data.timeZone === tz}>{tz.replaceAll('_', ' ')}</option>
    {/each}
  </select>
  <p class="text-xs text-muted-foreground">Defines "today" everywhere and stamps the clock.</p>
</div>
<div class="flex flex-col gap-1.5">
  <Label for="clockBreakMode">Clock breaks</Label>
  <select
    id="clockBreakMode"
    name="clockBreakMode"
    class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
  >
    <option value="accrue" selected={data.clockBreakMode === 'accrue'}>Accrue into the shift</option>
    <option value="split" selected={data.clockBreakMode === 'split'}>Split shifts at breaks</option>
  </select>
  <p class="text-xs text-muted-foreground">How punch-clock breaks land in the ledger.</p>
</div>
```

plus, below the grid (full width, checkbox style copied from the weekend toggles):

```svelte
<label
  class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-accent"
>
  <input type="checkbox" name="observeDst" checked={data.observeDst} class="mt-0.5 accent-primary" />
  <span>
    <span class="font-medium">Observe daylight saving time</span>
    <span class="block text-xs text-muted-foreground">
      Off pins the timezone to its standard offset year-round (e.g. Central stays UTC−6).
    </span>
  </span>
</label>
```

Script additions: `const timeZones = Intl.supportedValuesOf('timeZone');` and the reset handler (`resetToDefaults`) gains `set('timeZone', DEFAULT_SETTINGS.timeZone); set('clockBreakMode', DEFAULT_SETTINGS.clockBreakMode);` and adds `['observeDst', DEFAULT_SETTINGS.observeDst]` to its `flags` array.

- [ ] **Step 2: Gates + manual verify** — settings shows the three controls with America/Chicago + DST on + accrue selected; changing each auto-saves ("Saved" appears) and survives reload; switching timezone to e.g. `Pacific/Auckland` flips the dashboard/ledger "today" once the date differs. Reset-to-defaults restores all three.

- [ ] **Step 3: Commit** — `feat(settings): timezone, DST opt-out, and clock break mode`

---

### Task 9: End-to-end verification (both modes) + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Normal mode E2E** (Playwright against `DATABASE_URL=file:/tmp/scratch.db bun run dev`): full accrue cycle (in → break → back → out) lands one ledger entry with the right break; flip `clockBreakMode` to split, run in → break → back → out → two entries; simulate a stale shift (`sqlite3`/`bun -e` update `open_shift.started_at` to yesterday) → banner appears, resolveSave writes the entry with the chosen end, discard clears; edit an entry in the ledger → dialog shows "Added … · Edited …".

- [ ] **Step 2: Demo mode E2E** (`PUBLIC_DEMO=1 bun run dev`): the same punch cycle entirely client-side — network panel shows **zero** requests during punches; open shift survives reload (localStorage); sample/yours toggle keeps separate open shifts.

- [ ] **Step 3: Tab-switch regression** — cycling all four tabs triggers no `__data.json` in the production build (`bun run build`, run with `ORIGIN` set, check the network log) — the layout-load contract must survive this feature.

- [ ] **Step 4: CLAUDE.md** — document: the Clock tab + `src/lib/core/clock.ts` state machine + `open_shift` table (one paragraph in Architecture), the timezone trio in the settings list (`timeZone` / `observeDst` / `clockBreakMode`), `updatedAt` on `time_entries`, and the app-zone mechanism in `src/lib/date.ts` (set by the root layout load; actions pin it themselves).

- [ ] **Step 5: Final gates + commit** — `bun run check && bun run lint && bun run test` green → `docs: clock page, timezone, and entry-timestamp coverage`

---

## Self-review notes (already applied)

- Spec coverage: placement/nav (Task 5), break-mode toggle (Tasks 2, 8), accrue+split machine (Task 4), stale resolve (Tasks 4, 6, 7), adjust start (4, 6, 7), app-wide zone (1, 5, 6), DST opt-out (1, 8), created/edited stamps (3), demo parity (2, 7), tests (1, 3, 4, 9).
- Type consistency: `OpenShift` from `$lib/db/schema` everywhere; `ActionOutcome` from `$lib/core/log`; repo methods named `getOpenShift`/`saveOpenShift`/`clearOpenShift` in contract, server, demo, and fake.
- Known judgment calls for the executor: exact placement/classes in `+layout.svelte` nav loops and the settings Clock-section grid may need small adaptations to the real markup — keep the documented behavior identical.
