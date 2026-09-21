<script lang="ts">
  import CalendarCheck from '@lucide/svelte/icons/calendar-check';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Gift from '@lucide/svelte/icons/gift';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import DateField from '$lib/components/DateField.svelte';
  import DateJump from '$lib/components/DateJump.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { type BonusActionName, bonusLabelOf, runBonusAction } from '$lib/core/bonuses';
  import { formatDay, formatRangeISO, formatWeekRange, todayISO } from '$lib/date';
  import type { Bonus } from '$lib/db/schema';
  import { isDemo } from '$lib/demo/flag';
  import { BONUS_LABEL_MAX } from '$lib/schemas/bonus';
  import { type LedgerPeriod, PERIOD_NOUNS } from '$lib/schemas/settings';
  import { addDays, weekDates } from '$lib/timesheet';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Demo mode intercepts mutations client-side; results stand in for `form`.
  let demoForm = $state<ActionData>(null);
  const actionData = $derived(isDemo ? demoForm : form);

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  // ── Period nav (same bucket math as the dashboard and Expenses) ──────────
  const PERIOD_LABELS: Record<LedgerPeriod, string> = {
    week: 'Weekly',
    biweek: 'Bi-weekly',
    month: 'Monthly',
    quarter: 'Quarterly',
    year: 'Yearly',
  };
  // Initial-only read; the selector mutates independently after first render.
  // svelte-ignore state_referenced_locally
  let period = $state<LedgerPeriod>(data.ledgerPeriod);
  let anchor = $state(todayISO());

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function shiftMonth(a: string, n: number): string {
    const [y, m] = a.slice(0, 7).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
  }
  function lastDayOf(yearMonth01: string): string {
    const [y, m] = yearMonth01.slice(0, 7).split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  }

  const bucket = $derived.by(() => {
    const wsOn = data.weekStartsOn;
    switch (period) {
      case 'week': {
        const start = weekDates(anchor, wsOn)[0];
        return { start, end: addDays(start, 6), label: formatWeekRange(start, true) };
      }
      case 'biweek': {
        const wk = weekDates(anchor, wsOn)[0];
        const start = addDays(wk, -7);
        const end = addDays(wk, 6);
        return { start, end, label: formatRangeISO(start, end, true) };
      }
      case 'month': {
        const start = `${anchor.slice(0, 7)}-01`;
        return {
          start,
          end: lastDayOf(start),
          label: `${MONTHS[Number(anchor.slice(5, 7)) - 1]} ${Number(anchor.slice(0, 4))}`,
        };
      }
      case 'quarter': {
        const y = Number(anchor.slice(0, 4));
        const m = Number(anchor.slice(5, 7));
        const qm = Math.floor((m - 1) / 3) * 3 + 1;
        const start = `${y}-${String(qm).padStart(2, '0')}-01`;
        return {
          start,
          end: lastDayOf(`${y}-${String(qm + 2).padStart(2, '0')}-01`),
          label: `Q${Math.floor((m - 1) / 3) + 1} ${y}`,
        };
      }
      case 'year': {
        const y = Number(anchor.slice(0, 4));
        return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
      }
    }
  });

  function shiftPage(dir: -1 | 1) {
    switch (period) {
      case 'week':
        anchor = addDays(anchor, 7 * dir);
        return;
      case 'biweek':
        anchor = addDays(anchor, 14 * dir);
        return;
      case 'month':
        anchor = shiftMonth(anchor, dir);
        return;
      case 'quarter':
        anchor = shiftMonth(anchor, 3 * dir);
        return;
      case 'year':
        anchor = shiftMonth(anchor, 12 * dir);
        return;
    }
  }

  // The jump-home button has nowhere to go once the browsed bucket holds today.
  const atCurrentPeriod = $derived(todayISO() >= bucket.start && todayISO() <= bucket.end);

  const inBucket = $derived(data.bonuses.filter((b) => b.date >= bucket.start && b.date <= bucket.end));
  const total = $derived(Math.round(inBucket.reduce((s, b) => s + b.amount, 0) * 100) / 100);

  // ── Forms ────────────────────────────────────────────────────────────────
  let addDate = $state(todayISO());
  let editing = $state<Bonus | null>(null);
  let deleting = $state<Bonus | null>(null);
  let submitting = $state(false);

  // Shared enhance: demo cancels the POST and runs the core action against
  // localStorage; normal mode submits and invalidateAll() refreshes the layout.
  function bonusEnhance(action: BonusActionName, after?: () => void): SubmitFunction {
    return ({ formData, cancel }) => {
      submitting = true;
      if (isDemo) {
        cancel();
        void (async () => {
          const { demoRepo } = await import('$lib/demo/repo');
          const out = await runBonusAction(demoRepo, action, formData);
          demoForm = out.data as ActionData;
          if (out.ok) after?.();
          await invalidate('demo:data');
          submitting = false;
        })();
        return;
      }
      return async ({ result, update }) => {
        await update();
        if (result.type === 'success') after?.();
        submitting = false;
      };
    };
  }
</script>

<div class="flex flex-col gap-8">
  <div class="max-md:text-center">
    <h1 class="text-2xl font-semibold tracking-tight">Bonuses</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Money that arrived without hours behind it. Bonuses raise what you earned and fund savings goals — they never
      shrink an hours shortfall.
    </p>
  </div>

  <!-- add form -->
  <Card.Root>
    <Card.Header class="max-md:text-center">
      <Card.Title>Add a bonus</Card.Title>
    </Card.Header>
    <Card.Content>
      <form
        method="POST"
        action="?/add"
        use:enhance={bonusEnhance('add', () => (addDate = todayISO()))}
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[9rem_10rem_8rem_1fr_auto] lg:items-end"
      >
        <div class="flex flex-col gap-1.5">
          <Label for="bonus-date">Date</Label>
          <DateField id="bonus-date" name="date" bind:value={addDate} min={data.epoch} />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="bonus-label">Label</Label>
          <Input
            id="bonus-label"
            type="text"
            name="label"
            maxlength={BONUS_LABEL_MAX}
            placeholder="Q3 performance"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="bonus-amount">Amount (USD)</Label>
          <Input id="bonus-amount" type="number" name="amount" step="0.01" min="0.01" placeholder="2000" required />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="bonus-note">Note</Label>
          <Input id="bonus-note" type="text" name="note" maxlength={500} placeholder="Paid with the Sep 30 check" />
        </div>
        <Button type="submit" disabled={submitting} class="max-sm:w-full">
          <Plus class="size-4" /> Add
        </Button>
      </form>
      {#if actionData && 'bonusError' in actionData && actionData.bonusError}
        <p class="mt-3 text-sm text-destructive">{actionData.bonusError}</p>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- period nav -->
  <div class="flex flex-wrap items-center gap-2 rounded-lg border border-input bg-card p-2">
    <select
      aria-label="Period"
      value={period}
      onchange={(e) => {
        period = e.currentTarget.value as LedgerPeriod;
      }}
      class="h-9 shrink-0 basis-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:basis-auto"
    >
      {#each Object.entries(PERIOD_LABELS) as [v, label] (v)}
        <option value={v}>{label}</option>
      {/each}
    </select>
    <Button
      variant="outline"
      size="icon-lg"
      class="shrink-0"
      title="Previous period"
      aria-label="Previous period"
      disabled={bucket.start <= data.epoch}
      onclick={() => shiftPage(-1)}
    >
      <ChevronLeft class="size-4" />
    </Button>
    <span class="flex-1 text-center font-mono text-sm font-medium uppercase tabular-nums">{bucket.label}</span>
    <Button
      variant="outline"
      size="icon-lg"
      class="shrink-0"
      title="Next period"
      aria-label="Next period"
      onclick={() => shiftPage(1)}
    >
      <ChevronRight class="size-4" />
    </Button>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <!-- aria-disabled, not disabled: a disabled button drops pointer events
               and the explanatory tooltip could never show -->
          <Button
            {...props}
            variant="outline"
            size="lg"
            class="shrink-0 {atCurrentPeriod ? 'opacity-50' : ''}"
            aria-disabled={atCurrentPeriod}
            onclick={() => {
              if (!atCurrentPeriod) anchor = todayISO();
            }}
          >
            <CalendarCheck class="size-4" /> This {PERIOD_NOUNS[period]}
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>
        {atCurrentPeriod ? `Already on this ${PERIOD_NOUNS[period]}` : 'Jump back to the current period'}
      </Tooltip.Content>
    </Tooltip.Root>
    <DateJump
      value={anchor}
      min={data.epoch}
      label="Jump to date"
      onpick={(iso) => (anchor = iso < data.epoch ? data.epoch : iso)}
    />
  </div>

  <!-- list -->
  <Card.Root>
    <Card.Header class="flex flex-row items-center justify-between">
      <Card.Title>{bucket.label}</Card.Title>
      <span class="font-mono text-sm font-semibold tabular-nums" title="Period total">{money.format(total)}</span>
    </Card.Header>
    <Card.Content>
      {#if inBucket.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">No bonuses this period.</p>
      {:else}
        <ul class="divide-y divide-border/50">
          {#each inBucket as b (b.id)}
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm">
              <span class="w-14 font-mono text-xs uppercase tabular-nums">{formatDay(b.date)}</span>
              <span
                class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300"
              >
                <Gift class="size-3" />
                {bonusLabelOf(b.label)}
              </span>
              {#if b.note}<span class="max-w-56 truncate text-xs text-muted-foreground">{b.note}</span>{/if}
              <span class="ml-auto font-mono tabular-nums text-success">+{money.format(b.amount)}</span>
              <span class="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Edit bonus"
                  aria-label="Edit bonus"
                  onclick={() => (editing = b)}
                >
                  <Pencil class="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete bonus"
                  aria-label="Delete bonus"
                  class="text-destructive hover:text-destructive"
                  onclick={() => (deleting = b)}
                >
                  <Trash2 class="size-4" />
                </Button>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </Card.Content>
  </Card.Root>

  <p class="text-center text-xs text-muted-foreground">
    Every add, edit, and delete here lands in the
    <a href="/settings/audit" class="underline underline-offset-2 hover:text-foreground">audit log</a>.
  </p>
</div>

<!-- edit dialog -->
<Dialog.Root
  open={editing !== null}
  onOpenChange={(o) => {
    if (!o) editing = null;
  }}
>
  <Dialog.Content class="sm:max-w-md">
    {#if editing}
      <Dialog.Header>
        <Dialog.Title>Edit bonus</Dialog.Title>
      </Dialog.Header>
      <form
        method="POST"
        action="?/update"
        use:enhance={bonusEnhance('update', () => (editing = null))}
        class="flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={editing.id} />
        <div class="flex flex-col gap-1.5">
          <Label for="edit-bonus-date">Date</Label>
          <DateField id="edit-bonus-date" name="date" value={editing.date} min={data.epoch} />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="edit-bonus-label">Label</Label>
          <Input
            id="edit-bonus-label"
            type="text"
            name="label"
            maxlength={BONUS_LABEL_MAX}
            value={editing.label ?? ''}
            placeholder="Q3 performance"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="edit-bonus-amount">Amount (USD)</Label>
          <Input
            id="edit-bonus-amount"
            type="number"
            name="amount"
            step="0.01"
            min="0.01"
            value={editing.amount}
            required
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="edit-bonus-note">Note</Label>
          <Input id="edit-bonus-note" type="text" name="note" maxlength={500} value={editing.note ?? ''} />
        </div>
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (editing = null)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>Save</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- delete confirm -->
<Dialog.Root
  open={deleting !== null}
  onOpenChange={(o) => {
    if (!o) deleting = null;
  }}
>
  <Dialog.Content class="sm:max-w-md">
    {#if deleting}
      <Dialog.Header>
        <Dialog.Title>Delete this bonus?</Dialog.Title>
        <Dialog.Description>
          {formatDay(deleting.date)} · {bonusLabelOf(deleting.label)} · {money.format(deleting.amount)}
          {#if deleting.note}
            · {deleting.note}
          {/if}
        </Dialog.Description>
      </Dialog.Header>
      <form method="POST" action="?/delete" use:enhance={bonusEnhance('delete', () => (deleting = null))}>
        <input type="hidden" name="id" value={deleting.id} />
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (deleting = null)}>Cancel</Button>
          <Button type="submit" variant="destructive" disabled={submitting}>Delete</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>
