# Savings goals + chart color trio — design

Date: 2026-06-12. Brainstormed autonomously (user away); answers inferred from
the request: independent dollar goals (e.g. a Nintendo Switch), possibly
several, living on the dashboard without crowding Settings, while as-written
salary tracking stays exactly as it is. Also: a better above/met/below color
trio for the weekly chart.

## What a goal is

A **savings goal** is a named dollar target tracked independently of the
salary math: `name`, `targetAmount`, `startDate` (defaults to the day it's
created), and a `funding` mode:

- **`overtime`** (default): progress = dollars earned *beyond* the as-written
  salary schedule over `[max(startDate, epoch), today]` — the same earnings
  math the dashboard hero uses (OT multiplier honored when enabled), minus the
  schedule's expected dollars at the straight rate, floored at $0. This is the
  "your banked overtime has bought 80% of a Switch" view, and the only
  non-trivial semantics in this app (a $350 target funded by *all* earnings is
  ~1 workday).
- **`all`**: progress = every dollar earned since the start date — the classic
  "how many hours of work is this thing" measuring stick.

Goals are measuring sticks, not allocations: two simultaneous overtime goals
both read the same surplus (each from its own start date). No waterfall, no
priorities — YAGNI. A goal at ≥100% renders a "Reached" state and stays until
deleted. The yearly stretch goal in Settings (`goalEnabled`/`yearlyGoal`) is
unrelated and untouched; savings-goal math always uses the straight
`hourlyRate`, so "did I earn my as-written salary" stays the hero's job.

## UI

A **Savings goals** section on the dashboard between the stat grid and the
weekly chart. Responsive card grid (1 col mobile / 2 from `sm` / 3 from `lg`);
each card: name, funding chip, progress bar, `$saved of $target · NN%`, a
since/starts/reached line, and pencil/trash actions (shadcn dialogs, same
`enhance` idiom as Expenses). Empty state is one slim muted card with an "Add
goal" button — visible but not pushy. No Settings fields, no new tab.

## Plumbing (mirrors expenses end-to-end)

- `src/lib/savings-goals.ts` — pure: `GOAL_FUNDINGS`/labels + `goalProgress()`
  (tested in `savings-goals.test.ts`).
- `src/lib/db/schema.ts` — `savings_goals` table: `id`, `name`,
  `targetAmount`, `startDate`, `funding`, `createdAt`, `updatedAt`. Listed
  `createdAt` asc (creation order). No audit events — goals aren't ledger
  records and the audit page stays two-source.
- `src/lib/schemas/savings-goal.ts` — zod `savingsGoalInput` (name 1–80,
  amount > 0 ≤ 1M, ISO date, funding enum).
- Repo contract + `serverRepo` (`src/lib/server/savings-goals.ts`, injectable
  db, tested) + `demoRepo` (localStorage, both buckets) + `emptyRepo`.
- Root layout loads (`+layout.server.ts` + demo branch in `+layout.ts`) gain
  `listSavingsGoals()`; `computeDashboard` passes goals through.
- `src/lib/core/savings-goals.ts` — add/update/delete actions returning
  `ActionOutcome` (tested); new `src/routes/+page.server.ts` holds only the
  form actions (no `load`, so zero-network tab switching is preserved).

## Chart colors

Above/met/below was emerald-400 / success / amber-500 — two adjacent greens
(bad for deuteranopia) and an amber that reads "warning" for ordinary
shortfall weeks. New trio is the brand's AM/PM door palette around the
existing success green: **sky** (above, `bg-sky-500 dark:bg-sky-400`) /
**success** (met) / **rose** (below, `bg-rose-500 dark:bg-rose-400`). Legend
updates to match; the hero's own states are out of scope.
