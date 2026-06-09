<script lang="ts">
  import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
  import Briefcase from '@lucide/svelte/icons/briefcase';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Download from '@lucide/svelte/icons/download';
  import Maximize2 from '@lucide/svelte/icons/maximize-2';
  import Minimize2 from '@lucide/svelte/icons/minimize-2';
  import Palmtree from '@lucide/svelte/icons/palmtree';
  import PartyPopper from '@lucide/svelte/icons/party-popper';
  import Plane from '@lucide/svelte/icons/plane';
  import Plus from '@lucide/svelte/icons/plus';
  import Thermometer from '@lucide/svelte/icons/thermometer';
  import Upload from '@lucide/svelte/icons/upload';
  import X from '@lucide/svelte/icons/x';
  import { innerWidth } from 'svelte/reactivity/window';
  import { slide } from 'svelte/transition';
  import { enhance } from '$app/forms';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import * as Table from '$lib/components/ui/table';
  import { toCsv } from '$lib/csv';
  import { formatDay, formatRangeISO, formatTime, formatWeekRange, isWeekend, todayISO, weekdayShort } from '$lib/date';
  import type { TimeEntry } from '$lib/db/schema';
  import { LEAVE_KINDS, LEAVE_META, type LeaveKind } from '$lib/leave-kinds';
  import { addDays, parseTimeInput, weekDates } from '$lib/timesheet';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const hrs = (n: number) =>
    `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`;

  // Inline field-error lookups for each form on this page.
  function errorsFrom(key: 'fieldErrors' | 'editFieldErrors' | 'weekFieldErrors'): Record<string, string> {
    if (form && key in form) {
      const v = (form as Record<string, unknown>)[key];
      if (v && typeof v === 'object') return v as Record<string, string>;
    }
    return {};
  }
  const addErrors = $derived(errorsFrom('fieldErrors'));
  const editErrors = $derived(errorsFrom('editFieldErrors'));
  const weekErrors = $derived(errorsFrom('weekFieldErrors'));

  // Reformat a free-typed time ("2pm", "230", "14:00") to a friendly label on blur.
  function normalizeTime(e: FocusEvent & { currentTarget: HTMLInputElement }) {
    const parsed = parseTimeInput(e.currentTarget.value);
    if (parsed) e.currentTarget.value = formatTime(parsed, data.timeFormat);
  }
  // Friendly label for an initial HH:MM value (edit dialog); '' stays ''.
  const timeLabel = (hhmm: string | null) => (hhmm ? formatTime(hhmm, data.timeFormat) : '');
  // Mode-aware placeholders for clock inputs.
  const startPlaceholder = $derived(data.timeFormat === '24h' ? '09:00' : '09:00 AM');
  const endPlaceholder = $derived(data.timeFormat === '24h' ? '17:30' : '05:30 PM');

  // Split a formatted clock string into (digits, meridiem) for color-coded rendering.
  function splitMeridiem(formatted: string): { time: string; meridiem: 'AM' | 'PM' | '' } {
    if (formatted.endsWith(' AM')) return { time: formatted.slice(0, -3), meridiem: 'AM' };
    if (formatted.endsWith(' PM')) return { time: formatted.slice(0, -3), meridiem: 'PM' };
    return { time: formatted, meridiem: '' };
  }

  // Per-day totals of *net* worked hours (after breaks) drive the overtime badge.
  const dayTotals = $derived(
    data.entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.date] = (acc[e.date] ?? 0) + e.hours - e.breakHours;
      return acc;
    }, {}),
  );

  // Input mode for the single-entry form: clock in/out (default) or plain hours.
  let addMode = $state<'hours' | 'clock'>('clock');
  let addModeInput: HTMLInputElement | null = $state(null);
  let addKindInput: HTMLInputElement | null = $state(null);

  // Two toggle options, clock on the left.
  const MODE_OPTIONS = [
    { m: 'clock', label: 'Clock in/out' },
    { m: 'hours', label: 'Hours' },
  ] as const;

  let editing = $state<TimeEntry | null>(null);
  let editOpen = $state(false);

  // Delete-confirmation dialog state — populated by the trash button on a row.
  let deleting = $state<TimeEntry | null>(null);
  let deleteForm = $state<HTMLFormElement | null>(null);
  function confirmDelete(entry: TimeEntry) {
    deleting = entry;
  }
  function executeDelete() {
    deleteForm?.requestSubmit();
  }

  // Conflict-resolution state shared by the add/addWeek/importCsv forms.
  type ConflictEntry = {
    startTime: string | null;
    endTime: string | null;
    hours: number;
    breakHours: number;
    note: string | null;
  };
  type ConflictRow = { date: string; existing: ConflictEntry[]; proposed: ConflictEntry };
  let conflictForm = $state<HTMLFormElement | null>(null);
  let conflicts = $state<ConflictRow[]>([]);
  function clearConflictStrategy(formEl: HTMLFormElement) {
    formEl.querySelector('input[name="conflictStrategy"]')?.remove();
  }
  function resolveConflict(strategy: 'overwrite' | 'skip' | 'cancel') {
    const formEl = conflictForm;
    if (!formEl || strategy === 'cancel') {
      conflictForm = null;
      conflicts = [];
      return;
    }
    let input = formEl.querySelector<HTMLInputElement>('input[name="conflictStrategy"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'conflictStrategy';
      formEl.appendChild(input);
    }
    input.value = strategy;
    conflicts = [];
    formEl.requestSubmit();
  }
  // Re-runnable enhance factory: closes over a `resetOnSuccess` flag so the
  // weekly grid (which resets) and import form (which doesn't) share one path.
  function conflictAwareEnhance(opts: { resetOnSuccess?: boolean } = {}) {
    return ({ formElement, formData }: { formElement: HTMLFormElement; formData: FormData }) => {
      // If this is the user's first submit (not a retry), strip any stale
      // conflictStrategy from a previous round so the server re-detects.
      if (!formData.has('conflictStrategy')) clearConflictStrategy(formElement);
      return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: (o?: { reset?: boolean }) => Promise<void> }) => {
        const data = result.data;
        const conflictList = data?.conflicts;
        if (result.type === 'failure' && Array.isArray(conflictList) && conflictList.length > 0) {
          conflictForm = formElement;
          conflicts = conflictList as ConflictRow[];
          return;
        }
        clearConflictStrategy(formElement);
        await update({ reset: opts.resetOnSuccess && result.type === 'success' });
      };
    };
  }
  // Edit dialog mirrors the same toggle, defaulting to whichever the entry used.
  let editMode = $state<'hours' | 'clock'>('hours');
  // Editable entry kind. 'work' shows the clock/hours fields; leave kinds hide them.
  let editKind = $state<'work' | LeaveKind>('work');

  function openEdit(entry: TimeEntry) {
    editing = entry;
    editKind = entry.entryKind as 'work' | LeaveKind;
    editMode = entry.startTime && entry.endTime ? 'clock' : 'hours';
    editOpen = true;
  }

  // Weekly grid. Rows are keyed by date, so navigating weeks recreates the
  // inputs (clearing anything typed). Field names hours-0…6 map to the row
  // order, which the server recomputes as weekStart + i days.
  let weekAnchor = $state(todayISO());
  const weekRowDates = $derived(weekDates(weekAnchor, data.weekStartsOn));
  const weekStart = $derived(weekRowDates[0]);
  // Visible grid rows. `i` stays the day offset from weekStart (the server maps
  // field names hours-{i} etc. back to weekStart + i), so hiding weekends must
  // not renumber the remaining rows.
  const weekRows = $derived(
    weekRowDates.map((date, i) => ({ date, i })).filter((r) => !data.hideWeekendsGrid || !isWeekend(r.date)),
  );
  // The weekly grid shares the same modes, also defaulting to clock in/out.
  let weekMode = $state<'hours' | 'clock'>('clock');

  // Month/year jump for the weekly grid, derived from the current anchor.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const anchorYear = $derived(Number(weekAnchor.slice(0, 4)));
  const anchorMonth = $derived(Number(weekAnchor.slice(5, 7))); // 1–12
  const yearOptions = $derived.by(() => {
    const ty = Number(todayISO().slice(0, 4));
    const set = new Set<number>([anchorYear]);
    for (let y = ty - 5; y <= ty + 1; y++) set.add(y);
    return [...set].sort((a, b) => a - b);
  });
  function jumpTo(year: number, month: number) {
    weekAnchor = `${year}-${String(month).padStart(2, '0')}-01`;
  }

  // Export every entry as CSV (gross hours + break + clock times round-trip).
  function exportCsv() {
    const header = ['Date', 'Hours', 'Break', 'Clock In', 'Clock Out', 'Note'];
    const rows = data.entries.map((e) => [e.date, e.hours, e.breakHours, e.startTime ?? '', e.endTime ?? '', e.note ?? '']);
    const blob = new Blob([toCsv([header, ...rows])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  let csvInput = $state<HTMLInputElement | null>(null);

  // ── Entries pagination ───────────────────────────────────────────────────
  type Period = 'week' | 'biweek' | 'month' | 'quarter' | 'year';
  const PERIOD_LABELS: Record<Period, string> = {
    week: 'Weekly',
    biweek: 'Bi-weekly',
    month: 'Monthly',
    quarter: 'Quarterly',
    year: 'Yearly',
  };
  let entriesPeriod = $state<Period>('year');
  let entriesAnchor = $state(todayISO());
  // The entries table (md+) and stacked list (below md) are alternates; with
  // hundreds of rows per period, rendering both and hiding one via CSS doubles
  // the work. SSR/hydration (width unknown) renders both — the md:/md:hidden
  // classes pick one visually — then the first client measure tears down the
  // unused view.
  const showEntriesTable = $derived(innerWidth.current === undefined || innerWidth.current >= 768);
  const showEntriesList = $derived(innerWidth.current === undefined || innerWidth.current < 768);

  // Entry-row action buttons are plain elements (ghost icon-button classes
  // inlined) — with ~365 rows in a year view, per-row components are the
  // difference between an instant and a multi-second period switch.
  const ROW_BTN =
    'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent transition-all outline-none select-none hover:bg-muted hover:text-foreground active:translate-y-px focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-muted/50';

  // Per-entry note accordion. Rows without an override follow the expandNotes
  // setting, so toggling the setting flips every untouched row at once.
  let noteOverrides = $state<Map<string, boolean>>(new Map());
  const isNoteOpen = (id: string) => noteOverrides.get(id) ?? data.expandNotes;
  function toggleNote(id: string) {
    const next = new Map(noteOverrides);
    next.set(id, !isNoteOpen(id));
    noteOverrides = next;
  }

  // Fullscreen takeover for the entries section. Escape collapses it unless a
  // dialog is open on top (those own the Escape key).
  let entriesExpanded = $state(false);
  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (entriesExpanded && !editOpen && deleting === null && conflicts.length === 0) entriesExpanded = false;
  }

  function shiftMonth(anchor: string, n: number): string {
    const [y, m] = anchor.slice(0, 7).split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return d.toISOString().slice(0, 10);
  }
  function lastDayOf(yearMonth01: string): string {
    const [y, m] = yearMonth01.slice(0, 7).split('-').map(Number);
    const d = new Date(Date.UTC(y, m, 0));
    return d.toISOString().slice(0, 10);
  }

  const entriesBucket = $derived.by(() => {
    const anchor = entriesAnchor;
    const wsOn = data.weekStartsOn;
    switch (entriesPeriod) {
      case 'week': {
        const start = weekDates(anchor, wsOn)[0];
        const end = addDays(start, 6);
        return { start, end, label: formatWeekRange(start, true) };
      }
      case 'biweek': {
        const wk = weekDates(anchor, wsOn)[0];
        const start = addDays(wk, -7);
        const end = addDays(wk, 6);
        return { start, end, label: formatRangeISO(start, end, true) };
      }
      case 'month': {
        const start = `${anchor.slice(0, 7)}-01`;
        const end = lastDayOf(start);
        const y = Number(anchor.slice(0, 4));
        return { start, end, label: `${MONTHS[Number(anchor.slice(5, 7)) - 1]} ${y}` };
      }
      case 'quarter': {
        const y = Number(anchor.slice(0, 4));
        const m = Number(anchor.slice(5, 7));
        const qm = Math.floor((m - 1) / 3) * 3 + 1;
        const start = `${y}-${String(qm).padStart(2, '0')}-01`;
        const end = lastDayOf(`${y}-${String(qm + 2).padStart(2, '0')}-01`);
        return { start, end, label: `Q${Math.floor((m - 1) / 3) + 1} ${y}` };
      }
      case 'year': {
        const y = Number(anchor.slice(0, 4));
        return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
      }
    }
  });

  const pagedEntries = $derived(
    data.entries.filter((e) => e.date >= entriesBucket.start && e.date <= entriesBucket.end),
  );

  // The tracking epoch is the floor: once the current bucket reaches it there's
  // nothing older to page back to.
  const entriesAtEpoch = $derived(entriesBucket.start <= data.epoch);

  // Pad missing days with blank rows for every period so unlogged days stand
  // out at a glance. The scrollable container keeps long quarters/years usable.
  // Either weekend setting suppresses the blank Sat/Sun padding; days with
  // actual entries always show.
  const hideBlankWeekends = $derived(data.hideWeekendsEntries || data.hideWeekendsGrid);
  type DisplayRow = { kind: 'entry'; entry: TimeEntry } | { kind: 'blank'; date: string };
  const displayRows = $derived.by<DisplayRow[]>(() => {
    const byDate = new Map<string, TimeEntry[]>();
    for (const e of pagedEntries) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    const rows: DisplayRow[] = [];
    // Walk dates from end → start so newest stays on top. Cap upper bound at
    // today so future dates in the bucket (e.g. rest of year) aren't listed.
    const today = todayISO();
    let cursor = entriesBucket.end < today ? entriesBucket.end : today;
    while (cursor >= entriesBucket.start) {
      const dayEntries = byDate.get(cursor);
      if (dayEntries && dayEntries.length > 0) {
        for (const entry of dayEntries) rows.push({ kind: 'entry', entry });
      } else if (cursor >= data.epoch && (!hideBlankWeekends || !isWeekend(cursor))) {
        rows.push({ kind: 'blank', date: cursor });
      }
      cursor = addDays(cursor, -1);
    }
    return rows;
  });

  function shiftEntriesPage(dir: -1 | 1) {
    switch (entriesPeriod) {
      case 'week':
        entriesAnchor = addDays(entriesAnchor, 7 * dir);
        return;
      case 'biweek':
        entriesAnchor = addDays(entriesAnchor, 14 * dir);
        return;
      case 'month':
        entriesAnchor = shiftMonth(entriesAnchor, dir);
        return;
      case 'quarter':
        entriesAnchor = shiftMonth(entriesAnchor, 3 * dir);
        return;
      case 'year':
        entriesAnchor = shiftMonth(entriesAnchor, 12 * dir);
        return;
    }
  }

  // ── Spreadsheet-style editing for the weekly grid ────────────────────────
  let weekForm = $state<HTMLFormElement | null>(null);
  // Column order per mode; paste/fill distribute across these (notes included).
  const gridCols = $derived(weekMode === 'clock' ? ['start', 'end', 'break', 'note'] : ['hours', 'break', 'note']);

  function inputByName(name: string): HTMLInputElement | null {
    const el = weekForm?.querySelector(`[name="${name}"]`);
    return el instanceof HTMLInputElement ? el : null;
  }

  // Write a cell, normalizing clock columns ("2pm" → "2:00 PM") like on blur.
  function setCell(col: string, row: number, raw: string) {
    const cell = inputByName(`${col}-${row}`);
    if (!cell) return;
    if (col === 'start' || col === 'end') {
      const parsed = parseTimeInput(raw);
      cell.value = parsed ? formatTime(parsed, data.timeFormat) : raw.trim();
    } else {
      cell.value = raw.trim();
    }
  }

  // Wipe every editable cell in the weekly grid (form.reset would also clear
  // the hidden weekStart/mode inputs, so we walk the named inputs directly).
  function clearWeek() {
    if (!weekForm) return;
    const inputs = weekForm.querySelectorAll<HTMLInputElement>('input[name]');
    inputs.forEach((el) => {
      if (/^(start|end|break|hours|note)-\d$/.test(el.name)) el.value = '';
    });
    leaveRows = new Map();
  }

  // Per-row leave selection. Rows present in this map render in leave mode
  // and submit a hidden leave-{i} value (one of LEAVE_KINDS) on form submit.
  let leaveRows = $state<Map<number, LeaveKind>>(new Map());
  function setLeaveRow(i: number, kind: LeaveKind | '') {
    const next = new Map(leaveRows);
    if (kind === '') next.delete(i);
    else next.set(i, kind);
    leaveRows = next;
  }

  // Lucide icon per leave kind (paid/unpaid share the same icon).
  const LEAVE_ICON = {
    pto: Palmtree,
    pto_unpaid: Palmtree,
    sick_paid: Thermometer,
    sick_unpaid: Thermometer,
    holiday_paid: PartyPopper,
    holiday_unpaid: PartyPopper,
    vacation_paid: Plane,
    vacation_unpaid: Plane,
  } satisfies Record<LeaveKind, typeof Palmtree>;

  // All class strings are spelled out so Tailwind's JIT picks them up. Paid
  // variants use a filled background; unpaid variants use a dashed outline
  // with a lighter wash to call out "no pay".
  const KIND_CLASSES: Record<
    LeaveKind,
    { badge: string; row: string; button: string; activeButton: string }
  > = {
    pto: {
      badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      row: 'bg-emerald-500/10 hover:bg-emerald-500/20! ring-1 ring-inset ring-emerald-500/30',
      button:
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400',
      activeButton: 'bg-emerald-500/25 ring-2 ring-inset ring-emerald-500/60',
    },
    pto_unpaid: {
      badge:
        'bg-emerald-500/10 text-emerald-700 border border-dashed border-emerald-500/60 dark:text-emerald-300',
      row: 'bg-emerald-500/5 hover:bg-emerald-500/15! ring-1 ring-inset ring-emerald-500/25',
      button:
        'border-dashed border-emerald-500/50 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400',
      activeButton: 'bg-emerald-500/15 ring-2 ring-inset ring-emerald-500/50',
    },
    sick_paid: {
      badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
      row: 'bg-rose-500/10 hover:bg-rose-500/20! ring-1 ring-inset ring-rose-500/30',
      button: 'border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-400',
      activeButton: 'bg-rose-500/25 ring-2 ring-inset ring-rose-500/60',
    },
    sick_unpaid: {
      badge: 'bg-rose-500/10 text-rose-700 border border-dashed border-rose-500/60 dark:text-rose-300',
      row: 'bg-rose-500/5 hover:bg-rose-500/15! ring-1 ring-inset ring-rose-500/25',
      button:
        'border-dashed border-rose-500/50 bg-rose-500/5 text-rose-700 hover:bg-rose-500/15 dark:text-rose-400',
      activeButton: 'bg-rose-500/15 ring-2 ring-inset ring-rose-500/50',
    },
    holiday_paid: {
      badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
      row: 'bg-violet-500/10 hover:bg-violet-500/20! ring-1 ring-inset ring-violet-500/30',
      button:
        'border-violet-500/40 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-400',
      activeButton: 'bg-violet-500/25 ring-2 ring-inset ring-violet-500/60',
    },
    holiday_unpaid: {
      badge:
        'bg-violet-500/10 text-violet-700 border border-dashed border-violet-500/60 dark:text-violet-300',
      row: 'bg-violet-500/5 hover:bg-violet-500/15! ring-1 ring-inset ring-violet-500/25',
      button:
        'border-dashed border-violet-500/50 bg-violet-500/5 text-violet-700 hover:bg-violet-500/15 dark:text-violet-400',
      activeButton: 'bg-violet-500/15 ring-2 ring-inset ring-violet-500/50',
    },
    vacation_paid: {
      badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
      row: 'bg-sky-500/10 hover:bg-sky-500/20! ring-1 ring-inset ring-sky-500/30',
      button: 'border-sky-500/40 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-400',
      activeButton: 'bg-sky-500/25 ring-2 ring-inset ring-sky-500/60',
    },
    vacation_unpaid: {
      badge: 'bg-sky-500/10 text-sky-700 border border-dashed border-sky-500/60 dark:text-sky-300',
      row: 'bg-sky-500/5 hover:bg-sky-500/15! ring-1 ring-inset ring-sky-500/25',
      button:
        'border-dashed border-sky-500/50 bg-sky-500/5 text-sky-700 hover:bg-sky-500/15 dark:text-sky-400',
      activeButton: 'bg-sky-500/15 ring-2 ring-inset ring-sky-500/50',
    },
  };

  // Copy the first visible day's in/out/break (or hours/break) down to the
  // rest of the visible week (row 0 may be a hidden weekend).
  function fillDown() {
    const rows = weekRows.map((r) => r.i);
    if (rows.length < 2) return;
    for (const col of gridCols) {
      if (col === 'note') continue;
      const first = inputByName(`${col}-${rows[0]}`);
      if (!first?.value) continue;
      for (const row of rows.slice(1)) setCell(col, row, first.value);
    }
  }

  // Enter behaves like Tab inside the weekly grid: blurs the current cell
  // (which normalizes clock values) and moves to the next input instead of
  // submitting the form. Mirrors the Add-an-entry implicit behavior.
  function onGridKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (!/^(start|end|break|hours|note)-\d$/.test(t.name)) return;
    e.preventDefault();
    const inputs = Array.from(weekForm?.querySelectorAll<HTMLInputElement>('input[name]') ?? []).filter((el) =>
      /^(start|end|break|hours|note)-\d$/.test(el.name),
    );
    const i = inputs.indexOf(t);
    if (i >= 0 && i + 1 < inputs.length) inputs[i + 1].focus();
    else t.blur();
  }

  // Paste a block copied from Excel/Sheets (TSV) anchored at the focused cell.
  function onGridPaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text.includes('\t') && !text.includes('\n')) return; // single value → default paste
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const match = target.name.match(/^(start|end|break|hours|note)-(\d)$/);
    if (!match) return;
    const startCol = gridCols.indexOf(match[1]);
    const startRow = Number(match[2]);
    if (startCol < 0) return;

    e.preventDefault();
    const matrix = text
      .replace(/\r\n/g, '\n')
      .replace(/\n+$/, '')
      .split('\n')
      .map((line) => line.split('\t'));
    matrix.forEach((cells, r) => {
      const row = startRow + r;
      if (row > 6) return;
      cells.forEach((value, c) => {
        const col = gridCols[startCol + c];
        if (col) setCell(col, row, value);
      });
    });
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="flex flex-col gap-8">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Log time</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Record hours per day. Multiple entries per day are fine — they add up.
    </p>
  </div>

  <!-- quick add -->
  <Card.Root>
    <Card.Header class="max-sm:text-center">
      <Card.Title>Add an entry</Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <div class="flex w-full rounded-md border border-input p-0.5 text-sm sm:inline-flex sm:w-fit">
        {#each MODE_OPTIONS as opt (opt.m)}
          <button
            type="button"
            onclick={() => (addMode = opt.m)}
            class="flex-1 rounded-[0.3rem] px-3 py-1.5 transition-colors sm:flex-none sm:py-1 {addMode === opt.m
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
          >
            {opt.label}
          </button>
        {/each}
      </div>

      <form
        method="POST"
        action="?/add"
        use:enhance={conflictAwareEnhance({ resetOnSuccess: true })}
        class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <input type="hidden" name="mode" value={addMode} bind:this={addModeInput} />
        <div class="flex flex-col gap-1.5">
          <Label for="date">Date</Label>
          <Input
            id="date"
            type="date"
            name="date"
            value={todayISO()}
            max={todayISO()}
            required
            aria-invalid={addErrors.date ? 'true' : undefined}
            aria-describedby={addErrors.date ? 'date-error' : undefined}
            class="sm:w-44"
          />
          {#if addErrors.date}<p id="date-error" class="text-xs text-destructive">{addErrors.date}</p>{/if}
        </div>
        {#if addMode === 'clock'}
          <div class="grid grid-cols-2 gap-3 sm:contents">
            <div class="flex flex-col gap-1.5">
              <Label for="startTime">Clock in</Label>
              <Input
                id="startTime"
                type="text"
                name="startTime"
                inputmode="numeric"
                autocomplete="off"
                placeholder={startPlaceholder}
                onblur={normalizeTime}
                required
                aria-invalid={addErrors.startTime ? 'true' : undefined}
                aria-describedby={addErrors.startTime ? 'startTime-error' : undefined}
                class="sm:w-40"
              />
              {#if addErrors.startTime}<p id="startTime-error" class="text-xs text-destructive">{addErrors.startTime}</p>{/if}
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="endTime">Clock out</Label>
              <Input
                id="endTime"
                type="text"
                name="endTime"
                inputmode="numeric"
                autocomplete="off"
                placeholder={endPlaceholder}
                onblur={normalizeTime}
                required
                aria-invalid={addErrors.endTime ? 'true' : undefined}
                aria-describedby={addErrors.endTime ? 'endTime-error' : undefined}
                class="sm:w-40"
              />
              {#if addErrors.endTime}<p id="endTime-error" class="text-xs text-destructive">{addErrors.endTime}</p>{/if}
            </div>
          </div>
        {:else}
          <div class="flex flex-col gap-1.5">
            <Label for="hours">Hours</Label>
            <Input
              id="hours"
              type="number"
              name="hours"
              step="0.25"
              min="0.25"
              max="24"
              placeholder="8"
              required
              aria-invalid={addErrors.hours ? 'true' : undefined}
              aria-describedby={addErrors.hours ? 'hours-error' : undefined}
              class="sm:w-24"
            />
            {#if addErrors.hours}<p id="hours-error" class="text-xs text-destructive">{addErrors.hours}</p>{/if}
          </div>
        {/if}
        <div class="flex flex-col gap-1.5">
          <Label for="breakHours">Break <span class="text-muted-foreground">(h)</span></Label>
          <Input
            id="breakHours"
            type="number"
            name="breakHours"
            step="0.25"
            min="0"
            max="24"
            placeholder="0"
            aria-invalid={addErrors.breakHours ? 'true' : undefined}
            aria-describedby={addErrors.breakHours ? 'breakHours-error' : undefined}
            class="sm:w-24"
          />
          {#if addErrors.breakHours}<p id="breakHours-error" class="text-xs text-destructive">{addErrors.breakHours}</p>{/if}
        </div>
        <div class="flex w-full basis-full flex-col gap-1.5">
          <Label for="note">Note <span class="text-muted-foreground">(optional)</span></Label>
          <Input
            id="note"
            type="text"
            name="note"
            placeholder="What did you work on?"
            aria-invalid={addErrors.note ? 'true' : undefined}
            aria-describedby={addErrors.note ? 'note-error' : undefined}
          />
          {#if addErrors.note}<p id="note-error" class="text-xs text-destructive">{addErrors.note}</p>{/if}
        </div>
        <input type="hidden" name="kind" value="" bind:this={addKindInput} />
        <div class="flex w-full basis-full flex-wrap items-center gap-3">
          <Button type="submit" class="hover:bg-primary/75 max-sm:mx-auto max-sm:w-2/3">
            <Plus class="size-4" /> Add entry
          </Button>
          <div class="flex w-full flex-col items-start gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Or log leave</span>
            <div class="grid w-full grid-cols-2 gap-2 sm:w-fit sm:grid-flow-col sm:grid-cols-none sm:grid-rows-2">
              {#each LEAVE_KINDS as kind (kind)}
                {@const Icon = LEAVE_ICON[kind]}
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  class={KIND_CLASSES[kind].button + ' justify-start'}
                  onclick={(e) => {
                    if (addModeInput) addModeInput.value = 'leave';
                    if (addKindInput) addKindInput.value = kind;
                    const form = (e.currentTarget as HTMLButtonElement).form;
                    form?.querySelectorAll<HTMLInputElement>('input[required]').forEach((el) => {
                      if (el.name !== 'date') el.removeAttribute('required');
                    });
                  }}
                >
                  <Icon class="size-4" /> {LEAVE_META[kind].label}
                </Button>
              {/each}
            </div>
          </div>
        </div>
      </form>
    </Card.Content>
  </Card.Root>

  <!-- weekly grid -->
  <Card.Root>
    <Card.Header class="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
      <div class="max-sm:text-center">
        <Card.Title>Log a week</Card.Title>
        <Card.Description>Fill each day, then add them all at once.</Card.Description>
      </div>
      <!-- Mobile: week nav on its own full-width row, then month/year/This week
           sharing a line. sm:order-* restores the desktop sequence
           (month, year, nav, This week) once the sm:contents wrapper dissolves. -->
      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="flex items-center gap-2 sm:order-3">
          <Button variant="outline" size="icon" aria-label="Previous week" onclick={() => (weekAnchor = addDays(weekStart, -7))}>
            <ChevronLeft class="size-4" />
          </Button>
          <span class="min-w-44 flex-1 text-center text-sm font-medium tabular-nums sm:flex-none">
            {formatWeekRange(weekStart, true)}
          </span>
          <Button variant="outline" size="icon" aria-label="Next week" onclick={() => (weekAnchor = addDays(weekStart, 7))}>
            <ChevronRight class="size-4" />
          </Button>
        </div>
        <div class="flex items-center gap-2 sm:contents">
          <select
            aria-label="Month"
            value={String(anchorMonth)}
            onchange={(e) => jumpTo(anchorYear, Number(e.currentTarget.value))}
            class="h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:order-1 sm:flex-none"
          >
            {#each MONTHS as label, idx (label)}
              <option value={String(idx + 1)}>{label}</option>
            {/each}
          </select>
          <select
            aria-label="Year"
            value={String(anchorYear)}
            onchange={(e) => jumpTo(Number(e.currentTarget.value), anchorMonth)}
            class="h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:order-2 sm:flex-none"
          >
            {#each yearOptions as y (y)}
              <option value={String(y)}>{y}</option>
            {/each}
          </select>
          <Button variant="outline" size="sm" class="sm:order-4" onclick={() => (weekAnchor = todayISO())}>
            This week
          </Button>
        </div>
      </div>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <div class="flex w-full rounded-md border border-input p-0.5 text-sm sm:inline-flex sm:w-fit">
        {#each MODE_OPTIONS as opt (opt.m)}
          <button
            type="button"
            onclick={() => (weekMode = opt.m)}
            class="flex-1 rounded-[0.3rem] px-3 py-1.5 transition-colors sm:flex-none sm:py-1 {weekMode === opt.m
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
          >
            {opt.label}
          </button>
        {/each}
      </div>

      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <form
        bind:this={weekForm}
        method="POST"
        action="?/addWeek"
        onpaste={onGridPaste}
        onkeydown={onGridKeydown}
        use:enhance={conflictAwareEnhance({ resetOnSuccess: true })}
        class="flex flex-col gap-3"
      >
        <input type="hidden" name="weekStart" value={weekStart} />
        <input type="hidden" name="mode" value={weekMode} />
        <div
          class="hidden items-center gap-3 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground lg:flex"
        >
          <span class="w-28 shrink-0">Day</span>
          {#if weekMode === 'clock'}
            <span class="w-40 shrink-0">In</span>
            <span class="w-40 shrink-0">Out</span>
          {:else}
            <span class="w-20 shrink-0">Hours</span>
          {/if}
          <span class="w-20 shrink-0">Break</span>
          <span class="flex-1">Note</span>
          <span class="w-40 shrink-0 text-center">Leave</span>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:contents">
          {#each weekRows as { date, i }, idx (date)}
            {@const rowErr = (col: string) => weekErrors[`${col}-${i}`]}
            {@const leaveKind = leaveRows.get(i) ?? null}
            {@const isLeave = leaveKind !== null}
            {@const rowUnpaid = isLeave ? !LEAVE_META[leaveKind].paid : false}
            <div
              class="flex flex-col rounded-md max-lg:overflow-hidden max-lg:rounded-lg lg:flex-row lg:items-start lg:gap-3 lg:px-2 lg:py-1 {isLeave
                ? KIND_CLASSES[leaveKind].row + (rowUnpaid ? ' unpaid-hatch' : '')
                : isWeekend(date)
                  ? 'bg-amber-500/5 ring-1 ring-inset ring-amber-500/20'
                  : idx % 2 === 1
                    ? 'max-lg:ring-1 max-lg:ring-inset max-lg:ring-border lg:bg-muted/70'
                    : 'max-lg:ring-1 max-lg:ring-inset max-lg:ring-border'}"
            >
              <!-- card header below lg: day + entry-type select; dissolves into the flat row at lg -->
              <div class="flex items-center justify-between gap-2 border-b border-border/40 bg-muted/40 px-2.5 py-1.5 lg:contents">
                <div class="flex h-8 items-center font-mono text-sm uppercase tabular-nums lg:w-28 lg:shrink-0">
                  <span class="font-medium">{weekdayShort(date)}</span>
                  <span class="ml-1 text-muted-foreground">{formatDay(date).replace(/^\w+,\s/, '')}</span>
                </div>
                <Select.Root
                  type="single"
                  value={leaveKind ?? 'work'}
                  onValueChange={(v) => setLeaveRow(i, v === 'work' ? '' : (v as LeaveKind))}
                >
                  <Select.Trigger
                    aria-label="Leave kind for {weekdayShort(date)}"
                    class="h-8 w-36 shrink-0 lg:order-last lg:w-40 lg:self-center {isLeave ? KIND_CLASSES[leaveKind].button : ''}"
                  >
                    {#if isLeave}
                      {@const Icon = LEAVE_ICON[leaveKind]}
                      {@const meta = LEAVE_META[leaveKind]}
                      <span class="inline-flex min-w-0 items-center gap-1.5">
                        <Icon class="size-3.5 shrink-0" />
                        <span class="min-w-0 truncate text-xs">{meta.short}{meta.paid ? '' : ' (unpaid)'}</span>
                      </span>
                    {:else}
                      <span class="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <Briefcase class="size-3.5 shrink-0" />
                        <span class="min-w-0 truncate text-xs">Work</span>
                      </span>
                    {/if}
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="work">
                      <span
                        class="inline-flex items-center gap-2 rounded-md bg-zinc-500/15 px-1 py-0.5 text-zinc-700 dark:text-zinc-300"
                      >
                        <Briefcase class="size-3.5" />
                        Work
                      </span>
                    </Select.Item>
                    {#each LEAVE_KINDS as k (k)}
                      {@const ItemIcon = LEAVE_ICON[k]}
                      <Select.Item value={k}>
                        <span class="inline-flex items-center gap-2 rounded-md px-1 py-0.5 {KIND_CLASSES[k].badge}">
                          <ItemIcon class="size-3.5" />
                          {LEAVE_META[k].label}
                        </span>
                      </Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <!-- card body below lg -->
              <div class="flex flex-col gap-2 p-2.5 lg:contents">
                {#if isLeave}
                  {@const meta = LEAVE_META[leaveKind]}
                  <input type="hidden" name="leave-{i}" value={leaveKind} />
                  <div
                    class="flex min-h-8 items-center justify-center rounded-md px-2 font-mono text-xs font-medium uppercase tracking-wider lg:h-8 lg:w-40 lg:shrink-0 {KIND_CLASSES[leaveKind].badge}"
                  >
                    {meta.short} · {meta.paid ? '8.00h paid' : 'unpaid'}
                  </div>
                  <Input
                    type="text"
                    name="note-{i}"
                    placeholder="Reason (optional)"
                    aria-label="Leave note for {weekdayShort(date)}"
                    class="lg:flex-1"
                  />
                {:else}
                  <div class="grid grid-cols-6 gap-2 lg:contents">
                    {#if weekMode === 'clock'}
                      <div class="col-span-3 flex flex-col gap-1 lg:w-40 lg:shrink-0">
                        <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:hidden">In</span>
                        <Input
                          type="text"
                          name="start-{i}"
                          inputmode="numeric"
                          autocomplete="off"
                          placeholder={startPlaceholder}
                          onblur={normalizeTime}
                          aria-label="Clock in for {weekdayShort(date)}"
                          aria-invalid={rowErr('start') ? 'true' : undefined}
                          class="font-mono tabular-nums"
                        />
                        {#if rowErr('start')}<p class="text-xs text-destructive">{rowErr('start')}</p>{/if}
                      </div>
                      <div class="col-span-3 flex flex-col gap-1 lg:w-40 lg:shrink-0">
                        <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:hidden">Out</span>
                        <Input
                          type="text"
                          name="end-{i}"
                          inputmode="numeric"
                          autocomplete="off"
                          placeholder={endPlaceholder}
                          onblur={normalizeTime}
                          aria-label="Clock out for {weekdayShort(date)}"
                          aria-invalid={rowErr('end') ? 'true' : undefined}
                          class="font-mono tabular-nums"
                        />
                        {#if rowErr('end')}<p class="text-xs text-destructive">{rowErr('end')}</p>{/if}
                      </div>
                    {:else}
                      <div class="col-span-3 flex flex-col gap-1 lg:w-20 lg:shrink-0">
                        <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:hidden">Hours</span>
                        <Input
                          type="number"
                          name="hours-{i}"
                          step="0.25"
                          min="0.25"
                          max="24"
                          placeholder={isWeekend(date) ? '—' : '0'}
                          aria-label="Hours for {weekdayShort(date)}"
                          aria-invalid={rowErr('hours') ? 'true' : undefined}
                          class="font-mono tabular-nums"
                        />
                        {#if rowErr('hours')}<p class="text-xs text-destructive">{rowErr('hours')}</p>{/if}
                      </div>
                    {/if}
                    <div class="{weekMode === 'clock' ? 'col-span-2' : 'col-span-3'} flex flex-col gap-1 lg:w-20 lg:shrink-0">
                      <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:hidden">Break</span>
                      <Input
                        type="number"
                        name="break-{i}"
                        step="0.25"
                        min="0"
                        max="24"
                        placeholder="0"
                        aria-label="Break for {weekdayShort(date)}"
                        aria-invalid={rowErr('break') ? 'true' : undefined}
                        class="font-mono tabular-nums"
                      />
                      {#if rowErr('break')}<p class="text-xs text-destructive">{rowErr('break')}</p>{/if}
                    </div>
                    <div class="{weekMode === 'clock' ? 'col-span-4' : 'col-span-6'} flex flex-col gap-1 lg:flex-1">
                      <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:hidden">Note</span>
                      <Input
                        type="text"
                        name="note-{i}"
                        placeholder="Note (optional)"
                        aria-label="Note for {weekdayShort(date)}"
                        aria-invalid={rowErr('note') ? 'true' : undefined}
                      />
                      {#if rowErr('note')}<p class="text-xs text-destructive">{rowErr('note')}</p>{/if}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <Button type="submit" class="hover:bg-primary/75"><Plus class="size-4" /> Add week</Button>
          <Button type="button" variant="outline" onclick={fillDown}>
            <ArrowDownToLine class="size-4" /> Fill down
          </Button>
          <span class="hidden text-xs text-muted-foreground lg:inline">Tip: paste a block from a spreadsheet into any cell.</span>
          {#if form?.weekAdded}
            <span class="text-sm text-success">Added {form.weekAdded} {form.weekAdded === 1 ? 'day' : 'days'}.</span>
          {:else if form && 'weekError' in form && form.weekError}
            <span class="text-sm text-destructive">{form.weekError}</span>
          {/if}
          <Button type="button" variant="destructive" onclick={clearWeek} class="ml-auto w-24">
            <X class="size-4" /> Clear
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>

  <!-- entries -->
  {#if entriesExpanded}
    <!-- h is explicit: Chrome won't stretch an abs-positioned <button> from top/bottom constraints -->
    <button
      type="button"
      class="fixed inset-x-0 top-0 z-40 h-dvh cursor-default bg-black/70"
      onclick={() => (entriesExpanded = false)}
      aria-label="Collapse entries"
      tabindex={-1}
    ></button>
  {/if}
  <Card.Root
    class={entriesExpanded
      ? 'fixed inset-0 z-50 overflow-hidden max-sm:rounded-none max-sm:ring-0 sm:inset-6 2xl:inset-x-[calc((100vw-84rem)/2)]'
      : ''}
  >
    <Card.Header class="flex flex-row flex-wrap items-center justify-between gap-2">
      <div>
        <Card.Title>Entries</Card.Title>
        <Card.Description>
          {pagedEntries.length} in this {entriesPeriod === 'biweek' ? 'bi-week' : entriesPeriod} · {data.entries.length} total
        </Card.Description>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onclick={exportCsv} disabled={data.entries.length === 0}>
          <Download class="size-4" /> Export CSV
        </Button>
        <form
          method="POST"
          action="?/importCsv"
          enctype="multipart/form-data"
          use:enhance={conflictAwareEnhance()}
        >
          <input
            bind:this={csvInput}
            type="file"
            name="file"
            accept=".csv,text/csv"
            class="hidden"
            onchange={(e) => e.currentTarget.form?.requestSubmit()}
          />
          <Button variant="outline" size="sm" type="button" onclick={() => csvInput?.click()}>
            <Upload class="size-4" /> Import CSV
          </Button>
        </form>
        <Button
          variant="outline"
          size="sm"
          type="button"
          aria-label={entriesExpanded ? 'Collapse entries' : 'Expand entries'}
          onclick={() => (entriesExpanded = !entriesExpanded)}
        >
          {#if entriesExpanded}
            <Minimize2 class="size-4" />
          {:else}
            <Maximize2 class="size-4" />
          {/if}
        </Button>
      </div>
    </Card.Header>
    <Card.Content class={entriesExpanded ? 'flex min-h-0 flex-1 flex-col' : ''}>
      <!-- pagination controls: always a single dedicated row above the table -->
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Pagination period"
          value={entriesPeriod}
          onchange={(e) => {
            entriesPeriod = e.currentTarget.value as Period;
          }}
          class="h-9 shrink-0 basis-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:basis-auto"
        >
          {#each Object.entries(PERIOD_LABELS) as [v, label] (v)}
            <option value={v}>{label}</option>
          {/each}
        </select>
        <Button
          variant="outline"
          size="icon"
          class="shrink-0"
          aria-label="Previous period"
          disabled={entriesAtEpoch}
          onclick={() => shiftEntriesPage(-1)}
        >
          <ChevronLeft class="size-4" />
        </Button>
        <span class="flex-1 text-center font-mono text-sm font-medium uppercase tabular-nums">
          {entriesBucket.label}
        </span>
        <Button
          variant="outline"
          size="icon"
          class="shrink-0"
          aria-label="Next period"
          onclick={() => shiftEntriesPage(1)}
        >
          <ChevronRight class="size-4" />
        </Button>
        <Button variant="outline" size="sm" class="shrink-0" onclick={() => (entriesAnchor = todayISO())}>Today</Button>
      </div>
      {#if form?.imported}
        <p class="mb-3 text-sm text-success">
          Imported {form.imported} {form.imported === 1 ? 'entry' : 'entries'}{form.skipped
            ? ` · skipped ${form.skipped}`
            : ''}.
        </p>
      {:else if form && 'importError' in form && form.importError}
        <p class="mb-3 text-sm text-destructive">{form.importError}</p>
      {/if}
      {#if data.entries.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">No entries yet. Add your first above.</p>
      {:else if pagedEntries.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">No entries in this {entriesPeriod}.</p>
      {:else}
        {#if showEntriesTable}
        <div
          class="hidden overflow-y-auto rounded-md border border-input md:block {entriesExpanded
            ? 'min-h-0 flex-1'
            : 'max-h-[calc(14*2.75rem+2.5rem)]'}"
        >
        <Table.Root>
          <Table.Header class="sticky top-0 z-10 bg-background">
            <Table.Row>
              <Table.Head class="w-32">Date</Table.Head>
              <Table.Head class="w-24 font-mono">In</Table.Head>
              <Table.Head class="w-20 font-mono">Out</Table.Head>
              <Table.Head class="w-16 font-mono">Break</Table.Head>
              <Table.Head class="w-24 text-right font-mono">Worked</Table.Head>
              <Table.Head class="w-14 text-center">OT</Table.Head>
              <Table.Head class="w-36 text-center">Leave</Table.Head>
              <Table.Head class="w-32 text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each displayRows as row, idx (row.kind === 'entry' ? row.entry.id : `blank-${row.date}`)}
              {#if row.kind === 'blank'}
                <Table.Row
                  class={`text-muted-foreground/60 ${isWeekend(row.date) ? 'bg-amber-500/10' : idx % 2 === 1 ? 'bg-muted/70' : ''}`}
                >
                  <Table.Cell class="font-mono text-sm uppercase tabular-nums">
                    <span>{weekdayShort(row.date)}</span>
                    <span class="ml-1">{formatDay(row.date).replace(/^\w+,\s/, '')}</span>
                  </Table.Cell>
                  <Table.Cell class="font-mono text-sm tabular-nums">—</Table.Cell>
                  <Table.Cell class="font-mono text-sm tabular-nums">—</Table.Cell>
                  <Table.Cell class="font-mono text-sm tabular-nums">—</Table.Cell>
                  <Table.Cell class="text-right font-mono tabular-nums">—</Table.Cell>
                  <Table.Cell class="text-center"></Table.Cell>
                  <Table.Cell class="text-center"></Table.Cell>
                  <!-- Match the action-cell height (icon buttons are size-8) so blank rows line up with entry rows exactly. -->
                  <Table.Cell class="text-right"><span class="inline-block h-8 align-middle"></span></Table.Cell>
                </Table.Row>
              {:else}
                {@const entry = row.entry}
                {@const entryLeave = entry.entryKind !== 'work' ? (entry.entryKind as LeaveKind) : null}
                {@const leaveIsUnpaid = entryLeave ? !LEAVE_META[entryLeave].paid : false}
                <Table.Row
                  class={entryLeave
                    ? KIND_CLASSES[entryLeave].row + (leaveIsUnpaid ? ' unpaid-hatch' : '')
                    : idx % 2 === 1
                      ? 'bg-muted/70 hover:bg-muted!'
                      : 'hover:bg-muted/30!'}
                >
                <Table.Cell class="font-mono text-sm uppercase tabular-nums">
                  <span class="text-muted-foreground">{weekdayShort(entry.date)}</span>
                  <span class="ml-1">{formatDay(entry.date).replace(/^\w+,\s/, '')}</span>
                </Table.Cell>
                <Table.Cell class="font-mono text-sm tabular-nums">
                  {#if entry.startTime}
                    {@render clockTime(entry.startTime)}
                  {:else}
                    —
                  {/if}
                </Table.Cell>
                <Table.Cell class="font-mono text-sm tabular-nums">
                  {#if entry.endTime}
                    {@render clockTime(entry.endTime)}
                    {#if entry.startTime && entry.endTime < entry.startTime}
                      <span class="ml-1 text-xs text-muted-foreground">+1d</span>
                    {/if}
                  {:else}
                    —
                  {/if}
                </Table.Cell>
                <Table.Cell class="font-mono text-sm tabular-nums text-muted-foreground">
                  {entry.breakHours > 0 ? hrs(entry.breakHours) : '—'}
                </Table.Cell>
                <Table.Cell class="text-right font-mono tabular-nums">
                  {hrs(entry.hours - entry.breakHours)}
                </Table.Cell>
                <Table.Cell class="text-center">
                  {#if !entryLeave && dayTotals[entry.date] > data.dailyHours}
                    <span
                      class="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                    >
                      OT
                    </span>
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-center">
                  {#if entryLeave}
                    {@const Icon = LEAVE_ICON[entryLeave]}
                    {@const meta = LEAVE_META[entryLeave]}
                    <span
                      class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide {KIND_CLASSES[entryLeave].badge}"
                      title={meta.label}
                    >
                      <Icon class="size-3" /> {meta.short}{meta.paid ? '' : ' (Unpaid)'}
                    </span>
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-right">
                  <div class="flex justify-end gap-1">
                    {@render rowActions(entry, true)}
                  </div>
                </Table.Cell>
              </Table.Row>
              {#if entry.note && isNoteOpen(entry.id)}
                <Table.Row
                  class={entryLeave
                    ? KIND_CLASSES[entryLeave].row + (leaveIsUnpaid ? ' unpaid-hatch' : '')
                    : idx % 2 === 1
                      ? 'bg-muted/70 hover:bg-muted/70!'
                      : 'hover:bg-transparent!'}
                >
                  <Table.Cell colspan={8} class="py-2">
                    <div transition:slide={{ duration: 150 }} class="flex items-start gap-2 text-sm text-muted-foreground">
                      {@render iconNote('mt-0.5 size-3.5 shrink-0')}
                      <span class="whitespace-pre-wrap">{entry.note}</span>
                    </div>
                  </Table.Cell>
                </Table.Row>
              {/if}
              {/if}
            {/each}
          </Table.Body>
        </Table.Root>
        </div>
        {/if}

        <!-- mobile entries list: same rows, stacked layout -->
        {#if showEntriesList}
        <div
          class="divide-y divide-input overflow-y-auto rounded-md border border-input md:hidden {entriesExpanded
            ? 'min-h-0 flex-1'
            : 'max-h-[calc(14*2.75rem+2.5rem)]'}"
        >
          {#each displayRows as row, idx (row.kind === 'entry' ? row.entry.id : `blank-${row.date}`)}
            {#if row.kind === 'blank'}
              <div
                class="flex items-center justify-between px-3 py-2 text-muted-foreground/60 {isWeekend(row.date)
                  ? 'bg-amber-500/10'
                  : idx % 2 === 1
                    ? 'bg-muted/70'
                    : ''}"
              >
                <span class="font-mono text-sm uppercase tabular-nums">
                  <span>{weekdayShort(row.date)}</span>
                  <span class="ml-1">{formatDay(row.date).replace(/^\w+,\s/, '')}</span>
                </span>
                <span class="font-mono text-sm">—</span>
              </div>
            {:else}
              {@const entry = row.entry}
              {@const entryLeave = entry.entryKind !== 'work' ? (entry.entryKind as LeaveKind) : null}
              {@const leaveIsUnpaid = entryLeave ? !LEAVE_META[entryLeave].paid : false}
              <div
                class={entryLeave
                  ? KIND_CLASSES[entryLeave].row + (leaveIsUnpaid ? ' unpaid-hatch' : '')
                  : idx % 2 === 1
                    ? 'bg-muted/70'
                    : ''}
              >
                <div class="flex items-center justify-between gap-3 px-3 py-2">
                <div class="flex min-w-0 flex-col gap-1">
                  <div class="flex flex-wrap items-center gap-2 font-mono text-sm uppercase tabular-nums">
                    <span>
                      <span class="text-muted-foreground">{weekdayShort(entry.date)}</span>
                      <span class="ml-1">{formatDay(entry.date).replace(/^\w+,\s/, '')}</span>
                    </span>
                    {#if !entryLeave && dayTotals[entry.date] > data.dailyHours}
                      <span
                        class="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                      >
                        OT
                      </span>
                    {/if}
                    {#if entryLeave}
                      {@const Icon = LEAVE_ICON[entryLeave]}
                      {@const meta = LEAVE_META[entryLeave]}
                      <span
                        class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide {KIND_CLASSES[entryLeave].badge}"
                        title={meta.label}
                      >
                        <Icon class="size-3" /> {meta.short}{meta.paid ? '' : ' (Unpaid)'}
                      </span>
                    {/if}
                  </div>
                  {#if entry.startTime && entry.endTime}
                    <div class="font-mono text-sm tabular-nums text-muted-foreground">
                      {@render clockTime(entry.startTime)}
                      <span class="mx-0.5">→</span>
                      {@render clockTime(entry.endTime)}
                      {#if entry.endTime < entry.startTime}
                        <span class="ml-1 text-xs">+1d</span>
                      {/if}
                      {#if entry.breakHours > 0}
                        <span class="ml-1 text-xs">· {hrs(entry.breakHours)} break</span>
                      {/if}
                    </div>
                  {:else if entry.breakHours > 0}
                    <div class="font-mono text-sm tabular-nums text-muted-foreground">{hrs(entry.breakHours)} break</div>
                  {/if}
                </div>
                <div class="flex shrink-0 flex-col items-end gap-1">
                  <span class="font-mono text-sm font-medium tabular-nums">{hrs(entry.hours - entry.breakHours)}</span>
                  <div class="flex gap-1">
                    {@render rowActions(entry)}
                  </div>
                </div>
                </div>
                {#if entry.note && isNoteOpen(entry.id)}
                  <div
                    transition:slide={{ duration: 150 }}
                    class="flex items-start gap-2 border-t border-border/40 px-3 py-2 text-sm text-muted-foreground"
                  >
                    {@render iconNote('mt-0.5 size-3.5 shrink-0')}
                    <span class="whitespace-pre-wrap">{entry.note}</span>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
        {/if}
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<!-- edit dialog -->
<Dialog.Root bind:open={editOpen}>
  <Dialog.Content class="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
    <Dialog.Header>
      <Dialog.Title>Edit entry</Dialog.Title>
      <Dialog.Description>Change the date, hours, break, or note for this entry.</Dialog.Description>
    </Dialog.Header>
    {#if editing}
      <form
        method="POST"
        action="?/update"
        use:enhance={() => {
          return async ({ update, result }) => {
            await update();
            if (result.type === 'success') editOpen = false;
          };
        }}
        class="flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={editing.id} />
        <input type="hidden" name="mode" value={editKind === 'work' ? editMode : 'leave'} />
        {#if editKind !== 'work'}
          <input type="hidden" name="kind" value={editKind} />
        {/if}
        <div class="flex flex-col gap-1.5">
          <Label for="edit-date">Date</Label>
          <Input
            id="edit-date"
            type="date"
            name="date"
            value={editing.date}
            max={todayISO()}
            required
            aria-invalid={editErrors.date ? 'true' : undefined}
          />
          {#if editErrors.date}<p class="text-xs text-destructive">{editErrors.date}</p>{/if}
        </div>

        <!-- entry kind chooser -->
        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Entry type</span>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <Button
              type="button"
              variant={editKind === 'work' ? 'default' : 'outline'}
              size="sm"
              class="h-auto"
              onclick={() => {
                editKind = 'work';
                editMode = 'clock';
              }}
            >
              <Briefcase class="size-3.5" /> Work
            </Button>
            <div class="grid grid-cols-2 gap-2 sm:grid-flow-col sm:grid-cols-none sm:grid-rows-2">
              {#each LEAVE_KINDS as k (k)}
                {@const KindIcon = LEAVE_ICON[k]}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class={KIND_CLASSES[k].button +
                    ' justify-start' +
                    (editKind === k ? ' ' + KIND_CLASSES[k].activeButton : '')}
                  onclick={() => (editKind = k)}
                >
                  <KindIcon class="size-3.5" /> {LEAVE_META[k].label}
                </Button>
              {/each}
            </div>
          </div>
        </div>

        {#if editKind === 'work'}
          <div class="inline-flex w-fit rounded-md border border-input p-0.5 text-sm">
            {#each MODE_OPTIONS as opt (opt.m)}
              <button
                type="button"
                onclick={() => (editMode = opt.m)}
                class="rounded-[0.3rem] px-3 py-1 transition-colors {editMode === opt.m
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'}"
              >
                {opt.label}
              </button>
            {/each}
          </div>
          <div class="grid grid-cols-2 gap-4">
            {#if editMode === 'clock'}
            <div class="flex flex-col gap-1.5">
              <Label for="edit-start">Clock in</Label>
              <Input
                id="edit-start"
                type="text"
                name="startTime"
                inputmode="numeric"
                autocomplete="off"
                placeholder={startPlaceholder}
                value={timeLabel(editing.startTime)}
                onblur={normalizeTime}
                required
                aria-invalid={editErrors.startTime ? 'true' : undefined}
              />
              {#if editErrors.startTime}<p class="text-xs text-destructive">{editErrors.startTime}</p>{/if}
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="edit-end">Clock out</Label>
              <Input
                id="edit-end"
                type="text"
                name="endTime"
                inputmode="numeric"
                autocomplete="off"
                placeholder={endPlaceholder}
                value={timeLabel(editing.endTime)}
                onblur={normalizeTime}
                required
                aria-invalid={editErrors.endTime ? 'true' : undefined}
              />
              {#if editErrors.endTime}<p class="text-xs text-destructive">{editErrors.endTime}</p>{/if}
            </div>
          {:else}
            <div class="flex flex-col gap-1.5">
              <Label for="edit-hours">Hours</Label>
              <Input
                id="edit-hours"
                type="number"
                name="hours"
                step="0.25"
                min="0.25"
                max="24"
                value={editing.hours}
                required
                aria-invalid={editErrors.hours ? 'true' : undefined}
              />
              {#if editErrors.hours}<p class="text-xs text-destructive">{editErrors.hours}</p>{/if}
            </div>
          {/if}
          <div class="flex flex-col gap-1.5">
            <Label for="edit-break">Break (h)</Label>
            <Input
              id="edit-break"
              type="number"
              name="breakHours"
              step="0.25"
              min="0"
              max="24"
              value={editing.breakHours}
              aria-invalid={editErrors.breakHours ? 'true' : undefined}
            />
            {#if editErrors.breakHours}<p class="text-xs text-destructive">{editErrors.breakHours}</p>{/if}
          </div>
        </div>
        {/if}
        <div class="flex flex-col gap-1.5">
          <Label for="edit-note">Note</Label>
          <Input
            id="edit-note"
            type="text"
            name="note"
            value={editing.note ?? ''}
            aria-invalid={editErrors.note ? 'true' : undefined}
          />
          {#if editErrors.note}<p class="text-xs text-destructive">{editErrors.note}</p>{/if}
        </div>
        <Dialog.Footer>
          <Button type="submit">Save changes</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- delete confirmation -->
<Dialog.Root
  open={deleting !== null}
  onOpenChange={(o) => {
    if (!o) deleting = null;
  }}
>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Delete this entry?</Dialog.Title>
      <Dialog.Description>This can't be undone.</Dialog.Description>
    </Dialog.Header>
    {#if deleting}
      <div class="rounded-md border border-input bg-muted/40 p-3 font-mono text-sm tabular-nums">
        <div class="uppercase">
          <span class="text-muted-foreground">{weekdayShort(deleting.date)}</span>
          <span class="ml-1">{formatDay(deleting.date).replace(/^\w+,\s/, '')}</span>
        </div>
        <div class="mt-1 text-muted-foreground">
          {#if deleting.startTime && deleting.endTime}
            {formatTime(deleting.startTime, data.timeFormat)} → {formatTime(deleting.endTime, data.timeFormat)} ·
          {/if}
          {hrs(deleting.hours - deleting.breakHours)} worked{#if deleting.note}
            <span class="ml-1">· {deleting.note}</span>
          {/if}
        </div>
      </div>
      <form
        method="POST"
        action="?/delete"
        bind:this={deleteForm}
        use:enhance={() => async ({ update }) => {
          await update();
          deleting = null;
        }}
      >
        <input type="hidden" name="id" value={deleting.id} />
      </form>
    {/if}
    <Dialog.Footer class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        onclick={() => (deleting = null)}
        class="hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        onclick={executeDelete}
        class="hover:bg-destructive/30 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
      >
        Delete
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- duplicate-date conflict resolution -->
<Dialog.Root open={conflicts.length > 0} onOpenChange={(o) => !o && resolveConflict('cancel')}>
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>Entries already exist</Dialog.Title>
      <Dialog.Description>
        {conflicts.length === 1
          ? 'An entry already exists for this date.'
          : `Entries already exist for ${conflicts.length} of these dates.`}
        Choose how to handle the conflict — other rows in the batch are unaffected by your choice.
      </Dialog.Description>
    </Dialog.Header>
    <div class="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
      {#each conflicts as c (c.date)}
        <div class="rounded-md border border-input">
          <div class="border-b border-input bg-muted/40 px-3 py-1.5 font-mono text-sm uppercase tabular-nums">
            <span class="text-muted-foreground">{weekdayShort(c.date)}</span>
            <span class="ml-1">{formatDay(c.date).replace(/^\w+,\s/, '')}</span>
          </div>
          <div class="grid grid-cols-1 divide-y divide-input sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div class="space-y-1 bg-amber-500/5 p-3">
              <p class="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Existing{c.existing.length > 1 ? ` · ${c.existing.length} entries` : ''}
              </p>
              {#each c.existing as e, i (i)}
                {@render entrySummary(e)}
              {/each}
            </div>
            <div class="space-y-1 bg-emerald-500/5 p-3">
              <p class="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Proposed
              </p>
              {@render entrySummary(c.proposed)}
            </div>
          </div>
        </div>
      {/each}
    </div>
    <Dialog.Footer class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        onclick={() => resolveConflict('cancel')}
        class="hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Cancel everything
      </Button>
      <Button
        variant="outline"
        onclick={() => resolveConflict('skip')}
        class="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        Keep existing
      </Button>
      <Button
        variant="destructive"
        onclick={() => resolveConflict('overwrite')}
        class="hover:bg-destructive/30 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
      >
        Overwrite
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Inline lucide SVGs (pencil / trash-2 / sticky-note, ISC): snippets render
     plain elements, so the hundreds of entry rows skip component overhead. -->
{#snippet iconPencil()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="size-4"
    aria-hidden="true"
  >
    <path
      d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
    />
    <path d="m15 5 4 4" />
  </svg>
{/snippet}

{#snippet iconTrash()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="size-4 text-destructive"
    aria-hidden="true"
  >
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
{/snippet}

{#snippet iconNote(cls = 'size-4')}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={cls}
    aria-hidden="true"
  >
    <path
      d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"
    />
    <path d="M15 3v5a1 1 0 0 0 1 1h5" />
  </svg>
{/snippet}

{#snippet rowActions(entry: TimeEntry, spacer = false)}
  {#if entry.note}
    <button
      type="button"
      class="{ROW_BTN} {isNoteOpen(entry.id) ? 'bg-accent' : ''}"
      aria-label={isNoteOpen(entry.id) ? 'Hide note' : 'Show note'}
      aria-expanded={isNoteOpen(entry.id)}
      onclick={() => toggleNote(entry.id)}
    >
      {@render iconNote()}
    </button>
  {:else if spacer}
    <span class="inline-block size-8"></span>
  {/if}
  <button type="button" class={ROW_BTN} aria-label="Edit entry" onclick={() => openEdit(entry)}>
    {@render iconPencil()}
  </button>
  <button type="button" class={ROW_BTN} aria-label="Delete entry" onclick={() => confirmDelete(entry)}>
    {@render iconTrash()}
  </button>
{/snippet}

{#snippet clockTime(t: string)}
  {@const p = splitMeridiem(formatTime(t, data.timeFormat))}
  {p.time}{#if p.meridiem}<span
      class="ml-1 {p.meridiem === 'AM'
        ? 'text-rose-500 dark:text-rose-400'
        : 'text-sky-500 dark:text-sky-400'}">{p.meridiem}</span
    >{/if}
{/snippet}

{#snippet entrySummary(e: ConflictEntry)}
  {#if e.startTime && e.endTime}
    {@const sp = splitMeridiem(formatTime(e.startTime, data.timeFormat))}
    {@const ep = splitMeridiem(formatTime(e.endTime, data.timeFormat))}
    <div class="font-mono text-sm tabular-nums">
      <span>{sp.time}</span>{#if sp.meridiem}<span
          class="ml-0.5 {sp.meridiem === 'AM' ? 'text-rose-500 dark:text-rose-400' : 'text-sky-500 dark:text-sky-400'}"
          >{sp.meridiem}</span
        >{/if}
      <span class="mx-1 text-muted-foreground">→</span>
      <span>{ep.time}</span>{#if ep.meridiem}<span
          class="ml-0.5 {ep.meridiem === 'AM' ? 'text-rose-500 dark:text-rose-400' : 'text-sky-500 dark:text-sky-400'}"
          >{ep.meridiem}</span
        >{/if}
      {#if e.endTime < e.startTime}<span class="ml-1 text-xs text-muted-foreground">+1d</span>{/if}
    </div>
  {/if}
  <div class="font-mono text-sm tabular-nums text-muted-foreground">
    {hrs(e.hours - e.breakHours)} worked{#if e.breakHours > 0}
      <span class="text-xs"> · {hrs(e.breakHours)} break</span>
    {/if}
  </div>
  {#if e.note}<p class="text-xs text-muted-foreground">{e.note}</p>{/if}
{/snippet}
