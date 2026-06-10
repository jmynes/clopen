<p align="center">
  <img src="src/lib/assets/favicon.svg" width="88" alt="Clopen logo: two doors opening outward from a shared frame">
</p>

# Clopen

A personal timesheet. It tracks the hours you've worked against the hours you
were supposed to work, and what that means for your pay. The name comes from
the close-then-open shift (and, yes, the topology term).

Everything is local: one SQLite file on disk, no accounts, no network.

## What it does

- **Keeps a running balance.** Pick a period (week, bi-week, month, quarter,
  year) and the dashboard shows where you stand, in hours and dollars. Long
  days offset short ones; the comparison is always total logged against total
  expected, never day by day.
- **Uses your definition of a workweek.** Hours per workday, which weekdays
  count, which day the week starts on, and the date you started tracking —
  expected hours never accrue before that date.
- **Takes entries however you have them.** One at a time with clock in/out
  (it parses `2pm`, `230`, `14:00`) or plain hours; a whole week in a grid
  you can paste into from a spreadsheet; or a CSV import that matches your
  column names. Overnight shifts work. A day can hold several shifts — add
  them inline in the grid, or log to the same date and choose "keep both."
- **Treats leave as data.** PTO, sick, holiday, and vacation, each in paid
  and unpaid forms. Paid leave credits the baseline; unpaid leave is recorded
  but adds nothing, and is drawn hatched so the difference is visible.
- **Shows the gaps.** The ledger lists every day in the period, logged or
  not, back to your start date. Notes fold out under their rows, weekends
  can be hidden when they're empty, and the whole table has a fullscreen
  view.
- **Optionally pays overtime at a premium.** Off by default; when enabled,
  day-hours past the baseline earn at a configurable multiplier (1.5× to
  start). The balance math is unaffected either way.
- **Fits a phone.** Below tablet width the nav becomes a bottom tab bar, the
  week grid becomes day cards, and the ledger becomes a list.

## Quick start

```sh
bun install
bun run db:migrate     # creates ./local.db
bun run dev            # http://localhost:5173
```

Set your rate, baseline, workdays, and start date in **Settings**, then log
hours on **Log**. The **Dashboard** does the rest.

## Under the hood

Bun · SvelteKit 2 / Svelte 5 · TypeScript (strict) · Tailwind v4 ·
shadcn-svelte · Drizzle + libSQL · Biome · Vitest. The accounting lives in a
pure, unit-tested module (`src/lib/timesheet.ts`); the UI and database are
thin layers around it. Architecture notes and conventions are in
[`CLAUDE.md`](./CLAUDE.md).
