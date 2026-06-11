<p align="center">
  <img src="src/lib/assets/favicon.svg" width="88" alt="Clopen logo: two doors opening outward from a shared frame">
</p>

# Clopen

A single-user timesheet app. You set a schedule (hours per day, which days
you work), log your hours, and it keeps a running balance of logged vs.
expected — in hours and in pay. Named after the close-then-open shift.

Everything is local: one SQLite file, no accounts, no network.

## What it does

- Running balance for a week, bi-week, month, quarter, or year. It compares
  totals, not individual days, so a long day covers a short one.
- Configurable schedule: hours per workday, which weekdays count, week start
  day, and a tracking start date — nothing is expected before it.
- Several ways to enter time: clock in/out times (it parses `2pm`, `230`,
  `14:00`), plain hour totals, a weekly grid you can paste into from a
  spreadsheet, or CSV import. Overnight shifts and multiple shifts per day
  work.
- A punch clock: clock in, take breaks, clock out, and the finished shift
  lands in the ledger as a normal entry. Breaks can accrue into one entry or
  split the shift.
- Leave entries: PTO, sick, holiday, vacation, each paid or unpaid. Paid
  leave counts toward the baseline; unpaid is recorded but doesn't.
- A ledger of every day back to your start date, logged or not, with
  fold-out notes and a fullscreen view.
- Optional overtime pay at a multiplier (off by default).
- Works on phones: bottom tabs, day cards instead of the grid, a card list
  instead of the table.

## Quick start

```sh
bun install
bun run db:migrate     # creates ./local.db
bun run dev            # http://localhost:5173
```

Set your rate, hours, workdays, and start date in **Settings**, then log
time on **Log**.

## Stack

Bun · SvelteKit 2 / Svelte 5 · TypeScript (strict) · Tailwind v4 ·
shadcn-svelte · Drizzle + libSQL · Biome · Vitest. The timesheet math is a
pure, unit-tested module (`src/lib/timesheet.ts`); the UI and database are
thin layers around it. Architecture notes are in [`CLAUDE.md`](./CLAUDE.md).
