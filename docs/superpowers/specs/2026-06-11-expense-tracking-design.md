# Expense tracking + yearly goal — design

Date: 2026-06-11 · Status: approved

## Goal

Track work-related expenses (Uber/Lyft rides today, more kinds later) in a new
Expenses tab, audit-logged like ledger entries, and let the dashboard fold
those dollars into "money to make up in hours". Alongside it, a yearly dollar
goal setting (e.g. chasing $82k on an $80k salary) that prorates a stretch
target into every dashboard period. Bonus tracking is explicitly deferred —
noted in the UI and CLAUDE.md, not built.

## Decisions made

- **Expense math:** included expenses convert to hours owed at the straight
  hourly rate — they shift the hours hero and the dollars line both.
- **Goal scaling:** the yearly goal implies a target rate, prorated into every
  period (not year-view-only, not a separate progress line).
- **Categories:** fixed extensible kind enum (`ride`, `other`) mirroring the
  leave-kinds pattern, not free text.
- **Dashboard toggle:** setting-backed default (`countExpenses`), per-visit
  flips are local state only.
- **Structure:** parallel to entries (own table/events/schema/core/route), not
  a new entry kind and not a generic money-events table.

## Data model

New tables (one drizzle migration):

```
expenses:        id, date (ISO YYYY-MM-DD), amount (real, dollars > 0),
                 kind (text enum EXPENSE_KINDS, default 'ride'), note,
                 createdAt (epoch s), updatedAt (epoch s, null until edit)
expense_events:  id, expenseId, action (add|edit|delete), at (epoch ms),
                 snapshot (expense JSON after add/edit, or as-deleted)
```

`settings` gains three columns:

- `goalEnabled` boolean, default false
- `yearlyGoal` real, default 80000 (readonly-when-off, same pattern as
  `otMultiplierEnabled`/`otMultiplier`)
- `countExpenses` boolean, default true — the dashboard toggle's default

## Taxonomy

`src/lib/expense-kinds.ts`, mirroring `leave-kinds.ts`:

- `EXPENSE_KINDS = ['ride', 'other'] as const`
- `EXPENSE_META`: label / short / icon name / color family per kind
  (`ride` → "Ride", car icon, amber family)

Adding a kind later = append to the enum + meta; the text column needs no
migration.

## Math (pure, tested)

- `goalRateOf(yearlyGoal, year, settings)` in `src/lib/timesheet.ts`:
  `yearlyGoal ÷ (countWorkdays(Jan 1 … Dec 31 of year, workdays) × dailyHours)`
  — correct across 260- vs 262-workday years.
- Dashboard period math (client-side in `+page.svelte`, where it lives today):
  - `targetRate = goalEnabled ? goalRateOf(...) : hourlyRate`
  - `includedExpenses$ = countExpenses-toggle ? Σ amount of expenses in window : 0`
  - `expectedDollars = expectedHours × targetRate + includedExpenses$`
  - hours hero: `net = logged − expectedDollars ÷ hourlyRate`
  - With goal off and toggle off this reduces exactly to today's
    `logged − expectedHours`. The OT-premium earnings line is unchanged
    (premium affects earned dollars, not hours owed).

## Repo contract

`Repo` gains `listExpenses`, `addExpense`, `updateExpense`, `deleteExpense`,
`listExpenseEvents` (newest first, server cap 1000). Implementations:

- `src/lib/server/expenses.ts` — Drizzle CRUD with injectable `db`, writes
  `expense_events` inside the mutation functions (no per-caller wiring),
  bundled into `serverRepo`.
- `src/lib/demo/repo.ts` — localStorage branch, events capped at 500.
- `emptyRepo` — read-only stubs.

Root `+layout.server.ts` adds `expenses` to the parallel load (still no
`url`/`params`/`cookies` reads — tab switches stay network-free). Demo
`+layout.ts` branch mirrors it.

## Expenses page (`/expenses`)

4th nav tab: Dashboard / Clock / Log / **Expenses** / Settings. Lucide
`receipt` icon. Added to desktop header links, mobile bottom tab bar, and the
hamburger menu.

- Inline add form on top: date (defaults today), kind select (colored badge),
  amount, optional note.
- Period-paginated list below (defaults to month; same prev/next/today +
  DateJump pattern as Log), floored at the epoch. Rows: date · kind badge ·
  note · amount · edit/delete. Delete behind the existing confirm-dialog
  pattern; edit in a small dialog. Period total in the list header.
- One responsive layout (the table is narrow; no md/lg dual rendering).
- `+page.server.ts`: demo-gated `add` / `edit` / `delete` form actions;
  `src/lib/core/expenses.ts` holds `computeExpenses` + actions returning
  `{ ok, status, data }` like `log.ts`; `+page.ts` is a pure compute over
  `await parent()`.
- Zod `expenseInput` in `src/lib/schemas/expense.ts`: ISO date, positive
  amount (≤ 100,000), kind enum, optional note.

## Dashboard toggle

When the current window contains expenses, a small toggle renders by the
earnings line — "Include $X expenses" — initialized from `countExpenses`,
local state after that. No expenses in the window → no toggle, math identical
to today.

## Settings

Third card, **Dashboard**, with the existing uppercase micro-header style:

- Yearly goal: toggle + readonly-when-off dollar input. Hint copy: target
  take-home for the year, e.g. stretching for $82k on an $80k salary.
- "Count expenses by default" toggle.
- Muted footnote: bonus tracking is planned and will live here.

Auto-save via the existing debounced enhance path; `settingsInput` gains
`goalEnabled`, `yearlyGoal` (min 0, max 10,000,000), `countExpenses`.

## Audit log

`/settings/audit` loads entry events and expense events, merges into one
timeline ordered by `at` desc, with an "Entry" / "Expense" badge per row.
Expense snapshots render their own compact summary (date · kind · amount).

## Testing

- `goalRateOf` + adjusted-net reduction cases in `timesheet.test.ts`.
- `expenseInput` edge cases (zero/negative amount rejected).
- `src/lib/server/expenses.test.ts`: CRUD + event logging against in-memory
  libSQL, mirroring `entries.test.ts`.
- `bun run check`, `bun run lint`, `bun run test` all at zero
  errors/warnings.

## Out of scope (noted, not built)

- Bonus tracking (UI footnote + CLAUDE.md note only).
- Expense CSV import/export.
- Receipt attachments, mileage, reimbursement state.
