# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

**Clopen** — a **personal, single-user** timesheet tracker (named for the
close-then-open shift, with the topology pun as a bonus). Two questions drive it: *over a
chosen period (week / bi-week / month / quarter / year), did I work the hours I
owe, and is my pay right?*

**Model:** hourly pay; baseline of `dailyHours` (default 8h) on each configured
workday (default Mon–Fri → 40h/week). Overtime is tracked and banks against shortfalls because we compare *total*
logged hours to *total* expected hours up to the as-of date; by default it is
**not** paid at a premium, but an optional setting pays day-hours beyond the
baseline at `otMultiplier` × rate (default 1.5×, toggled off). **Leave** is a first-class
entry-kind taxonomy (8 kinds in paid/unpaid pairs: PTO/UPTO, Sick, Holiday,
Vacation). Paid kinds credit the daily baseline (default 8h, no clock times);
unpaid kinds record 0h with the same badge but a dashed outline. **No excused days** — any unlogged workday is a deficit.
The accrual lower bound is the **tracking epoch** in settings (defaults to the
job start date) rather than Jan 1, so year-one isn't backfilled.
**Expenses** (Uber/Lyft rides, extensible kinds) are tracked on their own tab
and can optionally fold into the make-whole math: included expense dollars
convert to hours owed at the straight rate. An optional **yearly goal**
(`goalEnabled`/`yearlyGoal`) replaces the salary rate with `goal ÷ year's
expected hours`, prorating a stretch target into every dashboard period.
**Bonus tracking is deferred** — noted in the UI, not built. Runs locally;
no auth, no deploy.

The math lives in `src/lib/timesheet.ts` (pure, fully unit-tested) — the heart
of the app. UI and DB are thin layers around it.

Fully responsive: below 768px (`md`) the app uses mobile chrome — an iOS-style
bottom tab bar plus an animated hamburger menu — and the data-dense surfaces
swap layouts (weekly grid → stacked day cards, entries table → card list).
Desktop spreadsheet behavior (column alignment, paste, fill-down) returns at
`lg` via `lg:contents` wrappers that dissolve the mobile structure.

## Commands

```bash
bun install            # install deps (also runs svelte-kit sync)
bun run dev            # dev server (http://localhost:5173)
bun run build          # production build (svelte-adapter-bun)
bun run preview        # preview the production build
bun run check          # svelte-check — 0 errors AND 0 warnings required
bun run lint           # biome check — 0 errors AND 0 warnings required
bun run lint:fix       # biome auto-fix
bun run format         # biome format in place
bun run test           # vitest run (one-shot)
bun run test:watch     # vitest watch
bun run db:generate    # drizzle-kit generate (after schema changes)
bun run db:migrate     # apply migrations (creates ./local.db)
bun run db:studio      # drizzle-kit studio
```

First run: `bun install && bun run db:migrate && bun run dev`.

Run a single test file: `bun run test src/lib/timesheet.test.ts`.

## Conventions

- **Bun for everything.** No npm/pnpm/yarn lockfiles. Runtime is Bun via
  `svelte-adapter-bun`.
- **TypeScript only, strict.** Zero-tolerance: `bun run check` and `bun run lint`
  must each report **0 errors and 0 warnings**. No `as any`, no `as unknown`, no
  suppression comments (`biome-ignore`, `@ts-expect-error`, etc.). Type it
  correctly instead.
- **Biome 2.5.0** is the source of truth: single quotes, semicolons always,
  2-space indent, 120 width. `src/app.css` is excluded (Tailwind v4 `@theme`).
  The `*.svelte` override in biome.json turns off rules its template analysis
  can't evaluate. Of the a11y rules new in 2.5.0, only `useValidAriaValues`
  is off svelte-wide — it rejects **every** expression-valued aria attribute,
  even `aria-checked={x ? 'true' : 'false'}`, so no dynamic aria state can
  conform. Two others stay on with single-file exceptions for verified
  false positives: `noStaticElementInteractions` (log's
  `<svelte:window onkeydown>`), `noLabelWithoutControl` (settings' workday
  chips — interpolated label text is invisible to it). New a11y findings
  anywhere else still fail the build. The header's theme and demo-data
  toggles are native sr-only radio inputs styled by their labels (tab lands
  once per group, arrows switch), not role="radio" buttons.
- **shadcn-svelte + Tailwind v4.** UI primitives live in `$lib/components/ui/*`.
  Add more via `bun x shadcn-svelte@latest add <name>`.
- **Server-only code under `src/lib/server/`.** Validate boundaries with Zod
  (`src/lib/schemas/`). Use `??`, not `||`, when 0/""/false are valid.
- Pre-commit hook (husky + lint-staged) runs `biome check --write` on staged
  files.

## Architecture

- `src/lib/timesheet.ts` — pure make-whole math: `countWorkdays`,
  `expectedHours`, `goalRateOf`, `loggedHours`, `overtimeHours`, `makeWholeStatus`, `bucketBreakdown`
  (logged-vs-target per day/week/month/quarter/year bucket; `weeklyBreakdown`
  is its week-granularity wrapper),
  `weekDates`, `yearStartOf`, `parseTimeInput`, `hoursBetween`. Timezone-safe
  (UTC arithmetic on explicit dates). `hoursBetween` wraps past midnight when
  the end time precedes the start. `makeWholeStatus` takes an optional `epoch`
  that clamps the lower bound of accrual. Tested in `timesheet.test.ts` (leap
  day, partial weeks, year-boundary, Sunday-start weeks, overnight shifts).
- `src/lib/db/schema.ts` — Drizzle tables:
  - `time_entries`: `id`, `date`, `hours`, `breakHours`, `startTime`, `endTime`,
    `note`, `entryKind`, `createdAt`, `updatedAt` (epoch seconds, null until
    first edit; the edit dialog shows "Added … · Edited …"). Multiple entries
    per day are allowed.
  - `settings` (single row, `id = 'default'`): `hourlyRate` (default 38.4615 =
    80k / 2080h), `dailyHours`, `workdays` (JSON `[1..7]`, ISO weekday numbers),
    `weekStartsOn` (1 = Mon, 7 = Sun; default 7), `epoch` (ISO date, default
    `2025-03-16`), `timeFormat` (`'12h' | '24h'`), `hideWeekendsEntries` /
    `hideWeekendsGrid` (booleans, default false — hide blank Sat/Sun rows in the
    entries views, and Sat/Sun rows in the weekly grid which implies the former;
    weekend days with entries always show), `expandNotes` (boolean, default
    false — entry notes start expanded in the Ledger),
    `ledgerPeriod` (`week | biweek | month | quarter | year`, default `month` —
    the period the Ledger opens to),
    `payCycle` (`daily | weekly | biweekly | monthly`, default `biweekly` —
    what the dashboard's period selector and chart granularity open to),
    `timeZone` (IANA, default `America/Chicago`) / `observeDst` (default true —
    off pins the zone to its fixed standard offset) / `clockBreakMode`
    (`accrue | split`, default `accrue` — how punch-clock breaks land),
    `otMultiplierEnabled` / `otMultiplier` (default false / 1.5 — pay day-hours
    beyond the baseline at the multiplier; dashboard earnings only),
    `goalEnabled` / `yearlyGoal` (default true / 80000 — chase a yearly dollar
    target instead of straight salary math), `countExpenses` (default true —
    the dashboard's include-expenses toggle starts here), and the
    `defaultExpenseKind` / `defaultRideVendor` / `defaultRideDirection` /
    `defaultMealVendor` / `defaultMealMethod` / `defaultPurchaseVendor` /
    `defaultPurchaseCadence` set (what the Expenses add form opens with;
    defaults ride / uber / to_work / uber_eats / delivery / hardware /
    monthly).
  - `open_shift` (at most one row, `id = 'current'`): the running punch-clock
    shift — `startedAt` / `breakStartedAt` (epoch **ms**), `breakSeconds`,
    `breakMode` snapshot. Clock-out composes normal `time_entries` and clears
    it; the ledger stays the only canonical record.
  - `entry_events`: append-only audit log of ledger mutations — `entryId`,
    `action` (`add | edit | delete`), `at` (epoch ms), `snapshot` (the entry
    JSON after an add/edit, or as it was at deletion). Written inside the repo
    implementations' CRUD (server + demo, demo capped at 500/bucket), so every
    mutation path logs without per-caller wiring. Viewed at `/settings/audit`
    (an on-demand page with its own server load — deliberately not part of the
    zero-network tab set), reached via the indigo "View audit log" button in
    Settings' Log & Ledger card. `Repo` exposes `listEntryEvents()` (newest
    first, server cap 1000). The audit page merges `entry_events` and
    `expense_events` into one timeline with Entry/Expense source badges.
  - `expenses`: `id`, `date` (ISO local-day), `amount` (dollars), `kind`
    (from `$lib/expense-kinds`), `vendor` (shared column, values scoped per
    kind by `KIND_VENDORS`), `direction` (ride-only commute leg) / `method`
    (meal-only delivery / pickup / restaurant-only dine-in) / `cadence`
    (subscription-purchase-only recurrence) — detail axes are null on other
    kinds and legacy rows — `note`, `createdAt`, `updatedAt` (same timestamp
    semantics as entries).
  - `expense_events`: mirror of `entry_events` with `expenseId`; written
    inside the repo implementations' CRUD (server + demo, demo capped at
    500/bucket). `Repo` exposes `listExpenseEvents()` plus `listExpenses` /
    `addExpense` / `updateExpense` / `deleteExpense`.
  - `savings_goals`: dashboard savings goals ("Nintendo Switch · $350") —
    `id`, `name`, `targetAmount`, `startDate` (ISO local-day), `funding`
    (`overtime | all`), `rank` (priority order, rewritten 0..n−1 on reorder),
    `allocation` (percent share of the savings stream, default 100),
    `createdAt`, `updatedAt`. Progress is derived (`$lib/savings-goals`
    `allocateGoals` — allocation split, capped at target, spare share spills
    to the highest-ranked unfinished goal; pure + tested), never stored, and
    always uses the straight `hourlyRate` — independent of the yearly stretch
    goal and of the hero's salary math. No audit events (not ledger records).
    `Repo` exposes `listSavingsGoals` (rank order) / `addSavingsGoal`
    (appends at rank max+1) / `updateSavingsGoal` / `deleteSavingsGoal` /
    `setSavingsGoalRank`.
- `src/lib/db/index.ts` — Drizzle/libSQL client, **lazy-constructed via Proxy**
  so module load doesn't open a connection during SvelteKit's build analyse pass.
  Local default `file:./local.db`.
- **Load architecture (zero-network tab switching):** entries + expenses +
  settings load once in the root `+layout.server.ts` (which must never read `url`/`params`/
  `cookies` — that's what keeps it from re-running on navigation) and the demo
  branch in `+layout.ts`; each page's `+page.ts` is a pure synchronous compute
  over `await parent()` (`computeDashboard` / `computeLog` /
  `computeExpenses` / `computeSettingsPage`). The per-route `+page.server.ts` files hold only form
  actions. Mutations refresh via `enhance`'s `invalidateAll()` (one fetch) in
  normal mode and `invalidate('demo:data')` (offline) in demo.
- `src/lib/core/` — transport-agnostic page logic: `repo.ts` (the `Repo`
  storage contract + `DEFAULT_SETTINGS` + `toWorkSettings` + `emptyRepo`),
  `log.ts` (`computeLog` + all five form actions returning
  `{ ok, status, data }`), `expenses.ts` (`computeExpenses` + add/update/delete
  actions, same outcome shape, tested in `expenses.test.ts`),
  `savings-goals.ts` (goal add/update/delete/move actions, same outcome shape,
  tested in `savings-goals.test.ts`), `dashboard.ts`,
  `settings-page.ts`, `clock.ts` (the
  punch-clock state machine: idle / working / on_break; `clockIn`,
  `startBreak`, `endBreak`, `clockOut`, `adjustStart`, `resolveSave`/`Discard`,
  `composeEntry`, `computeClock`; pure — callers pass `now`, fully tested in
  `clock.test.ts`). Accrue mode banks break punches into one entry's
  `breakHours`; split mode writes each in→out span as its own entry at break
  start. Clocking out while on break ends the shift at the break's start; a
  shift started before today (app zone) is "stale" and the Clock page demands
  an explicit resolve. Composed entries use wall-clock `hoursBetween` so they
  agree with every other surface (DST nights follow the wall clock). Server
  routes wrap failures in `fail()`; demo mode calls these directly.
- **App timezone:** `src/lib/date.ts` holds a module-level app zone
  (`setAppTimeZone`, set by the root `+layout.ts` load from settings before
  any page compute; clock actions pin it themselves since actions run before
  loads). `todayISO()`, `zonedParts(ms)`, `zonedToMs(date, hhmm)`, and
  `formatTimestamp(secs, mode)` all answer in it. `effectiveZone(tz, observeDst)`
  maps DST opt-out to the fixed `Etc/GMT±N` standard offset (sign inverted;
  fractional-offset zones pass through).
- `src/lib/demo/` — demo mode (`PUBLIC_DEMO=1`, the Railway copy): `flag.ts`
  reads the env; `repo.ts` is a localStorage `Repo`. Demo skips SSR
  (`export const ssr = !isDemo` in `+layout.ts`) so the first browser render
  reads localStorage directly — no stub flash — and every `use:enhance`
  handler has a demo branch that cancels the POST and runs the core action
  against localStorage (results stand in for the `form` prop via an
  `actionData` derived).
- `src/lib/server/entries.ts` / `expenses.ts` / `savings-goals.ts` /
  `settings.ts` — CRUD with an
  **injectable `db` arg** so unit tests run against an in-memory libSQL
  (`entries.test.ts`, `expenses.test.ts`, `savings-goals.test.ts`);
  `repo.ts` bundles them as `serverRepo`, the Drizzle `Repo` implementation.
  Entries module also exports `findExistingDates`, `listEntriesByDates`, and
  `deleteEntriesByDates` for the conflict-resolution flow. `toWorkSettings` maps
  a settings row into the shape the math expects.
- `src/lib/leave-kinds.ts` — single source of truth for the leave taxonomy:
  `ENTRY_KINDS` (`'work' | 'pto' | 'pto_unpaid' | …`), `LEAVE_KINDS` (the same
  set minus 'work'), `LEAVE_META` (label / short / paid / color family), and
  `leaveHours(kind, dailyHours)`.
- `src/lib/expense-kinds.ts` — expense taxonomy: `EXPENSE_KINDS`
  (`'meal' | 'purchase' | 'ride' | 'other'`), `EXPENSE_META` (label / badge
  classes — ride amber, meal teal, purchase fuchsia), `EXPENSE_VENDORS` +
  `KIND_VENDORS` (per-kind lists, exported as literal tuples `RIDE_VENDORS`
  lyft/taxi/uber/other, `MEAL_VENDORS` grubhub/restaurant/uber_eats,
  `PURCHASE_VENDORS` hardware/software/subscription/other so zod enums can
  derive) with `VENDOR_LABELS`, plus the per-kind second axes
  `RIDE_DIRECTIONS` (`to_work | to_home | other`), `MEAL_METHODS`
  (`delivery | pickup | dine_in` — `vendorMethods(vendor)` scopes dine-in
  to the restaurant vendor), and `PURCHASE_CADENCES`
  (`weekly | monthly | quarterly | yearly`, subscription-only,
  scale-ordered) with label maps. Ordering convention: kinds and vendor
  lists read alphabetically with Other pinned last. Append to extend; the
  kind/vendor DB columns are plain text so no migration is needed (a new
  *axis* column still migrates, like `cadence`).
  Uber/Lyft brand glyphs come from `@fortawesome/free-brands-svg-icons`
  (data-only pack, icons CC BY 4.0 — lucide dropped brand icons), rendered
  by `$lib/components/brand/BrandIcon.svelte` (a 15-line IconDefinition →
  inline-SVG renderer; no svelte-fa dependency) behind thin `UberIcon` /
  `LyftIcon` wrappers so icon maps stay uniform with lucide components.
  Uber Eats isn't in the FA pack; it comes from `simple-icons` via the
  parallel `SimpleBrandIcon.svelte` + `UberEatsIcon` wrapper. Grubhub has
  no mark of its own in any pack (Simple Icons only carries the
  house-with-cutlery shared with parent Just Eat Takeaway), so `GrubhubIcon`
  renders the genuine app icon (`assets/grubhub-app-icon.png`, fetched from
  grubhub.com's apple-touch-icon) as a 2KB raster. Lyft renders in its
  brand pink, Uber Eats its green.
- `src/lib/schemas/*` — Zod schemas:
  - `entryInput` — plain hours-mode (positive hours, optional break/note).
  - `clockEntryInput` — start + end times; computed hours via `hoursBetween`
    (wraps for overnight shifts); error `"Clock in and clock out can't match"`
    when start == end.
  - `leaveEntryInput` — date + `kind` (LeaveKind) + optional note; produces an
    `EntryInput` whose `entryKind` reflects the kind and whose `hours` is the
    daily baseline for paid kinds, 0 for unpaid.
  - `expenseInput` — ISO date + positive dollar amount (≤ 100k) + kind +
    optional vendor/direction/method (each scrubbed to null when it doesn't
    belong to the kind) + optional note (blank → null).
  - `savingsGoalInput` — trimmed name (1–80) + positive target (≤ 1M) + ISO
    start date + funding (`GOAL_FUNDINGS` enum from `$lib/savings-goals`).
  - `settingsInput` — adds `epoch` (ISO regex), `timeFormat` (`12h | 24h`),
    `ledgerPeriod` (`LEDGER_PERIODS` enum, also exported here), the
    `hideWeekendsEntries` / `hideWeekendsGrid` / `expandNotes` booleans, and
    `goalEnabled` / `yearlyGoal` / `countExpenses`.
- `src/lib/date.ts` — local `todayISO()` (via `@internationalized/date`) and
  display formatters: `formatTime(hhmm, mode)` (zero-padded, mode-aware),
  `formatTimeRange` (annotates overnight ranges with `(+1d)`), `formatDay`
  (2-digit day), `formatWeekRange`, `formatRangeISO` (generic two-date span used
  for bi-week labels).
- `src/lib/csv.ts` — RFC-4180 CSV parser/serializer used by Export/Import.
- `src/routes/+page.*` — dashboard. Period selector (opens to the `payCycle`
  setting's mapping — daily pay falls back to weekly since the hero has no
  day period) +
  prev/next/today nav + a `DateJump` calendar popover (jump to any date;
  month/year dropdowns and reachable days are floored at the epoch — the same
  component sits in the Log page's date bars) drives a derived bucket. The hero answers
  *Beat it · overtime banked / Made it / Came up short / Ahead of pace / Behind
  pace / On pace / Not started* based on bucket-vs-today state. Period math
  runs client-side from `data.entries`, clamped lower by epoch and upper by
  today. The hero's hours are money-driven: target hours =
  `(expectedHours × targetRate + includedExpenses) ÷ hourlyRate`, where
  `targetRate` is `goalRateOf(...)` when the goal is enabled (else the salary
  rate) — with goal off and no expenses this reduces exactly to schedule
  hours. When the window contains expenses, an amber "Include $X expenses"
  toggle sits under the earnings block (default from `countExpenses`,
  per-visit after that). A **Savings goals** section sits between the stat
  grid and the chart: a responsive card grid (1/2/3 cols) of dollar targets
  managed entirely in-page (add/edit/delete dialogs via a `goalEnhance`
  factory mirroring the Expenses idiom; actions live in the dashboard's
  `+page.server.ts` — actions only, no load, so tab switches stay
  network-free). Each goal tracks from its own `startDate` (epoch-clamped)
  through today, ignoring the period selector: `overtime` funding accumulates
  dollars earned beyond the as-written schedule (OT premium honored),
  `all` every dollar earned. Goals are **ranked with allocation shares**:
  each receives `allocation%` of its pool, capped at its target, and spare
  share from reached goals tops up the highest-ranked unfinished goal
  (`allocateGoals`, tested in `savings-goals-allocate.test.ts`) — so a small
  low-priority goal can pay off first. Cards lead with a header strip (rank
  badge `#N` + outline funding chip with icon, actions right — move up/down
  forms posting `?/moveGoal`, edit, delete, all with shadcn tooltips), then
  name, `N% share · since date`, and a blue progress bar (success green +
  "Reached" at 100%); zero goals renders one slim dashed empty-state card.
  Math in `$lib/savings-goals.ts` (pure, tested). The stat grid's four cards
  (Expected / Logged / Net / a signed dollar Surplus-or-Deficit vs. the
  period's target) carry foreground icons; only the Net and Surplus/Deficit
  numbers take color, mirroring the hero's hues. The goal dialog's "counting from" DateField carries a
  shortcuts footer (Today / This week / month / quarter / year, clamped to
  the epoch — an opt-in `shortcuts` prop on DateField). The hours chart
  below has a per-visit granularity select (daily / weekly / bi-weekly /
  monthly / quarterly / yearly over `bucketBreakdown`, opening to
  `payCycle`, still year-view),
  a y-axis with nice-step gridlines, and bars in rose below target, success
  green at it, with a blue overtime cap above the dashed target line
  (legend: Above / Met / Below; the blue matches the goal bars) — rendered
  by `$lib/components/HoursChart.svelte`.
- `src/routes/log/+page.*` — entries page. The forms (weekly grid, CSV
  import, and the edit/create dialog) share a `conflictAwareEnhance` factory
  that surfaces duplicate-date conflicts in a dialog (`overwrite | keep
  existing | keep both | cancel` — keep both appends the new entries as
  additional same-day shifts, and the dialog leads with "Add a second shift?"
  when clock spans don't overlap).
  The weekly grid uses a shadcn `Select` per row with icons and color
  badges so the chosen leave kind reads at a glance; selecting one hides the
  clock/break inputs and swaps the In column for a "Sick · 8.00h paid" /
  "Vacation · unpaid" chip. Each non-leave day has a + (beside its Worked
  field) that adds up to 5 inline extra shifts — controlled sub-rows named
  `start-{i}-{j}` (j ≥ 1; the server probes those suffixes and keys errors as
  `start-3-1`), each with its own read-only Worked and a − to remove it.
  Main-row field names stay `start-{i}` where i is the day offset from
  weekStart — hiding weekends or adding shifts must never renumber them.
  Paste and Fill target main rows only; Fill copies the last-touched cell to
  the whole week (fallback: first row's time fields down). The edit modal
  carries a Type chooser (work + leave kinds) and doubles as the
  single-entry create path: the pencil on a blank day opens it posting to
  `?/add` with that date prefilled.
  The entries table (titled **Ledger** in the UI) is paginated by the same
  period set (opens to the `ledgerPeriod` setting, monthly out of the box),
  capped at ~14 visible rows with a sticky
  header, pads unlogged days with em-dashes, tints leave rows in their color
  family (and darkens on hover rather than overwriting), and renders delete
  in a confirm dialog. Zebra stripes alternate per *day* (not per row) so a
  multi-shift day reads as one block; the date renders on its first row only,
  with follow-up rows marked "↳ shift N". Notes live
  behind a sticky-note action per row that toggles an accordion under the row
  (default open state comes from `expandNotes`); an expand button takes the
  whole section fullscreen, and paging back stops at the tracking epoch.
  Blank-day rows carry the same action cluster (note/delete disabled, pencil
  live). The Ledger header's destructive-outline **Clear** button opens a
  confirm dialog offering two scopes: the visible period (posts the bucket's
  start/end to `?/clearPeriod`, which resolves dates server-side) or the
  whole ledger (`?/clearAll` → `Repo.clearEntries()`); every removed entry
  still lands in the audit log. Confirm dialogs (row delete + clear) focus
  their destructive button on open via `onOpenAutoFocus`, so a bare Enter
  confirms — Tab still reaches Cancel, Escape still closes; the clear dialog
  falls back to Clear-all focus when the visible period is empty. Perf: the table (md+) and the mobile card list are alternates — only
  the visible one renders client-side (`innerWidth` from
  `svelte/reactivity/window`); entry rows are component-free (plain buttons +
  inline-SVG snippets); the ledger renders two screenfuls and grows only when
  a sentinel row scrolls into view (rows never scrolled to never mount, and
  `table-fixed` keeps appends cheap); and the weekly grid mounts one frame
  after the page paints behind `gridReady`.
- `src/routes/expenses/+page.*` — expenses tab (4th): an add form (DateField
  date / kind / amount / note, plus a kind-scoped Service select and a
  second axis — Direction for rides, Method for meals — that swap with the
  kind), a period-paginated list using the dashboard's bucket math (opens to
  `ledgerPeriod`, prev disabled at the epoch, DateJump floored there) with a
  period total in the header, and edit/delete dialogs. The dropdowns are
  icon-bearing shadcn `Select`s defined once as snippets (`kindSelect` /
  `vendorSelect` / `directionSelect` / `methodSelect`) shared by the add
  form and edit dialog — display-only, with hidden inputs carrying the
  values into the POST (the log grid's Select idiom); `detailDefaults(kind)`
  resets the axes when the kind flips. List rows badge a known vendor's
  glyph + label in place of the generic kind label and echo the
  direction/method as icon + text. A shared `expenseEnhance(action, after?)`
  factory branches demo mutations to `demoRepo` + `invalidate('demo:data')`.
  Validation errors surface as a single `expenseError` line under the add
  form. Footer note links the audit log and flags that bonus tracking is
  planned.
- `src/routes/clock/+page.*` — the punch clock (2nd nav tab). `+page.server.ts`
  holds the seven demo-gated actions (`in`, `breakStart`, `breakEnd`, `out`,
  `adjust`, `resolveSave`, `resolveDiscard`), each pinning the app zone before
  composing; `+page.ts` is `computeClock` over `await parent()` (the layout
  load also returns `openShift`, which powers a running dot on the Clock nav
  tab). The page: one 1s interval drives a big elapsed timer (worked time,
  frozen during accrue breaks; break time while on break), state-appropriate
  punch buttons disabled by a page-wide `submitting` flag, an inline
  adjust-start form, a stale-shift banner (DateField + time → `resolveSave`,
  or a confirm-dialog discard), and a Today card of the day's shifts. Demo
  branches run the core actions against `demoRepo` + `invalidate('demo:data')`.
- `src/routes/settings/+page.*` — sidebar shell: a section rail (vertical
  from `md`, dropdown below) showing one section at a time in a single wide
  pane (Global / Dashboard / Clock & time / Log & Ledger / Expenses,
  opening on Global). Global holds the baseline every surface computes
  from: Compensation (pay rate, daily hours), Schedule (week-start,
  tracking epoch, workday chips ordered by week start), and Time (time
  format, timezone full IANA select, observe-DST toggle).
  Inactive sections are `hidden`, **not unmounted** —
  the page stays one form so every field posts
  on each auto-save; switching
  sections runs `reportValidity()` first so an invalid field can't hide
  itself and silently block saves. Sections keep uppercase micro-headers.
  The Dashboard section leads with the yearly goal (toggle + readonly-when-off
  dollar field, same hidden-input idiom as the OT multiplier; **on by
  default** — migration 0025 also flipped the existing row), the pay cycle
  select, and the count-expenses default + "bonus tracking is planned"
  footnote, and the overtime multiplier. Log & Ledger holds weekend
  visibility toggles, default ledger period, expand-notes-by-default, and
  the View audit log link. Clock & time keeps just the clock break mode.
  Settings auto-save: every change schedules a debounced (400ms)
  `requestSubmit` through the shared enhance path (native validation gates
  it; zod failures surface in the status bar without persisting). The footer
  bar shows save status plus a Reset-to-defaults button behind a confirm
  dialog. Tooltips: `Tooltip.Provider` wraps the
  app in `+layout.svelte`; repeated/per-row controls use native `title`.
- `src/routes/+layout.svelte` — responsive nav (Dashboard / Clock / Log /
  Expenses / Settings): desktop header links (with icons) from `md`; below that an
  iOS-style bottom tab bar plus a top-left hamburger (bars→X morph) opening a
  slide-down menu over a dim overlay. The Clock link shows a small `bg-success`
  dot while a shift is running (`data.openShift`). The footer shows the app
  version via `__APP_VERSION__`, defined in `vite.config.ts` from
  `package.json` — no manual sync — plus GitHub and Discord (FA-brands
  `DiscordIcon`) links, in that order.
- **Brand:** `src/lib/assets/clopen-doors-ampm.svg` is the pre-colored
  two-tone doors mark (sky `#0ea5e9` + rose `#f43f5e`, exported from Serif)
  and the single source for both the header (`ClopenDoors.svelte`) and
  `favicon.svg` (same geometry centered on a square) — they can never drift.
- `src/app.html` — carries the social meta statically (description, Open
  Graph, Twitter card, light/dark theme-colors): the demo deploy is CSR-only
  (`ssr = !isDemo`), so crawlers only ever see this head, never
  `<svelte:head>`. `og:image` is `static/og.png`, a 1200×630 dark-mode
  screenshot of the demo dashboard; the image/url tags are hardcoded to
  `https://clopen-production.up.railway.app`.

## CSV import format

The importer matches header columns case-insensitively. Date column aliases:
`date`, `day`, `day of the week`. Hours: `hours`, `hrs`, `total hours`, `total`.
Clock in: `clock in`, `in`, `start`, `start time`, `check-in time`. Clock out:
mirrors clock in. Break: `break`, `break hours`. Note: `note`, `notes`,
`description`. Dates accept ISO, M/D/YY, M/D/YYYY, and the same prefixed with a
weekday (`Thu 1/1/26`). Off-day rows (no clock + zero/blank total) are skipped
silently.

## Git

Conventional commits with area scope (`feat(log):`, `style(dashboard):`,
`fix(date):`, `chore:`). Every commit ends with:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```
