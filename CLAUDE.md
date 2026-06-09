# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

A **personal, single-user** timesheet tracker. One question drives it: *at any
point in the calendar year, how many hours am I behind, and how much do I need
to make up to be "whole"?*

**Model:** hourly pay; baseline of `dailyHours` (default 8h) on each configured
workday (default Mon–Fri → 40h/week). Overtime is tracked but **not** paid at a
premium — it banks against shortfalls because we compare *total* logged hours to
*total* expected hours up to the as-of date. **No excused days** (any missed
workday is a deficit). Year boundary is the **calendar year** (Jan 1). Runs
locally; no auth, no deploy.

The math lives in `src/lib/timesheet.ts` (pure, fully unit-tested) — the heart
of the app. UI and DB are thin layers around it.

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
  `expectedHours`, `loggedHours`, `makeWholeStatus`, `weeklyBreakdown`,
  `yearStartOf`. Timezone-safe (UTC arithmetic on explicit dates). Tested in
  `timesheet.test.ts` (leap day, partial weeks, year-boundary, overtime banking).
- `src/lib/db/schema.ts` — Drizzle tables: `time_entries` (multiple per day) and
  single-row `settings` (`hourlyRate`, `dailyHours`, `workdays` JSON).
- `src/lib/db/index.ts` — Drizzle/libSQL client, **lazy-constructed via Proxy**
  so module load doesn't open a connection during SvelteKit's build analyse pass.
  Local default `file:./local.db`.
- `src/lib/server/entries.ts` / `settings.ts` — CRUD with an **injectable `db`
  arg** so unit tests run against an in-memory libSQL (`entries.test.ts`).
  `toWorkSettings` maps a settings row into the shape the math expects.
- `src/lib/schemas/*` — Zod schemas (`entryInput`, `settingsInput`).
- `src/lib/date.ts` — local `todayISO()` (via `@internationalized/date`) and
  display formatters. Keeps non-pure date-of-now logic out of `timesheet.ts`.
- `src/routes/+page.*` — dashboard: hero make-whole figure, as-of picker
  (`?asOf=`), stat grid, weekly chart.
- `src/routes/log/+page.*` — add/edit/delete entries via form actions.
- `src/routes/settings/+page.*` — pay rate, daily hours, workdays.

## Git

Conventional commits with area scope (`feat(ui):`, `feat(server):`, `chore:`).
Every commit ends with:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```
