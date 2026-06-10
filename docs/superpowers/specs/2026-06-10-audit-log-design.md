# Entry audit log — design

2026-06-10. Approved in-session (follow-up to the clock-page feature).

## Why

`createdAt`/`updatedAt` cover "when was this added/last edited", but deletes
are hard deletes with no trace, and edits keep only the last timestamp. The
user wants a timestamped log of every add / edit / delete on the ledger,
viewable from Settings.

## Design

**`entry_events` table** — append-only:

- `id` text pk (nanoid / uuid)
- `entryId` text — the affected entry
- `action` text enum `'add' | 'edit' | 'delete'`
- `at` integer epoch **ms** (finer than the entries' second stamps so bulk
  operations keep their order)
- `snapshot` text — JSON of the entry row **after** an add/edit, or **as it
  was** at deletion. An entry's full history is the chain of its snapshots;
  an edit's before-state is the previous event's snapshot.

**Writers live at the repo implementation level** (`src/lib/server/entries.ts`
and `src/lib/demo/repo.ts`), inside `addEntry` / `updateEntry` / `deleteEntry`
/ `deleteEntriesByDates` — so every path that mutates the ledger (single add,
weekly grid, CSV import, conflict overwrite, clock compose, edit dialog,
deletes) is logged with no per-caller wiring. `updateEntry` re-reads the row
after the write to snapshot the result; deletes snapshot before removing.
Demo events are capped at the latest 500 per bucket (localStorage), written
best-effort (a logging failure never blocks the mutation).

**Repo contract** += `listEntryEvents(): Promise<EntryEvent[]>` (newest
first; server capped at the latest 1000). `emptyRepo` returns `[]`.

**Viewer: `/settings/audit`** — an on-demand page (its own server load is
acceptable here; it is not one of the nav tabs, and this keeps event data out
of the layout payload). Demo branch reads localStorage via the usual
`+page.ts` pattern. The page lists events newest-first: an action chip
(Added / Edited / Deleted), the entry summary from the snapshot (date, clock
range or hours, leave kind), and the event timestamp via `formatTimestamp`
in the app zone. Back link to Settings. Entry: an "Audit log" button in the
Settings footer bar next to Reset-to-defaults.

## Out of scope

- Restore/undo from snapshots (the data supports it later).
- Pruning UI; server log grows unbounded (personal app, sqlite).
- Settings-change auditing (entries only).
