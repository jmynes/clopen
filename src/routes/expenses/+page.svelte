<script lang="ts">
  import AppWindow from '@lucide/svelte/icons/app-window';
  import Bike from '@lucide/svelte/icons/bike';
  import Briefcase from '@lucide/svelte/icons/briefcase';
  import CalendarCheck from '@lucide/svelte/icons/calendar-check';
  import CarTaxiFront from '@lucide/svelte/icons/car-taxi-front';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ConciergeBell from '@lucide/svelte/icons/concierge-bell';
  import Cpu from '@lucide/svelte/icons/cpu';
  import CreditCard from '@lucide/svelte/icons/credit-card';
  import House from '@lucide/svelte/icons/house';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import Receipt from '@lucide/svelte/icons/receipt';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Route from '@lucide/svelte/icons/route';
  import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Utensils from '@lucide/svelte/icons/utensils';
  import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import GrubhubIcon from '$lib/components/brand/GrubhubIcon.svelte';
  import LyftIcon from '$lib/components/brand/LyftIcon.svelte';
  import UberEatsIcon from '$lib/components/brand/UberEatsIcon.svelte';
  import UberIcon from '$lib/components/brand/UberIcon.svelte';
  import DateField from '$lib/components/DateField.svelte';
  import DateJump from '$lib/components/DateJump.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { type ExpenseActionName, runExpenseAction } from '$lib/core/expenses';
  import { formatDay, formatRangeISO, formatWeekRange, todayISO } from '$lib/date';
  import type { Expense } from '$lib/db/schema';
  import { isDemo } from '$lib/demo/flag';
  import {
    EXPENSE_KINDS,
    EXPENSE_META,
    type ExpenseKind,
    type ExpenseVendor,
    KIND_VENDORS,
    MEAL_METHOD_LABELS,
    type MealMethod,
    PURCHASE_CADENCE_LABELS,
    PURCHASE_CADENCES,
    type PurchaseCadence,
    RIDE_DIRECTION_LABELS,
    RIDE_DIRECTIONS,
    type RideDirection,
    VENDOR_LABELS,
    vendorMethods,
  } from '$lib/expense-kinds';
  import type { LedgerPeriod } from '$lib/schemas/settings';
  import { addDays, weekDates } from '$lib/timesheet';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Demo mode intercepts mutations client-side; results stand in for `form`.
  let demoForm = $state<ActionData>(null);
  const actionData = $derived(isDemo ? demoForm : form);

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  // ── Period nav (same bucket math as the dashboard) ───────────────────────
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

  const inBucket = $derived(data.expenses.filter((e) => e.date >= bucket.start && e.date <= bucket.end));
  const total = $derived(Math.round(inBucket.reduce((s, e) => s + e.amount, 0) * 100) / 100);

  // ── Forms ────────────────────────────────────────────────────────────────
  // The shadcn Selects are display-only (icons in the trigger and menu);
  // hidden inputs alongside them carry the values into the POST, and the
  // ride-only vendor/direction fields appear as the kind flips to ride.
  /** What a fresh form opens with — every axis comes from Settings → Expenses. */
  function detailDefaults(kind: ExpenseKind): {
    vendor: ExpenseVendor;
    direction: RideDirection;
    method: MealMethod;
    cadence: PurchaseCadence;
  } {
    const vendor =
      kind === 'ride'
        ? data.defaultRideVendor
        : kind === 'meal'
          ? data.defaultMealVendor
          : kind === 'purchase'
            ? data.defaultPurchaseVendor
            : 'other';
    return {
      vendor,
      direction: data.defaultRideDirection,
      method: data.defaultMealMethod,
      cadence: data.defaultPurchaseCadence,
    };
  }

  let addDate = $state(todayISO());
  // Initial-only reads of the settings defaults; the selects own the values
  // after first render.
  // svelte-ignore state_referenced_locally
  let addKind = $state<ExpenseKind>(data.defaultExpenseKind);
  // svelte-ignore state_referenced_locally
  let addVendor = $state<ExpenseVendor>(detailDefaults(addKind).vendor);
  // svelte-ignore state_referenced_locally
  let addDirection = $state<RideDirection>(data.defaultRideDirection);
  // svelte-ignore state_referenced_locally
  let addMethod = $state<MealMethod>(data.defaultMealMethod);
  // svelte-ignore state_referenced_locally
  let addCadence = $state<PurchaseCadence>(data.defaultPurchaseCadence);
  let editKind = $state<ExpenseKind>('ride');
  let editVendor = $state<ExpenseVendor>('other');
  let editDirection = $state<RideDirection>('other');
  let editMethod = $state<MealMethod>('delivery');
  let editCadence = $state<PurchaseCadence>('monthly');
  let editing = $state<Expense | null>(null);
  let deleting = $state<Expense | null>(null);
  let submitting = $state(false);

  const KIND_ICON = { ride: CarTaxiFront, meal: UtensilsCrossed, purchase: CreditCard, other: Receipt } as const;
  // Uber Eats isn't in the FA brands pack (its glyph comes from Simple
  // Icons); Grubhub renders its actual app icon (see GrubhubIcon).
  const VENDOR_ICON = {
    uber: UberIcon,
    lyft: LyftIcon,
    taxi: CarTaxiFront,
    uber_eats: UberEatsIcon,
    grubhub: GrubhubIcon,
    restaurant: Utensils,
    hardware: Cpu,
    software: AppWindow,
    subscription: RefreshCw,
    other: Receipt,
  } as const;
  const DIRECTION_ICON = { to_work: Briefcase, to_home: House, other: Route } as const;
  const METHOD_ICON = { delivery: Bike, pickup: ShoppingBag, dine_in: ConciergeBell } as const;
  const MARK_CLASS: Record<ExpenseVendor, string> = {
    uber: '',
    lyft: 'text-[#ff00bf]',
    taxi: 'text-yellow-500',
    uber_eats: 'text-[#06c167]',
    grubhub: '',
    restaurant: '',
    hardware: '',
    software: '',
    subscription: '',
    other: '',
  };

  /** Row display: a known vendor replaces the generic kind badge label. */
  function badgeLabel(e: Expense): string {
    return e.vendor ? VENDOR_LABELS[e.vendor] : EXPENSE_META[e.kind].label;
  }

  /** Dine-in only fits a restaurant; flipping vendor coerces a stranded method. */
  function coerceMethod(vendor: ExpenseVendor, method: MealMethod): MealMethod {
    return vendorMethods(vendor).includes(method) ? method : 'delivery';
  }

  // Shared enhance: demo cancels the POST and runs the core action against
  // localStorage; normal mode submits and invalidateAll() refreshes the layout.
  function expenseEnhance(action: ExpenseActionName, after?: () => void): SubmitFunction {
    return ({ formData, cancel }) => {
      submitting = true;
      if (isDemo) {
        cancel();
        void (async () => {
          const { demoRepo } = await import('$lib/demo/repo');
          const out = await runExpenseAction(demoRepo, action, formData);
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

<!-- The three dropdowns, shared by the add form and the edit dialog. Each is
     a display-only shadcn Select (icons in trigger + menu) with a hidden
     input carrying the value into the POST. -->
{#snippet kindSelect(id: string, value: ExpenseKind, set: (v: ExpenseKind) => void)}
  {@const KindIcon = KIND_ICON[value]}
  <div class="flex flex-col gap-1.5">
    <Label for={id}>Kind</Label>
    <Select.Root type="single" {value} onValueChange={(v) => set(v as ExpenseKind)}>
      <Select.Trigger {id} aria-label="Kind" class="w-full">
        <span class="inline-flex min-w-0 items-center gap-1.5">
          <KindIcon class="size-3.5 shrink-0" />
          <span class="min-w-0 truncate text-xs">{EXPENSE_META[value].label}</span>
        </span>
      </Select.Trigger>
      <Select.Content>
        {#each EXPENSE_KINDS as kind (kind)}
          {@const ItemIcon = KIND_ICON[kind]}
          <Select.Item value={kind} label={EXPENSE_META[kind].label}>
            <span class="inline-flex items-center gap-2">
              <ItemIcon class="size-3.5" />
              {EXPENSE_META[kind].label}
            </span>
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <input type="hidden" name="kind" {value} />
  </div>
{/snippet}

{#snippet vendorSelect(id: string, kind: ExpenseKind, value: ExpenseVendor, set: (v: ExpenseVendor) => void)}
  {@const Mark = VENDOR_ICON[value]}
  <div class="flex flex-col gap-1.5">
    <Label for={id}>Service</Label>
    <Select.Root type="single" {value} onValueChange={(v) => set(v as ExpenseVendor)}>
      <Select.Trigger {id} aria-label="Service" class="w-full">
        <span class="inline-flex min-w-0 items-center gap-1.5">
          <Mark class="size-3.5 shrink-0 {MARK_CLASS[value]}" />
          <span class="min-w-0 truncate text-xs">{VENDOR_LABELS[value]}</span>
        </span>
      </Select.Trigger>
      <Select.Content>
        {#each KIND_VENDORS[kind] as vendor (vendor)}
          {@const ItemIcon = VENDOR_ICON[vendor]}
          <Select.Item value={vendor} label={VENDOR_LABELS[vendor]}>
            <span class="inline-flex items-center gap-2">
              <ItemIcon class="size-3.5 {MARK_CLASS[vendor]}" />
              {VENDOR_LABELS[vendor]}
            </span>
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <input type="hidden" name="vendor" {value} />
  </div>
{/snippet}

{#snippet methodSelect(id: string, vendor: ExpenseVendor, value: MealMethod, set: (v: MealMethod) => void)}
  {@const MethodIcon = METHOD_ICON[value]}
  <div class="flex flex-col gap-1.5">
    <Label for={id}>Method</Label>
    <Select.Root type="single" {value} onValueChange={(v) => set(v as MealMethod)}>
      <Select.Trigger {id} aria-label="Method" class="w-full">
        <span class="inline-flex min-w-0 items-center gap-1.5">
          <MethodIcon class="size-3.5 shrink-0" />
          <span class="min-w-0 truncate text-xs">{MEAL_METHOD_LABELS[value]}</span>
        </span>
      </Select.Trigger>
      <Select.Content>
        {#each vendorMethods(vendor) as method (method)}
          {@const ItemIcon = METHOD_ICON[method]}
          <Select.Item value={method} label={MEAL_METHOD_LABELS[method]}>
            <span class="inline-flex items-center gap-2">
              <ItemIcon class="size-3.5" />
              {MEAL_METHOD_LABELS[method]}
            </span>
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <input type="hidden" name="method" {value} />
  </div>
{/snippet}

{#snippet cadenceSelect(id: string, value: PurchaseCadence, set: (v: PurchaseCadence) => void)}
  <div class="flex flex-col gap-1.5">
    <Label for={id}>Cadence</Label>
    <Select.Root type="single" {value} onValueChange={(v) => set(v as PurchaseCadence)}>
      <Select.Trigger {id} aria-label="Cadence" class="w-full">
        <span class="inline-flex min-w-0 items-center gap-1.5">
          <RefreshCw class="size-3.5 shrink-0" />
          <span class="min-w-0 truncate text-xs">{PURCHASE_CADENCE_LABELS[value]}</span>
        </span>
      </Select.Trigger>
      <Select.Content>
        {#each PURCHASE_CADENCES as cadence (cadence)}
          <Select.Item value={cadence} label={PURCHASE_CADENCE_LABELS[cadence]}>
            <span class="inline-flex items-center gap-2">
              <RefreshCw class="size-3.5" />
              {PURCHASE_CADENCE_LABELS[cadence]}
            </span>
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <input type="hidden" name="cadence" {value} />
  </div>
{/snippet}

{#snippet directionSelect(id: string, value: RideDirection, set: (v: RideDirection) => void)}
  {@const DirIcon = DIRECTION_ICON[value]}
  <div class="flex flex-col gap-1.5">
    <Label for={id}>Direction</Label>
    <Select.Root type="single" {value} onValueChange={(v) => set(v as RideDirection)}>
      <Select.Trigger {id} aria-label="Direction" class="w-full">
        <span class="inline-flex min-w-0 items-center gap-1.5">
          <DirIcon class="size-3.5 shrink-0" />
          <span class="min-w-0 truncate text-xs">{RIDE_DIRECTION_LABELS[value]}</span>
        </span>
      </Select.Trigger>
      <Select.Content>
        {#each RIDE_DIRECTIONS as direction (direction)}
          {@const ItemIcon = DIRECTION_ICON[direction]}
          <Select.Item value={direction} label={RIDE_DIRECTION_LABELS[direction]}>
            <span class="inline-flex items-center gap-2">
              <ItemIcon class="size-3.5" />
              {RIDE_DIRECTION_LABELS[direction]}
            </span>
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <input type="hidden" name="direction" {value} />
  </div>
{/snippet}

<div class="flex flex-col gap-8">
  <div class="max-md:text-center">
    <h1 class="text-2xl font-semibold tracking-tight">Expenses</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Work-related costs — rides and meals, for now. The dashboard can fold these into the hours to make up.
    </p>
  </div>

  <!-- add form -->
  <Card.Root>
    <Card.Header class="max-md:text-center">
      <Card.Title>Add an expense</Card.Title>
    </Card.Header>
    <Card.Content>
      <form
        method="POST"
        action="?/add"
        use:enhance={expenseEnhance('add', () => (addDate = todayISO()))}
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:items-end {addKind === 'other'
          ? 'lg:grid-cols-[10rem_8rem_8rem_1fr_auto]'
          : addKind === 'purchase' && addVendor !== 'subscription'
            ? 'lg:grid-cols-[9.5rem_7rem_8rem_7rem_1fr_auto]'
            : 'lg:grid-cols-[9rem_6.5rem_7.5rem_7.5rem_6.5rem_1fr_auto]'}"
      >
        <div class="flex flex-col gap-1.5">
          <Label for="expense-date">Date</Label>
          <DateField id="expense-date" name="date" bind:value={addDate} min={data.epoch} />
        </div>
        {@render kindSelect('expense-kind', addKind, (v) => {
          addKind = v;
          ({ vendor: addVendor, direction: addDirection, method: addMethod, cadence: addCadence } = detailDefaults(v));
        })}
        {#if addKind === 'ride'}
          {@render vendorSelect('expense-vendor', 'ride', addVendor, (v) => (addVendor = v))}
          {@render directionSelect('expense-direction', addDirection, (v) => (addDirection = v))}
        {:else if addKind === 'meal'}
          {@render vendorSelect('expense-vendor', 'meal', addVendor, (v) => {
            addVendor = v;
            addMethod = v === 'restaurant' ? 'dine_in' : coerceMethod(v, addMethod);
          })}
          {@render methodSelect('expense-method', addVendor, addMethod, (v) => (addMethod = v))}
        {:else if addKind === 'purchase'}
          {@render vendorSelect('expense-vendor', 'purchase', addVendor, (v) => (addVendor = v))}
          {#if addVendor === 'subscription'}
            {@render cadenceSelect('expense-cadence', addCadence, (v) => (addCadence = v))}
          {/if}
        {/if}
        <div class="flex flex-col gap-1.5">
          <Label for="expense-amount">Amount (USD)</Label>
          <Input id="expense-amount" type="number" name="amount" step="0.01" min="0.01" placeholder="18.50" required />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="expense-note">Note</Label>
          <Input id="expense-note" type="text" name="note" maxlength={500} placeholder="Uber to the office" />
        </div>
        <Button type="submit" disabled={submitting} class="max-sm:w-full">
          <Plus class="size-4" /> Add
        </Button>
      </form>
      {#if actionData && 'expenseError' in actionData && actionData.expenseError}
        <p class="mt-3 text-sm text-destructive">{actionData.expenseError}</p>
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
          <Button {...props} variant="outline" size="lg" class="shrink-0" onclick={() => (anchor = todayISO())}>
            <CalendarCheck class="size-4" /> Today
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>Jump back to the current period</Tooltip.Content>
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
        <p class="py-8 text-center text-sm text-muted-foreground">No expenses this period.</p>
      {:else}
        <ul class="divide-y divide-border/50">
          {#each inBucket as e (e.id)}
            {@const BadgeIcon = e.vendor ? VENDOR_ICON[e.vendor] : KIND_ICON[e.kind]}
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm">
              <span class="w-14 font-mono text-xs uppercase tabular-nums">{formatDay(e.date)}</span>
              <span
                class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ring-1 {EXPENSE_META[
                  e.kind
                ].badgeClass}"
              >
                <BadgeIcon class="size-3 {e.vendor ? MARK_CLASS[e.vendor] : ''}" />
                {badgeLabel(e)}
              </span>
              {#if e.direction && e.direction !== 'other'}
                {@const DirIcon = DIRECTION_ICON[e.direction]}
                <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <DirIcon class="size-3.5" />
                  {RIDE_DIRECTION_LABELS[e.direction].toLowerCase()}
                </span>
              {/if}
              {#if e.method}
                {@const MethodIcon = METHOD_ICON[e.method]}
                <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MethodIcon class="size-3.5" />
                  {MEAL_METHOD_LABELS[e.method].toLowerCase()}
                </span>
              {/if}
              {#if e.cadence}
                <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw class="size-3.5" />
                  {PURCHASE_CADENCE_LABELS[e.cadence].toLowerCase()}
                </span>
              {/if}
              {#if e.note}<span class="max-w-56 truncate text-xs text-muted-foreground">{e.note}</span>{/if}
              <span class="ml-auto font-mono tabular-nums">{money.format(e.amount)}</span>
              <span class="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Edit expense"
                  aria-label="Edit expense"
                  onclick={() => {
                    const defaults = detailDefaults(e.kind);
                    editKind = e.kind;
                    editVendor = e.vendor ?? defaults.vendor;
                    editDirection = e.direction ?? defaults.direction;
                    editMethod = e.method ?? defaults.method;
                    editCadence = e.cadence ?? defaults.cadence;
                    editing = e;
                  }}
                >
                  <Pencil class="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete expense"
                  aria-label="Delete expense"
                  class="text-destructive hover:text-destructive"
                  onclick={() => (deleting = e)}
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
    <a href="/settings/audit" class="underline underline-offset-2 hover:text-foreground">audit log</a>. Bonus tracking
    is planned.
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
        <Dialog.Title>Edit expense</Dialog.Title>
      </Dialog.Header>
      <form
        method="POST"
        action="?/update"
        use:enhance={expenseEnhance('update', () => (editing = null))}
        class="flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={editing.id} />
        <div class="flex flex-col gap-1.5">
          <Label for="edit-expense-date">Date</Label>
          <DateField id="edit-expense-date" name="date" value={editing.date} min={data.epoch} />
        </div>
        {@render kindSelect('edit-expense-kind', editKind, (v) => {
          editKind = v;
          ({ vendor: editVendor, direction: editDirection, method: editMethod, cadence: editCadence } =
            detailDefaults(v));
        })}
        {#if editKind === 'ride'}
          {@render vendorSelect('edit-expense-vendor', 'ride', editVendor, (v) => (editVendor = v))}
          {@render directionSelect('edit-expense-direction', editDirection, (v) => (editDirection = v))}
        {:else if editKind === 'meal'}
          {@render vendorSelect('edit-expense-vendor', 'meal', editVendor, (v) => {
            editVendor = v;
            editMethod = v === 'restaurant' ? 'dine_in' : coerceMethod(v, editMethod);
          })}
          {@render methodSelect('edit-expense-method', editVendor, editMethod, (v) => (editMethod = v))}
        {:else if editKind === 'purchase'}
          {@render vendorSelect('edit-expense-vendor', 'purchase', editVendor, (v) => (editVendor = v))}
          {#if editVendor === 'subscription'}
            {@render cadenceSelect('edit-expense-cadence', editCadence, (v) => (editCadence = v))}
          {/if}
        {/if}
        <div class="flex flex-col gap-1.5">
          <Label for="edit-expense-amount">Amount (USD)</Label>
          <Input
            id="edit-expense-amount"
            type="number"
            name="amount"
            step="0.01"
            min="0.01"
            value={editing.amount}
            required
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="edit-expense-note">Note</Label>
          <Input id="edit-expense-note" type="text" name="note" maxlength={500} value={editing.note ?? ''} />
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
        <Dialog.Title>Delete this expense?</Dialog.Title>
        <Dialog.Description>
          {formatDay(deleting.date)} · {badgeLabel(deleting)} · {money.format(deleting.amount)}
          {#if deleting.note}
            · {deleting.note}
          {/if}
        </Dialog.Description>
      </Dialog.Header>
      <form method="POST" action="?/delete" use:enhance={expenseEnhance('delete', () => (deleting = null))}>
        <input type="hidden" name="id" value={deleting.id} />
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (deleting = null)}>Cancel</Button>
          <Button type="submit" variant="destructive" disabled={submitting}>Delete</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>
