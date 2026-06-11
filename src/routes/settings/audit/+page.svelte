<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { formatDay, formatTimeRange, formatTimestamp } from '$lib/date';
  import type { EntryEvent, Expense, ExpenseEvent, TimeEntry } from '$lib/db/schema';
  import { EXPENSE_META, MEAL_METHOD_LABELS, RIDE_DIRECTION_LABELS, VENDOR_LABELS } from '$lib/expense-kinds';
  import { LEAVE_META } from '$lib/leave-kinds';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function snapshotOf(e: EntryEvent): TimeEntry | null {
    try {
      return JSON.parse(e.snapshot) as TimeEntry;
    } catch {
      return null;
    }
  }

  const ACTION_META = {
    add: { label: 'Added', class: 'bg-success/15 text-success' },
    edit: { label: 'Edited', class: 'bg-primary/10 text-primary' },
    delete: { label: 'Deleted', class: 'bg-destructive/10 text-destructive' },
  } as const;

  // What the entry looked like at that moment: clock range, net hours, or kind.
  function summary(s: TimeEntry | null): string {
    if (!s) return '—';
    if (s.entryKind !== 'work') return LEAVE_META[s.entryKind].label;
    if (s.startTime && s.endTime) return formatTimeRange(s.startTime, s.endTime, data.timeFormat);
    return `${(s.hours - s.breakHours).toFixed(2)}h`;
  }

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  // One timeline: entry and expense events interleaved by timestamp.
  type AuditItem = {
    id: string;
    action: EntryEvent['action'];
    at: number;
    source: 'Entry' | 'Expense';
    date: string | null;
    detail: string;
    note: string | null;
  };

  function entryItem(e: EntryEvent): AuditItem {
    const s = snapshotOf(e);
    return {
      id: e.id,
      action: e.action,
      at: e.at,
      source: 'Entry',
      date: s?.date ?? null,
      detail: summary(s),
      note: s?.note ?? null,
    };
  }

  function expenseSnapshotOf(e: ExpenseEvent): Expense | null {
    try {
      return JSON.parse(e.snapshot) as Expense;
    } catch {
      return null;
    }
  }

  // E.g. "Uber · to work · $18.50" or "Grubhub · delivery · $24.00";
  // vendor falls back to the kind label.
  function expenseDetail(s: Expense): string {
    const bits = [s.vendor ? VENDOR_LABELS[s.vendor] : EXPENSE_META[s.kind].label];
    if (s.direction && s.direction !== 'other') bits.push(RIDE_DIRECTION_LABELS[s.direction].toLowerCase());
    if (s.method) bits.push(MEAL_METHOD_LABELS[s.method].toLowerCase());
    bits.push(money.format(s.amount));
    return bits.join(' · ');
  }

  function expenseItem(e: ExpenseEvent): AuditItem {
    const s = expenseSnapshotOf(e);
    return {
      id: e.id,
      action: e.action,
      at: e.at,
      source: 'Expense',
      date: s?.date ?? null,
      detail: s ? expenseDetail(s) : '—',
      note: s?.note ?? null,
    };
  }

  const items = $derived(
    [...data.events.map(entryItem), ...data.expenseEvents.map(expenseItem)].sort((a, b) => b.at - a.at),
  );
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-6">
  <div class="max-md:text-center">
    <Button href="/settings" variant="ghost" size="sm" class="-ml-2 mb-2">
      <ArrowLeft class="size-4" /> Settings
    </Button>
    <h1 class="text-2xl font-semibold tracking-tight">Audit log</h1>
    <p class="mt-1 text-sm text-muted-foreground">Every add, edit, and delete on the ledger and expenses, newest first.</p>
  </div>

  <Card.Root>
    <Card.Content>
      {#if items.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">
          Nothing logged yet — events appear as entries and expenses are added, edited, or deleted.
        </p>
      {:else}
        <ul class="divide-y divide-border/50">
          {#each items as item (item.id)}
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span class="w-16 rounded px-1.5 py-0.5 text-center text-xs font-medium {ACTION_META[item.action].class}">
                {ACTION_META[item.action].label}
              </span>
              <span
                class="w-16 rounded px-1.5 py-0.5 text-center text-xs font-medium {item.source === 'Expense'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'}"
              >
                {item.source}
              </span>
              <span class="font-mono text-xs uppercase tabular-nums">{item.date ? formatDay(item.date) : '—'}</span>
              <span class="font-mono tabular-nums">{item.detail}</span>
              {#if item.note}<span class="max-w-48 truncate text-xs text-muted-foreground">{item.note}</span>{/if}
              <span class="ml-auto text-xs text-muted-foreground">
                {formatTimestamp(Math.floor(item.at / 1000), data.timeFormat)}
              </span>
            </li>
          {/each}
        </ul>
        <p class="mt-3 text-center text-xs text-muted-foreground">Showing the latest {items.length} events.</p>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
