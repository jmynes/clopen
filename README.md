# Hours Tracker

A personal, single-user timesheet tracker that answers two questions: **did I
make the hours I owe over the period that matters to me, and am I getting
paid the right amount?**

- **Baseline:** `dailyHours` (default 8h) on each configured workday (default
  Mon–Fri = 40h/week).
- **Period-driven dashboard.** Pick week / bi-week / month / quarter / year and
  see whether you made it, came up short, or are still on pace.
- **Tracking epoch.** Year-to-date math is clamped to your start date so
  year-one doesn't backfill expected hours before you began.
- **Overtime banks.** Extra hours offset shortfalls; they aren't paid at a
  premium — the app compares *total logged* against *total expected*.
- **Leave taxonomy.** Eight kinds in paid/unpaid pairs: **PTO / UPTO**,
  **Sick (paid / unpaid)**, **Holiday (paid / unpaid)**, **Vacation (paid /
  unpaid)**. Paid kinds credit the daily baseline; unpaid kinds record 0h.
- **Cumulative-timesheet CSV import.** Pre-existing "Day of the week" sheets
  with `Check-in / Check-out / Total hours` columns import directly, including
  shifts that cross midnight.
- **Local only.** SQLite on disk, no accounts, no cloud.

## Stack

Bun · SvelteKit 2 / Svelte 5 (runes) · TypeScript (strict) · Tailwind v4 ·
shadcn-svelte · Drizzle ORM + libSQL · Biome · Vitest.

## Quick start

```sh
bun install
bun run db:migrate     # creates ./local.db with the schema
bun run dev            # http://localhost:5173
```

1. **Settings** — hourly rate (defaults to $38.4615 = 80k / 2080h), hours per
   workday, workdays, week start (Sunday default), tracking epoch, and 12h/24h
   clock format.
2. **Log** — record entries one at a time, a full week at once, or import a CSV.
   Each row supports clock in/out, plain hours, or a single-tap **PTO** button.
3. **Dashboard** — pick a period and read off the verdict; the YTD weekly chart
   stays below for reference.

## Features at a glance

- **Dashboard hero** — `Beat it / Made it / Came up short / Ahead of pace /
  Behind pace / On pace / Not started`. Done periods with net > 0 surface as
  "Beat it · overtime banked"; done periods with net == 0 are "Made it"; the
  in-progress states explain pace vs. target.
- **Pagination & blanks** — entries table scopes to the active bucket and pads
  unlogged days with em-dashes so the gaps are obvious. Hovering a row darkens
  its existing color (PTO row gets a deeper emerald, zebra rows get a deeper
  muted) rather than overwriting it.
- **Leave entries** — colored badge in the Type column (Palmtree, Thermometer,
  PartyPopper, Plane). Paid kinds use a filled chip; unpaid kinds use a dashed
  outline. The row picks up a matching subtle tint.
- **Add an entry** — a 4×2 grid of leave shortcut buttons (PTO/UPTO,
  Sick paid/unpaid, Holiday paid/unpaid, Vacation paid/unpaid) sits below the
  regular fields, so a one-tap leave log is always at hand.
- **Log a week** — per-row Type select with icons and color-keyed labels.
  Choosing a leave kind hides clock/break and shows a "Sick · 8.00h paid" /
  "Vacation · unpaid" badge in the In column.
- **Edit modal** — same Type chooser as Add an entry, letting you flip any
  entry between Work and any of the eight leave kinds.
- **Overnight shifts** — clock-out earlier than clock-in is treated as next-day
  on the same date; the entries table tags it `+1d`.
- **Duplicate-date guard** — if you try to add a date that already has entries
  the app pops a dialog showing both sides and asks: overwrite, keep existing,
  or cancel.
- **AM/PM color hint** — rose `AM` and sky `PM` on the meridiem so you can scan
  start/end at a glance.
- **Theme switch** — segmented sun/moon control right of Settings; OS-preferred
  theme by default, persisted in localStorage, applied before first paint to
  avoid FOUC.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Dev server |
| `bun run build` / `bun run preview` | Production build / preview |
| `bun run check` | `svelte-check` (types + a11y) — must be 0/0 |
| `bun run lint` / `lint:fix` | Biome check / auto-fix — must be 0/0 |
| `bun run test` | Vitest (make-whole math + DB CRUD) |
| `bun run db:generate` / `db:migrate` / `db:studio` | Drizzle migrations / studio |

The make-whole math is pure and lives in `src/lib/timesheet.ts`, covered by
`src/lib/timesheet.test.ts`. See [`CLAUDE.md`](./CLAUDE.md) for architecture and
conventions.
