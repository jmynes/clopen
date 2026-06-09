# Timesheet

A personal, single-user timesheet tracker that answers one question at any point
in the year: **how many hours am I behind, and how many do I need to make up to
be "whole"?**

- **Baseline:** `dailyHours` (default 8h) on each workday (default Mon–Fri =
  40h/week), accruing from Jan 1.
- **Overtime banks.** Extra hours aren't paid at a premium — they offset
  shortfalls, because the app compares *total logged* to *total expected* up to
  your chosen as-of date.
- **No excused days.** Any missed workday is a deficit you owe.
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

1. **Settings** — set your hourly rate, hours per workday, and which days count.
2. **Log** — record hours per day (multiple entries per day are fine).
3. **Dashboard** — see hours to be whole, the dollar value, and a weekly
   logged-vs-target chart. Move the **As of** date to inspect any point in the
   year.

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
