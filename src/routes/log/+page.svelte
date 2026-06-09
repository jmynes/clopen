<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { enhance } from '$app/forms';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Table from '$lib/components/ui/table';
  import { formatDay, formatWeekRange, todayISO, weekdayShort } from '$lib/date';
  import type { TimeEntry } from '$lib/db/schema';
  import { addDays, weekDates } from '$lib/timesheet';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const hrs = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}h`;

  // Per-day totals of *net* worked hours (after breaks) drive the overtime badge.
  const dayTotals = $derived(
    data.entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.date] = (acc[e.date] ?? 0) + e.hours - e.breakHours;
      return acc;
    }, {}),
  );

  let editing = $state<TimeEntry | null>(null);
  let editOpen = $state(false);

  function openEdit(entry: TimeEntry) {
    editing = entry;
    editOpen = true;
  }

  // Weekly grid. Rows are keyed by date, so navigating weeks recreates the
  // inputs (clearing anything typed). Field names hours-0…6 map to weekDates()
  // order, which the server recomputes from weekStart.
  let weekAnchor = $state(todayISO());
  const weekRowDates = $derived(weekDates(weekAnchor));
  const weekStart = $derived(weekRowDates[0]);
  const isWeekend = (i: number) => i >= 5;
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
    <Card.Content>
      <form
        method="POST"
        action="?/add"
        use:enhance={() => {
          return async ({ update }) => {
            await update({ reset: true });
          };
        }}
        class="flex flex-col gap-4 sm:flex-row sm:items-end"
      >
        <div class="flex flex-col gap-1.5">
          <Label for="date">Date</Label>
          <Input id="date" type="date" name="date" value={todayISO()} max={todayISO()} required class="w-44" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="hours">Hours</Label>
          <Input id="hours" type="number" name="hours" step="0.25" min="0.25" max="24" placeholder="8" required class="w-24" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="breakHours">Break <span class="text-muted-foreground">(h)</span></Label>
          <Input id="breakHours" type="number" name="breakHours" step="0.25" min="0" max="24" placeholder="0" class="w-24" />
        </div>
        <div class="flex flex-1 flex-col gap-1.5">
          <Label for="note">Note <span class="text-muted-foreground">(optional)</span></Label>
          <Input id="note" type="text" name="note" placeholder="What did you work on?" />
        </div>
        <Button type="submit"><Plus class="size-4" /> Add</Button>
      </form>
      {#if form && 'error' in form && form.error}
        <p class="mt-3 text-sm text-destructive">{form.error}</p>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- weekly grid -->
  <Card.Root>
    <Card.Header class="flex flex-row flex-wrap items-center justify-between gap-2">
      <div>
        <Card.Title>Log a week</Card.Title>
        <Card.Description>Fill hours for each day, then add them all at once.</Card.Description>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous week" onclick={() => (weekAnchor = addDays(weekStart, -7))}>
          <ChevronLeft class="size-4" />
        </Button>
        <span class="min-w-32 text-center text-sm font-medium tabular-nums">{formatWeekRange(weekStart)}</span>
        <Button variant="outline" size="icon" aria-label="Next week" onclick={() => (weekAnchor = addDays(weekStart, 7))}>
          <ChevronRight class="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onclick={() => (weekAnchor = todayISO())}>This week</Button>
      </div>
    </Card.Header>
    <Card.Content>
      <form
        method="POST"
        action="?/addWeek"
        use:enhance={() => {
          return async ({ update }) => {
            await update({ reset: true });
          };
        }}
        class="flex flex-col gap-3"
      >
        <input type="hidden" name="weekStart" value={weekStart} />
        {#each weekRowDates as date, i (date)}
          <div class="flex items-center gap-3 {isWeekend(i) ? 'opacity-70' : ''}">
            <div class="w-28 shrink-0 text-sm">
              <span class="font-medium">{weekdayShort(date)}</span>
              <span class="ml-1 text-muted-foreground">{formatDay(date).replace(/^\w+,\s/, '')}</span>
            </div>
            <Input
              type="number"
              name="hours-{i}"
              step="0.25"
              min="0.25"
              max="24"
              placeholder={isWeekend(i) ? '—' : '0'}
              aria-label="Hours for {weekdayShort(date)}"
              class="w-20"
            />
            <Input
              type="number"
              name="break-{i}"
              step="0.25"
              min="0"
              max="24"
              placeholder="break"
              aria-label="Break for {weekdayShort(date)}"
              class="w-20"
            />
            <Input type="text" name="note-{i}" placeholder="Note (optional)" aria-label="Note for {weekdayShort(date)}" />
          </div>
        {/each}
        <div class="mt-1 flex items-center gap-3">
          <Button type="submit"><Plus class="size-4" /> Add week</Button>
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
    <Card.Header>
      <Card.Title>Entries</Card.Title>
      <Card.Description>{data.entries.length} total · newest first</Card.Description>
    </Card.Header>
    <Card.Content>
      {#if data.entries.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">No entries yet. Add your first above.</p>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head class="w-40">Date</Table.Head>
              <Table.Head class="w-28 text-right">Worked</Table.Head>
              <Table.Head>Note</Table.Head>
              <Table.Head class="w-24 text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.entries as entry (entry.id)}
              <Table.Row>
                <Table.Cell>
                  <span class="text-muted-foreground">{weekdayShort(entry.date)}</span>
                  <span class="ml-1">{formatDay(entry.date).replace(/^\w+,\s/, '')}</span>
                </Table.Cell>
                <Table.Cell class="text-right font-mono tabular-nums">
                  {hrs(entry.hours - entry.breakHours)}
                  {#if dayTotals[entry.date] > data.dailyHours}
                    <Badge variant="secondary" class="ml-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">OT</Badge>
                  {/if}
                  {#if entry.breakHours > 0}
                    <div class="text-xs font-normal text-muted-foreground">
                      {hrs(entry.hours)} − {hrs(entry.breakHours)} break
                    </div>
                  {/if}
                </Table.Cell>
                <Table.Cell class="text-muted-foreground">{entry.note ?? ''}</Table.Cell>
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
          return async ({ update }) => {
            await update();
            editOpen = false;
          };
        }}
        class="flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={editing.id} />
        <div class="flex flex-col gap-1.5">
          <Label for="edit-date">Date</Label>
          <Input id="edit-date" type="date" name="date" value={editing.date} max={todayISO()} required />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <Label for="edit-hours">Hours</Label>
            <Input id="edit-hours" type="number" name="hours" step="0.25" min="0.25" max="24" value={editing.hours} required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="edit-break">Break (h)</Label>
            <Input id="edit-break" type="number" name="breakHours" step="0.25" min="0" max="24" value={editing.breakHours} />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="edit-note">Note</Label>
          <Input id="edit-note" type="text" name="note" value={editing.note ?? ''} />
        </div>
        <Dialog.Footer>
          <Button type="submit">Save changes</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>
