# Clock in/out page — design

2026-06-10. Approved in-session.

## Why

The quick-add card is gone from the Log page; its replacement for "I'm working
right now" is a live punch clock: clock in, punch out/in for lunch and breaks,
clock out, with multiple shifts per day under a running timer. This also
introduces real timestamps (created/updated) on entries and an app-wide
timezone setting so day boundaries don't depend on where the browser runs.

## Decisions (user-confirmed)

- **Placement:** new Clock tab — 4th nav item (desktop header + mobile bottom
  bar): Dashboard / Clock / Log / Settings.
- **Break model:** a settings toggle `clockBreakMode`, default **accrue**
  (break punches accumulate into one shift entry's `breakHours`); **split**
  writes each in→out span as its own entry.
- **Timezone scope:** app-wide. `todayISO()` and all day-boundary math use the
  configured zone.
- **Stale shift:** prompt to resolve. An open shift started on a previous day
  shows a banner with set-end-time / save / discard. Nothing auto-writes.

## Architecture

**Open shift = single state row** (like `settings`), not a punch-event log and
not a null-ended entry. The ledger (`time_entries`) stays the only canonical
record; clock-out composes normal entries through the existing `Repo.addEntry`.
Audit lives on entries: `createdAt` (exists) + new `updatedAt`.

### Schema

- `settings` += `timeZone` (text, IANA, default `'America/Chicago'`),
  `observeDst` (boolean, default true), `clockBreakMode`
  (`'accrue' | 'split'`, default `'accrue'`).
- `time_entries` += `updatedAt` (integer epoch seconds, **null until first
  edit**; set by the update action in both server and demo repos).
- New `open_shift` table, single row `id = 'current'`:
  - `startedAt` integer epoch **ms**, nullable — start of the current open
    segment (null while on break in split mode, where the segment was already
    written as an entry)
  - `breakStartedAt` integer epoch ms, nullable — set while on break
  - `breakSeconds` integer, default 0 — accrued break (accrue mode)
  - `breakMode` text — snapshot of `clockBreakMode` taken at clock-in, so a
    mid-shift settings change doesn't corrupt the running shift

### State machine (`src/lib/core/clock.ts`, pure + unit-tested)

States: `idle` (no row) · `working` (`startedAt` set, `breakStartedAt` null) ·
`on_break` (`breakStartedAt` set; `startedAt` kept in accrue mode, null in
split mode). Adjust-start is only offered while `working`.

- **Clock in** (idle→working): create row, snapshot mode.
- **Start break** (working→on_break): accrue → set `breakStartedAt`; split →
  write entry for the closed segment immediately, keep the row as an
  on-break marker (`startedAt` cleared into the written entry, `breakStartedAt`
  = now).
- **Back to work** (on_break→working): accrue → `breakSeconds += now −
  breakStartedAt`, clear it; split → `startedAt = now` (new segment).
- **Clock out** (working→idle): accrue → one entry `{date, startTime, endTime,
  breakHours: breakSeconds/3600}`; split → entry for the final segment. Clear
  the row.
- **Clock out while on break** (on_break→idle): the shift ends at the break's
  start (you left and didn't come back).
- **Adjust start**: edit `startedAt` of the open segment (forgot-to-punch fix).
- **Resolve stale** (open shift whose start date ≠ today in the configured
  zone): save with an explicit end time, or discard the row.

Punch times are absolute epoch ms. Entry `date` / `startTime` / `endTime`
(HH:MM) are derived in the **effective zone at composition time**; overnight
spans rely on the existing `hoursBetween` midnight wrap.

Repo contract += `getOpenShift` / `saveOpenShift` / `clearOpenShift`. Demo repo
mirrors with a per-bucket localStorage key; `emptyRepo` returns null.

### Timezone (`src/lib/date.ts`)

- `effectiveZone(timeZone, observeDst)`: the IANA zone when observing DST,
  else its fixed standard-time offset as `Etc/GMT±N` (computed from the zone's
  January UTC offset; note the Etc sign inversion — Chicago standard is
  `Etc/GMT+6`).
- Module-level app zone with `setAppTimeZone(zone)`; `todayISO()` answers in
  it (fallback: previous behavior). The **root `+layout.ts`** sets it from
  settings before returning, so it's set before any page compute runs, on both
  server and client. Single-user app: shared server module state is fine.
- Formatting helpers for punch display ("since 9:02 AM") and entry-timestamp
  display reuse `formatTime`.

### Routes

- `src/routes/clock/+page.server.ts` — actions only (`in`, `breakStart`,
  `breakEnd`, `out`, `adjust`, `resolveSave`, `resolveDiscard`), each demo-
  gated like the other routes' actions, calling `src/lib/core/clock.ts`
  orchestrators with `serverRepo`.
- `src/routes/clock/+page.ts` — pure compute over `await parent()` (needs
  `openShift`, `entries`, `settings`).
- Root layout load adds `openShift` to its return (one cheap single-row read;
  keeps tab switches zero-network and lets the nav show a running indicator).
- Demo branches in the page's `use:enhance` handlers run the core actions
  against the demo repo + `invalidate('demo:data')`, per the established
  pattern.

### Clock page UI (`src/routes/clock/+page.svelte`)

- Big elapsed timer (ticks client-side each second from `startedAt`; break
  state shows break elapsed instead).
- State-appropriate buttons: Clock in / Take a break + Clock out / Back to
  work + Clock out.
- "Started at 9:02 AM" line with a small adjust control (time input, same
  parsing as the grid via `parseTimeInput`).
- "Today" card: today's logged shifts (from `entries`) with worked totals and
  a running grand total including the live shift.
- Stale-shift banner replaces the punch buttons until resolved.
- Nav: Clock tab in desktop header and mobile bottom bar, with a small dot
  when a shift is running.

### Settings UI (Clock section, auto-saving like the rest)

- Timezone: native select over the full IANA list
  (`Intl.supportedValuesOf('timeZone')`), default America/Chicago.
- "Observe daylight saving time" checkbox, default checked.
- Break punches: accrue into the shift (default) / split shifts at breaks.

### Created/modified visibility

Edit dialog footer: "Added Jun 10, 9:14 PM · Edited Jun 11, 8:02 AM" in the
configured zone (`createdAt` / `updatedAt`).

## Error handling

- Punch actions validate state transitions server-side (e.g. clock-in while a
  row exists → 409-style `fail` with a message); the UI disables the
  impossible buttons anyway.
- Zod validates the settings additions (`timeZone` must be in the supported
  list at parse time; booleans/enum as usual) and the adjust/resolve inputs
  (time format, end after start or explicit overnight).
- A running shift never blocks other features; the ledger/dashboard simply
  don't see it until it lands as entries.

## Testing

- Unit: state machine transitions (all six + adjust + resolve), accrue vs
  split composition, clock-out-on-break semantics, midnight-spanning
  composition, `effectiveZone` DST on/off mapping (Chicago, a non-DST zone,
  UTC), `todayISO` zone override.
- Existing suites must stay green (settings/entries shape changes ripple into
  `DEFAULT_SETTINGS` consumers).
- End-to-end (Playwright, dev + demo): full punch cycle in both break modes,
  stale-shift resolve, timezone change moving the day boundary, created/edited
  stamps in the edit dialog.

## Out of scope

- Notifications/reminders, idle detection, geofencing.
- Editing historical punches (the ledger's normal entry editing covers it).
- Multi-device conflict resolution beyond last-write-wins on the single row.
