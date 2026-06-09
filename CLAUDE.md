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
job start date) rather than Jan 1, so year-one isn't backfilled. Runs locally;
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
- **Biome 2.4.14** is the source of truth: single quotes, semicolons always,
  2-space indent, 120 width. `src/app.css` is excluded (Tailwind v4 `@theme`).
- **shadcn-svelte + Tailwind v4.** UI primitives live in `$lib/components/ui/*`.
  Add more via `bun x shadcn-svelte@latest add <name>`.
- **Server-only code under `src/lib/server/`.** Validate boundaries with Zod
  (`src/lib/schemas/`). Use `??`, not `||`, when 0/""/false are valid.
- Pre-commit hook (husky + lint-staged) runs `biome check --write` on staged
  files.

## Architecture

- `src/lib/timesheet.ts` — pure make-whole math: `countWorkdays`,
  `expectedHours`, `loggedHours`, `overtimeHours`, `makeWholeStatus`, `weeklyBreakdown`,
  `weekDates`, `yearStartOf`, `parseTimeInput`, `hoursBetween`. Timezone-safe
  (UTC arithmetic on explicit dates). `hoursBetween` wraps past midnight when
  the end time precedes the start. `makeWholeStatus` takes an optional `epoch`
  that clamps the lower bound of accrual. Tested in `timesheet.test.ts` (leap
  day, partial weeks, year-boundary, Sunday-start weeks, overnight shifts).
- `src/lib/db/schema.ts` — Drizzle tables:
  - `time_entries`: `id`, `date`, `hours`, `breakHours`, `startTime`, `endTime`,
    `note`, `entryKind`, `createdAt`. Multiple entries per day are allowed.
  - `settings` (single row, `id = 'default'`): `hourlyRate` (default 38.4615 =
    80k / 2080h), `dailyHours`, `workdays` (JSON `[1..7]`, ISO weekday numbers),
    `weekStartsOn` (1 = Mon, 7 = Sun; default 7), `epoch` (ISO date, default
    `2025-03-16`), `timeFormat` (`'12h' | '24h'`), `hideWeekendsEntries` /
    `hideWeekendsGrid` (booleans, default false — hide blank Sat/Sun rows in the
    entries views, and Sat/Sun rows in the weekly grid which implies the former;
    weekend days with entries always show), `expandNotes` (boolean, default
    false — entry notes start expanded in the Entries views),
    `otMultiplierEnabled` / `otMultiplier` (default false / 1.5 — pay day-hours
    beyond the baseline at the multiplier; dashboard earnings only).
- `src/lib/db/index.ts` — Drizzle/libSQL client, **lazy-constructed via Proxy**
  so module load doesn't open a connection during SvelteKit's build analyse pass.
  Local default `file:./local.db`.
- `src/lib/server/entries.ts` / `settings.ts` — CRUD with an **injectable `db`
  arg** so unit tests run against an in-memory libSQL (`entries.test.ts`).
  Entries module also exports `findExistingDates`, `listEntriesByDates`, and
  `deleteEntriesByDates` for the conflict-resolution flow. `toWorkSettings` maps
  a settings row into the shape the math expects.
- `src/lib/leave-kinds.ts` — single source of truth for the leave taxonomy:
  `ENTRY_KINDS` (`'work' | 'pto' | 'pto_unpaid' | …`), `LEAVE_KINDS` (the same
  set minus 'work'), `LEAVE_META` (label / short / paid / color family), and
  `leaveHours(kind, dailyHours)`.
- `src/lib/schemas/*` — Zod schemas:
  - `entryInput` — plain hours-mode (positive hours, optional break/note).
  - `clockEntryInput` — start + end times; computed hours via `hoursBetween`
    (wraps for overnight shifts); error `"Clock in and clock out can't match"`
    when start == end.
  - `leaveEntryInput` — date + `kind` (LeaveKind) + optional note; produces an
    `EntryInput` whose `entryKind` reflects the kind and whose `hours` is the
    daily baseline for paid kinds, 0 for unpaid.
  - `settingsInput` — adds `epoch` (ISO regex), `timeFormat` (`12h | 24h`), and
    the `hideWeekendsEntries` / `hideWeekendsGrid` / `expandNotes` booleans.
- `src/lib/date.ts` — local `todayISO()` (via `@internationalized/date`) and
  display formatters: `formatTime(hhmm, mode)` (zero-padded, mode-aware),
  `formatTimeRange` (annotates overnight ranges with `(+1d)`), `formatDay`
  (2-digit day), `formatWeekRange`, `formatRangeISO` (generic two-date span used
  for bi-week labels).
- `src/lib/csv.ts` — RFC-4180 CSV parser/serializer used by Export/Import.
- `src/routes/+page.*` — dashboard. Period selector (default **bi-weekly**) +
  prev/next/today nav drives a derived bucket. The hero answers
  *Beat it · overtime banked / Made it / Came up short / Ahead of pace / Behind
  pace / On pace / Not started* based on bucket-vs-today state. Period math
  runs client-side from `data.entries`, clamped lower by epoch and upper by
  today. Year-view weekly chart sits below.
- `src/routes/log/+page.*` — entries page. Three forms (single add, weekly
  grid, CSV import) share a `conflictAwareEnhance` factory that surfaces
  duplicate-date conflicts in a dialog (`overwrite | keep existing | cancel`).
  Add-an-entry has a 4×2 grid of leave-kind shortcut buttons under the regular
  fields. The weekly grid uses a shadcn `Select` per row with icons and color
  badges so the chosen leave kind reads at a glance; selecting one hides the
  clock/break inputs and swaps the In column for a "Sick · 8.00h paid" /
  "Vacation · unpaid" chip. The edit modal carries the same Type chooser.
  The entries table is paginated by the same period set (default yearly),
  capped at ~14 visible rows with a sticky header, pads unlogged days with
  em-dashes, tints leave rows in their color family (and darkens on hover
  rather than overwriting), and renders delete in a confirm dialog. Notes live
  behind a sticky-note action per row that toggles an accordion under the row
  (default open state comes from `expandNotes`); an expand button takes the
  whole section fullscreen, and paging back stops at the tracking epoch.
  Perf: the table (md+) and the mobile card list are alternates — only the
  visible one renders client-side (`innerWidth` from
  `svelte/reactivity/window`), and entry rows are component-free (plain
  buttons + inline-SVG snippets) so a 365-row year switches instantly.
- `src/routes/settings/+page.*` — two side-by-side cards (Pay & schedule /
  Display & entries): pay rate, daily hours, workdays, tracking epoch, time
  format, week-start, weekend visibility toggles, expand-notes-by-default.
- `src/routes/+layout.svelte` — responsive nav: desktop header links (with
  icons) from `md`; below that an iOS-style bottom tab bar plus a top-left
  hamburger (bars→X morph) opening a slide-down menu over a dim overlay.

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
