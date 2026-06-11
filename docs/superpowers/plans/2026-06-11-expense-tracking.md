# Expense Tracking + Yearly Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an audit-logged expense tracker (rides first, extensible) as a new Expenses tab, a dashboard toggle that folds expenses into hours-to-make-up, and a yearly dollar goal setting that prorates a stretch target into every dashboard period.

**Architecture:** Expenses mirror time entries end-to-end: own Drizzle tables (`expenses`, `expense_events`), Zod schema, `Repo` methods (server + demo + empty implementations), core module with `{ ok, status, data }` actions, and a `/expenses` route loaded from the root layout (zero-network tab switching preserved). The dashboard converts included expense dollars and the goal stretch into hours owed at the straight hourly rate. Spec: `docs/superpowers/specs/2026-06-11-expense-tracking-design.md`.

**Tech Stack:** SvelteKit (Svelte 5 runes), Drizzle/libSQL, Zod, Tailwind v4 + shadcn-svelte, Vitest, Bun.

**Conventions that gate every commit:** `bun run check` and `bun run lint` must both report 0 errors and 0 warnings. No `as any` / `as unknown` / suppression comments. Commits are conventional with area scope and end with `Co-Authored-By: Claude <noreply@anthropic.com>`.

---

### Task 1: Expense kind taxonomy

**Files:**
- Create: `src/lib/expense-kinds.ts`

- [ ] **Step 1: Create the taxonomy module**

```typescript
/**
 * Catalog of expense kinds. Rides (Uber/Lyft) are the founding use case; the
 * taxonomy is the extension point — append a kind here and the schema enum,
 * form select, and badges pick it up (the DB column is plain text, so no
 * migration). Bonus tracking is deliberately deferred; when it lands it will
 * be income, not an expense kind.
 */

export const EXPENSE_KINDS = ['ride', 'other'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export type ExpenseMeta = {
  /** Label for menus, badges, and the audit log (e.g. "Ride"). */
  label: string;
  /** Tailwind classes for the kind badge (bg + text + ring). Amber is the
   * expense hue — unclaimed by the leave chips (emerald/rose/violet/sky)
   * and the audit log's indigo. */
  badgeClass: string;
};

export const EXPENSE_META: Record<ExpenseKind, ExpenseMeta> = {
  ride: { label: 'Ride', badgeClass: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300' },
  other: { label: 'Other', badgeClass: 'bg-zinc-500/15 text-zinc-700 ring-zinc-500/30 dark:text-zinc-300' },
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add src/lib/expense-kinds.ts
git commit -m "feat(expenses): expense kind taxonomy (ride, other)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Schema — expense tables, settings columns, migration, settings plumbing

The `Settings` type grows here, which type-couples every place that constructs a full settings row. They all land in this one task so the commit stays green.

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/core/repo.ts` (DEFAULT_SETTINGS)
- Modify: `src/lib/demo/sample.ts` (SAMPLE_SETTINGS)
- Modify: `src/lib/schemas/settings.ts` (settingsInput)
- Modify: `src/lib/core/settings-page.ts` (compute + save action)
- Modify: `src/lib/server/settings.ts` (updateSettings row mapping)
- Modify: `src/lib/demo/repo.ts` (updateSettings row mapping)
- Create (generated): `drizzle/0019_*.sql`

- [ ] **Step 1: Add the tables to `src/lib/db/schema.ts`**

Add the import at the top (alongside the ENTRY_KINDS import):

```typescript
import { EXPENSE_KINDS } from '$lib/expense-kinds';
```

Append after the `openShift` table at the end of the file:

```typescript
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
```

- [ ] **Step 2: Add the settings columns**

In the `settings` table definition, after the `otMultiplier` line:

```typescript
  /** Chase a yearly dollar target instead of straight salary math. */
  goalEnabled: integer('goal_enabled', { mode: 'boolean' }).notNull().default(false),
  yearlyGoal: real('yearly_goal').notNull().default(80000),
  /** Dashboard default for folding expenses into the make-whole math. */
  countExpenses: integer('count_expenses', { mode: 'boolean' }).notNull().default(true),
```

- [ ] **Step 3: Update DEFAULT_SETTINGS in `src/lib/core/repo.ts`**

After `otMultiplier: 1.5,` add:

```typescript
  goalEnabled: false,
  yearlyGoal: 80000,
  countExpenses: true,
```

- [ ] **Step 4: Update SAMPLE_SETTINGS in `src/lib/demo/sample.ts`**

After `otMultiplier: 1.5,` add:

```typescript
  goalEnabled: false,
  yearlyGoal: 80000,
  countExpenses: true,
```

- [ ] **Step 5: Extend `settingsInput` in `src/lib/schemas/settings.ts`**

After the `otMultiplier` field:

```typescript
  goalEnabled: z.boolean().default(false),
  yearlyGoal: z.coerce.number().min(0, 'Goal cannot be negative').max(10_000_000).default(80000),
  countExpenses: z.boolean().default(true),
```

- [ ] **Step 6: Extend `src/lib/core/settings-page.ts`**

In `computeSettingsPage`'s returned object, after `otMultiplier: row.otMultiplier,`:

```typescript
    goalEnabled: row.goalEnabled,
    yearlyGoal: row.yearlyGoal,
    countExpenses: row.countExpenses,
```

In `saveSettingsAction`'s `settingsInput.safeParse({ ... })`, after `otMultiplier: form.get('otMultiplier'),`:

```typescript
    goalEnabled: form.has('goalEnabled'),
    yearlyGoal: form.get('yearlyGoal'),
    countExpenses: form.has('countExpenses'),
```

- [ ] **Step 7: Extend `updateSettings` in `src/lib/server/settings.ts`**

In the `row` object, after `otMultiplier: input.otMultiplier,`:

```typescript
    goalEnabled: input.goalEnabled,
    yearlyGoal: input.yearlyGoal,
    countExpenses: input.countExpenses,
```

In the `onConflictDoUpdate` `set` object, after `otMultiplier: row.otMultiplier,`:

```typescript
        goalEnabled: row.goalEnabled,
        yearlyGoal: row.yearlyGoal,
        countExpenses: row.countExpenses,
```

- [ ] **Step 8: Extend the demo `updateSettings` in `src/lib/demo/repo.ts`**

In its `row: Settings` object, after `otMultiplier: input.otMultiplier,`:

```typescript
      goalEnabled: input.goalEnabled,
      yearlyGoal: input.yearlyGoal,
      countExpenses: input.countExpenses,
```

- [ ] **Step 9: Generate and apply the migration**

Run: `bun run db:generate`
Expected: a new `drizzle/0019_<name>.sql` containing `CREATE TABLE expenses`, `CREATE TABLE expense_events`, and three `ALTER TABLE settings ADD ...` statements.

Run: `bun run db:migrate`
Expected: exits 0; `./local.db` now has the new tables/columns.

- [ ] **Step 10: Verify everything is green**

Run: `bun run check && bun run lint && bun run test`
Expected: 0 errors/warnings; all existing tests pass (entries tests migrate the in-memory DB from `./drizzle`, so they pick up 0019 automatically).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(db): expenses + expense_events tables, goal/countExpenses settings

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: `goalRateOf` — the rate a yearly goal implies (TDD)

**Files:**
- Modify: `src/lib/timesheet.ts`
- Test: `src/lib/timesheet.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/timesheet.test.ts` (inside the top-level of the file, alongside the other `describe` blocks; add `goalRateOf` to the existing import from `./timesheet`):

```typescript
describe('goalRateOf', () => {
  const MON_FRI = [1, 2, 3, 4, 5];

  it("divides the goal by the year's actual expected hours", () => {
    // 2026: Jan 1 and Dec 31 are both Thursdays → 261 weekdays → 2088h at 8h/day.
    expect(goalRateOf(82_000, 2026, 8, MON_FRI)).toBeCloseTo(82_000 / 2088, 10);
  });

  it('reduces to the salary rate when the goal equals that salary', () => {
    expect(goalRateOf(40 * 2088, 2026, 8, MON_FRI)).toBeCloseTo(40, 10);
  });

  it('handles a leap year whose extra days fall on the weekend', () => {
    // 2028: Jan 1 Sat, Dec 31 Sun → exactly 260 weekdays → 2080h at 8h/day.
    expect(goalRateOf(83_200, 2028, 8, MON_FRI)).toBeCloseTo(40, 10);
  });

  it('returns 0 when no workdays are configured', () => {
    expect(goalRateOf(82_000, 2026, 8, [])).toBe(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run test src/lib/timesheet.test.ts`
Expected: FAIL — `goalRateOf` is not exported.

- [ ] **Step 3: Implement in `src/lib/timesheet.ts`**

Add after `expectedHours` (around line 85):

```typescript
/**
 * The hourly rate a yearly dollar goal implies, given that year's actual
 * workday count (260–262 for Mon–Fri years). The dashboard swaps this in for
 * `hourlyRate` when a goal is enabled, so every period's dollar target — and
 * the extra hours it implies — prorates toward the goal. Unrounded: this is
 * an intermediate rate, like the 38.4615 default.
 */
export function goalRateOf(yearlyGoal: number, year: number, dailyHours: number, workdays: number[]): number {
  const yearlyHours = countWorkdays(`${year}-01-01`, `${year}-12-31`, workdays) * dailyHours;
  return yearlyHours > 0 ? yearlyGoal / yearlyHours : 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/timesheet.test.ts`
Expected: PASS (all, including pre-existing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/timesheet.ts src/lib/timesheet.test.ts
git commit -m "feat(timesheet): goalRateOf — hourly rate a yearly goal implies

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Expense Zod schema (TDD)

**Files:**
- Create: `src/lib/schemas/expense.ts`
- Test: `src/lib/schemas/expense.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/schemas/expense.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { expenseInput } from './expense';

describe('expenseInput', () => {
  const valid = { date: '2026-06-11', amount: '18.50', kind: 'ride', note: 'Uber to the office' };

  it('parses a valid expense and coerces the amount', () => {
    const out = expenseInput.parse(valid);
    expect(out).toEqual({ date: '2026-06-11', amount: 18.5, kind: 'ride', note: 'Uber to the office' });
  });

  it('rejects a zero amount', () => {
    expect(expenseInput.safeParse({ ...valid, amount: '0' }).success).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(expenseInput.safeParse({ ...valid, amount: '-5' }).success).toBe(false);
  });

  it('rejects a malformed date', () => {
    expect(expenseInput.safeParse({ ...valid, date: '6/11/2026' }).success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(expenseInput.safeParse({ ...valid, kind: 'bonus' }).success).toBe(false);
  });

  it('normalizes a blank note to null', () => {
    expect(expenseInput.parse({ ...valid, note: '  ' }).note).toBeNull();
    expect(expenseInput.parse({ date: valid.date, amount: valid.amount, kind: valid.kind }).note).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/schemas/expense.test.ts`
Expected: FAIL — cannot resolve `./expense`.

- [ ] **Step 3: Create `src/lib/schemas/expense.ts`**

```typescript
import { z } from 'zod';
import { EXPENSE_KINDS, type ExpenseKind } from '$lib/expense-kinds';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Canonical persisted shape for one expense. */
export type ExpenseInput = {
  date: string;
  amount: number;
  kind: ExpenseKind;
  note: string | null;
};

export const expenseInput = z
  .object({
    date: z.string().regex(ISO_DATE, 'Date must be YYYY-MM-DD'),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than 0')
      .max(100_000, 'A single expense cannot exceed $100,000'),
    kind: z.enum(EXPENSE_KINDS),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null),
  })
  .transform((v): ExpenseInput => ({ date: v.date, amount: v.amount, kind: v.kind, note: v.note }));
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/schemas/expense.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/expense.ts src/lib/schemas/expense.test.ts
git commit -m "feat(expenses): expenseInput zod schema

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Server CRUD + audit events, Repo contract, all three Repo implementations (TDD)

The `Repo` type grows here, so the server, demo, and empty implementations must change in the same commit.

**Files:**
- Create: `src/lib/server/expenses.ts`
- Test: `src/lib/server/expenses.test.ts`
- Modify: `src/lib/core/repo.ts` (Repo type + emptyRepo)
- Modify: `src/lib/server/repo.ts`
- Modify: `src/lib/demo/repo.ts`

- [ ] **Step 1: Write the failing server tests**

Create `src/lib/server/expenses.test.ts`:

```typescript
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '$lib/db/schema';
import type { ExpenseInput } from '$lib/schemas/expense';
import { addExpense, deleteExpense, listExpenseEvents, listExpenses, updateExpense } from './expenses';

type Db = ReturnType<typeof drizzle<typeof schema>>;

function mk(partial: Partial<ExpenseInput> & { date: string; amount: number }): ExpenseInput {
  return { kind: 'ride', note: null, ...partial };
}

let db: Db;

beforeEach(async () => {
  db = drizzle(createClient({ url: ':memory:' }), { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
});

describe('expenses CRUD', () => {
  it('adds an expense and reads it back', async () => {
    const created = await addExpense(mk({ date: '2026-06-10', amount: 18.5, note: 'Uber in' }), db);
    expect(created.id).toBeTruthy();
    expect(created.updatedAt ?? null).toBeNull();

    const all = await listExpenses(db);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ date: '2026-06-10', amount: 18.5, kind: 'ride', note: 'Uber in' });
  });

  it('lists newest date first, same-day by creation order', async () => {
    await addExpense(mk({ date: '2026-06-01', amount: 10, note: 'first' }), db);
    await addExpense(mk({ date: '2026-06-10', amount: 20 }), db);
    await addExpense(mk({ date: '2026-06-01', amount: 30, note: 'second' }), db);

    const all = await listExpenses(db);
    expect(all.map((e) => e.amount)).toEqual([20, 10, 30]);
  });

  it('updates an expense and stamps updatedAt', async () => {
    const created = await addExpense(mk({ date: '2026-06-10', amount: 18.5 }), db);
    await updateExpense(created.id, mk({ date: '2026-06-11', amount: 22, kind: 'other', note: 'revised' }), db);

    const all = await listExpenses(db);
    expect(all[0]).toMatchObject({ date: '2026-06-11', amount: 22, kind: 'other', note: 'revised' });
    expect(all[0].updatedAt).not.toBeNull();
  });

  it('deletes an expense', async () => {
    const created = await addExpense(mk({ date: '2026-06-10', amount: 18.5 }), db);
    await deleteExpense(created.id, db);
    expect(await listExpenses(db)).toHaveLength(0);
  });

  it('audit log: add/edit/delete each record an event with a snapshot', async () => {
    const row = await addExpense(mk({ date: '2026-06-10', amount: 18.5 }), db);
    await updateExpense(row.id, mk({ date: '2026-06-10', amount: 22 }), db);
    await deleteExpense(row.id, db);

    const events = await listExpenseEvents(db);
    expect(events.map((e) => e.action).sort()).toEqual(['add', 'delete', 'edit']);
    expect(events.every((e) => e.expenseId === row.id)).toBe(true);
    const edited = events.find((e) => e.action === 'edit');
    expect(JSON.parse(edited?.snapshot ?? '{}')).toMatchObject({ amount: 22 });
    const deleted = events.find((e) => e.action === 'delete');
    expect(JSON.parse(deleted?.snapshot ?? '{}')).toMatchObject({ amount: 22, date: '2026-06-10' });
  });

  it('deleting a missing id records no event', async () => {
    await deleteExpense('nope', db);
    expect(await listExpenseEvents(db)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/server/expenses.test.ts`
Expected: FAIL — cannot resolve `./expenses`.

- [ ] **Step 3: Create `src/lib/server/expenses.ts`**

```typescript
import { asc, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db as defaultDb } from '$lib/db';
import { type Expense, type ExpenseEvent, expenseEvents, expenses } from '$lib/db/schema';
import type { ExpenseInput } from '$lib/schemas/expense';

// The `db` arg is injectable so unit tests pass an in-memory libSQL client.
type Database = typeof defaultDb;

/** Append an audit event: the row after an add/edit, or as it was at deletion. */
async function logEvent(database: Database, action: ExpenseEvent['action'], row: Expense): Promise<void> {
  await database.insert(expenseEvents).values({
    id: nanoid(),
    expenseId: row.id,
    action,
    at: Date.now(),
    snapshot: JSON.stringify(row),
  });
}

/** Audit log, newest first; capped like the entry events list. */
export async function listExpenseEvents(database: Database = defaultDb): Promise<ExpenseEvent[]> {
  return database.select().from(expenseEvents).orderBy(desc(expenseEvents.at)).limit(1000);
}

export function listExpenses(database: Database = defaultDb): Promise<Expense[]> {
  return database.select().from(expenses).orderBy(desc(expenses.date), asc(expenses.createdAt));
}

export async function addExpense(input: ExpenseInput, database: Database = defaultDb): Promise<Expense> {
  const [created] = await database
    .insert(expenses)
    .values({ id: nanoid(), date: input.date, amount: input.amount, kind: input.kind, note: input.note })
    .returning();
  await logEvent(database, 'add', created);
  return created;
}

export async function updateExpense(id: string, input: ExpenseInput, database: Database = defaultDb): Promise<void> {
  const [updated] = await database
    .update(expenses)
    .set({
      date: input.date,
      amount: input.amount,
      kind: input.kind,
      note: input.note,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(expenses.id, id))
    .returning();
  if (updated) await logEvent(database, 'edit', updated);
}

export async function deleteExpense(id: string, database: Database = defaultDb): Promise<void> {
  const [removed] = await database.delete(expenses).where(eq(expenses.id, id)).returning();
  if (removed) await logEvent(database, 'delete', removed);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/server/expenses.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Grow the `Repo` contract in `src/lib/core/repo.ts`**

Add to the imports:

```typescript
import type { EntryEvent, Expense, ExpenseEvent, OpenShift, Settings, TimeEntry } from '$lib/db/schema';
import type { ExpenseInput } from '$lib/schemas/expense';
```

(replacing the existing `$lib/db/schema` type import line). Add to the `Repo` type, after `listEntryEvents()`:

```typescript
  listExpenses(): Promise<Expense[]>;
  addExpense(input: ExpenseInput): Promise<Expense>;
  updateExpense(id: string, input: ExpenseInput): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  /** Audit log of expense mutations, newest first. */
  listExpenseEvents(): Promise<ExpenseEvent[]>;
```

Add to `emptyRepo`, after `listEntryEvents`:

```typescript
  listExpenses: async () => [],
  addExpense: async () => {
    throw new Error('emptyRepo is read-only');
  },
  updateExpense: async () => {},
  deleteExpense: async () => {},
  listExpenseEvents: async () => [],
```

- [ ] **Step 6: Wire `serverRepo` in `src/lib/server/repo.ts`**

Add the import and spread the new methods in:

```typescript
import { addExpense, deleteExpense, listExpenseEvents, listExpenses, updateExpense } from '$lib/server/expenses';
```

and in the `serverRepo` object, after `listEntryEvents,`:

```typescript
  listExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  listExpenseEvents,
```

- [ ] **Step 7: Implement the demo repo in `src/lib/demo/repo.ts`**

Update the type imports:

```typescript
import type { EntryEvent, Expense, ExpenseEvent, OpenShift, Settings, TimeEntry } from '$lib/db/schema';
import type { ExpenseInput } from '$lib/schemas/expense';
```

Add the two key names to BOTH buckets in `KEYS`:

```typescript
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
```

Make `sorted` generic so expenses reuse it — replace the existing function with:

```typescript
function sorted<T extends { date: string; createdAt: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1; // date desc
    return a.createdAt - b.createdAt; // createdAt asc
  });
}
```

Add the expense helpers (after `rowFromInput`):

```typescript
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

function expenseFromInput(input: ExpenseInput, id: string, createdAt: number, updatedAt: number | null = null): Expense {
  return { id, date: input.date, amount: input.amount, kind: input.kind, note: input.note, createdAt, updatedAt };
}
```

Add the methods to `demoRepo` (after `listEntryEvents`):

```typescript
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
```

- [ ] **Step 8: Verify everything is green**

Run: `bun run check && bun run lint && bun run test`
Expected: 0 errors/warnings; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(expenses): server CRUD with audit events; Repo contract across server/demo/empty

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Load expenses in the root layout

**Files:**
- Modify: `src/routes/+layout.server.ts`
- Modify: `src/routes/+layout.ts`

- [ ] **Step 1: Server layout load**

In `src/routes/+layout.server.ts`, replace the parallel load:

```typescript
  const [entries, expenses, settings, openShift] = await Promise.all([
    repo.listEntries(),
    repo.listExpenses(),
    repo.getSettings(),
    repo.getOpenShift(),
  ]);
  return { entries, expenses, settings, openShift };
```

(Still no `url`/`params`/`cookies` reads — tab switches stay network-free.)

- [ ] **Step 2: Demo layout load**

In `src/routes/+layout.ts`, replace the demo-branch parallel load:

```typescript
  const [entries, expenses, settings, openShift] = await Promise.all([
    demoRepo.listEntries(),
    demoRepo.listExpenses(),
    demoRepo.getSettings(),
    demoRepo.getOpenShift(),
  ]);
  // The layout load runs before every page compute, on server and client,
  // so todayISO() is already zone-correct downstream.
  setAppTimeZone(effectiveZone(settings.timeZone, settings.observeDst));
  return { entries, expenses, settings, openShift };
```

- [ ] **Step 3: Verify and commit**

Run: `bun run check && bun run lint`
Expected: 0 errors/warnings.

```bash
git add src/routes/+layout.server.ts src/routes/+layout.ts
git commit -m "feat(expenses): load expenses once in the root layout

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Core expenses module — compute + actions (TDD)

**Files:**
- Create: `src/lib/core/expenses.ts`
- Test: `src/lib/core/expenses.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/core/expenses.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { Expense } from '$lib/db/schema';
import { addExpenseAction, deleteExpenseAction, updateExpenseAction } from './expenses';
import { emptyRepo, type Repo } from './repo';

/** In-memory Repo stub: only the expense methods are live. */
function memRepo(): { repo: Repo; rows: Expense[] } {
  const rows: Expense[] = [];
  const repo: Repo = {
    ...emptyRepo,
    listExpenses: async () => rows,
    addExpense: async (input) => {
      const row: Expense = { id: `e${rows.length + 1}`, ...input, createdAt: 1, updatedAt: null };
      rows.push(row);
      return row;
    },
    updateExpense: async (id, input) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...input, updatedAt: 2 };
    },
    deleteExpense: async (id) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows.splice(idx, 1);
    },
  };
  return { repo, rows };
}

function fd(pairs: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(pairs)) form.set(k, v);
  return form;
}

describe('expense actions', () => {
  it('add: inserts a valid expense', async () => {
    const { repo, rows } = memRepo();
    const out = await addExpenseAction(repo, fd({ date: '2026-06-11', amount: '18.50', kind: 'ride', note: 'in' }));
    expect(out.ok).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: '2026-06-11', amount: 18.5, kind: 'ride', note: 'in' });
  });

  it('add: surfaces validation errors without writing', async () => {
    const { repo, rows } = memRepo();
    const out = await addExpenseAction(repo, fd({ date: '2026-06-11', amount: '0', kind: 'ride' }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
    expect(String(out.data.expenseError)).toContain('greater than 0');
    expect(rows).toHaveLength(0);
  });

  it('update: edits in place', async () => {
    const { repo, rows } = memRepo();
    await addExpenseAction(repo, fd({ date: '2026-06-11', amount: '18.50', kind: 'ride' }));
    const out = await updateExpenseAction(repo, fd({ id: 'e1', date: '2026-06-12', amount: '22', kind: 'other' }));
    expect(out.ok).toBe(true);
    expect(rows[0]).toMatchObject({ date: '2026-06-12', amount: 22, kind: 'other' });
  });

  it('update/delete: reject a missing id', async () => {
    const { repo } = memRepo();
    const up = await updateExpenseAction(repo, fd({ date: '2026-06-12', amount: '22', kind: 'ride' }));
    expect(up.ok).toBe(false);
    const del = await deleteExpenseAction(repo, fd({}));
    expect(del.ok).toBe(false);
  });

  it('delete: removes the row', async () => {
    const { repo, rows } = memRepo();
    await addExpenseAction(repo, fd({ date: '2026-06-11', amount: '18.50', kind: 'ride' }));
    const out = await deleteExpenseAction(repo, fd({ id: 'e1' }));
    expect(out.ok).toBe(true);
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/core/expenses.test.ts`
Expected: FAIL — cannot resolve `./expenses`.

- [ ] **Step 3: Create `src/lib/core/expenses.ts`**

```typescript
/**
 * The Expenses page's load and form-action logic, Repo-agnostic like log.ts:
 * the server route wraps failures in fail(), demo mode uses outcomes directly.
 */

import type { z } from 'zod';
import type { Expense, Settings } from '$lib/db/schema';
import { expenseInput } from '$lib/schemas/expense';
import type { ActionOutcome } from './log';
import type { Repo } from './repo';

export function computeExpenses(expenses: Expense[], row: Settings) {
  return {
    expenses,
    epoch: row.epoch,
    weekStartsOn: row.weekStartsOn,
    ledgerPeriod: row.ledgerPeriod,
  };
}

function flattenError(parsed: z.ZodError): string {
  return parsed.issues.map((i) => i.message).join('; ');
}

function parseExpense(form: FormData) {
  return expenseInput.safeParse({
    date: form.get('date'),
    amount: form.get('amount'),
    kind: form.get('kind'),
    note: form.get('note') ?? undefined,
  });
}

export async function addExpenseAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const parsed = parseExpense(form);
  if (!parsed.success) return { ok: false, status: 400, data: { expenseError: flattenError(parsed.error) } };
  await repo.addExpense(parsed.data);
  return { ok: true, data: { expenseAdded: true } };
}

export async function updateExpenseAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const id = String(form.get('id') ?? '');
  if (!id) return { ok: false, status: 400, data: { expenseError: 'Missing expense id' } };
  const parsed = parseExpense(form);
  if (!parsed.success) return { ok: false, status: 400, data: { expenseError: flattenError(parsed.error) } };
  await repo.updateExpense(id, parsed.data);
  return { ok: true, data: { expenseUpdated: true } };
}

export async function deleteExpenseAction(repo: Repo, form: FormData): Promise<ActionOutcome> {
  const id = String(form.get('id') ?? '');
  if (!id) return { ok: false, status: 400, data: { expenseError: 'Missing expense id' } };
  await repo.deleteExpense(id);
  return { ok: true, data: { expenseDeleted: true } };
}

export type ExpenseActionName = 'add' | 'update' | 'delete';

/** Dispatch by SvelteKit action name ("?/add" → add). Demo mode's client router. */
export function runExpenseAction(repo: Repo, action: ExpenseActionName, form: FormData): Promise<ActionOutcome> {
  switch (action) {
    case 'add':
      return addExpenseAction(repo, form);
    case 'update':
      return updateExpenseAction(repo, form);
    case 'delete':
      return deleteExpenseAction(repo, form);
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/core/expenses.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/expenses.ts src/lib/core/expenses.test.ts
git commit -m "feat(expenses): core compute + add/update/delete actions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: The /expenses route

**Files:**
- Create: `src/routes/expenses/+page.ts`
- Create: `src/routes/expenses/+page.server.ts`
- Create: `src/routes/expenses/+page.svelte`

- [ ] **Step 1: Create `src/routes/expenses/+page.ts`**

```typescript
import { computeExpenses } from '$lib/core/expenses';
import type { PageLoad } from './$types';

// Pure view computation over the layout-loaded data — switching to this tab
// never fetches from the server.
export const load: PageLoad = async ({ parent }) => {
  const { expenses, settings } = await parent();
  return computeExpenses(expenses, settings);
};
```

- [ ] **Step 2: Create `src/routes/expenses/+page.server.ts`**

```typescript
import { fail } from '@sveltejs/kit';
import { addExpenseAction, deleteExpenseAction, updateExpenseAction } from '$lib/core/expenses';
import { isDemo } from '$lib/demo/flag';
import { serverRepo } from '$lib/server/repo';
import type { Actions } from './$types';

type Outcome = Awaited<ReturnType<typeof addExpenseAction>>;
function unwrap(out: Outcome) {
  return out.ok ? out.data : fail(out.status, out.data);
}

export const actions: Actions = {
  add: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await addExpenseAction(serverRepo, await request.formData()));
  },
  update: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await updateExpenseAction(serverRepo, await request.formData()));
  },
  delete: async ({ request }) => {
    if (isDemo) return fail(400, { error: 'Demo mode handles this in the browser' });
    return unwrap(await deleteExpenseAction(serverRepo, await request.formData()));
  },
};
```

- [ ] **Step 3: Create `src/routes/expenses/+page.svelte`**

```svelte
<script lang="ts">
  import CalendarCheck from '@lucide/svelte/icons/calendar-check';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import DateField from '$lib/components/DateField.svelte';
  import DateJump from '$lib/components/DateJump.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { type ExpenseActionName, runExpenseAction } from '$lib/core/expenses';
  import { formatDay, formatRangeISO, formatWeekRange, todayISO } from '$lib/date';
  import type { Expense } from '$lib/db/schema';
  import { isDemo } from '$lib/demo/flag';
  import { EXPENSE_KINDS, EXPENSE_META } from '$lib/expense-kinds';
  import type { LedgerPeriod } from '$lib/schemas/settings';
  import { addDays, weekDates } from '$lib/timesheet';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Demo mode intercepts mutations client-side; results stand in for `form`.
  let demoForm = $state<ActionData>(null);
  const actionData = $derived(isDemo ? demoForm : form);

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  // ── Period nav (same bucket math as the dashboard) ───────────────────────
  const PERIOD_LABELS: Record<LedgerPeriod, string> = {
    week: 'Weekly',
    biweek: 'Bi-weekly',
    month: 'Monthly',
    quarter: 'Quarterly',
    year: 'Yearly',
  };
  // Initial-only read; the selector mutates independently after first render.
  // svelte-ignore state_referenced_locally
  let period = $state<LedgerPeriod>(data.ledgerPeriod);
  let anchor = $state(todayISO());

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function shiftMonth(a: string, n: number): string {
    const [y, m] = a.slice(0, 7).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
  }
  function lastDayOf(yearMonth01: string): string {
    const [y, m] = yearMonth01.slice(0, 7).split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  }

  const bucket = $derived.by(() => {
    const wsOn = data.weekStartsOn;
    switch (period) {
      case 'week': {
        const start = weekDates(anchor, wsOn)[0];
        return { start, end: addDays(start, 6), label: formatWeekRange(start, true) };
      }
      case 'biweek': {
        const wk = weekDates(anchor, wsOn)[0];
        const start = addDays(wk, -7);
        const end = addDays(wk, 6);
        return { start, end, label: formatRangeISO(start, end, true) };
      }
      case 'month': {
        const start = `${anchor.slice(0, 7)}-01`;
        return {
          start,
          end: lastDayOf(start),
          label: `${MONTHS[Number(anchor.slice(5, 7)) - 1]} ${Number(anchor.slice(0, 4))}`,
        };
      }
      case 'quarter': {
        const y = Number(anchor.slice(0, 4));
        const m = Number(anchor.slice(5, 7));
        const qm = Math.floor((m - 1) / 3) * 3 + 1;
        const start = `${y}-${String(qm).padStart(2, '0')}-01`;
        return {
          start,
          end: lastDayOf(`${y}-${String(qm + 2).padStart(2, '0')}-01`),
          label: `Q${Math.floor((m - 1) / 3) + 1} ${y}`,
        };
      }
      case 'year': {
        const y = Number(anchor.slice(0, 4));
        return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
      }
    }
  });

  function shiftPage(dir: -1 | 1) {
    switch (period) {
      case 'week':
        anchor = addDays(anchor, 7 * dir);
        return;
      case 'biweek':
        anchor = addDays(anchor, 14 * dir);
        return;
      case 'month':
        anchor = shiftMonth(anchor, dir);
        return;
      case 'quarter':
        anchor = shiftMonth(anchor, 3 * dir);
        return;
      case 'year':
        anchor = shiftMonth(anchor, 12 * dir);
        return;
    }
  }

  const inBucket = $derived(data.expenses.filter((e) => e.date >= bucket.start && e.date <= bucket.end));
  const total = $derived(Math.round(inBucket.reduce((s, e) => s + e.amount, 0) * 100) / 100);

  // ── Forms ────────────────────────────────────────────────────────────────
  let addDate = $state(todayISO());
  let editing = $state<Expense | null>(null);
  let deleting = $state<Expense | null>(null);
  let submitting = $state(false);

  // Shared enhance: demo cancels the POST and runs the core action against
  // localStorage; normal mode submits and invalidateAll() refreshes the layout.
  function expenseEnhance(action: ExpenseActionName, after?: () => void): SubmitFunction {
    return ({ formData, cancel }) => {
      submitting = true;
      if (isDemo) {
        cancel();
        void (async () => {
          const { demoRepo } = await import('$lib/demo/repo');
          const out = await runExpenseAction(demoRepo, action, formData);
          demoForm = out.data as ActionData;
          if (out.ok) after?.();
          await invalidate('demo:data');
          submitting = false;
        })();
        return;
      }
      return async ({ result, update }) => {
        await update();
        if (result.type === 'success') after?.();
        submitting = false;
      };
    };
  }
</script>

<div class="flex flex-col gap-8">
  <div class="max-md:text-center">
    <h1 class="text-2xl font-semibold tracking-tight">Expenses</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Work-related costs — rides to and from shifts, for now. The dashboard can fold these into the hours to make up.
    </p>
  </div>

  <!-- add form -->
  <Card.Root>
    <Card.Header class="max-md:text-center">
      <Card.Title>Add an expense</Card.Title>
    </Card.Header>
    <Card.Content>
      <form
        method="POST"
        action="?/add"
        use:enhance={expenseEnhance('add', () => (addDate = todayISO()))}
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[10rem_8rem_8rem_1fr_auto] lg:items-end"
      >
        <div class="flex flex-col gap-1.5">
          <Label for="expense-date">Date</Label>
          <DateField id="expense-date" name="date" bind:value={addDate} min={data.epoch} />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="expense-kind">Kind</Label>
          <select
            id="expense-kind"
            name="kind"
            class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {#each EXPENSE_KINDS as kind (kind)}
              <option value={kind}>{EXPENSE_META[kind].label}</option>
            {/each}
          </select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="expense-amount">Amount (USD)</Label>
          <Input id="expense-amount" type="number" name="amount" step="0.01" min="0.01" placeholder="18.50" required />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="expense-note">Note</Label>
          <Input id="expense-note" type="text" name="note" maxlength={500} placeholder="Uber to the office" />
        </div>
        <Button type="submit" disabled={submitting} class="max-sm:w-full">
          <Plus class="size-4" /> Add
        </Button>
      </form>
      {#if actionData && 'expenseError' in actionData && actionData.expenseError}
        <p class="mt-3 text-sm text-destructive">{actionData.expenseError}</p>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- period nav -->
  <div class="flex flex-wrap items-center gap-2 rounded-lg border border-input bg-card p-2">
    <select
      aria-label="Period"
      value={period}
      onchange={(e) => {
        period = e.currentTarget.value as LedgerPeriod;
      }}
      class="h-9 shrink-0 basis-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:basis-auto"
    >
      {#each Object.entries(PERIOD_LABELS) as [v, label] (v)}
        <option value={v}>{label}</option>
      {/each}
    </select>
    <Button
      variant="outline"
      size="icon-lg"
      class="shrink-0"
      title="Previous period"
      aria-label="Previous period"
      disabled={bucket.start <= data.epoch}
      onclick={() => shiftPage(-1)}
    >
      <ChevronLeft class="size-4" />
    </Button>
    <span class="flex-1 text-center font-mono text-sm font-medium uppercase tabular-nums">{bucket.label}</span>
    <Button
      variant="outline"
      size="icon-lg"
      class="shrink-0"
      title="Next period"
      aria-label="Next period"
      onclick={() => shiftPage(1)}
    >
      <ChevronRight class="size-4" />
    </Button>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline" size="lg" class="shrink-0" onclick={() => (anchor = todayISO())}>
            <CalendarCheck class="size-4" /> Today
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>Jump back to the current period</Tooltip.Content>
    </Tooltip.Root>
    <DateJump value={anchor} min={data.epoch} label="Jump to date" onpick={(iso) => (anchor = iso < data.epoch ? data.epoch : iso)} />
  </div>

  <!-- list -->
  <Card.Root>
    <Card.Header class="flex flex-row items-center justify-between">
      <Card.Title>{bucket.label}</Card.Title>
      <span class="font-mono text-sm font-semibold tabular-nums" title="Period total">{money.format(total)}</span>
    </Card.Header>
    <Card.Content>
      {#if inBucket.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">No expenses this period.</p>
      {:else}
        <ul class="divide-y divide-border/50">
          {#each inBucket as e (e.id)}
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm">
              <span class="w-14 font-mono text-xs uppercase tabular-nums">{formatDay(e.date)}</span>
              <span class="rounded px-1.5 py-0.5 text-xs font-medium ring-1 {EXPENSE_META[e.kind].badgeClass}">
                {EXPENSE_META[e.kind].label}
              </span>
              {#if e.note}<span class="max-w-56 truncate text-xs text-muted-foreground">{e.note}</span>{/if}
              <span class="ml-auto font-mono tabular-nums">{money.format(e.amount)}</span>
              <span class="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Edit expense"
                  aria-label="Edit expense"
                  onclick={() => (editing = e)}
                >
                  <Pencil class="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete expense"
                  aria-label="Delete expense"
                  class="text-destructive hover:text-destructive"
                  onclick={() => (deleting = e)}
                >
                  <Trash2 class="size-4" />
                </Button>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </Card.Content>
  </Card.Root>

  <p class="text-center text-xs text-muted-foreground">
    Every add, edit, and delete here lands in the
    <a href="/settings/audit" class="underline underline-offset-2 hover:text-foreground">audit log</a>. Bonus tracking
    is planned.
  </p>
</div>

<!-- edit dialog -->
<Dialog.Root
  open={editing !== null}
  onOpenChange={(o) => {
    if (!o) editing = null;
  }}
>
  <Dialog.Content class="sm:max-w-md">
    {#if editing}
      <Dialog.Header>
        <Dialog.Title>Edit expense</Dialog.Title>
      </Dialog.Header>
      <form
        method="POST"
        action="?/update"
        use:enhance={expenseEnhance('update', () => (editing = null))}
        class="flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={editing.id} />
        <div class="flex flex-col gap-1.5">
          <Label for="edit-expense-date">Date</Label>
          <DateField id="edit-expense-date" name="date" value={editing.date} min={data.epoch} />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="edit-expense-kind">Kind</Label>
          <select
            id="edit-expense-kind"
            name="kind"
            class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {#each EXPENSE_KINDS as kind (kind)}
              <option value={kind} selected={editing.kind === kind}>{EXPENSE_META[kind].label}</option>
            {/each}
          </select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="edit-expense-amount">Amount (USD)</Label>
          <Input
            id="edit-expense-amount"
            type="number"
            name="amount"
            step="0.01"
            min="0.01"
            value={editing.amount}
            required
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="edit-expense-note">Note</Label>
          <Input id="edit-expense-note" type="text" name="note" maxlength={500} value={editing.note ?? ''} />
        </div>
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (editing = null)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>Save</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- delete confirm -->
<Dialog.Root
  open={deleting !== null}
  onOpenChange={(o) => {
    if (!o) deleting = null;
  }}
>
  <Dialog.Content class="sm:max-w-md">
    {#if deleting}
      <Dialog.Header>
        <Dialog.Title>Delete this expense?</Dialog.Title>
        <Dialog.Description>
          {formatDay(deleting.date)} · {EXPENSE_META[deleting.kind].label} · {money.format(deleting.amount)}
          {#if deleting.note}
            · {deleting.note}
          {/if}
        </Dialog.Description>
      </Dialog.Header>
      <form method="POST" action="?/delete" use:enhance={expenseEnhance('delete', () => (deleting = null))}>
        <input type="hidden" name="id" value={deleting.id} />
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (deleting = null)}>Cancel</Button>
          <Button type="submit" variant="destructive" disabled={submitting}>Delete</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>
```

- [ ] **Step 4: Verify**

Run: `bun run check && bun run lint`
Expected: 0 errors/warnings. If `size="icon-lg"` or the `Tooltip.Trigger` snippet API errors, copy the exact working usage from `src/routes/+page.svelte` (dashboard period nav) — it is the reference for this bar.

- [ ] **Step 5: Commit**

```bash
git add src/routes/expenses
git commit -m "feat(expenses): /expenses page — add form, period-paginated list, edit/delete dialogs

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Nav — Expenses as the 4th tab

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Add the link**

Add the icon import (alphabetical with the others):

```typescript
  import Receipt from '@lucide/svelte/icons/receipt';
```

In the `links` array, insert between Log and Settings:

```typescript
    { href: '/expenses', label: 'Expenses', icon: Receipt },
```

- [ ] **Step 2: Widen the bottom tab bar**

In the mobile tab bar `<div class="grid grid-cols-4">`, change to:

```svelte
    <div class="grid grid-cols-5">
```

(The desktop header and hamburger menu iterate `links`, so they pick the tab up automatically.)

- [ ] **Step 3: Verify and commit**

Run: `bun run check && bun run lint`
Expected: 0 errors/warnings.

```bash
git add src/routes/+layout.svelte
git commit -m "feat(nav): Expenses tab in header, tab bar, and hamburger menu

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Settings — Dashboard card (goal + count-expenses)

**Files:**
- Modify: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Add local state mirrors**

After the `otMultiplierValue` declarations (~line 45), add:

```typescript
  // svelte-ignore state_referenced_locally
  let goalEnabled = $state(data.goalEnabled);
  // svelte-ignore state_referenced_locally
  let yearlyGoalValue = $state(data.yearlyGoal);
```

- [ ] **Step 2: Wire reset-to-defaults**

In `resetToDefaults`, add `['countExpenses', DEFAULT_SETTINGS.countExpenses],` to the `flags` array, and after `otMultiplierValue = DEFAULT_SETTINGS.otMultiplier;` add:

```typescript
    goalEnabled = DEFAULT_SETTINGS.goalEnabled;
    yearlyGoalValue = DEFAULT_SETTINGS.yearlyGoal;
```

- [ ] **Step 3: Add the Dashboard card**

After the closing `</Card.Root>` of the "Log & Ledger" card (before the grid's closing `</div>`), add:

```svelte
      <Card.Root>
        <Card.Header class="max-md:text-center">
          <Card.Title>Dashboard</Card.Title>
        </Card.Header>
        <Card.Content class="flex flex-col divide-y divide-border/50">
          <section class="flex flex-col gap-3 pb-5">
            <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">Goal</h3>
            <div class="rounded-md border border-input text-sm transition-colors has-checked:border-primary has-checked:bg-accent">
              <label class="flex cursor-pointer items-start gap-2 px-3 py-2">
                <input type="checkbox" name="goalEnabled" bind:checked={goalEnabled} class="mt-0.5 accent-primary" />
                <span>
                  <span class="font-medium">Chase a yearly goal</span>
                  <span class="block text-xs text-muted-foreground">
                    Target take-home for the year — e.g. stretching for $82k on an $80k salary via overtime. Off keeps
                    the target at straight salary math.
                  </span>
                </span>
              </label>
              <!-- Disabled while toggled off so it's fully inert; a disabled input
                   doesn't submit, so a hidden input carries the bound value and a
                   custom goal isn't silently reset on save. -->
              <div
                class="flex items-center justify-between gap-3 border-t border-border/50 px-3 py-2 transition-opacity {goalEnabled
                  ? ''
                  : 'opacity-50'}"
              >
                <Label for="yearlyGoal">Yearly goal (USD)</Label>
                {#if !goalEnabled}
                  <input type="hidden" name="yearlyGoal" value={yearlyGoalValue} />
                {/if}
                <div class="relative w-32 shrink-0">
                  <span
                    aria-hidden="true"
                    class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
                  >
                    $
                  </span>
                  <Input
                    id="yearlyGoal"
                    type="number"
                    name="yearlyGoal"
                    step="500"
                    min="0"
                    max="10000000"
                    bind:value={yearlyGoalValue}
                    required
                    disabled={!goalEnabled}
                    class="pl-7 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
          </section>

          <section class="flex flex-col gap-3 pt-5">
            <h3 class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-md:text-center">
              Expenses
            </h3>
            <label
              class="flex cursor-pointer items-start gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-accent"
            >
              <input type="checkbox" name="countExpenses" checked={data.countExpenses} class="mt-0.5 accent-primary" />
              <span>
                <span class="font-medium">Count expenses by default</span>
                <span class="block text-xs text-muted-foreground">
                  The dashboard opens with logged expenses folded into the hours to make up. Its per-period toggle
                  still flips it per visit.
                </span>
              </span>
            </label>
            <p class="text-xs text-muted-foreground">Bonus tracking is planned and will live here.</p>
          </section>
        </Card.Content>
      </Card.Root>
```

- [ ] **Step 4: Verify and commit**

Run: `bun run check && bun run lint`
Expected: 0 errors/warnings.

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat(settings): Dashboard card — yearly goal + count-expenses default

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Dashboard — goal-rate target, expense toggle, money-driven hours

**Files:**
- Modify: `src/lib/core/dashboard.ts`
- Modify: `src/routes/+page.ts`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Thread expenses + new settings through `computeDashboard`**

In `src/lib/core/dashboard.ts`, change the import and signature:

```typescript
import type { Expense, Settings, TimeEntry } from '$lib/db/schema';
```

```typescript
export function computeDashboard(
  entries: TimeEntry[],
  expenses: Expense[],
  settingsRow: Settings,
  requested: string | null,
) {
```

and add to the returned object (after `otMultiplier: settingsRow.otMultiplier,`):

```typescript
    goalEnabled: settingsRow.goalEnabled,
    yearlyGoal: settingsRow.yearlyGoal,
    countExpenses: settingsRow.countExpenses,
    expenses,
```

- [ ] **Step 2: Pass expenses in `src/routes/+page.ts`**

```typescript
export const load: PageLoad = async ({ parent, url }) => {
  const { entries, expenses, settings } = await parent();
  return computeDashboard(entries, expenses, settings, url.searchParams.get('asOf'));
};
```

- [ ] **Step 3: Money-driven hours math in `src/routes/+page.svelte`**

Add `goalRateOf` to the `$lib/timesheet` import:

```typescript
  import { addDays, countWorkdays, goalRateOf, loggedHours, overtimeHours, weekDates } from '$lib/timesheet';
```

Replace this block:

```typescript
  const logged = $derived(loggedHours(inRange));
  const net = $derived(Math.round((logged - expectedHours) * 100) / 100);

  const expectedDollars = $derived(expectedHours * data.hourlyRate);
```

with:

```typescript
  const logged = $derived(loggedHours(inRange));

  // ── Goal + expenses fold into the target ─────────────────────────────────
  // Whether expenses in the window count toward the make-whole math. Starts
  // from the setting; flipping the hero toggle is per-visit only.
  // svelte-ignore state_referenced_locally
  let includeExpenses = $state(data.countExpenses);
  const expensesInRange = $derived(
    window ? data.expenses.filter((e) => e.date >= window.start && e.date <= window.end) : [],
  );
  const expensesTotal = $derived(Math.round(expensesInRange.reduce((s, e) => s + e.amount, 0) * 100) / 100);
  const includedExpenses = $derived(includeExpenses ? expensesTotal : 0);

  // A yearly goal swaps the salary rate for the rate the goal implies given
  // the bucket's year, so every period's dollar target prorates the stretch.
  const targetRate = $derived(
    data.goalEnabled
      ? goalRateOf(data.yearlyGoal, Number(bucket.start.slice(0, 4)), data.dailyHours, data.workdays)
      : data.hourlyRate,
  );
  const expectedDollars = $derived(expectedHours * targetRate + includedExpenses);

  // Hours owed are money-driven: the goal stretch and included expenses both
  // convert to hours at the straight rate. With goal off and no expenses this
  // reduces exactly to the schedule's expected hours.
  const targetHours = $derived(
    data.hourlyRate > 0 ? Math.round((expectedDollars / data.hourlyRate) * 100) / 100 : expectedHours,
  );
  const net = $derived(Math.round((logged - targetHours) * 100) / 100);
```

- [ ] **Step 4: Show the effective target everywhere hours display**

In the same file, replace every *display* use of `expectedHours` with `targetHours` (the `expectedDollars` derivation above is the only place `expectedHours` should remain, besides its own definition):

- `subtitle`: all four `hrs(expectedHours)` occurrences → `hrs(targetHours)`.
- `stats`: `{ label: 'Expected', value: hrs(expectedHours) }` → `{ label: 'Expected', value: hrs(targetHours) }`.

- [ ] **Step 5: Add the include-expenses toggle to the hero**

In the hero's right-hand block, after the `vs. target` paragraph (`</p>` that closes the `vs. {money.format(expectedDollars)} …` text), add:

```svelte
        {#if expensesTotal > 0}
          <label
            class="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-2.5 py-1.5 text-xs transition-colors has-checked:border-amber-500/60 has-checked:bg-amber-500/10"
          >
            <input type="checkbox" bind:checked={includeExpenses} class="accent-amber-500" />
            <span>Include {money.format(expensesTotal)} expenses</span>
          </label>
        {/if}
```

- [ ] **Step 6: Verify the reduction by hand**

Run: `bun run check && bun run lint && bun run test`
Expected: all green. Then `bun run dev` and confirm in the browser:
- With goal off and no expenses, the dashboard shows the same numbers as before the change (compare against `git stash` if unsure).
- Add an expense dated inside the current bi-week on /expenses → a toggle appears in the hero; flipping it moves Net by `amount ÷ hourlyRate` and the dollar target by `amount`.
- Enable the goal at $82,000 in Settings → Expected (hours and dollars) rises ~2.5% across periods.

- [ ] **Step 7: Commit**

```bash
git add src/lib/core/dashboard.ts src/routes/+page.ts src/routes/+page.svelte
git commit -m "feat(dashboard): yearly-goal target rate + include-expenses toggle

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Audit log — merged entry + expense timeline

**Files:**
- Modify: `src/routes/settings/audit/+page.server.ts`
- Modify: `src/routes/settings/audit/+page.ts`
- Modify: `src/routes/settings/audit/+page.svelte`

- [ ] **Step 1: Server load returns both streams**

Replace `src/routes/settings/audit/+page.server.ts`'s load:

```typescript
export const load: PageServerLoad = async () => {
  const repo = isDemo ? emptyRepo : serverRepo;
  const [events, expenseEvents] = await Promise.all([repo.listEntryEvents(), repo.listExpenseEvents()]);
  return { events, expenseEvents };
};
```

- [ ] **Step 2: Page load mirrors it (demo branch included)**

Replace `src/routes/settings/audit/+page.ts`'s load body:

```typescript
export const load: PageLoad = async ({ data, parent, depends }) => {
  const { settings } = await parent();
  if (!isDemo) return { events: data.events, expenseEvents: data.expenseEvents, timeFormat: settings.timeFormat };
  depends('demo:data');
  if (!browser) return { events: data.events, expenseEvents: data.expenseEvents, timeFormat: settings.timeFormat };
  const { demoRepo } = await import('$lib/demo/repo');
  const [events, expenseEvents] = await Promise.all([demoRepo.listEntryEvents(), demoRepo.listExpenseEvents()]);
  return { events, expenseEvents, timeFormat: settings.timeFormat };
};
```

- [ ] **Step 3: Merge in the page**

In `src/routes/settings/audit/+page.svelte`, update the script:

```typescript
  import type { EntryEvent, Expense, ExpenseEvent, TimeEntry } from '$lib/db/schema';
  import { EXPENSE_META } from '$lib/expense-kinds';
```

(extend the existing imports), then after `summary(...)` add:

```typescript
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  // One timeline: entry and expense events interleaved by timestamp.
  type AuditItem = {
    id: string;
    action: EntryEvent['action'];
    at: number;
    source: 'Entry' | 'Expense';
    date: string | null;
    detail: string;
    note: string | null;
  };

  function entryItem(e: EntryEvent): AuditItem {
    const s = snapshotOf(e);
    return { id: e.id, action: e.action, at: e.at, source: 'Entry', date: s?.date ?? null, detail: summary(s), note: s?.note ?? null };
  }

  function expenseSnapshotOf(e: ExpenseEvent): Expense | null {
    try {
      return JSON.parse(e.snapshot) as Expense;
    } catch {
      return null;
    }
  }

  function expenseItem(e: ExpenseEvent): AuditItem {
    const s = expenseSnapshotOf(e);
    return {
      id: e.id,
      action: e.action,
      at: e.at,
      source: 'Expense',
      date: s?.date ?? null,
      detail: s ? `${EXPENSE_META[s.kind].label} · ${money.format(s.amount)}` : '—',
      note: s?.note ?? null,
    };
  }

  const items = $derived(
    [...data.events.map(entryItem), ...data.expenseEvents.map(expenseItem)].sort((a, b) => b.at - a.at),
  );
```

Replace the template's `{#if data.events.length === 0}` block with one driven by `items`:

```svelte
      {#if items.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">
          Nothing logged yet — events appear as entries and expenses are added, edited, or deleted.
        </p>
      {:else}
        <ul class="divide-y divide-border/50">
          {#each items as item (item.id)}
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span class="w-16 rounded px-1.5 py-0.5 text-center text-xs font-medium {ACTION_META[item.action].class}">
                {ACTION_META[item.action].label}
              </span>
              <span
                class="w-16 rounded px-1.5 py-0.5 text-center text-xs font-medium {item.source === 'Expense'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'}"
              >
                {item.source}
              </span>
              <span class="font-mono text-xs uppercase tabular-nums">{item.date ? formatDay(item.date) : '—'}</span>
              <span class="font-mono tabular-nums">{item.detail}</span>
              {#if item.note}<span class="max-w-48 truncate text-xs text-muted-foreground">{item.note}</span>{/if}
              <span class="ml-auto text-xs text-muted-foreground">
                {formatTimestamp(Math.floor(item.at / 1000), data.timeFormat)}
              </span>
            </li>
          {/each}
        </ul>
        <p class="mt-3 text-center text-xs text-muted-foreground">Showing the latest {items.length} events.</p>
      {/if}
```

Also update the page subtitle: `Every add, edit, and delete on the ledger, newest first.` → `Every add, edit, and delete on the ledger and expenses, newest first.`

- [ ] **Step 4: Verify and commit**

Run: `bun run check && bun run lint`
Expected: 0 errors/warnings. In the dev server, add/edit/delete an expense and confirm the rows appear at `/settings/audit` with the Expense badge interleaved with entry events.

```bash
git add src/routes/settings/audit
git commit -m "feat(audit): merge expense events into the timeline with source badges

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: CLAUDE.md + full verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the system in CLAUDE.md**

In the **Project** section's model paragraph, before the closing "Runs locally; no auth, no deploy." sentence, insert:

> **Expenses** (Uber/Lyft rides, extensible kinds) are tracked on their own tab and can optionally fold into the make-whole math: included expense dollars convert to hours owed at the straight rate. An optional **yearly goal** (`goalEnabled`/`yearlyGoal`) replaces the salary rate with `goal ÷ year's expected hours`, prorating a stretch target into every dashboard period. **Bonus tracking is deferred** — noted in the UI, not built.

In **Architecture**, add bullets (matching the established style):

- Under the schema bullet: `expenses` (`id`, `date`, `amount`, `kind`, `note`, `createdAt`, `updatedAt`) and `expense_events` (mirror of `entry_events` with `expenseId`) tables; `settings` gains `goalEnabled` / `yearlyGoal` (default false / 80000) and `countExpenses` (default true — the dashboard toggle's default).
- New bullet after `src/lib/leave-kinds.ts`: `src/lib/expense-kinds.ts` — expense taxonomy: `EXPENSE_KINDS` (`'ride' | 'other'`), `EXPENSE_META` (label / badge classes). Append a kind to extend; no migration needed.
- Under `src/lib/schemas/*`: `expenseInput` — ISO date + positive dollar amount + kind + optional note.
- Under `src/lib/core/`: `expenses.ts` (`computeExpenses` + add/update/delete actions, same `{ ok, status, data }` shape).
- Under timesheet bullet: add `goalRateOf` to the exported function list.
- New route bullet: `src/routes/expenses/+page.*` — expenses tab (4th): add form (date/kind/amount/note), period-paginated list with the dashboard's bucket math (opens to `ledgerPeriod`, prev floored at epoch), edit/delete dialogs, demo branches against `demoRepo`.
- Dashboard bullet: note the hero's hours are money-driven (`(expectedHours × targetRate + includedExpenses) ÷ hourlyRate`), the include-expenses toggle (shown only when the window has expenses, default from `countExpenses`), and the goal-rate swap.
- Settings bullet: add the Dashboard card (goal toggle + readonly-when-off field, count-expenses default, bonus-tracking footnote).
- Audit bullet (`entry_events`): note `/settings/audit` merges `entry_events` and `expense_events` into one timeline with Entry/Expense badges; `Repo` also exposes `listExpenseEvents()`.

- [ ] **Step 2: Full verification suite**

Run: `bun run check && bun run lint && bun run test && bun run build`
Expected: 0 errors, 0 warnings, all tests pass, build succeeds.

- [ ] **Step 3: Manual smoke pass (dev server)**

Run `bun run dev` and walk: add a ride on /expenses → appears in list + period total; dashboard toggle appears and moves Net/target; Settings → Dashboard card saves (goal + checkbox) and Reset restores defaults; /settings/audit shows the expense events; mobile width shows 5 tabs. The user verifies in Firefox against `bun run dev` — leave the server available and flag anything that needs their eyes.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document the expense system + yearly goal

Co-Authored-By: Claude <noreply@anthropic.com>"
```
