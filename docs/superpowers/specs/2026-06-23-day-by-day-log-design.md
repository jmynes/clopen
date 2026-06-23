# Day-by-day Log — design

2026-06-23. Approved in-session.

## Why

The Log is painful during an in-progress week. The weekly grid is a write-only
*add* form: its cells start blank, it has one "Add week" submit button, and
re-touching a saved day fires a conflict dialog. The user's role rules out the
Clock page's live punch buttons — they get pulled into a room on arrival, so
they can't press "in"/"out" at the moment. They **type** times after the fact:
arrival whenever they get a second, departure on the way out or at end of day
("two chunks"). That is a spreadsheet, not a time clock.

Two consequences follow:

1. The grid can't show Mon–Wed while you fill Thursday, and a single day can't
   stick on its own without the whole-week ceremony.
2. The dashboard counts every elapsed workday — including **today, before it's
   over** — as a full `dailyHours` deficit (`expectedHours`, `timesheet.ts:82`,
   no proration). So every morning reads "Behind pace −8h" plus anything not yet
   typed.

The fix turns the grid into a **live, auto-saving editable view of the week**,
adds a **half-finished "open row"** for the arrival-only state, and stops the
dashboard from **owing today until the day's shift is complete**.

## Decisions (user-confirmed)

- **Grid is a live sheet.** Cells load from saved entries; each row binds to its
  entry id and edits in place; every cell **auto-saves on blur** with a per-row
  `… saving → ✓ saved` indicator. **No "Add week" button** — auto-save only.
- **Open rows, no timer.** Typing an arrival with a blank out persists a normal
  ledger row `In 9:00 · Out — · Worked —` (`hours: 0`). No ticking timer, no
  resolve prompts. Typing the out later completes it in place. The Clock page
  and `open_shift` are **untouched** — a separate tool for when live punching
  fits.
- **Forgotten out self-corrects.** No modal nagging; next day the 0h row is a
  past day with no logged hours and surfaces as a shortfall on the dashboard.
- **Clear-to-delete (decision A).** Clearing both time cells of an *open* (0h)
  row deletes it silently. Clearing a *completed, logged* day is real data and
  stays an explicit trash-button action — a stray blur can't destroy it.
- **Don't owe today until done (decision B).** Today's **full** baseline (not
  prorated) is excluded from "expected so far" until today has a **completed
  entry** — for a clock shift that means **both times filled**; an hours-mode or
  leave entry is inherently complete. An open arrival-only row keeps today
  excluded → caught-up-through-yesterday reads **On pace ±0**. Once today has a
  completed entry, its full baseline counts (an under-logged day shows its true
  shortfall). At midnight today becomes a normal past day under the existing
  "no excused days" rule.
- **Conflict dialog scoped to CSV.** With edit-in-place there are no typed-entry
  insert conflicts; the conflict-resolution flow survives only for `importCsv`.

## Architecture

The data layer is **already day-by-day**: `addEntry` / `updateEntry` /
`deleteEntry` each persist one entry immediately, and the dashboard recomputes
from `data.entries` client-side. This work is entirely in the **form/UX layer**
plus one **today-aware tweak** to how the dashboard chooses its expected as-of —
no change to the storage contract and **no migration** (the schema already
allows `startTime` set with `endTime` null and `hours = 0`; `schema.ts:26-31`).

Three loosely-coupled slices, shippable in this order. Each holds `bun run
check` / `lint` / `test` at zero.

### Slice 1 — Dashboard "don't owe today until done"

Small, independent, immediate relief.

- **Trigger (pure):** add `isOpenEntry(e) = e.startTime != null && e.endTime ==
  null` and `todayBaselineCounts(entries, today) = entries.some(e => e.date ===
  today && !isOpenEntry(e))` to `timesheet.ts`. A completed clock shift, an
  hours-mode entry, or a leave entry all count; an arrival-only open row does
  not.
- **Apply via an effective as-of for expected only.** `makeWholeStatus` gains an
  optional `expectedAsOf?: string` (defaults to `asOf`). **Logged** still counts
  through `asOf` (today's partials, surplus). **Expected** counts through
  `expectedAsOf`. The dashboard passes `expectedAsOf = todayBaselineCounts ?
  asOf : addDays(asOf, -1)` so today's whole baseline drops out until the shift
  is complete. The heart math keeps its signatures; the entries-dependent
  decision is made by the caller.
- **Surfaces:** the same effective as-of feeds the hero status, the stat grid
  (Expected / Net / Surplus-or-Deficit), and the current-period bar of the
  hours chart, so "On pace" and the chart agree. The money-driven hero formula
  (`target hours = (expectedHours × targetRate + expenses) ÷ hourlyRate`) is
  unchanged except that `expectedHours` now uses the effective as-of.
- **Tests:** today-as-workday with (a) no entry, (b) an open row, (c) a
  completed shift, (d) an under-logged completed shift; today as a non-workday;
  weekend; epoch clamp unchanged; existing `makeWholeStatus` cases stay green
  with the defaulted param.

### Slice 2 — Open-row half-day model

- **Validation:** new `openEntryInput` in `src/lib/schemas/entry.ts` — `date` +
  required `startTime` + optional `note` → an `EntryInput` with `startTime` set,
  `endTime: null`, `hours: 0`, `breakHours: 0`, `entryKind: 'work'`. Break is
  meaningless without a worked span, so an open row carries none; it's captured
  when the out is filled and the row becomes a `clockEntryInput`. `EntryInput`
  already types `startTime`/`endTime` as `string | null` and `hours` as
  `number` (`entry.ts:18-26`), so an open row *is* a valid `EntryInput` with no
  type change — `openEntryInput` is the only new piece.
- **Persistence:** flows through the existing `Repo.addEntry` / `updateEntry` —
  no new repo method. The grid's save path (Slice 3) picks the mode: both times
  → clock; start only → open; hours typed → hours; leave select → leave.
  Completing an open row is a plain `updateEntry` that sets `endTime` and the
  computed `hours`.
- **Rendering:** the Ledger table, the mobile entry cards, and the grid detect
  `isOpenEntry` and show an **"in progress"** treatment (a quiet badge / dashed
  outline, Worked `—`) — visually distinct from unpaid leave's 0h badge.
- **Math is inert to open rows:** `loggedHours` / `overtimeHours` /
  `makeWholeStatus` all see `hours: 0`, so an open row contributes nothing and
  never grants false credit. The audit log records open add/edit/delete like any
  entry (snapshot carries `endTime: null`).
- **Tests:** `openEntryInput` parse/scrub; add-open → complete-in-place yields
  the right `hours`; ledger/grid render the in-progress state; audit snapshots.

### Slice 3 — Live auto-saving grid

The larger UI rework, in `src/routes/log/+page.svelte` + a save helper.

- **Load + bind.** Seed each row from `data.entries` filtered to `weekRowDates`,
  grouped by date: main row = the day's first shift, `+` sub-rows = shifts
  2…N, leave select = a leave entry. Each row holds its **entry id** (or null =
  new). Re-seed on week navigation. Keep the existing `gridReady` deferral so
  first paint stays cheap. Field names are unchanged (`start-{i}`,
  `start-{i}-{j}`) so nothing renumbers when weekends hide or shifts are added.
- **Auto-save on blur** (debounced ~500ms per row) via a `saveRow(rowState)`
  helper that builds FormData and posts to the route's existing actions:
  - new id-less row with content → `?/add`; capture the created id and store it
    on the row so the next edit is an `update` (requires `addEntry` /
    `addAction` to **return the new entry id**).
  - row with an id, changed → `?/update`.
  - open (0h) row with an id, cleared → `?/delete` (silent, decision A).
  - completed/logged row, cleared → no auto-delete; trash button only.
  - Demo mode branches to `runLogAction(demoRepo, …)` + `invalidate('demo:data')`,
    matching the settings/expenses idiom.
- **Sync strategy (perf).** Optimistically keep the grid's own row state as the
  source of truth while typing (no refetch needed for the grid itself), and run
  a single **trailing `invalidateAll()`** after the debounce settles so the
  Ledger, totals, and dashboard catch up without a fetch per keystroke. (User
  runs `bun run dev` in Firefox — verify save latency there, not just headless.)
- **Indicator.** Per-row state `idle | saving | saved | error`; inline field
  errors render exactly as today (`rowErr`).
- **Remove.** The `addWeek` action, the whole-week submit button, and the
  typed-entry branch of `conflictAwareEnhance`. Keep `add` / `update` / `delete`
  / `importCsv` / `clearAll` / `clearPeriod`; CSV import keeps its conflict
  dialog.
- **Mobile.** The stacked day-cards (below `lg`) auto-save through the same
  helper.
- **Tests:** core `addAction` returns an id; save-mode selection (clock / open /
  hours / leave); edit-in-place updates vs inserts; open-row clear deletes,
  logged-row clear does not. Playwright (dev + demo): type arrival → row
  persists in progress → add out later → completes → dashboard moves off
  "Behind pace"; navigate weeks and see saved days; no "Add week" button.

## Error handling

- Auto-save surfaces zod failures inline per row (the row indicator goes
  `error`, the value is not persisted) — same gate as settings auto-save.
- A failed POST leaves the typed value in the cell and marks the row `error` for
  retry on the next blur; it never silently drops input.
- An open row never blocks anything: math treats it as 0h until completed.
- `expectedAsOf` defaulting to `asOf` means every existing caller of
  `makeWholeStatus` (tests, other surfaces) is unaffected.

## Out of scope

- The Clock page, `open_shift`, and live punching — untouched.
- Proration of today's baseline by time-of-day (explicitly rejected; the rule is
  binary on shift completeness).
- Reminders/notifications for a forgotten out (the next-day shortfall is the
  nudge).
- Bulk typed entry beyond CSV import (auto-save replaces the week submit).
- Reworking the Ledger table's pagination or the savings/goal surfaces.
