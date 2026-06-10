<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { formatDay, formatTimeRange, formatTimestamp } from '$lib/date';
  import type { EntryEvent, TimeEntry } from '$lib/db/schema';
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
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-6">
  <div class="max-md:text-center">
    <Button href="/settings" variant="ghost" size="sm" class="-ml-2 mb-2">
      <ArrowLeft class="size-4" /> Settings
    </Button>
    <h1 class="text-2xl font-semibold tracking-tight">Audit log</h1>
    <p class="mt-1 text-sm text-muted-foreground">Every add, edit, and delete on the ledger, newest first.</p>
  </div>

  <Card.Root>
    <Card.Content>
      {#if data.events.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">
          Nothing logged yet — events appear as ledger entries are added, edited, or deleted.
        </p>
      {:else}
        <ul class="divide-y divide-border/50">
          {#each data.events as e (e.id)}
            {@const s = snapshotOf(e)}
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span class="w-16 rounded px-1.5 py-0.5 text-center text-xs font-medium {ACTION_META[e.action].class}">
                {ACTION_META[e.action].label}
              </span>
              <span class="font-mono text-xs uppercase tabular-nums">{s ? formatDay(s.date) : '—'}</span>
              <span class="font-mono tabular-nums">{summary(s)}</span>
              {#if s?.note}<span class="max-w-48 truncate text-xs text-muted-foreground">{s.note}</span>{/if}
              <span class="ml-auto text-xs text-muted-foreground">
                {formatTimestamp(Math.floor(e.at / 1000), data.timeFormat)}
              </span>
            </li>
          {/each}
        </ul>
        <p class="mt-3 text-center text-xs text-muted-foreground">Showing the latest {data.events.length} events.</p>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
