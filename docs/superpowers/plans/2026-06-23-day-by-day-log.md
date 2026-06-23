# Day-by-day Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Log a day-by-day surface — the weekly grid auto-saves each day as it's typed, an arrival-only "open row" persists the in-progress half of a day, and the dashboard stops counting today as owed until its shift is complete.

**Architecture:** Three loosely-coupled slices, shippable in order. (1) A pure `todayBaselineCounts` helper plus an `expectedAsOf` bound, applied client-side on the dashboard, drops an incomplete today from "expected so far" while logged still counts it. (2) A new `openEntryInput` schema persists `{startTime, endTime:null, hours:0}` — already a valid `EntryInput`, no migration. (3) The deliberately-uncontrolled weekly grid gains a per-row id/state array, seeds its cells from saved entries, and saves each row on blur through the existing `add`/`update`/`delete` actions; the bulk `addWeek` submit is removed.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript strict, Drizzle/libSQL, Zod, Tailwind v4 + shadcn-svelte, Vitest (jsdom), Biome, Bun.

## Global Constraints

- **Bun only.** No npm/pnpm/yarn. Run tests with `bun run test <file>`; checks with `bun run check` and `bun run lint`.
- **Zero-tolerance gates.** `bun run check` and `bun run lint` must each report **0 errors and 0 warnings** before any commit.
- **No escape hatches.** No `as any`, no `as unknown`, no `biome-ignore` / `@ts-expect-error`. Type it correctly.
- **Use `??`, not `||`,** when `0` / `""` / `false` are valid values.
- **Biome style:** single quotes, semicolons always, 2-space indent, 120 width.
- **Math is pure + timezone-safe.** `src/lib/timesheet.ts` takes explicit dates; never read `Date.now()`/the host zone there.
- **Branch before committing** (currently on `main`): `git checkout -b feat/day-by-day-log` as the very first action of Task 1.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```

---

## Phase 1 — Dashboard: don't owe today until done

Outcome: caught-up-through-yesterday reads **On pace ±0** instead of **Behind −8h**; today's full baseline counts only once today has a completed shift (both clock times) or any non-open entry. Ships independently.

### Task 1: Pure `isOpenEntry` + `todayBaselineCounts` helpers

**Files:**
- Modify: `src/lib/timesheet.ts` (add two exported functions near `loggedHours`, ~line 156)
- Test: `src/lib/timesheet.test.ts` (add a new `describe` block)

**Interfaces:**
- Produces:
  - `isOpenEntry(e: { startTime: string | null; endTime: string | null }): boolean`
  - `todayBaselineCounts(entries: { date: string; startTime: string | null; endTime: string | null }[], today: string): boolean`

- [ ] **Step 1: Branch, then write the failing test**

First branch (one-time, this is the first action of the plan):
```bash
git checkout -b feat/day-by-day-log
```

Add to `src/lib/timesheet.test.ts` (it already imports from `'vitest'` and `'./timesheet'` — extend those imports with `isOpenEntry, todayBaselineCounts`):
```ts
describe('isOpenEntry / todayBaselineCounts', () => {
  const T = '2026-06-23';

  it('treats an arrival with no departure as open', () => {
    expect(isOpenEntry({ startTime: '09:00', endTime: null })).toBe(true);
  });
  it('a completed clock shift is not open', () => {
    expect(isOpenEntry({ startTime: '09:00', endTime: '17:00' })).toBe(false);
  });
  it('an hours-mode / leave entry (no times) is not open', () => {
    expect(isOpenEntry({ startTime: null, endTime: null })).toBe(false);
  });

  it("today doesn't count with no entries", () => {
    expect(todayBaselineCounts([], T)).toBe(false);
  });
  it("today doesn't count when its only row is open", () => {
    expect(todayBaselineCounts([{ date: T, startTime: '09:00', endTime: null }], T)).toBe(false);
  });
  it('today counts once a shift is completed', () => {
    expect(todayBaselineCounts([{ date: T, startTime: '09:00', endTime: '17:00' }], T)).toBe(true);
  });
  it('today counts for an hours-mode entry', () => {
    expect(todayBaselineCounts([{ date: T, startTime: null, endTime: null }], T)).toBe(true);
  });
  it('counts when any of several shifts is complete', () => {
    expect(
      todayBaselineCounts(
        [
          { date: T, startTime: '09:00', endTime: '11:00' },
          { date: T, startTime: '13:00', endTime: null },
        ],
        T,
      ),
    ).toBe(true);
  });
  it('ignores other days', () => {
    expect(todayBaselineCounts([{ date: '2026-06-22', startTime: '09:00', endTime: '17:00' }], T)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `bun run test src/lib/timesheet.test.ts`
Expected: FAIL — `isOpenEntry`/`todayBaselineCounts` are not exported.

- [ ] **Step 3: Implement the helpers**

In `src/lib/timesheet.ts`, after `loggedHours` (~line 156):
```ts
/**
 * An entry is "open" — a started-but-unfinished shift — when it has a clock-in
 * but no clock-out. Open rows carry 0 hours and never grant credit.
 */
export function isOpenEntry(e: { startTime: string | null; endTime: string | null }): boolean {
  return e.startTime !== null && e.endTime === null;
}

/**
 * Whether today's baseline should count toward "expected so far". It counts once
 * today has a completed entry — for a clock shift, both times filled; an
 * hours-mode or leave entry is inherently complete. An arrival-only open row
 * keeps today excluded, so an in-progress day never reads as a deficit.
 */
export function todayBaselineCounts(
  entries: { date: string; startTime: string | null; endTime: string | null }[],
  today: string,
): boolean {
  return entries.some((e) => e.date === today && !isOpenEntry(e));
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `bun run test src/lib/timesheet.test.ts`
Expected: PASS (all new cases green, existing suite unchanged).

- [ ] **Step 5: Lint, check, commit**

```bash
bun run lint && bun run check
git add src/lib/timesheet.ts src/lib/timesheet.test.ts
git commit -m "feat(timesheet): add isOpenEntry + todayBaselineCounts helpers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: `expectedAsOf` bound on `bucketBreakdown` (chart coherence)

**Files:**
- Modify: `src/lib/timesheet.ts` — `bucketBreakdown` (lines 271-297)
- Test: `src/lib/timesheet.test.ts` (extend the existing `bucketBreakdown` describe block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `bucketBreakdown` gains optional `expectedAsOf?: string` in its params. When set, each bucket's **target** counts workdays only through `min(bucketEnd, expectedAsOf)`, while **logged** still sums through `asOf`. Default (undefined) preserves today's behavior exactly.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/timesheet.test.ts` inside the `bucketBreakdown` describe (it already imports `bucketBreakdown`). `settings` is the Mon–Fri 8h fixture already defined in that file. 2026-06-22/23/24 are Mon/Tue/Wed (all workdays), so a `weekStartsOn: 1` week bucket spans that Monday:
```ts
it('expectedAsOf drops an in-progress day from target but keeps it in logged', () => {
  const buckets = bucketBreakdown({
    entries: [
      { date: '2026-06-22', hours: 8 }, // Mon, completed
      { date: '2026-06-23', hours: 8 }, // Tue, completed
      { date: '2026-06-24', hours: 2 }, // Wed = today, logged partial
    ],
    rangeStart: '2026-06-22',
    asOf: '2026-06-24', // Wed
    expectedAsOf: '2026-06-23', // today's baseline excluded
    settings,
    weekStartsOn: 1,
    granularity: 'week',
  });
  expect(buckets).toHaveLength(1);
  expect(buckets[0].target).toBe(16); // Mon+Tue only (today dropped)
  expect(buckets[0].logged).toBe(18); // Mon 8 + Tue 8 + Wed 2 (today kept)
  expect(buckets[0].net).toBe(2);
});

it('without expectedAsOf, target counts through asOf as before', () => {
  const buckets = bucketBreakdown({
    entries: [{ date: '2026-06-22', hours: 8 }],
    rangeStart: '2026-06-22',
    asOf: '2026-06-24',
    settings,
    weekStartsOn: 1,
    granularity: 'week',
  });
  expect(buckets[0].target).toBe(24); // Mon+Tue+Wed
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `bun run test src/lib/timesheet.test.ts`
Expected: FAIL — `expectedAsOf` not honored (target is 24, not 16).

- [ ] **Step 3: Implement the bound**

In `src/lib/timesheet.ts`, edit `bucketBreakdown` (lines 271-297). Add `expectedAsOf` to the params type and destructure it, then clip the target's upper bound:
```ts
export function bucketBreakdown(params: {
  entries: EntryLike[];
  rangeStart: string;
  asOf: string;
  settings: WorkSettings;
  weekStartsOn?: number;
  granularity: BucketGranularity;
  /**
   * Upper bound for TARGET counting (defaults to `asOf`). Lets the dashboard
   * drop an in-progress today from the target while logged still counts it.
   */
  expectedAsOf?: string;
}): BucketSummary[] {
  const { entries, rangeStart, asOf, settings, weekStartsOn = 7, granularity, expectedAsOf } = params;
  const rangeStartMs = parseISO(rangeStart);
  const asOfMs = parseISO(asOf);
  if (asOfMs < rangeStartMs) return [];

  const buckets: BucketSummary[] = [];
  for (let ms = rangeStartMs; ms <= asOfMs; ) {
    const [start, next] = bucketBounds(ms, granularity, weekStartsOn);
    const fromISO = toISO(Math.max(start, rangeStartMs));
    const toRangeISO = toISO(Math.min(next - DAY_MS, asOfMs));

    // Target counts through expectedAsOf when it clips earlier than the bucket's
    // logged window; logged always sums through toRangeISO.
    const targetEnd = expectedAsOf && expectedAsOf < toRangeISO ? expectedAsOf : toRangeISO;
    const target =
      targetEnd >= fromISO ? round2(countWorkdays(fromISO, targetEnd, settings.workdays) * settings.dailyHours) : 0;
    const logged = loggedHours(entries.filter((e) => e.date >= fromISO && e.date <= toRangeISO));

    buckets.push({ start: toISO(start), end: toRangeISO, logged, target, net: round2(logged - target) });
    ms = next;
  }
  return buckets;
}
```

- [ ] **Step 4: Run the tests, verify pass**

Run: `bun run test src/lib/timesheet.test.ts`
Expected: PASS — including existing `bucketBreakdown` and `weeklyBreakdown` cases (default param unchanged).

- [ ] **Step 5: Lint, check, commit**

```bash
bun run lint && bun run check
git add src/lib/timesheet.ts src/lib/timesheet.test.ts
git commit -m "feat(timesheet): bucketBreakdown gains an expectedAsOf target bound

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Apply the rule on the dashboard

**Files:**
- Modify: `src/routes/+page.svelte` (`<script>` derivations: lines 144-146, 203, 268-277; imports)

**Interfaces:**
- Consumes: `todayBaselineCounts` (Task 1), `bucketBreakdown` `expectedAsOf` (Task 2).
- Produces: no new exports — pure view wiring. `data.entries` are `TimeEntry[]` (carry `startTime`/`endTime`), so they satisfy the helper's structural type directly.

This task has no unit test of its own (the math is covered by Tasks 1-2); it ends with a manual verification on the running dev server.

- [ ] **Step 1: Import the helper**

In `src/routes/+page.svelte`, find the import from `'$lib/timesheet'` (it already imports `countWorkdays`, `goalRateOf`, `overtimeHours`, `bucketBreakdown`, `addDays`). Add `todayBaselineCounts`:
```ts
import {
  addDays,
  bucketBreakdown,
  countWorkdays,
  goalRateOf,
  overtimeHours,
  todayBaselineCounts,
} from '$lib/timesheet';
```
(Match the existing import's exact member list; only add `todayBaselineCounts`.)

- [ ] **Step 2: Add the today-aware bounds and rewrite `expectedHours` / `workdaysElapsed`**

Replace the `expectedHours` derivation (lines 144-146) and the `workdaysElapsed` derivation (line 203). Insert the new derivations just above `expectedHours`:
```ts
  // Today's baseline is excluded from the expected/elapsed side until today has
  // a completed entry (a clock shift with both times, or any non-open row).
  // Logged still counts today, so an in-progress day reads On pace, not behind.
  const todayCounts = $derived(todayBaselineCounts(data.entries, data.today));
  const heroExpectedAsOf = $derived(todayCounts ? data.today : addDays(data.today, -1));
  const expectedEnd = $derived(window ? minStr(window.end, heroExpectedAsOf) : null);

  const expectedHours = $derived.by(() => {
    if (!window || !expectedEnd || expectedEnd < window.start) return 0;
    return countWorkdays(window.start, expectedEnd, data.workdays) * data.dailyHours;
  });
```
And replace `workdaysElapsed` (line 203):
```ts
  const workdaysElapsed = $derived.by(() => {
    if (!window || !expectedEnd || expectedEnd < window.start) return 0;
    return countWorkdays(window.start, expectedEnd, data.workdays);
  });
```
`inRange` (lines 147-149) and `logged` (line 150) stay exactly as they are — they keep counting through `window.end` (today).

- [ ] **Step 3: Pass `expectedAsOf` to the chart**

In the `chartBuckets` derivation (lines 268-277), add a sibling derived and thread it in:
```ts
  const chartExpectedAsOf = $derived(
    data.asOf === data.today && !todayCounts ? addDays(data.today, -1) : data.asOf,
  );
  const chartBuckets = $derived(
    bucketBreakdown({
      entries: data.entries,
      rangeStart: maxStr(`${data.year}-01-01`, data.epoch),
      asOf: data.asOf,
      expectedAsOf: chartExpectedAsOf,
      settings: { hourlyRate: data.hourlyRate, dailyHours: data.dailyHours, workdays: data.workdays },
      weekStartsOn: data.weekStartsOn,
      granularity: chartGranularity,
    }),
  );
```

- [ ] **Step 4: Check + lint**

Run: `bun run check && bun run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Manual verification on dev (Firefox)**

Run `bun run dev`. With no entry yet for today and the prior workdays logged, the hero must read **On pace** / **±0** (not Behind). Add a completed clock shift for today → today's baseline appears in Expected and the subtitle's "X of Y workdays elapsed" ticks up by one. Add only an arrival (open row, once Phase 2 lands) → stays On pace. Confirm the chart's current-period bar matches (no phantom dip from today). The user runs `bun run dev` in Firefox — verify there, not only headless.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(dashboard): don't count today as owed until its shift is complete

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2 — Open-row half-day model

Outcome: typing an arrival with a blank out persists `In 9:00 · Out — · Worked —` (`hours: 0`); typing the out later completes it. Math is inert to open rows. No migration.

### Task 4: `openEntryInput` schema

**Files:**
- Modify: `src/lib/schemas/entry.ts` (add after `clockEntryInput`, ~line 112)
- Test: Create `src/lib/schemas/entry.test.ts`

**Interfaces:**
- Produces: `openEntryInput` — a Zod schema parsing `{ date, startTime, note? }` into an `EntryInput` with `startTime` set, `endTime: null`, `hours: 0`, `breakHours: 0`, `entryKind: 'work'`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/schemas/entry.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { openEntryInput } from './entry';

describe('openEntryInput', () => {
  it('parses an arrival into an open work entry with 0 hours', () => {
    const parsed = openEntryInput.safeParse({ date: '2026-06-23', startTime: '9am' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        date: '2026-06-23',
        hours: 0,
        breakHours: 0,
        note: null,
        startTime: '09:00',
        endTime: null,
        entryKind: 'work',
      });
    }
  });

  it('keeps a trimmed note and drops a blank one', () => {
    const withNote = openEntryInput.safeParse({ date: '2026-06-23', startTime: '09:00', note: '  hi ' });
    expect(withNote.success && withNote.data.note).toBe('hi');
    const blank = openEntryInput.safeParse({ date: '2026-06-23', startTime: '09:00', note: '   ' });
    expect(blank.success && blank.data.note).toBe(null);
  });

  it('rejects a missing/unparseable start time', () => {
    expect(openEntryInput.safeParse({ date: '2026-06-23', startTime: '' }).success).toBe(false);
    expect(openEntryInput.safeParse({ date: '2026-06-23', startTime: 'nope' }).success).toBe(false);
  });

  it('rejects a bad date', () => {
    expect(openEntryInput.safeParse({ date: '06/23/2026', startTime: '09:00' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `bun run test src/lib/schemas/entry.test.ts`
Expected: FAIL — `openEntryInput` not exported.

- [ ] **Step 3: Implement the schema**

In `src/lib/schemas/entry.ts`, after `clockEntryInput` (line 112), reusing the existing `date`, `clockTime`, and `note` building blocks:
```ts
/**
 * Open mode: an arrival with no departure yet — a started, unfinished shift.
 * Records the clock-in, 0 worked hours, and no break (a break needs a span;
 * it's captured when the out is filled and the row becomes a clock entry).
 */
export const openEntryInput = z
  .object({
    date,
    startTime: clockTime,
    note,
  })
  .transform(
    (v): EntryInput => ({
      date: v.date,
      hours: 0,
      breakHours: 0,
      note: v.note,
      startTime: v.startTime,
      endTime: null,
      entryKind: 'work',
    }),
  );
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `bun run test src/lib/schemas/entry.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, check, commit**

```bash
bun run lint && bun run check
git add src/lib/schemas/entry.ts src/lib/schemas/entry.test.ts
git commit -m "feat(schemas): openEntryInput for arrival-only half-days

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Wire `open` mode into the Log core actions

**Files:**
- Modify: `src/lib/core/log.ts` — `parseEntry` (lines 38-51), add `openEntryInput` import
- Test: `src/lib/core/log.test.ts` (add a `memRepo`/`fd` harness + an "open mode" describe)

**Interfaces:**
- Consumes: `openEntryInput` (Task 4); `Repo` (`./repo`).
- Produces: `parseEntry` now recognizes `mode === 'open'`. `addAction`/`updateAction` therefore persist open rows unchanged (they already call `parseEntry`).

- [ ] **Step 1: Write the failing test**

`src/lib/core/log.test.ts` currently imports only `futureImportDates`. Extend the imports and add a harness + tests (mirrors `expenses.test.ts`):
```ts
import { describe, expect, it } from 'vitest';
import type { TimeEntry } from '$lib/db/schema';
import type { EntryInput } from '$lib/schemas/entry';
import { addAction, futureImportDates, updateAction } from './log';
import { emptyRepo, type Repo } from './repo';

function memRepo(): { repo: Repo; rows: TimeEntry[] } {
  const rows: TimeEntry[] = [];
  const repo: Repo = {
    ...emptyRepo,
    listEntries: async () => rows,
    addEntry: async (input: EntryInput) => {
      const row: TimeEntry = { id: `e${rows.length + 1}`, ...input, createdAt: 1, updatedAt: null };
      rows.push(row);
      return row;
    },
    updateEntry: async (id, input) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...input, updatedAt: 2 };
    },
    findExistingDates: async (dates) => dates.filter((d) => rows.some((r) => r.date === d)),
    listEntriesByDates: async (dates) => rows.filter((r) => dates.includes(r.date)),
  };
  return { repo, rows };
}

function fd(pairs: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(pairs)) form.set(k, v);
  return form;
}

describe('addAction — open mode', () => {
  it('persists an arrival-only row as 0h with no end time', async () => {
    const { repo, rows } = memRepo();
    const out = await addAction(repo, fd({ mode: 'open', date: '2026-06-23', startTime: '9am' }));
    expect(out.ok).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ startTime: '09:00', endTime: null, hours: 0, entryKind: 'work' });
  });

  it('completes an open row in place via clock mode', async () => {
    const { repo, rows } = memRepo();
    await addAction(repo, fd({ mode: 'open', date: '2026-06-23', startTime: '09:00' }));
    const out = await updateAction(
      repo,
      fd({ id: 'e1', mode: 'clock', date: '2026-06-23', startTime: '09:00', endTime: '17:00' }),
    );
    expect(out.ok).toBe(true);
    expect(rows[0]).toMatchObject({ startTime: '09:00', endTime: '17:00', hours: 8 });
  });

  it('rejects an open row with no start time', async () => {
    const { repo, rows } = memRepo();
    const out = await addAction(repo, fd({ mode: 'open', date: '2026-06-23', startTime: '' }));
    expect(out.ok).toBe(false);
    expect(rows).toHaveLength(0);
  });
});
```
(Keep the existing `futureImportDates` describe block in the file.)

- [ ] **Step 2: Run the test, verify it fails**

Run: `bun run test src/lib/core/log.test.ts`
Expected: FAIL — `mode: 'open'` currently falls through to `entryInput` and errors on missing hours.

- [ ] **Step 3: Implement `open` mode in `parseEntry`**

In `src/lib/core/log.ts`, add the import (line 12 area):
```ts
import { clockEntryInput, type EntryInput, entryInput, leaveEntryInput, openEntryInput } from '$lib/schemas/entry';
```
Then edit `parseEntry` (lines 38-51) to branch on `'open'`:
```ts
function parseEntry(form: FormData, dailyHours = 8) {
  const date = form.get('date');
  const note = form.get('note') ?? undefined;
  const mode = form.get('mode');
  if (mode === 'leave') {
    const kind = String(form.get('kind') ?? '');
    return leaveEntryInput.safeParse({ date, note, kind, dailyHours });
  }
  if (mode === 'open') {
    return openEntryInput.safeParse({ date, startTime: form.get('startTime'), note });
  }
  const common = { date, breakHours: form.get('breakHours') || undefined, note };
  if (mode === 'clock') {
    return clockEntryInput.safeParse({ ...common, startTime: form.get('startTime'), endTime: form.get('endTime') });
  }
  return entryInput.safeParse({ ...common, hours: form.get('hours') });
}
```

- [ ] **Step 4: Run the tests, verify pass**

Run: `bun run test src/lib/core/log.test.ts`
Expected: PASS (open + clock-complete + reject, plus the untouched `futureImportDates` block).

- [ ] **Step 5: Lint, check, commit**

```bash
bun run lint && bun run check
git add src/lib/core/log.ts src/lib/core/log.test.ts
git commit -m "feat(log): accept open (arrival-only) entries in the core actions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Render open rows as "in progress" in the Ledger

**Files:**
- Modify: `src/routes/log/+page.svelte` — table row (lines 1864-1934) and mobile card (lines 2032-2104)

**Interfaces:**
- Consumes: an entry is open when `entry.startTime && !entry.endTime` (only `entryKind === 'work'` rows are ever open).
- Produces: no exports — visual treatment only.

This is a UI task; it ends with a manual verification.

- [ ] **Step 1: Table — show "—" worked and an "in progress" chip**

In the table row, the Worked cell currently renders `{hrs(entry.hours - entry.breakHours)}`. Make open rows show a dash:
```svelte
<Table.Cell class="text-right font-mono tabular-nums">
  {entry.startTime && !entry.endTime ? '—' : hrs(entry.hours - entry.breakHours)}
</Table.Cell>
```
In the OT cell (the `<Table.Cell class="text-center">` holding the OT badge, lines ~1908-1916), add an in-progress chip alongside it:
```svelte
<Table.Cell class="text-center">
  {#if entry.entryKind === 'work' && entry.startTime && !entry.endTime}
    <span
      class="inline-flex items-center rounded-md border border-dashed border-amber-500/60 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
      title="Shift in progress — add a clock-out to finish it"
    >
      In progress
    </span>
  {:else if !entryLeave && row.dayCount === 1 && dayTotals[entry.date] > data.dailyHours}
    <span
      title="Worked past the daily baseline"
      class="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
    >
      OT
    </span>
  {/if}
</Table.Cell>
```

- [ ] **Step 2: Mobile card — open-row time line + "—" worked**

In the mobile card, the time line renders only when `entry.startTime && entry.endTime`. Add an open-row branch and dash the Worked span. Replace the time-line block (lines ~2071-2090) so it reads:
```svelte
{#if entry.startTime && entry.endTime}
  <div class="font-mono text-sm tabular-nums text-muted-foreground">
    {@render clockTime(entry.startTime)}
    <span class="mx-0.5">→</span>
    {@render clockTime(entry.endTime)}
    {#if entry.endTime < entry.startTime}
      <span title="Ends the next day" class="ml-1 text-xs">+1d</span>
    {/if}
    {#if entry.breakHours > 0}
      <span class="ml-1 text-xs">· {hrs(entry.breakHours)} break</span>
    {/if}
  </div>
{:else if entry.startTime && !entry.endTime}
  <div class="font-mono text-sm tabular-nums text-amber-600 dark:text-amber-400">
    {@render clockTime(entry.startTime)}
    <span class="mx-0.5">→</span> … in progress
  </div>
{:else if entry.breakHours > 0}
  <div class="font-mono text-sm tabular-nums text-muted-foreground">{hrs(entry.breakHours)} break</div>
{/if}
```
And the Worked span (line ~2089):
```svelte
<span class="font-mono text-sm font-medium tabular-nums">
  {entry.startTime && !entry.endTime ? '—' : hrs(entry.hours - entry.breakHours)}
</span>
```

- [ ] **Step 3: Check + lint**

Run: `bun run check && bun run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Manual verification**

Insert an open row directly (until Phase 3 wires the grid, use the browser console in demo, or temporarily add one via the edit dialog posting `mode=open` — or just verify after Phase 3). The Ledger row and mobile card show `In 9:00 · Out — · Worked —` with an amber dashed **In progress** chip, visually distinct from unpaid-leave's hatched 0h badge.

- [ ] **Step 5: Commit**

```bash
git add src/routes/log/+page.svelte
git commit -m "feat(log): render open (in-progress) rows in the ledger

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3 — Live auto-saving grid

Outcome: the weekly grid loads your saved days into its cells, saves each row on blur (add → capture id → update thereafter), persists an arrival-only row as `open`, and drops the "Add week" submit. The grid stays **uncontrolled** (per the deliberate design at `+page.svelte:684-686`); auto-save reads the DOM on blur via the existing `inputByName` pattern and tracks ids/state in a parallel array. Sub-shifts (already controlled state) save the same way.

### Task 7: `addAction` returns the created entry id

**Files:**
- Modify: `src/lib/core/log.ts` — `addAction` (lines 154-175)
- Test: `src/lib/core/log.test.ts` (extend the open-mode harness)

**Interfaces:**
- Consumes: `repo.addEntry` already returns `Promise<TimeEntry>` (server uses `nanoid`, demo `crypto.randomUUID`).
- Produces: a successful `addAction` outcome's `data` gains `ids: string[]` (one id per inserted row, in insert order). Existing `added`/`overwrote` keys stay.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/core/log.test.ts`:
```ts
describe('addAction — returns ids', () => {
  it('surfaces the created entry id so the grid can switch to update', async () => {
    const { repo } = memRepo();
    const out = await addAction(repo, fd({ mode: 'clock', date: '2026-06-23', startTime: '09:00', endTime: '17:00' }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.ids).toEqual(['e1']);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `bun run test src/lib/core/log.test.ts`
Expected: FAIL — `out.data.ids` is `undefined`.

- [ ] **Step 3: Capture and return the ids**

In `src/lib/core/log.ts`, edit the tail of `addAction` (lines 173-174):
```ts
  const ids: string[] = [];
  for (const e of resolved.toInsert) {
    const created = await repo.addEntry(e);
    ids.push(created.id);
  }
  return { ok: true, data: { added: resolved.toInsert.length, overwrote: resolved.overwroteCount, ids } };
```

- [ ] **Step 4: Run the tests, verify pass**

Run: `bun run test src/lib/core/log.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, check, commit**

```bash
bun run lint && bun run check
git add src/lib/core/log.ts src/lib/core/log.test.ts
git commit -m "feat(log): addAction returns created entry ids

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Grid save helper (`saveRow` / `postAction`) + per-row state

**Files:**
- Modify: `src/routes/log/+page.svelte` (`<script>`: add state + helpers near the grid editing block, ~lines 657-720)

**Interfaces:**
- Consumes: `runLogAction` from `$lib/core/log` (demo path) + `demoRepo` (already imported on this page for `runDemo`); `deserialize` from `$app/forms`; `inputByName` (existing DOM reader used by `recomputeWeekTotals`); `subShifts`, `weekMode`, `weekRowDates` (existing); `parseTimeInput`/`formatTime` (existing).
- Produces:
  - `rowMeta: { id: string | null; wasOpen: boolean; save: 'idle' | 'saving' | 'saved' | 'error'; error: string }[]` (length 7, main rows).
  - `subMeta: same-shape[][]` (parallel to `subShifts`).
  - `saveRow(i: number): Promise<void>` and `saveSubShift(i: number, j: number): Promise<void>`.
  - `postAction(action, body): Promise<{ ok: boolean; data: Record<string, unknown> }>`.

- [ ] **Step 1: Add imports and state**

Add at the top imports (and ensure `isLeaveKind` is imported from `$lib/leave-kinds` — the page already imports `LEAVE_META`/`LeaveKind` from there; add `isLeaveKind` to that statement if absent, since `buildRow` uses it):
```ts
import { deserialize } from '$app/forms';
import { runLogAction } from '$lib/core/log';
```
In the grid-editing block (after `subShifts`, ~line 668), add:
```ts
  type RowSave = { id: string | null; wasOpen: boolean; save: 'idle' | 'saving' | 'saved' | 'error'; error: string };
  const emptyMeta = (): RowSave => ({ id: null, wasOpen: false, save: 'idle', error: '' });
  let rowMeta = $state<RowSave[]>(Array.from({ length: 7 }, emptyMeta));
  let subMeta = $state<RowSave[][]>(Array.from({ length: 7 }, () => []));
  // Trailing sync: after saves settle, refresh the ledger/dashboard once.
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (isDemo) void invalidate('demo:data');
      else void invalidateAll();
    }, 600);
  }
```
(`invalidate` is already imported on this page; add `invalidateAll` to that import from `$app/navigation`.)

- [ ] **Step 2: Add `postAction` (server programmatic POST)**

```ts
  async function postAction(
    action: 'add' | 'update' | 'delete',
    body: FormData,
  ): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(`?/${action}`, { method: 'POST', body });
    const result = deserialize(await res.text());
    if (result.type === 'success') return { ok: true, data: (result.data ?? {}) as Record<string, unknown> };
    if (result.type === 'failure') return { ok: false, data: (result.data ?? {}) as Record<string, unknown> };
    return { ok: false, data: { error: 'Could not reach the server' } };
  }
```

- [ ] **Step 3: Add `buildRow` + `saveRow` (main rows, read from the DOM)**

```ts
  // Read a main row's typed values from the uncontrolled inputs (same source as
  // recomputeWeekTotals) and decide what to persist.
  function buildRow(i: number): { mode: 'leave' | 'clock' | 'open' | 'hours'; form: FormData } | 'empty' | 'partial' {
    const date = weekRowDates[i];
    const leave = String(inputByName(`leave-${i}`)?.value ?? '');
    const note = inputByName(`note-${i}`)?.value ?? '';
    const form = new FormData();
    form.set('date', date);
    if (note.trim()) form.set('note', note.trim());

    if (isLeaveKind(leave)) {
      form.set('mode', 'leave');
      form.set('kind', leave);
      return { mode: 'leave', form };
    }
    const brk = inputByName(`break-${i}`)?.value ?? '';
    if (brk.trim()) form.set('breakHours', brk.trim());

    if (weekMode === 'clock') {
      const start = parseTimeInput(inputByName(`start-${i}`)?.value ?? '');
      const end = parseTimeInput(inputByName(`end-${i}`)?.value ?? '');
      if (!start && !end) return 'empty';
      if (start && end) {
        form.set('mode', 'clock');
        form.set('startTime', start);
        form.set('endTime', end);
        return { mode: 'clock', form };
      }
      if (start && !end) {
        form.set('mode', 'open');
        form.set('startTime', start);
        return { mode: 'open', form };
      }
      return 'partial'; // end without start — wait for more input
    }
    const hours = inputByName(`hours-${i}`)?.value ?? '';
    if (!hours.trim()) return 'empty';
    form.set('mode', 'hours');
    form.set('hours', hours.trim());
    return { mode: 'hours', form };
  }

  async function saveRow(i: number): Promise<void> {
    const meta = rowMeta[i];
    const built = buildRow(i);
    if (built === 'partial') return;
    if (built === 'empty') {
      // Cleared a row. Only auto-delete a throwaway open row; a logged day needs
      // the explicit trash button (decision A).
      if (meta.id && meta.wasOpen) {
        await deleteRowEntry(i);
      }
      return;
    }
    meta.save = 'saving';
    meta.error = '';
    const action = meta.id ? 'update' : 'add';
    if (meta.id) built.form.set('id', meta.id);
    const out = isDemo
      ? await runLogAction(demoRepo, action, built.form)
      : await postAction(action, built.form);
    if (out.ok) {
      if (!meta.id && Array.isArray(out.data.ids) && typeof out.data.ids[0] === 'string') {
        meta.id = out.data.ids[0];
      }
      meta.wasOpen = built.mode === 'open';
      meta.save = 'saved';
      scheduleSync();
    } else {
      meta.save = 'error';
      meta.error = firstError(out.data);
    }
  }

  async function deleteRowEntry(i: number): Promise<void> {
    const meta = rowMeta[i];
    if (!meta.id) return;
    const form = new FormData();
    form.set('id', meta.id);
    const out = isDemo ? await runLogAction(demoRepo, 'delete', form) : await postAction('delete', form);
    if (out.ok) {
      meta.id = null;
      meta.wasOpen = false;
      meta.save = 'idle';
      scheduleSync();
    }
  }

  // First error message from a core-action failure payload (fieldErrors or a flat error).
  function firstError(data: Record<string, unknown>): string {
    const fe = data.fieldErrors ?? data.weekFieldErrors;
    if (fe && typeof fe === 'object') {
      const first = Object.values(fe as Record<string, string>)[0];
      if (typeof first === 'string') return first;
    }
    return typeof data.error === 'string' ? data.error : 'Could not save';
  }
```

- [ ] **Step 4: Add `saveSubShift` (controlled sub-rows)**

```ts
  async function saveSubShift(i: number, j: number): Promise<void> {
    const shift = subShifts[i][j];
    const meta = subMeta[i][j];
    if (!meta) return;
    const date = weekRowDates[i];
    const form = new FormData();
    form.set('date', date);
    if (shift.note.trim()) form.set('note', shift.note.trim());
    if (shift.brk.trim()) form.set('breakHours', shift.brk.trim());

    let mode: 'clock' | 'open' | 'hours' | null = null;
    if (weekMode === 'clock') {
      const start = parseTimeInput(shift.start);
      const end = parseTimeInput(shift.end);
      if (start && end) {
        mode = 'clock';
        form.set('startTime', start);
        form.set('endTime', end);
      } else if (start && !end) {
        mode = 'open';
        form.set('startTime', start);
      } else if (!start && !end) {
        if (meta.id && meta.wasOpen) await deleteSubShiftEntry(i, j);
        return;
      } else {
        return; // partial
      }
    } else {
      if (!shift.hours.trim()) {
        if (meta.id && meta.wasOpen) await deleteSubShiftEntry(i, j);
        return;
      }
      mode = 'hours';
      form.set('hours', shift.hours.trim());
    }
    form.set('mode', mode);
    meta.save = 'saving';
    meta.error = '';
    const action = meta.id ? 'update' : 'add';
    if (meta.id) form.set('id', meta.id);
    const out = isDemo ? await runLogAction(demoRepo, action, form) : await postAction(action, form);
    if (out.ok) {
      if (!meta.id && Array.isArray(out.data.ids) && typeof out.data.ids[0] === 'string') meta.id = out.data.ids[0];
      meta.wasOpen = mode === 'open';
      meta.save = 'saved';
      scheduleSync();
    } else {
      meta.save = 'error';
      meta.error = firstError(out.data);
    }
  }

  async function deleteSubShiftEntry(i: number, j: number): Promise<void> {
    const meta = subMeta[i][j];
    if (!meta?.id) return;
    const form = new FormData();
    form.set('id', meta.id);
    const out = isDemo ? await runLogAction(demoRepo, 'delete', form) : await postAction('delete', form);
    if (out.ok) {
      meta.id = null;
      meta.wasOpen = false;
      meta.save = 'idle';
      scheduleSync();
    }
  }
```
Keep `addSubShift`/`removeSubShift` in sync with `subMeta`: in `addSubShift` push `emptyMeta()` to `subMeta[i]`; in `removeSubShift`, if `subMeta[i][j]?.id` exists call `deleteSubShiftEntry(i, j)` first, then `subMeta[i].splice(j, 1)`. Update the `weekStart` reset `$effect` (lines 679-682) to also reset `rowMeta`/`subMeta`:
```ts
  $effect(() => {
    void weekStart;
    subShifts = emptySubShifts();
    subMeta = Array.from({ length: 7 }, () => []);
    rowMeta = Array.from({ length: 7 }, emptyMeta);
  });
```

- [ ] **Step 5: Check + lint (no behavior wired yet)**

Run: `bun run check && bun run lint`
Expected: 0 errors, 0 warnings. (Helpers compile; nothing calls them until Task 9-10. If lint flags an unused function, proceed to Task 9 in the same uncommitted change — they're wired immediately — or temporarily wire the focusout handler from Task 10 first. Prefer committing Tasks 8-10 together if the linter rejects unused symbols.)

- [ ] **Step 6: Commit (with Tasks 9-10 if needed for unused-symbol lint)**

```bash
git add src/routes/log/+page.svelte
git commit -m "feat(log): grid save helpers (saveRow/saveSubShift/postAction)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Seed the grid from saved entries

**Files:**
- Modify: `src/routes/log/+page.svelte` (`<script>`: a `seedGrid()` + effects; the grid already lazy-mounts behind `gridReady` at lines 629-635)

**Interfaces:**
- Consumes: `data.entries`, `weekRowDates`, `inputByName`, `formatTime`, `data.timeFormat`, `subShifts`, `subMeta`, `rowMeta`, `recomputeWeekTotals` (existing); the leave-select state used by `leave-{i}` (existing — set it the same way the row's leave Select is driven).
- Produces: `seedGrid()` — populates the uncontrolled main-row inputs + sub-shift state from the week's entries and records each entry's id in `rowMeta`/`subMeta`.

- [ ] **Step 1: Implement `seedGrid()`**

```ts
  // Populate the (uncontrolled) main rows + (controlled) sub-shifts from saved
  // entries for the visible week, recording ids so blur-saves become updates.
  function seedGrid(): void {
    const byDate = new Map<string, TimeEntry[]>();
    for (const e of data.entries) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    const nextSub: SubShift[][] = Array.from({ length: 7 }, () => []);
    const nextSubMeta: RowSave[][] = Array.from({ length: 7 }, () => []);
    const nextRowMeta: RowSave[] = Array.from({ length: 7 }, emptyMeta);

    weekRowDates.forEach((date, i) => {
      const dayEntries = (byDate.get(date) ?? []).slice().sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
      const setVal = (name: string, v: string) => {
        const el = inputByName(name);
        if (el) el.value = v;
      };
      // Reset main-row inputs for this offset first.
      setVal(`start-${i}`, '');
      setVal(`end-${i}`, '');
      setVal(`hours-${i}`, '');
      setVal(`break-${i}`, '');
      setVal(`note-${i}`, '');

      const [main, ...extras] = dayEntries;
      if (main) {
        nextRowMeta[i] = { id: main.id, wasOpen: main.startTime !== null && main.endTime === null, save: 'saved', error: '' };
        if (main.entryKind !== 'work') {
          // Leave row — drive the leave Select state for this offset (mirror the
          // existing leave-select setter); do not fill clock/hours cells.
          setLeaveRow(i, main.entryKind);
        } else if (main.startTime) {
          setVal(`start-${i}`, formatTime(main.startTime, data.timeFormat));
          if (main.endTime) setVal(`end-${i}`, formatTime(main.endTime, data.timeFormat));
        } else {
          setVal(`hours-${i}`, String(main.hours));
        }
        if (main.breakHours > 0) setVal(`break-${i}`, String(main.breakHours));
        if (main.note) setVal(`note-${i}`, main.note);
      }
      extras.forEach((e) => {
        nextSub[i].push({
          start: e.startTime ? formatTime(e.startTime, data.timeFormat) : '',
          end: e.endTime ? formatTime(e.endTime, data.timeFormat) : '',
          hours: e.startTime ? '' : String(e.hours),
          brk: e.breakHours > 0 ? String(e.breakHours) : '',
          note: e.note ?? '',
        });
        nextSubMeta[i].push({ id: e.id, wasOpen: e.startTime !== null && e.endTime === null, save: 'saved', error: '' });
      });
    });

    subShifts = nextSub;
    subMeta = nextSubMeta;
    rowMeta = nextRowMeta;
    recomputeWeekTotals();
  }
```
`setLeaveRow(i, kind)` drives the same state the row's leave `Select` already writes: the `leaveRows` set (consulted by `recomputeWeekTotals` at line 699) plus the hidden `leave-{i}` input that `buildRow` reads. Set both (`leaveRows.add(i)` and `inputByName('leave-${i}').value = kind`, or call the existing leave-select change handler directly). If those writes aren't already centralized, add one small setter and route both seeding and the user's Select through it.

- [ ] **Step 2: Call `seedGrid` on mount and week change**

Replace the `weekStart` reset `$effect` (now in Task 8 Step 4) so that instead of blanking everything, it re-seeds:
```ts
  $effect(() => {
    void weekStart;
    void data.entries;
    if (gridReady) seedGrid();
  });
```
And in the `gridReady` effect (lines 629-635), call `seedGrid()` once `gridReady` flips true (after the `requestAnimationFrame`):
```ts
  $effect(() => {
    const id = requestAnimationFrame(() => {
      gridReady = true;
      seedGrid();
    });
    return () => cancelAnimationFrame(id);
  });
```
Note: seeding on `data.entries` change is what lets the trailing `invalidateAll` reflect new ids/totals without clobbering in-progress typing — because seeding only writes empty/derived values into cells the user has already committed (saved rows), and a row mid-edit has focus (its blur-save runs first). If clobbering-on-refresh shows up in testing, gate `seedGrid` to run only when `weekStart` changes (drop `void data.entries`) and accept a manual refresh lag; verify in Task 12.

- [ ] **Step 3: Check + lint**

Run: `bun run check && bun run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Manual verification**

`bun run dev`. Log a day via the edit dialog, then open the grid for that week — the day's cells are pre-filled and a second shift shows as a sub-row. Navigate weeks; cells reflect each week's saved entries.

- [ ] **Step 5: Commit**

```bash
git add src/routes/log/+page.svelte
git commit -m "feat(log): seed the weekly grid from saved entries

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Auto-save on blur + per-row indicator

**Files:**
- Modify: `src/routes/log/+page.svelte` — grid `<form>` handlers (lines 1166-1182), per-row markup (the Worked cell area + sub-shift rows), and a debounce map

**Interfaces:**
- Consumes: `saveRow`, `saveSubShift` (Task 8).
- Produces: `onGridFocusOut` handler + `scheduleRowSave(i)` / `scheduleSubSave(i, j)` debouncers; a small saved/saving/error indicator per row.

- [ ] **Step 1: Add per-(row) debounce + focusout handler**

```ts
  const rowSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  function scheduleRowSave(i: number): void {
    const key = `m${i}`;
    const t = rowSaveTimers.get(key);
    if (t) clearTimeout(t);
    rowSaveTimers.set(key, setTimeout(() => void saveRow(i), 500));
  }
  function scheduleSubSave(i: number, j: number): void {
    const key = `s${i}.${j}`;
    const t = rowSaveTimers.get(key);
    if (t) clearTimeout(t);
    rowSaveTimers.set(key, setTimeout(() => void saveSubShift(i, j), 500));
  }
  function onGridFocusOut(e: FocusEvent): void {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    const m = el.name.match(/^(?:start|end|hours|break|note)-(\d+)(?:-(\d+))?$/);
    if (!m) return;
    const i = Number(m[1]);
    if (m[2]) scheduleSubSave(i, Number(m[2]) - 1);
    else scheduleRowSave(i);
  }
```
(Sub-shift field names are `start-{i}-{j}` with `j >= 1`; `subShifts[i]` is 0-indexed, hence `Number(m[2]) - 1`.)

- [ ] **Step 2: Wire `onfocusout` on the grid form; drop the bulk submit enhance**

In the grid `<form>` tag (lines 1166-1182), remove `action="?/addWeek"` and the `use:enhance={conflictAwareEnhance({...})}`, and add `onfocusout`. The form no longer submits as a unit:
```svelte
<form
  bind:this={weekForm}
  onpaste={onGridPaste}
  onfocusin={onGridFocusIn}
  onfocusout={onGridFocusOut}
  oninput={recomputeWeekTotals}
  onkeydown={onGridKeydown}
  class="flex flex-col gap-3"
>
```
Leave-select change and sub-shift inputs need their own save triggers (they don't blur through `onfocusout` reliably as controlled components): in the leave `Select`'s onchange/handler, call `scheduleRowSave(i)`; on each sub-shift input add `onblur={() => scheduleSubSave(i, j)}` (or rely on `onfocusout` for the native inputs — verify in Task 12).

**Mobile is covered for free:** the grid is a single `<form>` whose `lg:contents` wrappers restyle the *same* `start-{i}` inputs into stacked day-cards below `lg`, so `onfocusout` fires there too — no separate mobile wiring.

**Behavior change — future-date confirm:** the removed `addWeek`/`conflictAwareEnhance` path prompted before saving a future-dated row (`needsFutureConfirm`). Auto-save drops that prompt: a future day in the visible week only persists if the user explicitly types into it, and the dashboard already ignores future entries (math filters `date <= asOf`; the window clamps to today). This is a deliberate simplification — surface it to the maintainer at review; if a guard is still wanted, have `saveRow`/`saveSubShift` skip rows whose `date > data.today` (today comes from a `data`/load value, not `Date.now()`).

- [ ] **Step 3: Per-row save indicator**

Next to each main row's Worked `<output>` (the cell at lines 1361-1382), render the row's save state:
```svelte
{#if rowMeta[i].save === 'saving'}
  <span class="text-xs text-muted-foreground" aria-live="polite">saving…</span>
{:else if rowMeta[i].save === 'saved'}
  <span class="text-xs text-success" aria-live="polite">✓ saved</span>
{:else if rowMeta[i].save === 'error'}
  <span class="text-xs text-destructive" title={rowMeta[i].error}>{rowMeta[i].error}</span>
{/if}
```

- [ ] **Step 4: Check + lint**

Run: `bun run check && bun run lint`
Expected: 0 errors, 0 warnings. Fix any now-unused symbols from Task 8 (they're all referenced now).

- [ ] **Step 5: Manual verification (dev + demo)**

`bun run dev`: type an arrival only → blur → row persists (reload shows it as **In progress** in the Ledger), hero stays On pace. Type the out → blur → completes, Worked fills, `✓ saved`. Edit a saved cell → updates in place (no conflict dialog). `PUBLIC_DEMO=1 bun run dev`: same against localStorage.

- [ ] **Step 6: Commit**

```bash
git add src/routes/log/+page.svelte
git commit -m "feat(log): auto-save each grid row on blur

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Remove `addWeek` and scope the conflict dialog to CSV

**Files:**
- Modify: `src/routes/log/+page.svelte` (remove the "Add week" button at lines 1560-1568; `conflictAwareEnhance` stays only for the CSV import form)
- Modify: `src/routes/log/+page.server.ts` (remove the `addWeek` action, lines 34-37)
- Modify: `src/lib/core/log.ts` (remove `addWeekAction` and its `'addWeek'` case in `runLogAction`)
- Test: `src/lib/core/log.test.ts` (no addWeek tests exist; nothing to delete)

**Interfaces:**
- Consumes: nothing new.
- Produces: `LogActionName` loses `'addWeek'`; `runLogAction`'s switch loses its `'addWeek'` case. `importCsv` keeps `conflictAwareEnhance`.

- [ ] **Step 1: Remove the "Add week" submit button**

Delete the `<Tooltip.Root>…Add week…</Tooltip.Root>` block (lines 1560-1568). If that leaves an empty footer container, remove the now-empty wrapper too.

- [ ] **Step 2: Remove `addWeekAction` from core**

In `src/lib/core/log.ts`: delete `addWeekAction` (lines 195-277), remove `'addWeek'` from the `LogActionName` union (line 358), and delete the `case 'addWeek':` arm in `runLogAction` (lines 369-370). Remove the now-unused `addDays` import if nothing else uses it (check: it's used in `addWeekAction` only — confirm with `grep -n addDays src/lib/core/log.ts`).

- [ ] **Step 3: Remove the server action**

In `src/routes/log/+page.server.ts`: delete the `addWeek` action (lines 34-37) and drop `addWeekAction` from the import list.

- [ ] **Step 4: Confirm CSV import still uses the conflict flow**

The import form keeps `use:enhance={conflictAwareEnhance(...)}`. Verify `conflictAwareEnhance` and the conflict dialog markup remain referenced (grep `conflictAwareEnhance` — should appear on the import form only now).

- [ ] **Step 5: Check, lint, full test run**

Run: `bun run check && bun run lint && bun run test`
Expected: 0/0; all suites green (no addWeek test references).

- [ ] **Step 6: Commit**

```bash
git add src/routes/log/+page.svelte src/routes/log/+page.server.ts src/lib/core/log.ts
git commit -m "feat(log): drop the addWeek bulk submit; grid auto-saves instead

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: End-to-end coverage (Playwright, dev + demo)

**Files:**
- Create or extend the project's Playwright suite (match the existing e2e location referenced by the Clock spec's "Playwright (dev + demo)"; if none exists in-repo, add `tests/e2e/log-daily.spec.ts` and a `bunx playwright` script).

**Interfaces:**
- Consumes: the running dev server (normal + `PUBLIC_DEMO=1`).

- [ ] **Step 1: Write the scenarios**

Cover, in demo mode (no DB needed):
1. Type an arrival only into today's grid row → blur → reload → the Ledger shows the day as **In progress**; the dashboard hero reads **On pace** (not Behind).
2. Add the clock-out → blur → Ledger row completes (`Worked 8.00h`), hero unchanged/On pace.
3. Edit a saved day's clock-out in the grid → updates in place, **no conflict dialog** appears.
4. Navigate to a prior week with saved entries → cells are pre-filled.
5. The "Add week" button is absent.

- [ ] **Step 2: Run e2e against dev and demo**

Run the suite against `bun run dev` and against `PUBLIC_DEMO=1 bun run dev`.
Expected: all scenarios pass.

- [ ] **Step 3: Commit**

```bash
git add tests/
git commit -m "test(log): e2e for day-by-day grid auto-save + open rows

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Finishing

After Task 12, with `bun run check`, `bun run lint`, and `bun run test` all green, use the **superpowers:finishing-a-development-branch** skill to choose how to integrate `feat/day-by-day-log` (merge / PR / cleanup). A CHANGELOG/version bump (the repo uses `chore(release): vX.Y.Z`) is the maintainer's call at integration time.
