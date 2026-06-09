# Clopen

**Did you work the hours you owe — and is your pay right?**

Clopen answers those two questions at a glance, for any stretch of time you
care about. It's a personal timesheet named after the worst shift on the
schedule — closing at night and opening the next morning — with a topology
pun thrown in for free.

Everything runs on your machine. No accounts, no cloud, no one watching your
hours but you.

## The verdict, not a spreadsheet

Pick a period — week, bi-week, month, quarter, year — and the dashboard hands
you a verdict: **Beat it · overtime banked**, **Made it**, **Came up short**,
**Ahead of pace**, **Behind pace**. Behind each verdict: hours logged against
hours owed, dollars earned against dollars expected, and a week-by-week chart
of the year so far.

Clopen thinks in *balances*, not punch cards. Long days bank against short
ones, because what matters is the running total — not whether Tuesday was
perfect. Your "owed" baseline is yours to define: hours per workday, which
days count, and the date you started tracking (so your first year isn't
haunted by months before day one).

## Log time the way it actually happened

- **One entry at a time** — clock in/out (type `2pm`, `230`, `14:00` —
  Clopen understands) or plain hours, with a live **Worked** total as you
  type. Overnight shift? Clocking out earlier than you clocked in just works,
  tagged `+1d`.
- **A whole week at once** — a spreadsheet-style grid you can paste into
  straight from Excel or Sheets. **Fill** copies the field you just touched
  across the week. Worked a split day? Hit **+** on the day and log a second
  shift right inline.
- **Leave in one tap** — PTO, sick, holiday, vacation, each in paid and
  unpaid flavors. Paid leave credits your baseline; unpaid leave is recorded
  with a dashed badge and a hatched row so it never masquerades as pay.
- **Double-booked a date?** Clopen shows both versions side by side and asks:
  overwrite, keep existing, keep both — and when the times don't overlap, it
  recognizes a second shift when it sees one.
- **CSV in, CSV out** — import the cumulative timesheet you already keep
  (it matches your column names, not the other way around) and export
  everything any time.

## A ledger you can actually read

The entries table pads unlogged days so gaps stare back at you, tints
weekends amber, color-codes leave by family, and badges overtime days. Notes
tuck behind a sticky-note button and unfold beneath the row. Need room? One
click takes the whole ledger fullscreen. Weekends optional, blank history
capped at your start date, AM rose / PM sky so clock times scan at a glance.

Spot a mistake? Edit or delete any entry in place — even add an entry to an
empty day right from its row.

## Overtime, your way

By default overtime isn't paid at a premium — it banks against shortfalls.
But if your job pays time-and-a-half, flip one switch in Settings, set the
multiplier, and the dashboard's earnings follow suit. Day-hours past your
baseline earn at the multiplier; the make-whole math stays untouched.

## Pocket-sized when it needs to be

Below tablet width Clopen swaps to mobile chrome: an iOS-style tab bar, a
hamburger menu, day cards instead of the spreadsheet grid, and a stacked
entries list. Same data, same math, thumb-friendly.

## Quick start

```sh
bun install
bun run db:migrate     # creates ./local.db
bun run dev            # http://localhost:5173
```

Open **Settings**, set your hourly rate and baseline, pick your workdays and
start date — then start logging on **Log** and let the **Dashboard** keep
score.

## Under the hood

Bun · SvelteKit 2 / Svelte 5 · TypeScript (strict) · Tailwind v4 ·
shadcn-svelte · Drizzle + libSQL · Biome · Vitest. The make-whole math is a
pure, fully unit-tested module (`src/lib/timesheet.ts`); the UI and database
are thin layers around it. Architecture, conventions, and the full command
list live in [`CLAUDE.md`](./CLAUDE.md).
