<script lang="ts">
  import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Download from '@lucide/svelte/icons/download';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Upload from '@lucide/svelte/icons/upload';
  import { enhance } from '$app/forms';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Table from '$lib/components/ui/table';
  import { toCsv } from '$lib/csv';
  import { formatDay, formatTime, formatWeekRange, isWeekend, todayISO, weekdayShort } from '$lib/date';
  import type { TimeEntry } from '$lib/db/schema';
  import { addDays, parseTimeInput, weekDates } from '$lib/timesheet';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const hrs = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}h`;

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
    if (parsed) e.currentTarget.value = formatTime(parsed);
  }
  // Friendly label for an initial HH:MM value (edit dialog); '' stays ''.
  const timeLabel = (hhmm: string | null) => (hhmm ? formatTime(hhmm) : '');

  // Per-day totals of *net* worked hours (after breaks) drive the overtime badge.
  const dayTotals = $derived(
    data.entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.date] = (acc[e.date] ?? 0) + e.hours - e.breakHours;
      return acc;
    }, {}),
  );

  // Input mode for the single-entry form: clock in/out (default) or plain hours.
  let addMode = $state<'hours' | 'clock'>('clock');

  // Two toggle options, clock on the left.
  const MODE_OPTIONS = [
    { m: 'clock', label: 'Clock in/out' },
    { m: 'hours', label: 'Hours' },
  ] as const;

  let editing = $state<TimeEntry | null>(null);
  let editOpen = $state(false);
  // Edit dialog mirrors the same toggle, defaulting to whichever the entry used.
  let editMode = $state<'hours' | 'clock'>('hours');

  function openEdit(entry: TimeEntry) {
    editing = entry;
    editMode = entry.startTime && entry.endTime ? 'clock' : 'hours';
    editOpen = true;
  }

  // Weekly grid. Rows are keyed by date, so navigating weeks recreates the
  // inputs (clearing anything typed). Field names hours-0…6 map to the row
  // order, which the server recomputes as weekStart + i days.
  let weekAnchor = $state(todayISO());
  const weekRowDates = $derived(weekDates(weekAnchor, data.weekStartsOn));
  const weekStart = $derived(weekRowDates[0]);
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
      cell.value = parsed ? formatTime(parsed) : raw.trim();
    } else {
      cell.value = raw.trim();
    }
  }

  // Copy the first day's in/out/break (or hours/break) down to the rest of the week.
  function fillDown() {
    for (const col of gridCols) {
      if (col === 'note') continue;
      const first = inputByName(`${col}-0`);
      if (!first?.value) continue;
      for (let row = 1; row < 7; row++) setCell(col, row, first.value);
    }
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

<div class="flex flex-col gap-8">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Log time</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Record hours per day. Multiple entries per day are fine — they add up.
    </p>
  </div>

  <!-- quick add -->
  <Card.Root>
    <Card.Header>
      <Card.Title>Add an entry</Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <div class="inline-flex w-fit rounded-md border border-input p-0.5 text-sm">
        {#each MODE_OPTIONS as opt (opt.m)}
          <button
            type="button"
            onclick={() => (addMode = opt.m)}
            class="rounded-[0.3rem] px-3 py-1 transition-colors {addMode === opt.m
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
        use:enhance={() => {
          return async ({ update }) => {
            await update({ reset: true });
          };
        }}
        class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <input type="hidden" name="mode" value={addMode} />
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
            class="w-44"
          />
          {#if addErrors.date}<p id="date-error" class="text-xs text-destructive">{addErrors.date}</p>{/if}
        </div>
        {#if addMode === 'clock'}
          <div class="flex flex-col gap-1.5">
            <Label for="startTime">Clock in</Label>
            <Input
              id="startTime"
              type="text"
              name="startTime"
              inputmode="numeric"
              autocomplete="off"
              placeholder="9:00 am"
              onblur={normalizeTime}
              required
              aria-invalid={addErrors.startTime ? 'true' : undefined}
              aria-describedby={addErrors.startTime ? 'startTime-error' : undefined}
              class="w-40"
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
              placeholder="5:30 pm"
              onblur={normalizeTime}
              required
              aria-invalid={addErrors.endTime ? 'true' : undefined}
              aria-describedby={addErrors.endTime ? 'endTime-error' : undefined}
              class="w-40"
            />
            {#if addErrors.endTime}<p id="endTime-error" class="text-xs text-destructive">{addErrors.endTime}</p>{/if}
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
              class="w-24"
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
            class="w-24"
          />
          {#if addErrors.breakHours}<p id="breakHours-error" class="text-xs text-destructive">{addErrors.breakHours}</p>{/if}
        </div>
        <div class="flex flex-1 flex-col gap-1.5">
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
        <Button type="submit"><Plus class="size-4" /> Add</Button>
      </form>
    </Card.Content>
  </Card.Root>

  <!-- weekly grid -->
  <Card.Root>
    <Card.Header class="flex flex-row flex-wrap items-center justify-between gap-2">
      <div>
        <Card.Title>Log a week</Card.Title>
        <Card.Description>Fill each day, then add them all at once.</Card.Description>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select
          aria-label="Month"
          value={String(anchorMonth)}
          onchange={(e) => jumpTo(anchorYear, Number(e.currentTarget.value))}
          class="h-9 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {#each MONTHS as label, idx (label)}
            <option value={String(idx + 1)}>{label}</option>
          {/each}
        </select>
        <select
          aria-label="Year"
          value={String(anchorYear)}
          onchange={(e) => jumpTo(Number(e.currentTarget.value), anchorMonth)}
          class="h-9 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {#each yearOptions as y (y)}
            <option value={String(y)}>{y}</option>
          {/each}
        </select>
        <Button variant="outline" size="icon" aria-label="Previous week" onclick={() => (weekAnchor = addDays(weekStart, -7))}>
          <ChevronLeft class="size-4" />
        </Button>
        <span class="min-w-44 text-center text-sm font-medium tabular-nums">{formatWeekRange(weekStart, true)}</span>
        <Button variant="outline" size="icon" aria-label="Next week" onclick={() => (weekAnchor = addDays(weekStart, 7))}>
          <ChevronRight class="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onclick={() => (weekAnchor = todayISO())}>This week</Button>
      </div>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <div class="inline-flex w-fit rounded-md border border-input p-0.5 text-sm">
        {#each MODE_OPTIONS as opt (opt.m)}
          <button
            type="button"
            onclick={() => (weekMode = opt.m)}
            class="rounded-[0.3rem] px-3 py-1 transition-colors {weekMode === opt.m
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
          >
            {opt.label}
          </button>
        {/each}
      </div>

      <form
        bind:this={weekForm}
        method="POST"
        action="?/addWeek"
        onpaste={onGridPaste}
        use:enhance={() => {
          return async ({ update }) => {
            await update({ reset: true });
          };
        }}
        class="flex flex-col gap-3"
      >
        <input type="hidden" name="weekStart" value={weekStart} />
        <input type="hidden" name="mode" value={weekMode} />
        <div class="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span class="w-28 shrink-0">Day</span>
          {#if weekMode === 'clock'}
            <span class="w-40 shrink-0">In</span>
            <span class="w-40 shrink-0">Out</span>
          {:else}
            <span class="w-20 shrink-0">Hours</span>
          {/if}
          <span class="w-20 shrink-0">Break</span>
          <span class="flex-1">Note</span>
        </div>
        {#each weekRowDates as date, i (date)}
          {@const rowErr = (col: string) => weekErrors[`${col}-${i}`]}
          <div class="flex items-start gap-3 rounded-md px-2 py-1 {i % 2 === 1 ? 'bg-muted/40' : ''} {isWeekend(date) ? 'opacity-70' : ''}">
            <div class="w-28 shrink-0 pt-2 text-sm">
              <span class="font-medium">{weekdayShort(date)}</span>
              <span class="ml-1 text-muted-foreground">{formatDay(date).replace(/^\w+,\s/, '')}</span>
            </div>
            {#if weekMode === 'clock'}
              <div class="flex w-40 shrink-0 flex-col gap-1">
                <Input
                  type="text"
                  name="start-{i}"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="9:00 am"
                  onblur={normalizeTime}
                  aria-label="Clock in for {weekdayShort(date)}"
                  aria-invalid={rowErr('start') ? 'true' : undefined}
                />
                {#if rowErr('start')}<p class="text-xs text-destructive">{rowErr('start')}</p>{/if}
              </div>
              <div class="flex w-40 shrink-0 flex-col gap-1">
                <Input
                  type="text"
                  name="end-{i}"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="5:30 pm"
                  onblur={normalizeTime}
                  aria-label="Clock out for {weekdayShort(date)}"
                  aria-invalid={rowErr('end') ? 'true' : undefined}
                />
                {#if rowErr('end')}<p class="text-xs text-destructive">{rowErr('end')}</p>{/if}
              </div>
            {:else}
              <div class="flex w-20 shrink-0 flex-col gap-1">
                <Input
                  type="number"
                  name="hours-{i}"
                  step="0.25"
                  min="0.25"
                  max="24"
                  placeholder={isWeekend(date) ? '—' : '0'}
                  aria-label="Hours for {weekdayShort(date)}"
                  aria-invalid={rowErr('hours') ? 'true' : undefined}
                />
                {#if rowErr('hours')}<p class="text-xs text-destructive">{rowErr('hours')}</p>{/if}
              </div>
            {/if}
            <div class="flex w-20 shrink-0 flex-col gap-1">
              <Input
                type="number"
                name="break-{i}"
                step="0.25"
                min="0"
                max="24"
                placeholder="0"
                aria-label="Break for {weekdayShort(date)}"
                aria-invalid={rowErr('break') ? 'true' : undefined}
              />
              {#if rowErr('break')}<p class="text-xs text-destructive">{rowErr('break')}</p>{/if}
            </div>
            <div class="flex flex-1 flex-col gap-1">
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
        {/each}
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <Button type="submit"><Plus class="size-4" /> Add week</Button>
          <Button type="button" variant="outline" onclick={fillDown}>
            <ArrowDownToLine class="size-4" /> Fill down
          </Button>
          <span class="text-xs text-muted-foreground">Tip: paste a block from a spreadsheet into any cell.</span>
          {#if form?.weekAdded}
            <span class="text-sm text-success">Added {form.weekAdded} {form.weekAdded === 1 ? 'day' : 'days'}.</span>
          {:else if form && 'weekError' in form && form.weekError}
            <span class="text-sm text-destructive">{form.weekError}</span>
          {/if}
        </div>
      </form>
    </Card.Content>
  </Card.Root>

  <!-- entries -->
  <Card.Root>
    <Card.Header class="flex flex-row flex-wrap items-center justify-between gap-2">
      <div>
        <Card.Title>Entries</Card.Title>
        <Card.Description>{data.entries.length} total · newest first</Card.Description>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" onclick={exportCsv} disabled={data.entries.length === 0}>
          <Download class="size-4" /> Export CSV
        </Button>
        <form
          method="POST"
          action="?/importCsv"
          enctype="multipart/form-data"
          use:enhance={() => async ({ update }) => update()}
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
      </div>
    </Card.Header>
    <Card.Content>
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
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head class="w-32">Date</Table.Head>
              <Table.Head class="w-24 font-mono">In</Table.Head>
              <Table.Head class="w-24 font-mono">Out</Table.Head>
              <Table.Head class="w-20 text-right font-mono">Break</Table.Head>
              <Table.Head class="w-24 text-right font-mono">Worked</Table.Head>
              <Table.Head class="w-14 text-center">OT</Table.Head>
              <Table.Head>Note</Table.Head>
              <Table.Head class="w-24 text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.entries as entry (entry.id)}
              <Table.Row class="even:bg-muted/40">
                <Table.Cell>
                  <span class="text-muted-foreground">{weekdayShort(entry.date)}</span>
                  <span class="ml-1">{formatDay(entry.date).replace(/^\w+,\s/, '')}</span>
                </Table.Cell>
                <Table.Cell class="font-mono text-sm tabular-nums">
                  {entry.startTime ? formatTime(entry.startTime) : '—'}
                </Table.Cell>
                <Table.Cell class="font-mono text-sm tabular-nums">
                  {#if entry.endTime}
                    {formatTime(entry.endTime)}
                    {#if entry.startTime && entry.endTime < entry.startTime}
                      <span class="ml-1 text-xs text-muted-foreground">+1d</span>
                    {/if}
                  {:else}
                    —
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-right font-mono text-sm tabular-nums text-muted-foreground">
                  {entry.breakHours > 0 ? hrs(entry.breakHours) : '—'}
                </Table.Cell>
                <Table.Cell class="text-right font-mono tabular-nums">
                  {hrs(entry.hours - entry.breakHours)}
                </Table.Cell>
                <Table.Cell class="text-center">
                  {#if dayTotals[entry.date] > data.dailyHours}
                    <Badge variant="secondary" class="bg-amber-500/15 text-amber-600 dark:text-amber-400">OT</Badge>
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-muted-foreground">
                  {entry.note ?? ''}
                </Table.Cell>
                <Table.Cell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onclick={() => openEdit(entry)} aria-label="Edit entry">
                      <Pencil class="size-4" />
                    </Button>
                    <form method="POST" action="?/delete" use:enhance>
                      <input type="hidden" name="id" value={entry.id} />
                      <Button variant="ghost" size="icon" type="submit" aria-label="Delete entry">
                        <Trash2 class="size-4 text-destructive" />
                      </Button>
                    </form>
                  </div>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<!-- edit dialog -->
<Dialog.Root bind:open={editOpen}>
  <Dialog.Content class="sm:max-w-md">
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
        <input type="hidden" name="mode" value={editMode} />
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
                placeholder="9:00 am"
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
                placeholder="5:30 pm"
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
