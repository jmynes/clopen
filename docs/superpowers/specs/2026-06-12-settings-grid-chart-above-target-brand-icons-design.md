# Settings 2×2 grid · chart above-target · real brand logos

Approved 2026-06-12. Three independent UI changes, no schema or math changes.

## 1. Settings page: balanced 2×2 card grid

`src/routes/settings/+page.svelte`: the cards grid drops `lg:grid-cols-3`
(four cards in three columns orphaned the Dashboard card on a second row) and
keeps `md:grid-cols-2` — a 2×2 at desktop. Cards keep their contents and order:
Pay & schedule, Clock & time / Log & Ledger, Dashboard. Inner field grids drop
their `lg:grid-cols-1` overrides (they existed to fit third-width cards) so
fields sit two-up in the wider half-width cards via the existing
`sm:grid-cols-2`.

## 2. Weekly chart: above-target weeks read distinctly

`src/lib/components/WeeklyChart.svelte`: a week with `logged > target` renders
a stacked two-tone bar — success green up to the target line, the overtime
portion above it in a brighter emerald (the hero's "Beat it" family). Exactly
met stays solid success; below stays amber. Legend gains "Above target" as a
third chip. Hover value and title unchanged (full logged hours). No data
changes — `weeklyBreakdown` already supplies `logged`/`target`.

## 3. Real Grubhub and Uber Eats logos

Add `simple-icons` (data-only brand SVG paths, like the FA data packages; FA
brands has no Grubhub or Uber Eats glyph). New `GrubhubIcon.svelte` and
`UberEatsIcon.svelte` in `$lib/components/brand/` follow the `UberIcon`
pattern: inline SVG, `currentColor`, 24×24 viewBox from the simple-icons
definition. `src/routes/expenses/+page.svelte` maps `grubhub` to GrubhubIcon
(replacing the lucide Soup stand-in) and `uber_eats` to UberEatsIcon
(replacing the green-tinted Uber badge). Existing tint classes stay.

## Done means

`bun run check`, `bun run lint`, `bun run test` all clean; committed per area
(conventional commits); pushed to `main`; Railway deploy reaches SUCCESS.
